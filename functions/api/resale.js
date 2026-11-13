/**
 * Cloudflare Pages Function: PRIVATE resale deals report (the locked /deals page).
 *
 *   GET  /api/resale          -> the report JSON, but ONLY with the correct passkey in
 *                                the `x-resale-key` header. No key / wrong key => 401.
 *                                The answer also carries `scan_req` (when "Scan now" was
 *                                last pressed) and `scan_status` (what the home PC said
 *                                about that scan), so the page can show progress.
 *   GET  /api/resale?poll=1   -> for the home PC only (auth: x-write-key): just
 *                                {"scan_req": "<ISO time>" | null}. It asks this every
 *                                half minute to learn that "Scan now" was pressed.
 *   POST /api/resale          -> three kinds of body:
 *        {"action":"request_scan"}   from the page (auth: x-resale-key): records the
 *                                    press. A press within 3 minutes of the last one is
 *                                    folded into it: each scan costs eBay calls from a
 *                                    daily allowance and a few KV writes from a shared
 *                                    1,000 a day, so the button has a cooldown.
 *        {"action":"scan_status",..} from the home PC (auth: x-write-key): "running",
 *                                    "done" or "failed" for the scan it picked up.
 *        anything else               the home PC publishing the report (auth: x-write-key).
 *
 * Backed by KV (binding RESALE, or PCPARTS on the same shared namespace) under its own
 * keys. The home PC posts about every 90 minutes plus once per button scan, well inside
 * KV's 1,000 writes/day free cap; the half-minute poll is a read (100,000/day free).
 *
 * SECRETS: set by the owner in the Cloudflare dashboard or with wrangler, NEVER committed:
 *   wrangler pages secret put RESALE_KEY   # the passkey typed on the page; may be a
 *                                          # comma-separated list
 * Writes reuse the existing PCPARTS_WRITE_KEY secret, so no new write secret is needed.
 * An optional RESALE_WRITE_KEY, if it is ever set, takes precedence for writes.
 *
 * Same shape as /api/pcparts, deliberately: one gate pattern to reason about. The
 * report is NOT edge-cached: it is private, so the key is re-checked every request.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-write-key,x-resale-key",
};
const KV_KEY = "resale_report";
const KV_SCAN_REQ = "resale_scan_req";        // ISO stamp of the last "Scan now" press
const KV_SCAN_STATUS = "resale_scan_status";  // small JSON from the home PC about that scan
const MAX_BODY = 500000;   // characters; the publisher keeps well under this
const MAX_STATUS = 2000;   // characters; a scan status is a few short fields
const PRESS_FOLD_MS = 180000;   // the page shows the same 3 minute cooldown

// constant-time-ish compare so a wrong key can't be timed out character by character
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Every configured passkey: RESALE_KEY, which may itself be a comma-separated list.
// Values live ONLY in Cloudflare env, never in this repo.
function passkeys(env) {
  const cands = [];
  if (env.RESALE_KEY) for (const k of String(env.RESALE_KEY).split(",")) { const t = k.trim(); if (t) cands.push(t); }
  return cands;
}

function passOk(env, request) {
  const supplied = request.headers.get("x-resale-key") || "";
  return passkeys(env).some((k) => safeEqual(supplied, k));
}

// RESALE_WRITE_KEY if it is set, otherwise the existing PCPARTS_WRITE_KEY.
function writeOk(env, request) {
  const writeKey = env.RESALE_WRITE_KEY ? env.RESALE_WRITE_KEY : env.PCPARTS_WRITE_KEY;
  const key = request.headers.get("x-write-key") || "";
  return !!writeKey && safeEqual(key, String(writeKey));
}

function json(body, status, extraHeaders = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store", ...extraHeaders },
  });
}

function store(env) {
  return env.RESALE || env.PCPARTS || null;
}

function parseStatus(raw) {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" && !Array.isArray(o) ? o : null;
  } catch { return null; }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const kv = store(env);

  // The home PC asking whether "Scan now" was pressed. Auth is the WRITE key: the
  // passkey must never be needed on the home PC.
  if (new URL(request.url).searchParams.get("poll") === "1") {
    if (!writeOk(env, request)) return new Response("forbidden", { status: 403, headers: CORS });
    if (!kv) return json({ error: "kv-not-bound" }, 500);
    return json({ scan_req: (await kv.get(KV_SCAN_REQ)) || null }, 200);
  }

  if (passkeys(env).length === 0) return json({ error: "not-configured" }, 503);
  if (!passOk(env, request)) return json({ error: "unauthorized" }, 401);
  if (!kv) return json({ error: "kv-not-bound" }, 500);

  const [data, scanReq, scanStatus] = await Promise.all([
    kv.get(KV_KEY), kv.get(KV_SCAN_REQ), kv.get(KV_SCAN_STATUS),
  ]);
  const extra = { scan_req: scanReq || null, scan_status: parseStatus(scanStatus) };
  if (!data) return json({ error: "no-report-yet", ...extra }, 200);
  let out = data;
  try {
    const obj = JSON.parse(data);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) out = JSON.stringify({ ...obj, ...extra });
  } catch { /* serve it raw if it somehow is not valid JSON */ }
  return new Response(out, {
    status: 200,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  const text = await request.text();
  if (text.length > MAX_BODY) return new Response("too-large", { status: 413, headers: CORS });
  let body = null;
  try { body = JSON.parse(text); } catch { /* handled below, after the auth check */ }
  const action = body && typeof body === "object" && !Array.isArray(body) ? body.action : undefined;

  // "Scan now" on the page. Auth here is the PASSKEY, not the write key.
  if (action === "request_scan") {
    if (passkeys(env).length === 0) return json({ error: "not-configured" }, 503);
    if (!passOk(env, request)) return json({ error: "unauthorized" }, 401);
    const kv = store(env);
    if (!kv) return json({ error: "kv-not-bound" }, 500);
    const last = await kv.get(KV_SCAN_REQ);
    const lastMs = last ? Date.parse(last) : NaN;
    if (Number.isFinite(lastMs) && Date.now() - lastMs < PRESS_FOLD_MS) {
      return json({ ok: true, requested: false, scan_req: last }, 200);
    }
    const stamp = new Date().toISOString();
    await kv.put(KV_SCAN_REQ, stamp);
    return json({ ok: true, requested: true, scan_req: stamp }, 200);
  }

  // Everything else comes from the home PC (auth: write key).
  if (!writeOk(env, request)) return new Response("forbidden", { status: 403, headers: CORS });
  const kv = store(env);
  if (!kv) return new Response("kv-not-bound", { status: 500, headers: CORS });
  if (body === null) return new Response("bad-json", { status: 400, headers: CORS });

  if (action === "scan_status") {
    const state = body.state;
    if (state !== "running" && state !== "done" && state !== "failed") {
      return new Response("bad-status", { status: 400, headers: CORS });
    }
    const rec = {
      state,
      req: typeof body.req === "string" ? body.req.slice(0, 40) : null,
      ts: new Date().toISOString(),
      note: typeof body.note === "string" ? body.note.slice(0, 300) : "",
    };
    const out = JSON.stringify(rec);
    if (out.length > MAX_STATUS) return new Response("too-large", { status: 413, headers: CORS });
    await kv.put(KV_SCAN_STATUS, out);
    return json({ ok: true }, 200);
  }

  await kv.put(KV_KEY, text);
  return json({ ok: true, bytes: text.length }, 200);
}
