"use client";

import { useEffect, useRef, useState } from "react";

// Private resale deals page. Gated by a password checked server-side by /api/resale
// against the RESALE_KEY secret (never shipped to the client). The password is sent
// only in the x-resale-key header, never in a URL, and is never logged. It is kept
// in localStorage when "Remember on this device" is ticked, otherwise in sessionStorage.
// Same gate shape as /pc-parts deliberately: one pattern to reason about.

type Status = {
  ts?: string; read?: number; clean?: number; calls?: number;
  skipped?: boolean; calls_left?: number | null;
};
type Listing = {
  id?: string; legacy?: string; url?: string; product?: string; title?: string; kind?: string;
  price?: number | null; postage?: number | null; cost?: number | null; max_pay?: number | null;
  resale?: number | null; net?: number | null; profit?: number | null; profit_now?: number | null;
  roi?: number | null; bid_up_to?: number | null; ends?: string | null; hours?: number | null;
  bids?: number | null; condition?: string; feedback?: number | null; returns?: boolean | null;
  where?: string; photos?: number | null; notes?: string[]; desc?: string; seller_notes?: string;
  found_ts?: string; read?: boolean;
};
type MarketRow = {
  key?: string; product?: string; peers?: number; p25?: number | null;
  median?: number | null; net?: number | null; max_pay?: number | null;
};
type SellingRow = {
  product?: string; cond?: string; title?: string; price?: number | null; sold?: number | null;
  days?: number | null; per_day?: number | null; legacy?: string; url?: string;
};
type Report = {
  schema?: number; generated?: string; status?: Status | null; market_ts?: string;
  market?: MarketRow[]; finds?: Listing[]; watch?: Listing[]; selling?: SellingRow[];
};
type Result =
  | { kind: "ok"; report: Report }
  | { kind: "nodata" }
  | { kind: "unauthorized" }
  | { kind: "notset" }
  | { kind: "error" };

const STORE_KEY = "resale_key";
const EBAY_PREFIX = "https://www.ebay.co.uk/itm/";
const STALE_MS = 4 * 3600 * 1000;
const MSG_UNREACHABLE = "Could not reach the server. Try again.";
const MSG_NOT_SET_UP = "The page is not set up yet.";
const MSG_NO_DATA = "No data yet. The first report arrives after the next check.";

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
  if (!res.ok || typeof data !== "object" || data === null) return { kind: "error" };
  const err = (data as { error?: unknown }).error;
  if (err === "no-report-yet") return { kind: "nodata" };
  if (err) return { kind: "error" };
  return { kind: "ok", report: data as Report };
}

