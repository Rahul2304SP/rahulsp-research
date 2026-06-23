/**
 * Cloudflare Pages Function: relay for the live World Money-Flow map.
 *
 *   GET  /api/moneyflow            -> latest LIVE slice (today's per-minute fused flows)   [k=live]
 *   GET  /api/moneyflow?k=history  -> the daily HISTORY blob (scrubber timeline)
 *   POST /api/moneyflow            -> the local emitter publishes a slice (auth: x-write-key) [?k=live|history]
 *
 * Backed by R2 (binding MONEYFLOW), NOT KV: the emitter overwrites `live` every ~60s (~43k writes/mo),
 * which is trivial for R2's 1M/mo free cap but would blow KV's 1,000/day. Reads are edge-cached
 * (s-maxage), so R2 Class-B reads stay tiny no matter how many visitors poll.
 *
 * One-time setup (operator):
 *   1. R2 bucket `moneyflow` created; binding MONEYFLOW declared in wrangler.toml (done).
 *   2. Secret MONEYFLOW_WRITE_KEY set via `wrangler pages secret put MONEYFLOW_WRITE_KEY`
 *      (or Pages dashboard env vars). The emitter sends the same string in the x-write-key header.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-write-key",
};

// live data is minute-fresh; history changes ~daily. Cache at the edge so R2 is barely touched.
const TTL = { live: 50, history: 3600 };

function keyOf(url) {
  const k = new URL(url).searchParams.get("k") || "live";
  return k === "history" ? "history" : "live";
}

function err(body, status) {
  return new Response(JSON.stringify({ error: body }), {
    status,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  if (!env.MONEYFLOW) return err("r2-not-bound", 200);
  const k = keyOf(request.url);
  const obj = await env.MONEYFLOW.get(k);
  if (!obj) return err("no-data-yet", 200);
  const ttl = TTL[k];
  return new Response(obj.body, {
    status: 200,
    headers: {
      ...CORS,
      "content-type": "application/json",
      "cache-control": `public, max-age=${ttl}, s-maxage=${ttl}`,
    },
  });
}

export async function onRequestPost({ request, env }) {
  const key = request.headers.get("x-write-key") || "";
  if (!env.MONEYFLOW_WRITE_KEY || key !== env.MONEYFLOW_WRITE_KEY) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }
  if (!env.MONEYFLOW) return new Response("r2-not-bound", { status: 500, headers: CORS });
  const k = keyOf(request.url);
  let text;
  try {
    text = await request.text();
    JSON.parse(text); // validate it's JSON before storing
  } catch {
    return new Response("bad-json", { status: 400, headers: CORS });
  }
  await env.MONEYFLOW.put(k, text, {
    httpMetadata: { contentType: "application/json" },
  });
  return new Response("ok", { status: 200, headers: CORS });
}
