"use client";

import { useEffect, useMemo, useState } from "react";

// Private PC component price report. Gated by a passkey checked server-side by
// /api/pcparts against the PCPARTS_KEY secret (never shipped to the client).
// The passkey the user types is held only in sessionStorage for the tab session.
// Same shape as /homefinder deliberately — one gate pattern to reason about.

type Offer = {
  site: string; shop: string; price: number; in_stock: boolean | null;
  name?: string; url?: string; ts?: string; marketplace?: boolean; stale?: boolean;
};
type Point = { ts: string; site: string; price: number };
type Stats = {
  n?: number; days?: number; min?: number; median?: number; max?: number; pct_rank?: number;
};
type Item = {
  id: string; label: string; category: string; query?: string;
  target?: number | null; notes?: string; seen?: string;
  verdict: string; why: string;
  best_retail?: Offer | null; best_market?: Offer | null;
  offers: Offer[]; history: Point[]; stats: Stats;
};
type Source = {
  site: string; shop: string; mode?: string; enabled?: boolean; marketplace?: boolean;
  last_ok_hours?: number | null; healthy?: boolean; note?: string;
};
type Report = {
  generated?: string; currency?: string;
  build?: { retail_total?: number | null; market_total?: number | null;
            complete?: boolean; priced?: number; total?: number };
  season?: { now?: { name: string; why: string } | null;
             next?: { name: string; days: number; why: string } };
  sources?: Source[];
  items?: Item[];
  min_days_for_verdict?: number;
  refresh_state?: string;
};

const VERDICT: Record<string, { bg: string; fg: string; bd: string }> = {
  BUY: { bg: "#e6f4e6", fg: "#0a7d28", bd: "#bfe0bf" },
  CONSIDER: { bg: "#e8eefb", fg: "#0a5ad6", bd: "#c3d3f2" },
  WAIT: { bg: "#fff7e6", fg: "#b06b00", bd: "#f0dcb0" },
  "TOO EARLY": { bg: "#f0f1f4", fg: "#667", bd: "#dde" },
  "NO DATA": { bg: "#f7f7f9", fg: "#99a", bd: "#e6e6ec" },
};
// Stable per-shop colours so a line means the same shop in every chart.
const SHOP_COLOUR: Record<string, string> = {
  scan: "#c0392b", amazon: "#e67e22", "awd-it": "#2980b9", novatech: "#16a085",
  currys: "#8e44ad", ebay: "#7f8c8d", argos: "#d35400", ccl: "#2c3e50",
  ebuyer: "#27ae60", laptopsdirect: "#95a5a6",
};
const colourFor = (site: string) => SHOP_COLOUR[site] || "#556";

const gbp = (n?: number | null, dp = 2) =>
  n || n === 0 ? "£" + n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : "—";

const wrap: React.CSSProperties = {
  maxWidth: 1080, margin: "0 auto", padding: "28px 18px 64px",
  fontFamily: "ui-sans-serif,system-ui,Segoe UI,Arial,sans-serif", color: "#1a1a2e",
};
const gate: React.CSSProperties = {
  maxWidth: 380, margin: "12vh auto", padding: 26, border: "1px solid #e6e6ec",
  borderRadius: 12, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.05)",
};
const input: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 15, border: "1px solid #d8d8e0",
  borderRadius: 8, marginBottom: 10, boxSizing: "border-box",
};
const btn: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 15, border: 0, borderRadius: 8,
  background: "#1a1a2e", color: "#fff", cursor: "pointer",
};
const card: React.CSSProperties = {
  border: "1px solid #e6e6ec", borderRadius: 12, background: "#fff", marginBottom: 12,
  overflow: "hidden",
};
const th: React.CSSProperties = {
  textAlign: "left", padding: "6px 10px", fontSize: 12, color: "#778",
  fontWeight: 600, borderBottom: "1px solid #eee",
};
const td: React.CSSProperties = { padding: "7px 10px", fontSize: 13, borderBottom: "1px solid #f4f4f7" };

function Badge({ v }: { v: string }) {
  const s = VERDICT[v] || VERDICT["NO DATA"];
  return (
    <span style={{
      background: s.bg, color: s.fg, border: `1px solid ${s.bd}`, borderRadius: 999,
      padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: .3, whiteSpace: "nowrap",
    }}>{v}</span>
  );
}

