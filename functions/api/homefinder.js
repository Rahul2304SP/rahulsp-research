/**
 * Cloudflare Pages Function: PRIVATE property valuation report ("HomeFinder").
 *
 *   GET  /api/homefinder   -> the valuation report JSON, but ONLY with the correct
 *                             passkey in the `x-homefinder-key` header. No key / wrong
 *                             key => 401. This is the gate for the private page.
 *   POST /api/homefinder   -> the local emitter publishes the report (auth: x-write-key).
 *
 * Backed by KV (binding HOMEFINDER) — the report updates infrequently (manual / weekly),
 * so it's well under KV's 1,000 writes/day free cap.
 *
 * SECRETS — set via the dashboard or wrangler, NEVER committed:
 *   wrangler pages secret put HOMEFINDER_KEY        # the passkey users type (set your own value)
 *   wrangler pages secret put HOMEFINDER_WRITE_KEY  # random; the emitter sends it in x-write-key
 *
 * The report is NOT edge-cached (private, must re-check the key every request).
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-write-key,x-homefinder-key",
};
const KV_KEY = "homefinder_report";
const KV_REFRESH = "homefinder_refresh_req";   // ISO timestamp of the last "Refresh" button press

// constant-time-ish string compare so a wrong key can't be timed out character by character
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
  if (!env.HOMEFINDER_KEY) return json({ error: "not-configured" }, 503);
  const supplied = request.headers.get("x-homefinder-key") || "";
  if (!safeEqual(supplied, env.HOMEFINDER_KEY)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.HOMEFINDER) return json({ error: "kv-not-bound" }, 500);
  const data = await env.HOMEFINDER.get(KV_KEY);
  if (!data) return json({ error: "no-report-yet" }, 200);
  // merge in the refresh request state so the page (and the local poller) can tell
  // whether a re-scrape was requested but not yet published.
  const refreshReq = await env.HOMEFINDER.get(KV_REFRESH);
  let out = data;
  try {
    const obj = JSON.parse(data);
    obj.refresh_req = refreshReq || null;
    obj.refresh_state = refreshReq && (!obj.generated || refreshReq > obj.generated) ? "running" : "idle";
    out = JSON.stringify(obj);
  } catch { /* serve raw if it somehow isn't valid JSON */ }
  return new Response(out, {
    status: 200,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.HOMEFINDER) return new Response("kv-not-bound", { status: 500, headers: CORS });
  const text = await request.text();

  // A passkey-holder pressing "Refresh data" — record the request (the local PC
  // poller picks it up and re-scrapes). Auth is the PASSKEY, not the write key.
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON / huge report */ }
  if (body && body.action === "request_refresh") {
    const pass = request.headers.get("x-homefinder-key") || "";
    if (!env.HOMEFINDER_KEY || !safeEqual(pass, env.HOMEFINDER_KEY)) {
      return json({ error: "unauthorized" }, 401);
    }
    await env.HOMEFINDER.put(KV_REFRESH, new Date().toISOString());
    return json({ ok: true, requested: true }, 200);
  }

  // Otherwise this is the local emitter publishing the report (auth: write key).
  const key = request.headers.get("x-write-key") || "";
  if (!env.HOMEFINDER_WRITE_KEY || !safeEqual(key, env.HOMEFINDER_WRITE_KEY)) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }
  try {
    JSON.parse(text); // validate JSON before storing
  } catch {
    return new Response("bad-json", { status: 400, headers: CORS });
  }
  await env.HOMEFINDER.put(KV_KEY, text);
  return json({ ok: true, bytes: text.length }, 200);
}
