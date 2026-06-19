/**
 * Cloudflare Pages Function: relay for the live US30 forward-60-min volatility forecast.
 *
 *   GET  /api/us30vol   -> returns the latest snapshot JSON (public, CORS-open, no-store)
 *   POST /api/us30vol   -> the local emitter publishes a new snapshot (auth: x-write-key)
 *
 * The local emitter (running beside the US30 daemon) runs the US30 LGB fvol60 model on the
 * live feature frame each minute and POSTs the result here; the public gauge page polls GET.
 * The PC is never exposed: it only pushes outward to this endpoint.
 *
 * One-time setup (operator, in the Cloudflare Pages project for rahulsp-research):
 *   1. Create a KV namespace, bind it to this Pages project with the variable name  US30VOL
 *   2. Add an environment variable / secret  US30VOL_WRITE_KEY  (a long random string)
 *   The emitter sends that same string in the  x-write-key  header.
 *
 * Snapshot contract (what GET returns / POST accepts):
 *   {
 *     schema: 1,
 *     as_of_utc: "2026-06-19T14:32:00Z",   // when the model produced it
 *     symbol: "US30",
 *     model: "US30 LGB fvol60",
 *     price: 42180.0,                       // current US30 level
 *     horizon_min: 60,
 *     sigma_pts: 168.0,                     // forecast 1-sigma move over next 60 min, in points
 *     sigma_pct: 0.00398,                   // = sigma_pts / price
 *     range_low: 42012.0,                   // price - sigma_pts (68% band)
 *     range_high: 42348.0,                  // price + sigma_pts
 *     regime: "elevated",                   // calm | normal | elevated | extreme (set by emitter)
 *     market_open: true
 *   }
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-write-key",
};

function json(body, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  if (!env.US30VOL) return json({ error: "kv-not-bound" }, 200);
  const v = await env.US30VOL.get("latest");
  if (!v) return json({ error: "no-data-yet" }, 200);
  return new Response(v, {
    status: 200,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  const key = request.headers.get("x-write-key") || "";
  if (!env.US30VOL_WRITE_KEY || key !== env.US30VOL_WRITE_KEY) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }
  let b;
  try {
    b = await request.json();
  } catch {
    return new Response("bad-json", { status: 400, headers: CORS });
  }
  // minimal sanity: the two numbers the page cannot render without
  if (typeof b.price !== "number" || typeof b.sigma_pts !== "number") {
    return new Response("bad-payload", { status: 400, headers: CORS });
  }
  b.schema = 1;
  b.received_utc = new Date().toISOString();
  if (!env.US30VOL) return new Response("kv-not-bound", { status: 500, headers: CORS });
  // keep 25h so a dead emitter shows as stale rather than serving ancient data forever
  await env.US30VOL.put("latest", JSON.stringify(b), { expirationTtl: 90000 });
  return new Response("ok", { status: 200, headers: CORS });
}