// ---- formatting (a missing value gives "" or null, never "undefined" or "NaN") ----
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const gbp = (x: unknown, dp = 2): string => {
  const n = num(x);
  return n === null ? "" : "£" + n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
};
// A limit is never rounded up past what it is: 108.50 shows as £108.
const gbpLimit = (x: unknown): string => {
  const n = num(x);
  return n === null ? "" : gbp(Math.floor(n + 1e-9), 0);
};
const pct = (x: unknown): string => {
  const n = num(x);
  return n === null ? "" : Math.round(n * 100) + "%";
};
const ms = (iso: unknown): number | null => {
  if (typeof iso !== "string" || !iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};
function ago(diff: number): string {
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
}
function endsIn(diff: number): string {
  const min = Math.max(0, Math.floor(diff / 60000));
  if (min < 1) return "Ends in under 1 min";
  if (min < 60) return `Ends in ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `Ends in ${h} h ${min % 60} min`;
  return `Ends in ${Math.floor(h / 24)} days ${h % 24} h`;
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const text = (x: unknown): string => (typeof x === "string" ? x : "");

// ---- styles ----
const FONT = "ui-sans-serif,system-ui,Segoe UI,Arial,sans-serif";
const wrap: React.CSSProperties = {
  maxWidth: 760, margin: "0 auto", padding: "16px 16px 56px", boxSizing: "border-box",
  fontFamily: FONT, color: "#1a1a2e", overflowWrap: "anywhere",
};
const gate: React.CSSProperties = {
  maxWidth: 380, margin: "10vh auto 0", padding: 24, border: "1px solid #e6e6ec",
  borderRadius: 12, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.05)", boxSizing: "border-box",
};
const input: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 16, border: "1px solid #d8d8e0",
  borderRadius: 8, marginBottom: 10, boxSizing: "border-box", minHeight: 44,
};
const btn: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 16, border: 0, borderRadius: 8,
  background: "#1a1a2e", color: "#fff", cursor: "pointer", minHeight: 44,
};
const smallBtn: React.CSSProperties = {
  padding: "8px 14px", fontSize: 14, border: "1px solid #d8d8e0", borderRadius: 8,
  background: "#fff", color: "#1a1a2e", cursor: "pointer", minHeight: 40,
};
const card: React.CSSProperties = {
  border: "1px solid #e6e6ec", borderRadius: 12, background: "#fff", marginBottom: 12,
  padding: 14, boxSizing: "border-box",
};
const h2: React.CSSProperties = { fontSize: 18, margin: "28px 0 10px" };
const muted: React.CSSProperties = { fontSize: 13, color: "#667", lineHeight: 1.5 };
const th: React.CSSProperties = {
  textAlign: "left", padding: "8px 6px", fontSize: 12, color: "#778",
  fontWeight: 600, borderBottom: "1px solid #eee",
};
const td: React.CSSProperties = { padding: "9px 6px", fontSize: 14, borderBottom: "1px solid #f4f4f7", verticalAlign: "top" };
const right: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
const chip: React.CSSProperties = {
  display: "inline-block", fontSize: 12, color: "#8a5200", background: "#fff7e6",
  border: "1px solid #f0dcb0", borderRadius: 999, padding: "3px 10px", margin: "0 6px 6px 0",
};
const grey: React.CSSProperties = {
  display: "inline-block", fontSize: 12, color: "#667", background: "#f1f1f5",
  border: "1px solid #e1e1e8", borderRadius: 999, padding: "3px 10px", marginBottom: 6,
};
const amber: React.CSSProperties = {
  fontSize: 14, color: "#8a5200", background: "#fff7e6", border: "1px solid #f0dcb0",
  borderRadius: 8, padding: "8px 12px", margin: "10px 0 0", lineHeight: 1.5,
};
const notice: React.CSSProperties = {
  fontSize: 14, color: "#1e3a8a", background: "#eef3ff", border: "1px solid #cfdcff",
  borderRadius: 8, padding: "10px 12px", margin: "14px 0 0", lineHeight: 1.5,
};
const linkBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 44,
  marginTop: 10, borderRadius: 8, background: "#0a5ad6", color: "#fff", fontSize: 16,
  textDecoration: "none", boxSizing: "border-box",
};

// ---- one listing ----
function ListingCard({ l, mode, now }: { l: Listing; mode: "bin" | "auction"; now: number }) {
  const [open, setOpen] = useState(false);
  const cost = gbp(l.cost);
  const endMs = ms(l.ends);
  const foundMs = ms(l.found_ts);
  const bids = num(l.bids);
  const facts: string[] = [];
  if (text(l.condition)) facts.push(text(l.condition));
  if (num(l.feedback) !== null) facts.push(`seller feedback ${num(l.feedback)}`);
  if (l.returns === true) facts.push("returns");
  else if (l.returns === false) facts.push("no returns");
  if (text(l.where)) facts.push(text(l.where));
  const photos = num(l.photos);
  if (photos !== null) facts.push(plural(photos, "photo", "photos"));
  const notes = Array.isArray(l.notes) ? l.notes.filter((n) => typeof n === "string" && n) : [];
  const sellerNotes = text(l.seller_notes);
  const desc = text(l.desc);
  const url = text(l.url);
  const unread = mode === "auction" && l.read === false;

  return (
    <div style={card}>
      {text(l.product) ? <div style={{ fontWeight: 700, fontSize: 16 }}>{text(l.product)}</div> : null}
      {text(l.title) ? (
        <div style={{
          fontSize: 14, color: "#445", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere",
        }}>{text(l.title)}</div>
      ) : null}

      <div style={{ marginTop: 10, lineHeight: 1.55 }}>
        {mode === "bin" ? (
          <>
            {cost ? <div style={{ fontSize: 18, fontWeight: 700 }}>{cost} delivered</div> : null}
            {gbpLimit(l.max_pay) ? <div style={{ fontSize: 15 }}>Pay at most {gbpLimit(l.max_pay)}</div> : null}
            {gbp(l.profit, 0) ? (
              <div style={{ fontSize: 15, color: "#0a7d28" }}>
                Profit about {gbp(l.profit, 0)}{pct(l.roi) ? ` (${pct(l.roi)})` : ""}
              </div>
            ) : null}
            {foundMs !== null ? <div style={muted}>Found {ago(now - foundMs)}</div> : null}
          </>
        ) : (
          <>
            {cost ? (
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                Now {cost} delivered{bids !== null ? (bids === 0 ? ", no bids yet" : `, ${plural(bids, "bid", "bids")}`) : ""}
              </div>
            ) : null}
            {gbpLimit(l.bid_up_to) ? <div style={{ fontSize: 15 }}>Bid no more than {gbpLimit(l.bid_up_to)}</div> : null}
            {endMs !== null ? <div style={{ fontSize: 15, fontWeight: 600, color: "#8a5200" }}>{endsIn(endMs - now)}</div> : null}
          </>
        )}
      </div>

      {facts.length ? <div style={{ ...muted, marginTop: 8 }}>{facts.join(" · ")}</div> : null}

      {unread || notes.length ? (
        <div style={{ marginTop: 10 }}>
          {unread ? <span style={{ ...grey, marginRight: 6 }}>Not read yet</span> : null}
          {notes.map((n, i) => <span key={i} style={chip}>{n}</span>)}
        </div>
      ) : null}

      {sellerNotes || desc ? (
        <div style={{ marginTop: 6 }}>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} style={smallBtn}>
            {open ? "Hide description" : "Description"}
          </button>
          {open ? (
            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55 }}>
              {sellerNotes ? (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Seller&apos;s condition notes</div>
                  <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginBottom: 10 }}>{sellerNotes}</div>
                </>
              ) : null}
              {desc ? <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{desc}</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {url.startsWith(EBAY_PREFIX) ? (
        <a href={url} target="_blank" rel="noopener noreferrer" style={linkBtn}>Open on eBay</a>
      ) : null}
    </div>
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
  const [now, setNow] = useState<number>(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const keyRef = useRef("");

  async function unlock(k: string, how: "typed" | "saved") {
    setBusy(true); setMsg("");
    const r = await fetchReport(k);
    setBusy(false);
    if (r.kind === "ok" || r.kind === "nodata") {
      keyRef.current = k;
      if (how === "typed") saveKey(k, remember);
      setReport(r.kind === "ok" ? r.report : null);
      setNow(Date.now());
      setRefreshMsg("");
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

  function lock() {
    clearSaved();
    keyRef.current = "";
    setReport(null); setPw(""); setMsg(""); setRefreshMsg("");
    setPhase("gate");
  }

  async function refresh() {
    setRefreshing(true); setRefreshMsg("");
    const r = await fetchReport(keyRef.current);
    setRefreshing(false);
    if (r.kind === "ok") { setReport(r.report); setNow(Date.now()); }
    else if (r.kind === "nodata") { setReport(null); setNow(Date.now()); }
    else if (r.kind === "unauthorized") lock();
    else setRefreshMsg(r.kind === "notset" ? MSG_NOT_SET_UP : MSG_UNREACHABLE);
  }

  useEffect(() => {
    const saved = readSaved();
    if (saved) unlock(saved, "saved");
    else setPhase("gate");
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  if (phase === "boot") {
    return (
      <div style={wrap}>
        <div style={gate}><p style={{ ...muted, margin: 0 }}>Checking...</p></div>
      </div>
    );
  }

  if (phase === "gate") {
    return (
      <div style={wrap}>
        <div style={gate}>
          <h1 style={{ fontSize: 22, margin: "0 0 14px" }}>Deals</h1>
          <form onSubmit={(e) => { e.preventDefault(); if (pw && !busy) unlock(pw, "typed"); }}>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                   autoComplete="current-password" placeholder="Password" aria-label="Password"
                   autoFocus style={input} />
            <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40, fontSize: 15, marginBottom: 10 }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                     style={{ width: 20, height: 20 }} />
              Remember on this device
            </label>
            <button type="submit" disabled={busy || !pw} style={{ ...btn, opacity: busy || !pw ? 0.6 : 1 }}>
              {busy ? "Checking..." : "Unlock"}
            </button>
          </form>
          {msg ? <p role="alert" style={{ color: "#c01616", fontSize: 15, margin: "12px 0 0" }}>{msg}</p> : null}
        </div>
      </div>
    );
  }

  // ---- unlocked ----
  const generated = ms(report?.generated);
  const stale = generated !== null && now - generated > STALE_MS;
  const finds = Array.isArray(report?.finds) ? report!.finds!.filter((x) => x && typeof x === "object") : [];
  const watchAll = Array.isArray(report?.watch) ? report!.watch!.filter((x) => x && typeof x === "object") : [];
  const market = Array.isArray(report?.market) ? report!.market!.filter((x) => x && typeof x === "object") : [];
  const selling = Array.isArray(report?.selling) ? report!.selling!.filter((x) => x && typeof x === "object") : [];
  const byFound = (a: Listing, b: Listing) => (ms(b.found_ts) ?? 0) - (ms(a.found_ts) ?? 0);
  const byEnd = (a: Listing, b: Listing) => (ms(a.ends) ?? 0) - (ms(b.ends) ?? 0);
  const live = (l: Listing) => { const e = ms(l.ends); return e !== null && e > now; };
  const bins = finds.filter((f) => f.kind === "bin").sort(byFound);
  const aucs = finds.filter((f) => f.kind === "auction" && live(f)).sort(byEnd);
  const watch = watchAll.filter(live).sort(byEnd);
  const marketTs = ms(report?.market_ts);

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Deals</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={refresh} disabled={refreshing} style={{ ...smallBtn, opacity: refreshing ? 0.6 : 1 }}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" onClick={lock} style={smallBtn}>Lock</button>
        </div>
      </div>
      {generated !== null ? <div style={{ ...muted, marginTop: 6 }}>Updated {ago(now - generated)}</div> : null}
      {refreshMsg ? <div role="alert" style={{ color: "#c01616", fontSize: 14, marginTop: 6 }}>{refreshMsg}</div> : null}
      {stale && generated !== null ? (
        <div style={amber}>Last update was {ago(now - generated)}. The home PC may be off.</div>
      ) : null}
      {report?.status?.skipped === true ? (
        <div style={amber}>The last check was skipped: eBay&apos;s daily call limit was nearly used up.</div>
      ) : null}

      <div style={notice}>
        Automatic check. Nobody has read these listings. Read the description and look at the photos before you buy or bid.
      </div>

      {report === null ? (
        <p style={{ ...muted, fontSize: 15, marginTop: 20 }}>{MSG_NO_DATA}</p>
      ) : (
        <>
          <h2 style={h2}>Buy it now</h2>
          {bins.length
            ? bins.map((l, i) => <ListingCard key={l.id || l.legacy || i} l={l} mode="bin" now={now} />)
            : <p style={muted}>Nothing new under the limit right now.</p>}

          {aucs.length ? (
            <>
              <h2 style={h2}>Auctions ending soon</h2>
              {aucs.map((l, i) => <ListingCard key={l.id || l.legacy || i} l={l} mode="auction" now={now} />)}
            </>
          ) : null}

          <h2 style={h2}>Auctions to watch</h2>
          {watch.length
            ? watch.map((l, i) => <ListingCard key={l.id || l.legacy || i} l={l} mode="auction" now={now} />)
            : <p style={muted}>No auctions under the limit in the next 48 hours.</p>}

          {market.length ? (
            <>
              <h2 style={h2}>Pay at most</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr><th style={th}>Product</th><th style={{ ...th, ...right }}>Sells for</th><th style={{ ...th, ...right }}>Pay at most</th></tr>
                  </thead>
                  <tbody>
                    {market.map((m, i) => (
                      <tr key={m.key || i}>
                        <td style={td}>{text(m.product)}</td>
                        <td style={{ ...td, ...right }}>{gbp(m.p25)}</td>
                        <td style={{ ...td, ...right, fontWeight: 700 }}>{gbpLimit(m.max_pay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...muted, marginTop: 8 }}>
                {marketTs !== null
                  ? `Prices checked ${new Date(marketTs).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. `
                  : ""}
                &apos;Sells for&apos; is the cheaper end of used asking prices, not sold prices.
              </p>
            </>
          ) : null}

          {selling.length ? (
            <>
              <h2 style={h2}>Selling now</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Product</th><th style={{ ...th, ...right }}>Price</th>
                      <th style={{ ...th, ...right }}>Sold</th><th style={{ ...th, ...right }}>Per day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selling.map((s, i) => (
                      <tr key={s.legacy || i}>
                        <td style={td}>
                          {text(s.product)}
                          {text(s.cond) ? <span style={{ color: "#778", fontSize: 12 }}> ({text(s.cond)})</span> : null}
                        </td>
                        <td style={{ ...td, ...right }}>{gbp(s.price)}</td>
                        <td style={{ ...td, ...right }}>{num(s.sold) !== null ? num(s.sold) : ""}</td>
                        <td style={{ ...td, ...right }}>
                          {num(s.per_day) !== null ? num(s.per_day)!.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...muted, marginTop: 8 }}>Real sales counted from eBay listings we track.</p>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
