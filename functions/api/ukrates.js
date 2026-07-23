/**
 * Cloudflare Pages Function: relay for the UK Rate Watch tool.
 *
 *   GET  /api/ukrates   -> latest UK rates snapshot JSON (public, CORS-open)
 *   POST /api/ukrates   -> the local monitor publishes a snapshot (auth: x-write-key)
 *
 * The local mortgage monitor (Data Scraper/Economic Data/UK/mortgage_monitor.py --post)
 * refreshes the UK macro panel from BoE/ONS sources a few times a day and POSTs the
 * distilled snapshot here; the public page polls GET. Writes are ~4/day — far under
 * the KV 1,000/day cap, so this reuses the shared KV namespace under its own key
 * (same pattern as /api/gpr and /api/homefinder).
 *
 * One-time setup (operator):
 *   1. wrangler.toml binds the shared KV namespace as  UKRATES
 *   2. Secret  UKRATES_WRITE_KEY  set via `wrangler pages secret put` (never committed);
 *      the monitor sends the same string in the  x-write-key  header.
 *
 * Snapshot contract: see build_payload() in mortgage_monitor.py (schema 1) —
 * bank_rate, sonia, cpi/core/wages prints, ois_curve spots + forward_path,
 * swap2y_live_est, gilt5y/gilt10y daily (+ sparkline), next_events, flags.
 */

const KEY = "ukrates_latest";

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

function kv(env) {
  return env.UKRATES || env.US30VOL || null;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  const ns = kv(env);
  if (!ns) return json({ error: "kv-not-bound" }, 200);
  const v = await ns.get(KEY);
  if (!v) return json({ error: "no-data-yet" }, 200);
  return new Response(v, {
    status: 200,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  const key = request.headers.get("x-write-key") || "";
  if (!env.UKRATES_WRITE_KEY || key !== env.UKRATES_WRITE_KEY) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }
  let b;
  try {
    b = await request.json();
  } catch {
    return new Response("bad-json", { status: 400, headers: CORS });
  }
  // minimal sanity: the numbers the page cannot render without
  if (typeof b.bank_rate !== "number" || !Array.isArray(b.forward_path)) {
    return new Response("bad-payload", { status: 400, headers: CORS });
  }
  b.schema = 1;
  b.received_utc = new Date().toISOString();
  const ns = kv(env);
  if (!ns) return new Response("kv-not-bound", { status: 500, headers: CORS });
  // 14-day TTL: the feed is daily-cadence; the page banners staleness after ~4 days,
  // and a dead monitor eventually reads as "no-data-yet" rather than serving forever.
  await ns.put(KEY, JSON.stringify(b), { expirationTtl: 1209600 });
  return new Response("ok", { status: 200, headers: CORS });
}
