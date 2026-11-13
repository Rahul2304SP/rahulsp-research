"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chakra_Petch, IBM_Plex_Sans } from "next/font/google";
import "./deals.css";

// Private resale deals page. Gated by a password checked server-side by /api/resale
// against the RESALE_KEY secret (never shipped to the client). The password is kept in
// localStorage ("Remember on this device") or sessionStorage, never in a URL.
//
// The page covers the whole screen (its own top bar and bottom bar) so it works like an
// app on a phone: four views and the scan key sit in thumb reach at the bottom.

const display = Chakra_Petch({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--dz-display", display: "swap" });
const body = IBM_Plex_Sans({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--dz-text", display: "swap" });

type Vet = { status?: string; passed?: string[]; cautions?: string[] };
type Status = {
  ts?: string; read?: number; clean?: number; calls?: number; skipped?: boolean;
  calls_left?: number | null; trigger?: string; new_finds?: number;
};
type Listing = {
  id?: string; legacy?: string; url?: string; product?: string; title?: string; kind?: string;
  price?: number | null; postage?: number | null; cost?: number | null; max_pay?: number | null;
  resale?: number | null; net?: number | null; profit?: number | null; profit_now?: number | null;
  roi?: number | null; bid_up_to?: number | null; ends?: string | null; hours?: number | null;
  bids?: number | null; condition?: string; feedback?: number | null; feedback_pct?: number | null;
  returns?: boolean | null; where?: string; photos?: number | null; notes?: string[]; desc?: string;
  seller_notes?: string; found_ts?: string; read?: boolean; image?: string; images?: string[];
  vet?: Vet | null; over?: boolean;
};
type AuctionStat = {
  n_ended?: number | null; n_sold?: number | null; n_priced?: number | null; median?: number | null;
  low?: number | null; high?: number | null; avg_bids?: number | null; avg_bidders?: number | null;
};
type MarketRow = {
  key?: string; product?: string; peers?: number; p25?: number | null; median?: number | null;
  net?: number | null; max_pay?: number | null; auction?: AuctionStat | null;
};
type SoldRow = {
  key?: string; product?: string; title?: string; legacy?: string; url?: string; image?: string;
  total?: number | null; final_bid?: number | null; postage?: number | null; bids?: number | null;
  bidders?: number | null; sold?: boolean; exact?: boolean; seen_min_before_end?: number | null;
  ended?: string;
};
type SellingRow = {
  product?: string; cond?: string; title?: string; price?: number | null; sold?: number | null;
  days?: number | null; per_day?: number | null; legacy?: string; url?: string;
};
type Quota = { left?: number | null; limit?: number | null; resets?: string | null };
type ScanStatus = { state?: string; req?: string | null; ts?: string; note?: string };
type Scan = { req: string | null; status: ScanStatus | null };
type Report = {
  schema?: number; generated?: string; status?: Status | null; quota?: Quota | null;
  market_ts?: string; market?: MarketRow[]; finds?: Listing[]; watch?: Listing[];
  sold?: SoldRow[]; selling?: SellingRow[];
};
type Result =
  | { kind: "ok"; report: Report; scan: Scan }
  | { kind: "nodata"; scan: Scan }
  | { kind: "unauthorized" }
  | { kind: "notset" }
  | { kind: "error" };
type Tab = "deals" | "auctions" | "prices" | "sold";

const STORE_KEY = "resale_key";
const VET_KEY = "resale_vetted_only";
const EBAY_PREFIX = "https://www.ebay.co.uk/itm/";
const EBAY_IMG_PREFIX = "https://i.ebayimg.com/";
const STALE_MS = 4 * 3600 * 1000;
const SCAN_GIVE_UP_MS = 12 * 60 * 1000;
const SCAN_NO_ANSWER_MS = 150 * 1000;
const SCAN_COOLDOWN_MS = 3 * 60 * 1000;      // the same gap /api/resale enforces between presses
const LOW_CALLS = 1500;                      // below this the home PC refuses manual scans
const STOP_CALLS = 700;                      // below this it skips the automatic checks too
const MSG_UNREACHABLE = "Could not reach the server. Try again.";
const MSG_NOT_SET_UP = "The page is not set up yet.";

// ---- password storage (every access guarded: private mode and blocked storage throw) ----
function readSaved(): string {
  try { const v = window.localStorage.getItem(STORE_KEY); if (v) return v; } catch { /* blocked */ }
  try { const v = window.sessionStorage.getItem(STORE_KEY); if (v) return v; } catch { /* blocked */ }
  return "";
}
function savedForGood(): boolean {
  try { return !!window.localStorage.getItem(STORE_KEY); } catch { return false; }
}
function saveKey(k: string, remember: boolean) {
  try {
    if (remember) window.localStorage.setItem(STORE_KEY, k); else window.localStorage.removeItem(STORE_KEY);
  } catch { /* blocked */ }
  try {
    if (remember) window.sessionStorage.removeItem(STORE_KEY); else window.sessionStorage.setItem(STORE_KEY, k);
  } catch { /* blocked */ }
}
function clearSaved() {
  try { window.localStorage.removeItem(STORE_KEY); } catch { /* blocked */ }
  try { window.sessionStorage.removeItem(STORE_KEY); } catch { /* blocked */ }
}

function scanOf(data: Record<string, unknown>): Scan {
  const req = typeof data.scan_req === "string" && data.scan_req ? data.scan_req : null;
  const st = data.scan_status;
  return { req, status: st && typeof st === "object" && !Array.isArray(st) ? (st as ScanStatus) : null };
}

async function fetchReport(k: string): Promise<Result> {
  let res: Response;
  try {
    res = await fetch("/api/resale", { headers: { "x-resale-key": k }, cache: "no-store" });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status === 503) return { kind: "notset" };
  let data: unknown;
  try { data = await res.json(); } catch { return { kind: "error" }; }
  if (!res.ok || typeof data !== "object" || data === null || Array.isArray(data)) return { kind: "error" };
  const obj = data as Record<string, unknown>;
  if (obj.error === "no-report-yet") return { kind: "nodata", scan: scanOf(obj) };
  if (obj.error) return { kind: "error" };
  return { kind: "ok", report: obj as Report, scan: scanOf(obj) };
}

async function requestScan(k: string): Promise<{ ok: boolean; req: string | null; status: number }> {
  try {
    const res = await fetch("/api/resale", {
      method: "POST", cache: "no-store",
      headers: { "x-resale-key": k, "content-type": "application/json" },
      body: JSON.stringify({ action: "request_scan" }),
    });
    if (!res.ok) return { ok: false, req: null, status: res.status };
    const d = (await res.json()) as { scan_req?: unknown };
    return { ok: true, req: typeof d.scan_req === "string" ? d.scan_req : null, status: 200 };
  } catch {
    return { ok: false, req: null, status: 0 };
  }
}

// ---- formatting (a missing value gives an empty string, never "undefined" or "NaN") ----
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const text = (x: unknown): string => (typeof x === "string" ? x : "");
const gbp = (x: unknown, dp = 2): string => {
  const n = num(x);
  if (n === null) return "";
  const s = "£" + Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return n < 0 ? "minus " + s : s;
};
const whole = (x: unknown): string => {       // limits and profit: floored, so a limit is never overstated
  const n = num(x);
  return n === null ? "" : gbp(Math.floor(n), 0);
};
const count = (x: unknown): string => {
  const n = num(x);
  return n === null ? "" : Math.round(n).toLocaleString("en-GB");
};
const pct = (x: unknown): string => {
  const n = num(x);
  return n === null ? "" : `${Math.round(n * 100)}%`;
};
const ms = (iso: unknown): number | null => {
  if (typeof iso !== "string" || !iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};
function ago(diff: number): string {
  const m = Math.max(0, Math.floor(diff / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
}
function endsIn(diff: number): string {
  const m = Math.max(1, Math.ceil(diff / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} days ${h % 24} h`;
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

// A listing's vetting result. Reports made before vetting was added carry only `read` and
// `notes`, so work it out from those.
function vetOf(l: Listing): { status: "vetted" | "caution" | "unread"; passed: string[]; cautions: string[] } {
  const v = l.vet;
  const strs = (a: unknown) => (Array.isArray(a) ? a.filter((s): s is string => typeof s === "string" && !!s) : []);
  if (v && typeof v === "object" && (v.status === "vetted" || v.status === "caution" || v.status === "unread")) {
    return { status: v.status, passed: strs(v.passed), cautions: strs(v.cautions) };
  }
  if (l.read === false) return { status: "unread", passed: [], cautions: [] };
  const cautions = strs(l.notes).filter((n) => n !== "no returns");
  return {
    status: "caution",
    passed: ["description read, no fault wording"],
    cautions: cautions.length ? cautions : ["checked before the full vetting rules were added"],
  };
}

// ---- small drawn parts ----
const Tick = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 7.5 5.5 11 12 3.5" /></svg>
);
const Bang = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 2v6.5M7 11v1" /></svg>
);
const Chevron = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 4.5 6 8.5l4-4" /></svg>
);

// eBay serves each photo at several sizes: a small one for the strip, the largest when tapped.
const sized = (u: string, px: number) => u.replace(/\/s-l\d+\.(jpe?g|png|webp)$/i, `/s-l${px}.$1`);

function photosOf(l: { images?: string[]; image?: string }): string[] {
  const all = (Array.isArray(l.images) ? l.images : []).concat(text(l.image) ? [text(l.image)] : []);
  const seen = new Set<string>();
  const pics: string[] = [];
  for (const u of all) {
    if (typeof u !== "string" || !u.startsWith(EBAY_IMG_PREFIX)) continue;
    const k = sized(u, 0);
    if (seen.has(k)) continue;
    seen.add(k);
    pics.push(u);
  }
  return pics;
}

function Photos({ l }: { l: Listing }) {
  const pics = photosOf(l);
  if (pics.length === 0) return null;
  return (
    <div className="dz-photos">
      {pics.map((u, i) => (
        <a key={u} className="cut-s" href={sized(u, 1600)} target="_blank" rel="noopener noreferrer"
           aria-label={`Photo ${i + 1} of ${pics.length}, opens full size`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sized(u, 500)} alt="" loading="lazy" referrerPolicy="no-referrer" width={168} height={168} />
        </a>
      ))}
    </div>
  );
}

function VetTag({ status }: { status: "vetted" | "caution" | "unread" }) {
  return (
    <span className="dz-tag cut-s" data-vet={status}>
      {status === "vetted" ? <Tick /> : status === "caution" ? <Bang /> : null}
      {status === "vetted" ? "Vetted" : status === "caution" ? "Caution" : "Not read yet"}
    </span>
  );
}

function SpecRow({ k, v }: { k: string; v: string }) {
  return (<><dt>{k}</dt><dd>{v}</dd></>);
}

function ListingCard({ l, mode, now }: { l: Listing; mode: "bin" | "auction"; now: number }) {
  const [fold, setFold] = useState<"" | "checks" | "desc">("");
  const vet = vetOf(l);
  const cost = num(l.cost);
  const limit = mode === "bin" ? num(l.max_pay) : num(l.bid_up_to);
  const against = mode === "bin" ? cost : num(l.price);          // what the limit is compared with
  const room = limit !== null && against !== null ? limit - against : null;
  const fill = limit && against !== null ? Math.max(0, Math.min(1, against / limit)) : null;
  const tight = room !== null && limit ? room / limit < 0.08 : false;
  const endMs = ms(l.ends);
  const foundMs = ms(l.found_ts);
  const bids = num(l.bids);
  const fb = num(l.feedback);
  const fbPct = num(l.feedback_pct);
  const sellerNotes = text(l.seller_notes);
  const desc = text(l.desc);
  const url = text(l.url);
  const closing = endMs !== null && endMs - now < 3600 * 1000;

  const spec: [string, string][] = [];
  if (text(l.condition)) spec.push(["Condition", text(l.condition)]);
  if (fb !== null) spec.push(["Seller", `${count(fb)} feedback${fbPct !== null ? `, ${fbPct % 1 === 0 ? fbPct : fbPct.toFixed(1)}% positive` : ""}`]);
  if (l.returns === true) spec.push(["Returns", "Accepted"]);
  else if (l.returns === false) spec.push(["Returns", "Not accepted"]);
  if (text(l.where)) spec.push(["Location", text(l.where)]);
  if (mode === "auction" && bids !== null) spec.push(["Bids", bids === 0 ? "None yet" : String(bids)]);
  if (mode === "bin" && foundMs !== null) spec.push(["Found", ago(now - foundMs)]);

  return (
    <article className="dz-card cut">
      <div className="dz-card-in cut">
        <Photos l={l} />
        <div className="dz-card-head">
          <h3 className="dz-prod">{text(l.product) || "Listing"}</h3>
          <VetTag status={vet.status} />
        </div>
        {text(l.title) ? <p className="dz-title">{text(l.title)}</p> : null}

        <div className="dz-meter">
          <div className="dz-meter-row">
            <div className="dz-meter-now">
              <b className="num">{gbp(cost) || "n/a"}</b>
              <span>{mode === "bin" ? "delivered" : "now, delivered"}</span>
            </div>
            <div className="dz-meter-lim">
              <b className="num">{whole(limit) || "n/a"}</b>
              <span>{mode === "bin" ? "pay at most" : "bid no more than"}</span>
            </div>
          </div>
          {fill !== null ? (
            <div className="dz-scale" data-tight={tight ? "1" : "0"} aria-hidden="true">
              <i style={{ width: `${(fill * 100).toFixed(1)}%` }} />
            </div>
          ) : null}
          <div className="dz-room">
            {l.over === true ? (
              <span className="hot">The price has risen above the limit</span>
            ) : mode === "bin" ? (
              num(l.profit) !== null
                ? <span className="go">Profit about {whole(l.profit)}{pct(l.roi) ? ` (${pct(l.roi)})` : ""}</span>
                : <span />
            ) : (
              room !== null ? <span className={tight ? "hot" : "go"}>{whole(room)} of room left</span> : <span />
            )}
            {mode === "auction" && endMs !== null ? (
              <span className={closing ? "hot" : "dim"}>Ends in {endsIn(endMs - now)}</span>
            ) : null}
          </div>
        </div>

        {spec.length ? (
          <dl className="dz-spec">
            {spec.map(([k, v]) => (<SpecRow key={k} k={k} v={v} />))}
          </dl>
        ) : null}

        <div className="dz-folds">
          <button type="button" className="dz-fold-b cut-s" aria-expanded={fold === "checks"}
                  onClick={() => setFold(fold === "checks" ? "" : "checks")}>
            <span>Checks</span>
            {vet.status === "unread" ? null : vet.cautions.length ? (
              <span className="dz-fold-n" data-k="warn" aria-label={`${vet.cautions.length} to look at`}><Bang />{vet.cautions.length}</span>
            ) : (
              <span className="dz-fold-n" aria-label={`${vet.passed.length} passed`}><Tick />{vet.passed.length}</span>
            )}
            <Chevron />
          </button>
          <button type="button" className="dz-fold-b cut-s" aria-expanded={fold === "desc"}
                  onClick={() => setFold(fold === "desc" ? "" : "desc")}>
            <span>Description</span><Chevron />
          </button>
        </div>
        <div className="dz-fold" data-open={fold === "checks" ? "1" : "0"}>
          <div>
            <div className="dz-fold-in">
              {vet.status === "unread" ? (
                <p className="dz-desc">This listing has not been read yet. It is read on the next scan.</p>
              ) : (
                <ul className="dz-checks">
                  {vet.cautions.map((c) => (<li key={"c" + c} data-k="warn"><Bang /><span>{c}</span></li>))}
                  {vet.passed.map((c) => (<li key={"p" + c} data-k="ok"><Tick /><span>{c}</span></li>))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="dz-fold" data-open={fold === "desc" ? "1" : "0"}>
          <div>
            <div className="dz-fold-in">
              {sellerNotes ? (<><p className="dz-desc-l">Seller&apos;s condition notes</p><p className="dz-desc" style={{ marginBottom: 10 }}>{sellerNotes}</p></>) : null}
              <p className="dz-desc">
                {desc || (vet.status === "unread" ? "Not read yet."
                  : vet.passed.includes("seller wrote a description") ? "The description is not included here. Open the listing to read it."
                  : "The seller wrote no description.")}
              </p>
            </div>
          </div>
        </div>

        {url.startsWith(EBAY_PREFIX) ? (
          <a className="dz-key cut-s" href={url} target="_blank" rel="noopener noreferrer">Open on eBay</a>
        ) : null}
      </div>
    </article>
  );
}

// ---- the page ----
export default function Deals() {
  const [phase, setPhase] = useState<"boot" | "gate" | "in">("boot");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [scan, setScan] = useState<Scan>({ req: null, status: null });
  const [now, setNow] = useState<number>(() => Date.now());
  const [tab, setTab] = useState<Tab>("deals");
  const [vettedOnly, setVettedOnly] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState("");
  const [netMsg, setNetMsg] = useState("");
  const keyRef = useRef("");
  const wasRunning = useRef(false);
  const mainRef = useRef<HTMLElement | null>(null);

  const lock = useCallback(() => {
    clearSaved();
    keyRef.current = "";
    setReport(null); setScan({ req: null, status: null });
    setPw(""); setMsg(""); setNetMsg(""); setSheet(false);
    setPhase("gate");
  }, []);

  const refresh = useCallback(async () => {
    if (!keyRef.current) return;
    const r = await fetchReport(keyRef.current);
    if (r.kind === "ok") { setReport(r.report); setScan(r.scan); setNetMsg(""); }
    else if (r.kind === "nodata") { setReport(null); setScan(r.scan); setNetMsg(""); }
    else if (r.kind === "unauthorized") lock();
    else setNetMsg(r.kind === "notset" ? MSG_NOT_SET_UP : MSG_UNREACHABLE);
    setNow(Date.now());
  }, [lock]);

  async function unlock(k: string, how: "typed" | "saved") {
    setBusy(true); setMsg("");
    const r = await fetchReport(k);
    setBusy(false);
    if (r.kind === "ok" || r.kind === "nodata") {
      keyRef.current = k;
      if (how === "typed") saveKey(k, remember);
      setReport(r.kind === "ok" ? r.report : null);
      setScan(r.scan);
      setNow(Date.now());
      setPw("");
      setPhase("in");
      return;
    }
    if (r.kind === "unauthorized") {
      if (how === "saved") clearSaved();
      setMsg(how === "typed" ? "Wrong password." : "");
    } else {
      if (how === "saved") {
        setPw(k);                           // keep the saved password so one tap retries
        setRemember(savedForGood());        // and keep the choice made when it was saved
      }
      setMsg(r.kind === "notset" ? MSG_NOT_SET_UP : MSG_UNREACHABLE);
    }
    setPhase("gate");
  }

  // first load: the page takes over the screen; try a saved password
  useEffect(() => {
    document.documentElement.classList.add("dz-lock");
    try { if (window.localStorage.getItem(VET_KEY) === "0") setVettedOnly(false); } catch { /* blocked */ }
    const saved = readSaved();
    if (saved) unlock(saved, "saved");
    else setPhase("gate");
    return () => { document.documentElement.classList.remove("dz-lock"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- scan state ----
  const reqMs = ms(scan.req);
  const st = scan.status && scan.status.req === scan.req ? scan.status : null;
  const stState = st ? text(st.state) : "";
  const stNote = st ? text(st.note) : "";
  const settled = stState === "done" || stState === "failed";
  const running = phase === "in" && !!scan.req && !settled && reqMs !== null && now - reqMs < SCAN_GIVE_UP_MS;
  const scanPhase: "idle" | "waiting" | "scanning" | "noanswer" = !running ? "idle"
    : stState === "running" ? "scanning"
    : now - (reqMs as number) > SCAN_NO_ANSWER_MS ? "noanswer" : "waiting";

  // the clock: countdowns every 30 s; data every 2 minutes, or every 6 s while a scan runs
  useEffect(() => {
    if (phase !== "in") return;
    const tickClock = window.setInterval(() => setNow(Date.now()), 30000);
    const pull = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, running ? 6000 : 120000);
    const onShow = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearInterval(tickClock); window.clearInterval(pull);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [phase, running, refresh]);

  // a scan that just finished: say what it found
  useEffect(() => {
    if (wasRunning.current && !running && settled) {
      setToast(stState === "done"
        ? `Scan finished${stNote ? `: ${stNote}` : ""}`
        : `Scan not run${stNote ? `: ${stNote}` : ""}`);
    }
    wasRunning.current = running;
  }, [running, settled, stState, stNote]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 8000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // after a scan the key rests for a few minutes: every scan spends eBay calls
  const cool = !running && reqMs !== null ? Math.max(0, reqMs + SCAN_COOLDOWN_MS - now) : 0;
  const coolMin = Math.ceil(cool / 60000);

  async function pressScan() {
    if (running || !keyRef.current) return;
    if (cool > 0) { setToast(`You can scan again in ${coolMin} min.`); return; }
    setToast("");
    const r = await requestScan(keyRef.current);
    if (r.status === 401) { lock(); return; }
    if (!r.ok || !r.req) { setToast("The scan could not be requested. Check your connection and try again."); return; }
    setScan((s) => ({ req: r.req, status: s.status }));
    setNow(Date.now());
  }

  function pick(t: Tab) {
    setTab(t);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }
  function toggleVetted() {
    const v = !vettedOnly;
    setVettedOnly(v);
    try { window.localStorage.setItem(VET_KEY, v ? "1" : "0"); } catch { /* blocked */ }
  }

  const shell = `dz ${display.variable} ${body.variable}`;

  if (phase === "boot") return <div className={shell}><p className="dz-boot">Loading</p></div>;

  if (phase === "gate") {
    return (
      <div className={shell}>
        <div className="dz-gate">
          <h1>Deals</h1>
          <p>Private. Enter the password to open it.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (pw && !busy) unlock(pw, "typed"); }}>
            <input className="dz-field" type="password" autoComplete="current-password" placeholder="Password"
                   aria-label="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
            <label className="dz-check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember on this device
            </label>
            <button className="dz-key dz-key-gold cut-s" type="submit" disabled={busy || !pw}>
              {busy ? "Checking" : "Unlock"}
            </button>
          </form>
          <p className="dz-err" role="alert">{msg}</p>
        </div>
      </div>
    );
  }

  // ---- unlocked ----
  const objs = <T,>(a: T[] | undefined): T[] => (Array.isArray(a) ? a.filter((x) => x && typeof x === "object") : []);
  const generated = ms(report?.generated);
  const stale = generated !== null && now - generated > STALE_MS;
  const allFinds = objs(report?.finds);
  const bins = allFinds.filter((f) => f.kind === "bin");
  const closingSoon = allFinds.filter((f) => {
    if (f.kind !== "auction") return false;
    const e = ms(f.ends);
    return e !== null && e > now;
  });
  const watching = objs(report?.watch).filter((w) => {
    const e = ms(w.ends);
    return e === null || e > now;
  });
  const market = objs(report?.market);
  const sold = objs(report?.sold);
  const selling = objs(report?.selling);
  const pass = (l: Listing) => !vettedOnly || vetOf(l).status === "vetted";
  const binsShown = bins.filter(pass), closingShown = closingSoon.filter(pass), watchShown = watching.filter(pass);
  const hiddenDeals = bins.length + closingSoon.length - binsShown.length - closingShown.length;
  const hiddenWatch = watching.length - watchShown.length;
  const demand = market.filter((m) => m.auction && num(m.auction.n_ended));
  const soldCount = sold.filter((s) => s.sold).length;

  const q = report?.quota;
  const left = num(q?.left) ?? num(report?.status?.calls_left);
  const limit = num(q?.limit) ?? 5000;
  const resets = ms(q?.resets);
  const low = left !== null && left < LOW_CALLS;
  const marketMs = ms(report?.market_ts);

  let sync = generated !== null ? `Updated ${ago(now - generated)}` : "No report yet";
  let syncTone = "";
  if (scanPhase === "scanning") sync = "Scanning eBay now";
  else if (scanPhase === "waiting") sync = "Scan requested. Waiting for the home PC";
  else if (scanPhase === "noanswer") { sync = "The home PC has not answered. It may be off or busy"; syncTone = "hot"; }
  else if (netMsg) { sync = netMsg; syncTone = "hot"; }
  else if (stale && generated !== null) { sync = `Last update ${ago(now - generated)}. The home PC may be off`; syncTone = "hot"; }

  const filterRow = (hidden: number) => (
    <div className="dz-filter">
      <span className="dz-filter-t">
        {vettedOnly
          ? (hidden > 0 ? `${hidden} more with cautions or not read yet` : "Showing vetted listings")
          : "Showing every listing under the limit"}
      </span>
      <button type="button" className="dz-switch" aria-pressed={vettedOnly} onClick={toggleVetted}>
        Vetted only<i />
      </button>
    </div>
  );

  return (
    <div className={shell}>
      <header className="dz-top">
        <div className="dz-wrap">
          <div className="dz-top-row">
            <div>
              <h1 className="dz-brand">Deals</h1>
              <button type="button" className="dz-sync" data-tone={syncTone} onClick={() => refresh()}
                      aria-label={`${sync}. Tap to refresh`}>
                {sync}
              </button>
            </div>
            <button type="button" className="dz-quota" data-low={low ? "1" : "0"} aria-expanded={sheet}
                    onClick={() => setSheet(!sheet)} aria-label="eBay calls left today. Tap for details">
              <span className="dz-quota-n num">{left !== null ? count(left) : "n/a"}</span>
              <span className="dz-quota-l">eBay calls left of {count(limit)}</span>
              <span className="dz-quota-bar"><i style={{ width: `${left !== null && limit ? Math.max(0, Math.min(100, (left / limit) * 100)).toFixed(1) : 0}%` }} /></span>
            </button>
          </div>
          {report?.status?.skipped === true && scanPhase === "idle" ? (
            <p className="dz-note" data-tone="hot">The last check was skipped: eBay&apos;s daily call limit was nearly used up.</p>
          ) : null}
          {sheet ? (
            <div className="dz-sheet">
              <p>
                eBay allows {count(limit)} calls a day{left !== null ? ` and ${count(left)} are left` : ""}.
                {resets !== null ? ` The count starts again at ${clock(resets)}.` : ""}
              </p>
              <p>
                A scan usually uses about 60 calls, and up to 240 when many listings are new to it. Scans from this
                key stop below {count(LOW_CALLS)} calls and the automatic checks below {count(STOP_CALLS)}, so the
                price monitor keeps working.
              </p>
              <p>Vetted means the program read the description and found no fault wording, and the seller, photos and postage passed its checks. It is not a person&apos;s judgement: look at the photos before you pay.</p>
              <button type="button" className="dz-link" onClick={lock}>Lock this device</button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="dz-main" ref={mainRef}>
        <div className="dz-wrap dz-view" key={tab}>
          {tab === "deals" ? (
            <>
              {filterRow(hiddenDeals)}
              <h2 className="dz-h">Buy now <small>{plural(binsShown.length, "listing", "listings")}</small></h2>
              {binsShown.length === 0 ? (
                <p className="dz-empty"><b>Nothing to buy under the limit right now.</b> Press Scan to look again, or open Auctions for what is coming up.</p>
              ) : binsShown.map((l, i) => <ListingCard key={text(l.id) || `b${i}`} l={l} mode="bin" now={now} />)}
              {closingShown.length > 0 ? (
                <>
                  <h2 className="dz-h">Auctions closing within 3 hours <small>{closingShown.length}</small></h2>
                  {closingShown.map((l, i) => <ListingCard key={text(l.id) || `c${i}`} l={l} mode="auction" now={now} />)}
                </>
              ) : null}
            </>
          ) : null}

          {tab === "auctions" ? (
            <>
              {filterRow(hiddenWatch)}
              <h2 className="dz-h">Under the limit, closing within 48 hours <small>{watchShown.length}</small></h2>
              {watchShown.length === 0 ? (
                <p className="dz-empty"><b>No auctions to watch.</b> Nothing under the limit closes in the next 48 hours.</p>
              ) : watchShown.map((l, i) => <ListingCard key={text(l.id) || `w${i}`} l={l} mode="auction" now={now} />)}
            </>
          ) : null}

          {tab === "prices" ? (
            <>
              <h2 className="dz-h">What to pay <small>{plural(market.length, "product", "products")}</small></h2>
              {market.length === 0 ? <p className="dz-empty">No prices yet.</p> : (
                <table className="dz-table">
                  <thead>
                    <tr><th>Product</th><th>Asking</th><th>Auctions</th><th>Pay at most</th></tr>
                  </thead>
                  <tbody>
                    {market.map((m, i) => {
                      const a = m.auction;
                      const priced = a ? num(a.n_priced) : null;
                      return (
                        <tr key={text(m.key) || i}>
                          <td className="name">{text(m.product) || "n/a"}</td>
                          <td className="num">{gbp(m.p25, 0) || "n/a"}</td>
                          <td className="num">
                            {a && num(a.median) !== null ? gbp(a.median, 0) : "n/a"}
                            {priced ? <small>{plural(priced, "sale", "sales")}</small> : null}
                          </td>
                          <td className="num lim">{whole(m.max_pay) || "n/a"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p className="dz-cap">
                Asking is the cheaper end of used Buy It Now prices{marketMs !== null
                  ? `, checked ${new Date(marketMs).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}.
                Auctions is the middle price of finished auctions that sold, delivered. Pay at most leaves 30% after eBay fees, postage and packaging.
              </p>
            </>
          ) : null}

          {tab === "sold" ? (
            <>
              {demand.length > 0 ? (
                <>
                  <h2 className="dz-h">Demand, last 30 days</h2>
                  <table className="dz-table">
                    <thead><tr><th>Product</th><th>Sold</th><th>Typical</th><th>Bids</th></tr></thead>
                    <tbody>
                      {demand.map((m, i) => {
                        const a = m.auction as AuctionStat;
                        const avg = num(a.avg_bids);
                        return (
                          <tr key={text(m.key) || i}>
                            <td className="name">{text(m.product) || "n/a"}</td>
                            <td className="num">{count(a.n_sold) || "0"}<small>of {count(a.n_ended)} ended</small></td>
                            <td className="num">{gbp(a.median, 0) || "n/a"}</td>
                            <td className="num">{avg !== null ? avg.toFixed(1) : "n/a"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : null}
              <h2 className="dz-h">Finished auctions <small>what buyers paid</small></h2>
              {sold.length === 0 ? (
                <p className="dz-empty"><b>No finished auctions recorded yet.</b> Each tracked auction appears here with its final price when it closes.</p>
              ) : sold.map((s, i) => {
                const e = ms(s.ended);
                const bidsN = num(s.bids);
                const seenMin = num(s.seen_min_before_end);
                const pic = text(s.image).startsWith(EBAY_IMG_PREFIX) ? sized(text(s.image), 140) : "";
                const href = text(s.url).startsWith(EBAY_PREFIX) ? text(s.url) : "";
                const when = [bidsN !== null ? plural(bidsN, "bid", "bids") : "", e !== null ? ago(now - e) : ""].filter(Boolean).join(", ");
                const inner = (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {pic ? <img className="cut-s" src={pic} alt="" loading="lazy" referrerPolicy="no-referrer" width={56} height={56} /> : <span className="ph cut-s" />}
                    <span>
                      <span className="dz-sold-p">{text(s.product) || "Auction"}</span>
                      <span className="dz-sold-t" style={{ display: "block" }}>{text(s.title)}</span>
                    </span>
                    <span className="dz-sold-r">
                      <b className="num">{s.sold ? gbp(s.total) || "n/a" : "No sale"}</b>
                      {when ? <span>{when}</span> : null}
                      {s.sold && s.exact === false && seenMin !== null ? (
                        <span>seen {Math.round(seenMin)} min before the end</span>
                      ) : null}
                    </span>
                  </>
                );
                return href
                  ? <a key={text(s.legacy) || i} className="dz-sold" data-sold={s.sold ? "1" : "0"} href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
                  : <div key={text(s.legacy) || i} className="dz-sold" data-sold={s.sold ? "1" : "0"}>{inner}</div>;
              })}
              {sold.length > 0 ? <p className="dz-cap">Prices include postage. A finished auction with bids is a real sale, so these show what people pay today.</p> : null}

              {selling.length > 0 ? (
                <>
                  <h2 className="dz-h">Selling now <small>Buy It Now listings we count</small></h2>
                  <table className="dz-table">
                    <thead><tr><th>Product</th><th>Price</th><th>Sold</th><th>A day</th></tr></thead>
                    <tbody>
                      {selling.map((s, i) => {
                        const perDay = num(s.per_day);
                        return (
                          <tr key={text(s.legacy) || i}>
                            <td className="name">{text(s.product) || "n/a"}{text(s.cond) ? <small>{text(s.cond)}</small> : null}</td>
                            <td className="num">{gbp(s.price) || "n/a"}</td>
                            <td className="num">{count(s.sold) || "n/a"}</td>
                            <td className="num">{perDay !== null ? perDay.toFixed(1) : "n/a"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </main>

      <nav className="dz-bar" aria-label="Views">
        {toast ? <div className="dz-toast cut-s" role="status">{toast}</div> : null}
        <div className="dz-wrap dz-bar-row">
          <button type="button" className="dz-tab" aria-current={tab === "deals" ? "page" : undefined} onClick={() => pick("deals")}>
            <b className="num">{binsShown.length + closingShown.length}</b>Deals
          </button>
          <button type="button" className="dz-tab" aria-current={tab === "auctions" ? "page" : undefined} onClick={() => pick("auctions")}>
            <b className="num">{watchShown.length}</b>Auctions
          </button>
          <button type="button" className="dz-scan cut-s" data-busy={running ? "1" : "0"} data-cool={cool > 0 ? "1" : "0"}
                  onClick={pressScan} aria-disabled={running || cool > 0}
                  aria-label={running ? "A scan is running" : cool > 0 ? `Scan again in ${coolMin} minutes` : "Scan eBay now"}>
            {running ? "Scanning" : "Scan"}
            <small>{running ? (scanPhase === "scanning" ? "reading eBay" : "starting") : cool > 0 ? `in ${coolMin} min` : "look now"}</small>
          </button>
          <button type="button" className="dz-tab" aria-current={tab === "prices" ? "page" : undefined} onClick={() => pick("prices")}>
            <b className="num">{market.length || ""}</b>Prices
          </button>
          <button type="button" className="dz-tab" aria-current={tab === "sold" ? "page" : undefined} onClick={() => pick("sold")}>
            <b className="num">{soldCount || ""}</b>Sold
          </button>
        </div>
      </nav>
    </div>
  );
}
