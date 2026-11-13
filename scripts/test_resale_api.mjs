// Offline test for functions/api/resale.js: fake KV, real Request objects, no network.
//   node scripts/test_resale_api.mjs        (Node 20; prints one line per case, then ALL PASS)
// Test secrets are the literals below. They are not real and never leave this file.
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "..", "functions", "api", "resale.js");

let tmpDir = null;
async function load() {
  try {
    return { mod: await import(pathToFileURL(src).href), via: "direct import of resale.js" };
  } catch (e) {
    // Node refused the .js as a module: import a copy named .mjs from the OS temp folder.
    tmpDir = mkdtempSync(path.join(tmpdir(), "resale-api-test-"));
    const copy = path.join(tmpDir, "resale.mjs");
    copyFileSync(src, copy);
    return { mod: await import(pathToFileURL(copy).href), via: `temp copy (${e.code || e.name})` };
  }
}

const PASS = "test-pass";
const WRITE = "test-write";
const URL_ = "https://example.test/api/resale";

function fakeKV() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
    _m: m,
  };
}
const get = (headers = {}) => new Request(URL_, { method: "GET", headers });
const post = (body, headers = {}) => new Request(URL_, { method: "POST", headers, body });

let fails = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  " + detail}`);
  if (!ok) fails++;
}
async function body(res) { return await res.text(); }

const { mod, via } = await load();
console.log(`loaded the function by: ${via}`);
const { onRequestGet, onRequestPost, onRequestOptions } = mod;

check("exports the three handlers", [onRequestGet, onRequestPost, onRequestOptions].every((f) => typeof f === "function"));

// ---- GET ----
{
  const res = await onRequestGet({ request: get({ "x-resale-key": PASS }), env: { RESALE: fakeKV() } });
  check("GET, RESALE_KEY unset: 503", res.status === 503, String(res.status));
  check("GET, RESALE_KEY unset: not-configured", (await body(res)) === '{"error":"not-configured"}');
  const env2 = { RESALE: fakeKV(), RESALE_KEY: " , " };
  const r2 = await onRequestGet({ request: get({ "x-resale-key": PASS }), env: env2 });
  check("GET, RESALE_KEY only commas: 503", r2.status === 503, String(r2.status));
  const r3 = await onRequestGet({ request: get({ "x-resale-key": PASS }), env: { RESALE: fakeKV(), PCPARTS_KEY: PASS } });
  check("GET, only PCPARTS_KEY set: 503 (that passkey is not reused)", r3.status === 503, String(r3.status));
}
{
  const env = { RESALE: fakeKV(), RESALE_KEY: PASS };
  const wrong = await onRequestGet({ request: get({ "x-resale-key": "test-wrong" }), env });
  check("GET wrong key: 401", wrong.status === 401, String(wrong.status));
  check("GET wrong key: unauthorized body", (await body(wrong)) === '{"error":"unauthorized"}');
  const none = await onRequestGet({ request: get(), env });
  check("GET no key header: 401", none.status === 401, String(none.status));
  const empty = await onRequestGet({ request: get({ "x-resale-key": "" }), env });
  check("GET empty key header: 401", empty.status === 401, String(empty.status));
  const shorter = await onRequestGet({ request: get({ "x-resale-key": PASS.slice(0, -1) }), env });
  check("GET key one character short: 401", shorter.status === 401, String(shorter.status));
  const ok = await onRequestGet({ request: get({ "x-resale-key": PASS }), env });
  check("GET right key, nothing stored: 200", ok.status === 200, String(ok.status));
  const nothing = JSON.parse(await body(ok));
  check("GET right key, nothing stored: no-report-yet", nothing.error === "no-report-yet");
  check("GET right key, nothing stored: scan fields are null", nothing.scan_req === null && nothing.scan_status === null);
  check("GET answers carry cache-control no-store", ok.headers.get("cache-control") === "no-store");
  const viaQuery = await onRequestGet({ request: new Request(URL_ + "?key=" + PASS), env });
  check("GET with the key in the URL instead of the header: 401", viaQuery.status === 401, String(viaQuery.status));
  const wk = await onRequestGet({ request: get({ "x-resale-key": WRITE }), env: { ...env, RESALE_WRITE_KEY: WRITE } });
  check("GET with the write key as the passkey: 401", wk.status === 401, String(wk.status));
}
{
  const env = { RESALE: fakeKV(), RESALE_KEY: "test-pass-one, test-pass-two ,test-pass-three" };
  const codes = [];
  for (const k of ["test-pass-one", "test-pass-two", "test-pass-three", "test-pass-four", "test-pass-one, test-pass-two"]) {
    codes.push((await onRequestGet({ request: get({ "x-resale-key": k }), env })).status);
  }
  check("comma-separated RESALE_KEY: each listed key works (spaces ignored), others do not",
    JSON.stringify(codes) === "[200,200,200,401,401]", JSON.stringify(codes));
}
{
  const res = await onRequestGet({ request: get({ "x-resale-key": PASS }), env: { RESALE_KEY: PASS } });
  check("GET with no KV bound: 500", res.status === 500, String(res.status));
}

