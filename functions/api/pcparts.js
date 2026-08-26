/**
 * Cloudflare Pages Function: PRIVATE PC component price report.
 *
 *   GET  /api/pcparts   -> the price report JSON, but ONLY with the correct passkey
 *                          in the `x-pcparts-key` header. No key / wrong key => 401.
 *   POST /api/pcparts   -> the local alerter publishes the report (auth: x-write-key).
 *
 * Backed by KV (binding PCPARTS) on the shared namespace under its own key. The
 * alerter polls hourly, so ~24 writes/day — well inside KV's 1,000/day free cap.
 *
 * SECRETS — set via the dashboard or wrangler, NEVER committed:
 *   wrangler pages secret put PCPARTS_KEY        # the passkey you type (gates GET)
 *   wrangler pages secret put PCPARTS_WRITE_KEY  # random; the alerter sends it
 *
 * Same shape as /api/homefinder, deliberately: one gate pattern to reason about.
 * The report is NOT edge-cached — private, so the key is re-checked every request.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-write-key,x-pcparts-key",
};
const KV_KEY = "pcparts_report";
const KV_REFRESH = "pcparts_refresh_req";   // ISO stamp of the last "Refresh" press

// constant-time-ish compare so a wrong key can't be timed out character by character
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Accept any configured passkey: PCPARTS_KEY (which may itself be a comma-separated
// list) plus an optional per-person PCPARTS_KEY_MOM. Values live ONLY in Cloudflare
// env — never in this repo.
function keyOk(env, supplied) {
  const cands = [];
  if (env.PCPARTS_KEY) for (const k of String(env.PCPARTS_KEY).split(",")) { const t = k.trim(); if (t) cands.push(t); }
  if (env.PCPARTS_KEY_MOM) { const t = String(env.PCPARTS_KEY_MOM).trim(); if (t) cands.push(t); }
  return cands.some((k) => safeEqual(supplied, k));
}

function json(body, status, extraHeaders = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store", ...extraHeaders },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  if (!env.PCPARTS_KEY && !env.PCPARTS_KEY_MOM) return json({ error: "not-configured" }, 503);
  const supplied = request.headers.get("x-pcparts-key") || "";
  if (!keyOk(env, supplied)) return json({ error: "unauthorized" }, 401);
  if (!env.PCPARTS) return json({ error: "kv-not-bound" }, 500);

  const data = await env.PCPARTS.get(KV_KEY);
  if (!data) return json({ error: "no-report-yet" }, 200);

  const refreshReq = await env.PCPARTS.get(KV_REFRESH);
  let out = data;
  try {
    const obj = JSON.parse(data);
    obj.refresh_req = refreshReq || null;
    obj.refresh_state =
      refreshReq && (!obj.generated || refreshReq > obj.generated) ? "running" : "idle";
    out = JSON.stringify(obj);
  } catch { /* serve raw if it somehow isn't valid JSON */ }

  return new Response(out, {
    status: 200,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.PCPARTS) return new Response("kv-not-bound", { status: 500, headers: CORS });
  const text = await request.text();

  // A passkey-holder pressing "Refresh" — record it; the home PC's next cycle
  // picks it up and re-scrapes. Auth here is the PASSKEY, not the write key.
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON, or the full report */ }
  if (body && body.action === "request_refresh") {
    const pass = request.headers.get("x-pcparts-key") || "";
    if (!keyOk(env, pass)) return json({ error: "unauthorized" }, 401);
    await env.PCPARTS.put(KV_REFRESH, new Date().toISOString());
    return json({ ok: true, requested: true }, 200);
  }

  // Otherwise this is the local alerter publishing (auth: write key).
  const key = request.headers.get("x-write-key") || "";
  if (!env.PCPARTS_WRITE_KEY || !safeEqual(key, env.PCPARTS_WRITE_KEY)) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }
  try {
    JSON.parse(text); // validate before storing
  } catch {
    return new Response("bad-json", { status: 400, headers: CORS });
  }
  await env.PCPARTS.put(KV_KEY, text);
  return json({ ok: true, bytes: text.length }, 200);
}
