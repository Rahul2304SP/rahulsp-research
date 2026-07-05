/**
 * Cloudflare Pages Function: on-demand "value a pasted listing URL".
 *
 * The private HomeFinder page lets you paste a Rightmove / Zoopla / Richard James
 * / Charles Harding / Miles & Byron link and get a full report. The valuation
 * BRAIN lives on the local PC (comps + AVM + floor-plan OCR + compass + condition
 * + GPU), so this endpoint is just a tiny relay between the page and that PC:
 *
 *   POST {url}            (auth: passkey)   -> queue the URL, returns {id}
 *   GET  ?id=<id>         (auth: passkey)   -> {status:"pending"} | {status:"done", record}
 *   GET  ?pending=1       (auth: write key) -> {job:{id,url,ts}|null}  (local worker pulls the job)
 *   POST {id, record}     (auth: write key) -> local worker posts the finished report back
 *
 * Backed by KV (binding HOMEFINDER). ~2 writes per paste — far under the free cap.
 * Same secrets as /api/homefinder (HOMEFINDER_KEY passkey, HOMEFINDER_WRITE_KEY).
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-write-key,x-homefinder-key",
};
const REQ_KEY = "hf_value_req";            // latest pending job {id,url,ts}
const RESULT_PREFIX = "hf_value_result:";  // + id -> finished record JSON

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Accept the primary HOMEFINDER_KEY (optionally comma-separated) plus an optional
// per-person key like HOMEFINDER_KEY_MOM. Same set the report page uses.
function keyOk(env, supplied) {
  const cands = [];
  if (env.HOMEFINDER_KEY) for (const k of String(env.HOMEFINDER_KEY).split(",")) { const t = k.trim(); if (t) cands.push(t); }
  if (env.HOMEFINDER_KEY_MOM) { const t = String(env.HOMEFINDER_KEY_MOM).trim(); if (t) cands.push(t); }
  return cands.some((k) => safeEqual(supplied, k));
}
function json(body, status, extra = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store", ...extra },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  if (!env.HOMEFINDER) return json({ error: "kv-not-bound" }, 500);
  const text = await request.text();
  let body = null;
  try { body = JSON.parse(text); } catch { return json({ error: "bad-json" }, 400); }
  if (!body) return json({ error: "bad-request" }, 400);

  // (A) local worker posting a finished RESULT — auth: write key
  if (body.id && body.record !== undefined) {
    const key = request.headers.get("x-write-key") || "";
    if (!env.HOMEFINDER_WRITE_KEY || !safeEqual(key, env.HOMEFINDER_WRITE_KEY)) {
      return json({ error: "forbidden" }, 403);
    }
    await env.HOMEFINDER.put(RESULT_PREFIX + String(body.id).slice(0, 40),
      JSON.stringify(body.record), { expirationTtl: 3600 });
    return json({ ok: true }, 200);
  }

  // (B) page enqueuing a URL to value — auth: passkey
  if (body.url) {
    const pass = request.headers.get("x-homefinder-key") || "";
    if (!keyOk(env, pass)) {
      return json({ error: "unauthorized" }, 401);
    }
    const url = String(body.url).trim().slice(0, 600);
    if (!/^https?:\/\/[^ ]+$/.test(url)) return json({ error: "not a valid link" }, 400);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await env.HOMEFINDER.put(REQ_KEY, JSON.stringify({ id, url, ts: new Date().toISOString() }),
      { expirationTtl: 900 });
    return json({ ok: true, id }, 200);
  }
  return json({ error: "bad-request" }, 400);
}

export async function onRequestGet({ request, env }) {
  if (!env.HOMEFINDER) return json({ error: "kv-not-bound" }, 500);
  const params = new URL(request.url).searchParams;

  // (C) local worker pulling the pending job — auth: write key
  if (params.get("pending")) {
    const key = request.headers.get("x-write-key") || "";
    if (!env.HOMEFINDER_WRITE_KEY || !safeEqual(key, env.HOMEFINDER_WRITE_KEY)) {
      return json({ error: "forbidden" }, 403);
    }
    const req = await env.HOMEFINDER.get(REQ_KEY);
    return json({ job: req ? JSON.parse(req) : null }, 200);
  }

  // (D) page polling for a result — auth: passkey
  const id = params.get("id");
  if (id) {
    const pass = request.headers.get("x-homefinder-key") || "";
    if (!keyOk(env, pass)) {
      return json({ error: "unauthorized" }, 401);
    }
    const res = await env.HOMEFINDER.get(RESULT_PREFIX + String(id).slice(0, 40));
    return json(res ? { status: "done", record: JSON.parse(res) } : { status: "pending" }, 200);
  }
  return json({ error: "bad-request" }, 400);
}