/** Multi-shop price history. One line per shop, plus the target as a dashed rule. */
function Chart({ history, target }: { history: Point[]; target?: number | null }) {
  const W = 620, H = 150, PAD = { l: 52, r: 12, t: 12, b: 22 };
  if (!history || history.length < 2) {
    return (
      <div style={{ padding: "18px 10px", fontSize: 12, color: "#99a" }}>
        Not enough history to plot yet — this fills in as the tracker runs.
      </div>
    );
  }
  const xs = history.map((p) => new Date(p.ts).getTime());
  const ys = history.map((p) => p.price).concat(target ? [target] : []);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 === y0) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.08;
  y0 -= pad; y1 += pad;
  const px = (t: number) => PAD.l + ((t - x0) / Math.max(x1 - x0, 1)) * (W - PAD.l - PAD.r);
  const py = (v: number) => PAD.t + (1 - (v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);

  const bySite = new Map<string, Point[]>();
  for (const p of history) {
    if (!bySite.has(p.site)) bySite.set(p.site, []);
    bySite.get(p.site)!.push(p);
  }
  const ticks = [y0 + (y1 - y0) * 0.05, (y0 + y1) / 2, y1 - (y1 - y0) * 0.05];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}
         role="img" aria-label="Price history by shop">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={py(t)} y2={py(t)} stroke="#f0f0f4" />
          <text x={PAD.l - 6} y={py(t) + 3} textAnchor="end" fontSize="9" fill="#99a">
            {"£" + Math.round(t).toLocaleString("en-GB")}
          </text>
        </g>
      ))}
      {target ? (
        <>
          <line x1={PAD.l} x2={W - PAD.r} y1={py(target)} y2={py(target)}
                stroke="#0a7d28" strokeDasharray="4 3" strokeWidth="1" />
          <text x={W - PAD.r} y={py(target) - 4} textAnchor="end" fontSize="9" fill="#0a7d28">
            target
          </text>
        </>
      ) : null}
      {[...bySite.entries()].map(([site, pts]) => {
        const sorted = [...pts].sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
        const d = sorted.map((p, i) =>
          `${i ? "L" : "M"}${px(+new Date(p.ts)).toFixed(1)},${py(p.price).toFixed(1)}`).join(" ");
        return (
          <g key={site}>
            <path d={d} fill="none" stroke={colourFor(site)} strokeWidth="1.6"
                  strokeLinejoin="round" />
            {sorted.map((p, i) => (
              <circle key={i} cx={px(+new Date(p.ts))} cy={py(p.price)} r="2"
                      fill={colourFor(site)}>
                <title>{`${site} · £${p.price.toLocaleString("en-GB")} · ${new Date(p.ts).toLocaleString("en-GB")}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function OfferRow({ o, target }: { o: Offer; target?: number | null }) {
  const gap = target ? ((o.price - target) / target) * 100 : null;
  return (
    <tr>
      <td style={td}>
        <span style={{
          display: "inline-block", width: 8, height: 8, borderRadius: 2,
          background: colourFor(o.site), marginRight: 7,
        }} />
        {o.shop}
        {o.marketplace ? (
          <span style={{ marginLeft: 6, fontSize: 10, color: "#b06b00", border: "1px solid #f0dcb0",
                         background: "#fff7e6", borderRadius: 4, padding: "1px 5px" }}>
            marketplace
          </span>
        ) : null}
        {o.stale ? (
          <span style={{ marginLeft: 6, fontSize: 10, color: "#99a" }}>stale</span>
        ) : null}
      </td>
      <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>{gbp(o.price)}</td>
      <td style={{ ...td, whiteSpace: "nowrap", color: gap && gap <= 0 ? "#0a7d28" : "#889" }}>
        {gap === null ? "—" : (gap > 0 ? "+" : "") + gap.toFixed(1) + "%"}
      </td>
      <td style={{ ...td, whiteSpace: "nowrap" }}>
        {o.in_stock === true ? <span style={{ color: "#0a7d28" }}>in stock</span>
          : o.in_stock === false ? <span style={{ color: "#c01616" }}>out</span>
          : <span style={{ color: "#aab" }}>unknown</span>}
      </td>
      <td style={{ ...td, color: "#778", maxWidth: 320, overflow: "hidden",
                   textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={o.name || ""}>{o.name || ""}</td>
      <td style={td}>
        {o.url ? <a href={o.url} target="_blank" rel="noreferrer"
                    style={{ color: "#0a5ad6", textDecoration: "none" }}>open ↗</a> : "—"}
      </td>
    </tr>
  );
}

function ItemCard({ it, open, onToggle, showMarket }:
  { it: Item; open: boolean; onToggle: () => void; showMarket: boolean }) {
  const best = it.best_retail;
  const offers = showMarket ? it.offers : it.offers.filter((o) => !o.marketplace);
  const spread = offers.length > 1
    ? ((offers[offers.length - 1].price - offers[0].price) / offers[0].price) * 100
    : null;

  return (
    <div style={card}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
        background: "none", border: 0, cursor: "pointer", textAlign: "left",
      }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{it.label}</div>
          <div style={{ fontSize: 11, color: "#99a", marginTop: 2 }}>
            {it.category}{it.stats?.n ? ` · ${it.stats.n} observations` : ""}
            {offers.length ? ` · ${offers.length} shop${offers.length > 1 ? "s" : ""}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 120 }}>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{gbp(best?.price)}</div>
          <div style={{ fontSize: 11, color: "#99a" }}>{best?.shop || "no retail price"}</div>
        </div>
        <div style={{ minWidth: 108, textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#778" }}>
            target {it.target ? gbp(it.target, 0) : "—"}
          </div>
          {best && it.target ? (
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: best.price <= it.target ? "#0a7d28" : "#b06b00",
            }}>
              {(best.price > it.target ? "+" : "") +
                (((best.price - it.target) / it.target) * 100).toFixed(1)}%
            </div>
          ) : null}
        </div>
        <Badge v={it.verdict} />
        <span style={{ color: "#bbc", fontSize: 13, width: 12 }}>{open ? "▾" : "▸"}</span>
      </button>

      {open ? (
        <div style={{ borderTop: "1px solid #f0f0f4", padding: "12px 16px 16px", background: "#fcfcfd" }}>
          <p style={{ fontSize: 13, color: "#556", margin: "0 0 10px" }}>{it.why}</p>
          {it.notes ? (
            <p style={{ fontSize: 12, color: "#778", margin: "0 0 12px", fontStyle: "italic" }}>
              {it.notes}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12,
                        color: "#667", marginBottom: 12 }}>
            {it.stats?.min ? <span>seen low <b>{gbp(it.stats.min)}</b></span> : null}
            {it.stats?.median ? <span>median <b>{gbp(it.stats.median)}</b></span> : null}
            {it.stats?.max ? <span>seen high <b>{gbp(it.stats.max)}</b></span> : null}
            {spread !== null ? <span>shop spread <b>{spread.toFixed(0)}%</b></span> : null}
            {it.best_market ? (
              <span>marketplace <b>{gbp(it.best_market.price)}</b> ({it.best_market.shop})</span>
            ) : null}
          </div>

          <Chart history={it.history} target={it.target} />

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead>
              <tr>
                <th style={th}>Shop</th><th style={th}>Price</th><th style={th}>vs target</th>
                <th style={th}>Stock</th><th style={th}>Listing</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => <OfferRow key={o.site} o={o} target={it.target} />)}
              {!offers.length ? (
                <tr><td style={{ ...td, color: "#99a" }} colSpan={6}>
                  No shop is currently reporting a price for this part.
                </td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function PcParts() {
  const [key, setKey] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState("gap");
  const [showMarket, setShowMarket] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  async function load(k: string) {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/pcparts", { headers: { "x-pcparts-key": k } });
      if (r.status === 401) { setErr("Incorrect passkey."); setLoading(false); return; }
      const data = await r.json();
      if (data.error === "no-report-yet") { setErr("No report has been published yet."); setLoading(false); return; }
      if (data.error) { setErr("Service not ready (" + data.error + ")."); setLoading(false); return; }
      sessionStorage.setItem("pcp_key", k);
      setReport(data);
    } catch { setErr("Network error — try again."); }
    setLoading(false);
  }

  async function requestRefresh() {
    const k = sessionStorage.getItem("pcp_key") || key;
    setRefreshing(true); setRefreshMsg("");
    try {
      const r = await fetch("/api/pcparts", {
        method: "POST",
        headers: { "x-pcparts-key": k, "content-type": "application/json" },
        body: JSON.stringify({ action: "request_refresh" }),
      });
      if (r.ok) setRefreshMsg("Refresh requested — your PC re-scrapes on its next cycle and republishes.");
      else if (r.status === 401) setRefreshMsg("Passkey rejected.");
      else setRefreshMsg("Couldn't request a refresh (" + r.status + ").");
    } catch { setRefreshMsg("Network error requesting refresh."); }
    setTimeout(() => setRefreshing(false), 4000);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("pcp_key");
    if (saved) { setKey(saved); load(saved); }
  }, []);

  const items = useMemo(() => {
    const list = [...(report?.items || [])];
    const gapOf = (i: Item) =>
      i.best_retail && i.target ? (i.best_retail.price - i.target) / i.target : 9e9;
    if (sort === "gap") list.sort((a, b) => gapOf(a) - gapOf(b));
    else if (sort === "price") list.sort((a, b) => (b.best_retail?.price || 0) - (a.best_retail?.price || 0));
    else if (sort === "name") list.sort((a, b) => a.label.localeCompare(b.label));
    else if (sort === "verdict") {
      const rank: Record<string, number> = { BUY: 0, CONSIDER: 1, WAIT: 2, "TOO EARLY": 3, "NO DATA": 4 };
      list.sort((a, b) => (rank[a.verdict] ?? 9) - (rank[b.verdict] ?? 9));
    }
    return list;
  }, [report, sort]);

  if (!report) {
    return (
      <main style={wrap}>
        <div style={gate}>
          <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>🖥️ PC Build Price Tracker</h1>
          <p style={{ color: "#667", fontSize: 14, marginTop: 0 }}>Enter your passkey to view.</p>
          <form onSubmit={(e) => { e.preventDefault(); load(key); }}>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)}
                   placeholder="Passkey" autoFocus style={input} />
            <button type="submit" disabled={loading || !key} style={btn}>
              {loading ? "Checking…" : "View report"}
            </button>
          </form>
          {err && <p style={{ color: "#c01616", fontSize: 14 }}>{err}</p>}
        </div>
      </main>
    );
  }

  const b = report.build || {};
  const buys = items.filter((i) => i.verdict === "BUY").length;

  return (
    <main style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>🖥️ PC Build Price Tracker</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={requestRefresh} disabled={refreshing}
                  title="Ask the home PC to re-scrape on its next cycle"
                  style={{ ...btn, width: "auto", padding: "6px 12px", fontSize: 13,
                           background: refreshing ? "#9bb" : "#0a7d28" }}>
            {refreshing ? "Requested…" : "↻ Refresh"}
          </button>
          <button onClick={() => { sessionStorage.removeItem("pcp_key"); setReport(null); setKey(""); }}
                  style={{ ...btn, width: "auto", padding: "6px 12px", fontSize: 13 }}>Lock</button>
        </div>
      </div>

      <p style={{ color: "#778", fontSize: 13, marginTop: 0 }}>
        Live UK component prices, polled hourly across {(report.sources || []).filter((s) => s.enabled).length} shops
        {report.generated ? ` · updated ${new Date(report.generated).toLocaleString("en-GB")}` : ""}
        {report.refresh_state === "running" ? <span style={{ color: "#0a7d28" }}> · refresh running…</span> : null}
      </p>
      {refreshMsg ? <p style={{ fontSize: 12, color: "#0a7d28" }}>{refreshMsg}</p> : null}

      {/* Build total */}
      <div style={{ ...card, display: "flex", gap: 28, flexWrap: "wrap", padding: "16px 18px",
                    alignItems: "center", marginTop: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "#99a", textTransform: "uppercase", letterSpacing: .6 }}>
            Build total, cheapest retail
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>
            {b.complete ? gbp(b.retail_total, 0) : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#99a" }}>
            {b.priced}/{b.total} parts priced
            {!b.complete ? " · total needs every part priced" : ""}
          </div>
        </div>
        {b.complete && b.market_total ? (
          <div>
            <div style={{ fontSize: 11, color: "#99a", textTransform: "uppercase", letterSpacing: .6 }}>
              Incl. marketplace
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#556" }}>{gbp(b.market_total, 0)}</div>
            <div style={{ fontSize: 11, color: "#99a" }}>seller-dependent, no retail warranty</div>
          </div>
        ) : null}
        <div>
          <div style={{ fontSize: 11, color: "#99a", textTransform: "uppercase", letterSpacing: .6 }}>
            At buy price
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: buys ? "#0a7d28" : "#556" }}>
            {buys} of {items.length}
          </div>
        </div>
        {report.season?.now ? (
          <div style={{ flex: 1, minWidth: 220, background: "#eef6ee", borderLeft: "3px solid #0a7d28",
                        padding: "8px 12px", borderRadius: 6, fontSize: 12, color: "#365" }}>
            <b>{report.season.now.name}</b> is live — {report.season.now.why}
          </div>
        ) : report.season?.next ? (
          <div style={{ flex: 1, minWidth: 220, background: "#f7f7f9", borderLeft: "3px solid #ccd",
                        padding: "8px 12px", borderRadius: 6, fontSize: 12, color: "#667" }}>
            Next discount window: <b>{report.season.next.name}</b> in {report.season.next.days} days
            {report.season.next.why ? ` — ${report.season.next.why}` : ""}
          </div>
        ) : null}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap",
                    margin: "18px 0 10px", fontSize: 13, color: "#556" }}>
        <label>
          Sort{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value)}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d8d8e0" }}>
            <option value="gap">closest to target</option>
            <option value="verdict">verdict</option>
            <option value="price">price, high to low</option>
            <option value="name">name</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={showMarket}
                 onChange={(e) => setShowMarket(e.target.checked)} />
          show marketplace listings
        </label>
        <button onClick={() => setOpenIds(Object.fromEntries(items.map((i) => [i.id, true])))}
                style={{ background: "none", border: 0, color: "#0a5ad6", cursor: "pointer", fontSize: 13 }}>
          expand all
        </button>
        <button onClick={() => setOpenIds({})}
                style={{ background: "none", border: 0, color: "#0a5ad6", cursor: "pointer", fontSize: 13 }}>
          collapse all
        </button>
      </div>

      {items.map((it) => (
        <ItemCard key={it.id} it={it} showMarket={showMarket}
                  open={!!openIds[it.id]}
                  onToggle={() => setOpenIds((s) => ({ ...s, [it.id]: !s[it.id] }))} />
      ))}

      {/* Source health — say plainly which shops are not reporting */}
      <h2 style={{ fontSize: 15, marginTop: 28, marginBottom: 8 }}>Shops</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(report.sources || []).map((s) => (
          <div key={s.site} title={s.note || ""}
               style={{
                 border: "1px solid #e6e6ec", borderRadius: 8, padding: "6px 10px", fontSize: 12,
                 background: !s.enabled ? "#f7f7f9" : s.healthy ? "#fff" : "#fff7e6",
                 color: !s.enabled ? "#aab" : "#445",
               }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999,
                           marginRight: 6,
                           background: !s.enabled ? "#ccd" : s.healthy ? "#0a7d28" : "#e0a500" }} />
            {s.shop}
            <span style={{ color: "#aab", marginLeft: 6 }}>
              {!s.enabled ? "disabled"
                : s.last_ok_hours === null || s.last_ok_hours === undefined ? "no data"
                : s.last_ok_hours < 2 ? "live"
                : `${s.last_ok_hours}h ago`}
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: "#99a", marginTop: 24, lineHeight: 1.6 }}>
        Verdicts are percentile calls against this tracker&apos;s own observed history — there is no
        external price history for these parts, so it builds its own. Anything with under{" "}
        {report.min_days_for_verdict ?? 10} days behind it reads <b>TOO EARLY</b> rather than
        pretending a percentile means something. Prices in an alert are re-checked on the
        product page before being trusted; search-page prices sometimes disagree.
        Informational only, not advice.
      </p>
    </main>
  );
}