// ---- POST ----
const REPORT = JSON.stringify({ schema: 1, generated: "2026-11-14T12:00:00+00:00", finds: [{ legacy: "1", title: "café £" }], watch: [] });
{
  const kv = fakeKV();
  const none = await onRequestPost({ request: post(REPORT, { "x-write-key": WRITE }), env: { RESALE: kv } });
  check("POST, no write key configured: 403", none.status === 403, String(none.status));
  const noHeader = await onRequestPost({ request: post(REPORT), env: { RESALE: kv, PCPARTS_WRITE_KEY: WRITE } });
  check("POST, no header: 403", noHeader.status === 403, String(noHeader.status));
  const wrong = await onRequestPost({ request: post(REPORT, { "x-write-key": "test-wrong" }), env: { RESALE: kv, PCPARTS_WRITE_KEY: WRITE } });
  check("POST, wrong write key: 403", wrong.status === 403, String(wrong.status));
  const emptyEnv = await onRequestPost({ request: post(REPORT, { "x-write-key": "" }), env: { RESALE: kv, PCPARTS_WRITE_KEY: "" } });
  check("POST, empty header and empty configured key: 403", emptyEnv.status === 403, String(emptyEnv.status));
  const asPass = await onRequestPost({ request: post(REPORT, { "x-write-key": PASS }), env: { RESALE: kv, RESALE_KEY: PASS, PCPARTS_WRITE_KEY: WRITE } });
  check("POST with the passkey as the write key: 403", asPass.status === 403, String(asPass.status));
  check("nothing was stored by the refused posts", kv._m.size === 0, String(kv._m.size));
}
{
  const kv = fakeKV();
  const env = { RESALE: kv, RESALE_KEY: PASS, PCPARTS_WRITE_KEY: WRITE };
  const h = { "x-write-key": WRITE };
  const bad = await onRequestPost({ request: post("{not json", h), env });
  check("POST not JSON: 400", bad.status === 400, String(bad.status));
  const empty = await onRequestPost({ request: post("", h), env });
  check("POST empty body: 400", empty.status === 400, String(empty.status));
  const prefix = '{"x":"';
  const exact = prefix + "a".repeat(500000 - prefix.length - 2) + '"}';
  const over = prefix + "a".repeat(500000 - prefix.length - 1) + '"}';
  check("test bodies are exactly 500,000 and 500,001 characters", exact.length === 500000 && over.length === 500001, `${exact.length} ${over.length}`);
  const tooBig = await onRequestPost({ request: post(over, h), env });
  check("POST 500,001 characters: 413", tooBig.status === 413, String(tooBig.status));
  check("nothing stored by the refused bodies", kv._m.size === 0, String(kv._m.size));
  const atCap = await onRequestPost({ request: post(exact, h), env });
  check("POST exactly 500,000 characters: 200", atCap.status === 200, String(atCap.status));
  const okRes = await onRequestPost({ request: post(REPORT, h), env });
  check("POST good report (write key falls back to PCPARTS_WRITE_KEY): 200", okRes.status === 200, String(okRes.status));
  const okBody = JSON.parse(await body(okRes));
  check("POST answer is {ok:true, bytes:n}", okBody.ok === true && okBody.bytes === REPORT.length, JSON.stringify(okBody));
  check("stored under the key resale_report", kv._m.get("resale_report") === REPORT);
  const back = await onRequestGet({ request: get({ "x-resale-key": PASS }), env });
  const text = await body(back);
  const strip = (t) => { const o = JSON.parse(t); delete o.scan_req; delete o.scan_status; return JSON.stringify(o); };
  check("round trip: GET returns the stored report", back.status === 200 && strip(text) === JSON.stringify(JSON.parse(REPORT)), String(back.status));
  check("round trip: the answer also carries the scan fields", "scan_req" in JSON.parse(text) && "scan_status" in JSON.parse(text));
  check("round trip: content-type json and no-store", back.headers.get("content-type") === "application/json" && back.headers.get("cache-control") === "no-store");
  check("round trip: parsed content matches", strip(text) === JSON.stringify(JSON.parse(REPORT)));
  const wrongAfter = await onRequestGet({ request: get({ "x-resale-key": "test-wrong" }), env });
  check("with a report stored, a wrong key still gets nothing but 401", wrongAfter.status === 401 && (await body(wrongAfter)) === '{"error":"unauthorized"}');
}
{
  const kv = fakeKV();
  const env = { RESALE: kv, RESALE_KEY: PASS, RESALE_WRITE_KEY: WRITE, PCPARTS_WRITE_KEY: "test-other-write" };
  const own = await onRequestPost({ request: post(REPORT, { "x-write-key": WRITE }), env });
  check("RESALE_WRITE_KEY set: it is accepted", own.status === 200, String(own.status));
  const fallback = await onRequestPost({ request: post(REPORT, { "x-write-key": "test-other-write" }), env });
  check("RESALE_WRITE_KEY set: PCPARTS_WRITE_KEY is no longer accepted", fallback.status === 403, String(fallback.status));
  const noRes = await onRequestPost({ request: post(REPORT, { "x-write-key": WRITE }), env: { RESALE: kv, RESALE_WRITE_KEY: WRITE } });
  check("RESALE_WRITE_KEY alone (no PCPARTS_WRITE_KEY): 200", noRes.status === 200, String(noRes.status));
}
{
  const res = await onRequestPost({ request: post(REPORT, { "x-write-key": WRITE }), env: { PCPARTS_WRITE_KEY: WRITE } });
  check("POST with no KV bound: 500", res.status === 500, String(res.status));
}

