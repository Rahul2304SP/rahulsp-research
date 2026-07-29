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
// Manually MEASURED total plot areas, {uid: {plot_m2, at}}. Plot size is the single
// most important number for this buyer and there is no free data source for it
// (Land Registry INSPIRE is login-walled, OSM has no per-property garden polygons),
// so it is measured by hand off aerial imagery and recorded here. Handful of writes
// a day at most — far under KV's 1,000/day free cap.
const KV_PLOTS = "homefinder_plots";

// constant-time-ish string compare so a wrong key can't be timed out character by character
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Accept ANY configured passkey: the primary HOMEFINDER_KEY (which may itself be a
// comma-separated list of allowed keys) plus an optional per-person key such as
// HOMEFINDER_KEY_MOM. Key VALUES live ONLY in Cloudflare env — never in this repo.
function keyOk(env, supplied) {
  const cands = [];
  if (env.HOMEFINDER_KEY) for (const k of String(env.HOMEFINDER_KEY).split(",")) { const t = k.trim(); if (t) cands.push(t); }
  if (env.HOMEFINDER_KEY_MOM) { const t = String(env.HOMEFINDER_KEY_MOM).trim(); if (t) cands.push(t); }
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
  if (!env.HOMEFINDER_KEY && !env.HOMEFINDER_KEY_MOM) return json({ error: "not-configured" }, 503);
  const supplied = request.headers.get("x-homefinder-key") || "";
  if (!keyOk(env, supplied)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.HOMEFINDER) return json({ error: "kv-not-bound" }, 500);
  const data = await env.HOMEFINDER.get(KV_KEY);
  if (!data) return json({ error: "no-report-yet" }, 200);
  // merge in the refresh request state so the page (and the local poller) can tell
  // whether a re-scrape was requested but not yet published.
  const refreshReq = await env.HOMEFINDER.get(KV_REFRESH);
  const plotsRaw = await env.HOMEFINDER.get(KV_PLOTS);
  let out = data;
  try {
    const obj = JSON.parse(data);
    obj.refresh_req = refreshReq || null;
    obj.refresh_state = refreshReq && (!obj.generated || refreshReq > obj.generated) ? "running" : "idle";
    // measured plots are served straight from KV, so a measurement shows up on the
    // page immediately rather than waiting for the next nightly re-publish
    try { obj.plots = plotsRaw ? JSON.parse(plotsRaw) : {}; } catch { obj.plots = {}; }
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
    if (!keyOk(env, pass)) {
      return json({ error: "unauthorized" }, 401);
    }
    await env.HOMEFINDER.put(KV_REFRESH, new Date().toISOString());
    return json({ ok: true, requested: true }, 200);
  }

  // A passkey-holder recording a plot they measured off the aerial view.
  // {action:"set_plot", uid:"Rightmove:123", plot_m2: 134.7}  — plot_m2 null deletes.
  if (body && body.action === "set_plot") {
    const pass = request.headers.get("x-homefinder-key") || "";
    if (!keyOk(env, pass)) return json({ error: "unauthorized" }, 401);
    const uid = typeof body.uid === "string" ? body.uid.slice(0, 120) : "";
    if (!uid) return json({ error: "bad-uid" }, 400);
    let plots = {};
    try { plots = JSON.parse((await env.HOMEFINDER.get(KV_PLOTS)) || "{}"); } catch { plots = {}; }
    if (body.plot_m2 === null) {
      delete plots[uid];
    } else {
      const v = Number(body.plot_m2);
      // 20 m2 (a courtyard) .. 20,000 m2 (5 acres) — anything outside is a typo or
      // a wrong unit, and a bad plot figure is worse than none at all here.
      if (!isFinite(v) || v < 20 || v > 20000) return json({ error: "bad-plot_m2" }, 400);
      plots[uid] = { plot_m2: Math.round(v * 10) / 10, at: new Date().toISOString() };
    }
    await env.HOMEFINDER.put(KV_PLOTS, JSON.stringify(plots));
    return json({ ok: true, uid, plot_m2: plots[uid]?.plot_m2 ?? null, count: Object.keys(plots).length }, 200);
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
