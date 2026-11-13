/**
 * Cloudflare Pages Function: PRIVATE resale deals report (the locked /deals page).
 *
 *   GET  /api/resale   -> the latest report JSON, but ONLY with the correct passkey in
 *                         the `x-resale-key` header. No key / wrong key => 401.
 *   POST /api/resale   -> the home PC publishes the report (auth: x-write-key).
 *
 * Backed by KV: binding RESALE, or PCPARTS if RESALE is not declared (same shared
 * namespace), under its own key. The home PC posts once per ~90 minute check, so
 * ~16 writes/day, well inside KV's 1,000/day free cap.
 *
 * SECRETS: set via the dashboard or wrangler, NEVER committed. No value appears here.
 *   wrangler pages secret put RESALE_KEY         # the passkey you type (gates GET);
 *                                                # may be a comma-separated list
 *   wrangler pages secret put RESALE_WRITE_KEY   # OPTIONAL. If unset, writes reuse
 *                                                # PCPARTS_WRITE_KEY (already in place)
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
const MAX_BODY = 500000;   // characters; the publisher keeps well under this

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

function json(body, status, extraHeaders = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store", ...extraHeaders },
  });
}

function store(env) {
  return env.RESALE || env.PCPARTS || null;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const cands = passkeys(env);
  if (cands.length === 0) return json({ error: "not-configured" }, 503);
  const supplied = request.headers.get("x-resale-key") || "";
  if (!cands.some((k) => safeEqual(supplied, k))) return json({ error: "unauthorized" }, 401);
  const kv = store(env);
  if (!kv) return json({ error: "kv-not-bound" }, 500);

  const data = await kv.get(KV_KEY);
  if (!data) return json({ error: "no-report-yet" }, 200);
  return new Response(data, {
    status: 200,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  // Auth: RESALE_WRITE_KEY if it is set, otherwise the existing PCPARTS_WRITE_KEY.
  const writeKey = env.RESALE_WRITE_KEY ? env.RESALE_WRITE_KEY : env.PCPARTS_WRITE_KEY;
  const key = request.headers.get("x-write-key") || "";
  if (!writeKey || !safeEqual(key, String(writeKey))) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }
  const kv = store(env);
  if (!kv) return new Response("kv-not-bound", { status: 500, headers: CORS });

  const text = await request.text();
  if (text.length > MAX_BODY) return new Response("too-large", { status: 413, headers: CORS });
  try {
    JSON.parse(text); // validate before storing
  } catch {
    return new Response("bad-json", { status: 400, headers: CORS });
  }
  await kv.put(KV_KEY, text);
  return json({ ok: true, bytes: text.length }, 200);
}