// ---- binding fallback ----
{
  const pc = fakeKV();
  const env = { PCPARTS: pc, RESALE_KEY: PASS, PCPARTS_WRITE_KEY: WRITE };
  const p = await onRequestPost({ request: post(REPORT, { "x-write-key": WRITE }), env });
  const g = await onRequestGet({ request: get({ "x-resale-key": PASS }), env });
  check("only the PCPARTS binding: POST and GET both work", p.status === 200 && g.status === 200 && JSON.parse(await body(g)).generated === JSON.parse(REPORT).generated, `${p.status} ${g.status}`);
  check("PCPARTS binding: stored under resale_report, not pcparts_report", pc._m.has("resale_report") && !pc._m.has("pcparts_report"));
  const both = { RESALE: fakeKV(), PCPARTS: fakeKV(), RESALE_KEY: PASS, PCPARTS_WRITE_KEY: WRITE };
  await onRequestPost({ request: post(REPORT, { "x-write-key": WRITE }), env: both });
  check("both bindings declared: RESALE is the one used", both.RESALE._m.size === 1 && both.PCPARTS._m.size === 0);
}

// ---- scan button: request, poll, status ----
{
  const kv = fakeKV();
  const env = { RESALE: kv, RESALE_KEY: PASS, PCPARTS_WRITE_KEY: WRITE };
  const J = { "content-type": "application/json" };
  const ask = (headers) => onRequestPost({ request: post('{"action":"request_scan"}', { ...J, ...headers }), env });

  const noKey = await ask({});
  check("request_scan without the password: 401", noKey.status === 401, String(noKey.status));
  const wrong = await ask({ "x-resale-key": "test-wrong" });
  check("request_scan with a wrong password: 401", wrong.status === 401, String(wrong.status));
  const withWrite = await ask({ "x-write-key": WRITE });
  check("request_scan with only the write key: 401", withWrite.status === 401, String(withWrite.status));
  check("refused presses store nothing", kv._m.size === 0);
  const unset = await onRequestPost({ request: post('{"action":"request_scan"}', { ...J, "x-resale-key": PASS }), env: { RESALE: fakeKV(), PCPARTS_WRITE_KEY: WRITE } });
  check("request_scan with RESALE_KEY unset: 503", unset.status === 503, String(unset.status));

  const first = await ask({ "x-resale-key": PASS });
  const fb = JSON.parse(await body(first));
  check("request_scan with the password: 200 and a stamp", first.status === 200 && fb.requested === true && !Number.isNaN(Date.parse(fb.scan_req)), String(first.status));
  check("the press is stored under resale_scan_req only", kv._m.size === 1 && kv._m.get("resale_scan_req") === fb.scan_req);
  const again = await ask({ "x-resale-key": PASS });
  const ab = JSON.parse(await body(again));
  check("a second press inside the 3 minute cooldown is folded into the first", again.status === 200 && ab.requested === false && ab.scan_req === fb.scan_req);
  kv._m.set("resale_scan_req", new Date(Date.now() - 170000).toISOString());
  const early = JSON.parse(await body(await ask({ "x-resale-key": PASS })));
  check("a press 170 seconds later is still folded", early.requested === false);
  const old = new Date(Date.now() - 190000).toISOString();
  kv._m.set("resale_scan_req", old);
  const later = await ask({ "x-resale-key": PASS });
  const lb = JSON.parse(await body(later));
  check("a press 190 seconds later is a new request", lb.requested === true && lb.scan_req !== old && kv._m.get("resale_scan_req") === lb.scan_req);

  const pollUrl = URL_ + "?poll=1";
  const pollNo = await onRequestGet({ request: new Request(pollUrl), env });
  check("poll without the write key: 403", pollNo.status === 403, String(pollNo.status));
  const pollPass = await onRequestGet({ request: new Request(pollUrl, { headers: { "x-resale-key": PASS } }), env });
  check("poll with the password instead of the write key: 403", pollPass.status === 403, String(pollPass.status));
  const pollOk = await onRequestGet({ request: new Request(pollUrl, { headers: { "x-write-key": WRITE } }), env });
  const pb = JSON.parse(await body(pollOk));
  check("poll with the write key: only the stamp", pollOk.status === 200 && pb.scan_req === lb.scan_req && Object.keys(pb).length === 1);
  const pollEmpty = await onRequestGet({ request: new Request(pollUrl, { headers: { "x-write-key": WRITE } }), env: { RESALE: fakeKV(), PCPARTS_WRITE_KEY: WRITE } });
  check("poll with nothing pressed yet: null", JSON.parse(await body(pollEmpty)).scan_req === null);
  const pollUnset = await onRequestGet({ request: new Request(pollUrl, { headers: { "x-write-key": "" } }), env: { RESALE: fakeKV() } });
  check("poll with no write key configured and an empty header: 403", pollUnset.status === 403, String(pollUnset.status));

  const status = (obj, headers) => onRequestPost({ request: post(JSON.stringify({ action: "scan_status", ...obj }), { ...J, ...headers }), env });
  const stNo = await status({ state: "running", req: lb.scan_req }, { "x-resale-key": PASS });
  check("scan_status with the password instead of the write key: 403", stNo.status === 403, String(stNo.status));
  const stBad = await status({ state: "exploded", req: lb.scan_req }, { "x-write-key": WRITE });
  check("scan_status with an unknown state: 400", stBad.status === 400, String(stBad.status));
  check("neither wrote a status", !kv._m.has("resale_scan_status"));
  const stOk = await status({ state: "done", req: lb.scan_req, note: "x".repeat(900) }, { "x-write-key": WRITE });
  check("scan_status from the home PC: 200", stOk.status === 200, String(stOk.status));
  const saved = JSON.parse(kv._m.get("resale_scan_status"));
  check("status keeps state and req, stamps the time, trims the note", saved.state === "done" && saved.req === lb.scan_req && saved.note.length === 300 && !Number.isNaN(Date.parse(saved.ts)));
  check("a status never overwrites the report", !kv._m.has("resale_report"));

  await onRequestPost({ request: post(REPORT, { "x-write-key": WRITE }), env });
  const page = await onRequestGet({ request: get({ "x-resale-key": PASS }), env });
  const pg = JSON.parse(await body(page));
  check("the page's GET carries the press and the status with the report", pg.scan_req === lb.scan_req && pg.scan_status.state === "done" && pg.generated === JSON.parse(REPORT).generated);
  kv._m.set("resale_scan_status", "not json");
  const page2 = JSON.parse(await body(await onRequestGet({ request: get({ "x-resale-key": PASS }), env })));
  check("a corrupt status is served as null, not an error", page2.scan_status === null && page2.generated === JSON.parse(REPORT).generated);

  const rep2 = '{"generated":"2026-11-13T18:00:00Z","action":"something-else"}';
  const odd = await onRequestPost({ request: post(rep2, { "x-write-key": WRITE }), env });
  check("a report whose action is not a known one is still stored as the report", odd.status === 200 && kv._m.get("resale_report") === rep2);
  const big = await onRequestPost({ request: post("x".repeat(500001), { "x-resale-key": PASS }), env });
  check("an oversized body is refused before anything else: 413", big.status === 413, String(big.status));
}

// ---- OPTIONS ----
{
  const res = await onRequestOptions();
  check("OPTIONS: 204", res.status === 204, String(res.status));
  check("OPTIONS: x-resale-key and x-write-key allowed", /x-resale-key/.test(res.headers.get("access-control-allow-headers") || "") && /x-write-key/.test(res.headers.get("access-control-allow-headers") || ""));
  check("OPTIONS: methods GET, POST, OPTIONS", res.headers.get("access-control-allow-methods") === "GET,POST,OPTIONS");
}

if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
