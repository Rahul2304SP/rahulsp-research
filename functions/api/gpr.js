/**
 * Cloudflare Pages Function: relay for the live World Tension geopolitical-risk gauge (v2 GPR).
 *
 *   GET  /api/gpr   -> latest snapshot JSON (public, CORS-open, no-store)
 *   POST /api/gpr   -> the local gpr_emitter publishes a new snapshot (auth: x-write-key)
 *
 * Shares the existing KV namespace with the volatility relay (distinct key "gpr_latest"), so no new
 * namespace is required: it prefers an env.GPR binding if present, else falls back to env.US30VOL.
 * The write key likewise accepts GPR_WRITE_KEY or the shared US30VOL_WRITE_KEY.
 *
 * Snapshot contract (what the World Tension page consumes):
 *   {
 *     schema: 1,
 *     as_of_utc: "2026-06-22T22:00:00Z",
 *     level: 224,                 // CI-anchored level (100 = long-run average)
 *     label: "Severe",
 *     percentile_90d: 52,
 *     trend_30d: [ ... ],         // 30 daily values
 *     drivers: [{name, share}],   // top category mix, last 24h
 *     context_median: 92,
 *     peak_value: 1046, peak_label: "September 2001",
 *     feeds_ok: 222, feeds_total: 223,
 *     calibration: "preliminary"
 *   }
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-write-key",
};
const KEY = "gpr_latest";

function kvOf(env) {
  return env.GPR || env.US30VOL || null;
}

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
  const kv = kvOf(env);
  if (!kv) return json({ error: "kv-not-bound" }, 200);
  const v = await kv.get(KEY);
  if (!v) return json({ error: "no-data-yet" }, 200);
  return new Response(v, {
    status: 200,
    headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  const expected = env.GPR_WRITE_KEY || env.US30VOL_WRITE_KEY;
  const key = request.headers.get("x-write-key") || "";
  if (!expected || key !== expected) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }
  let b;
  try {
    b = await request.json();
  } catch {
    return new Response("bad-json", { status: 400, headers: CORS });
  }
  if (typeof b.level !== "number" || !isFinite(b.level)) {
    return new Response("bad-payload", { status: 400, headers: CORS });
  }
  b.schema = 1;
  b.received_utc = new Date().toISOString();
  const kv = kvOf(env);
  if (!kv) return new Response("kv-not-bound", { status: 500, headers: CORS });
  // 26h TTL so a dead emitter reads as stale rather than serving ancient data forever
  await kv.put(KEY, JSON.stringify(b), { expirationTtl: 93600 });
  return new Response("ok", { status: 200, headers: CORS });
}
