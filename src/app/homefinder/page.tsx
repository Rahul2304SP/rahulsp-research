"use client";

import { useEffect, useState } from "react";

// Private property valuation report. Gated by a passkey checked server-side by
// /api/homefinder against the HOMEFINDER_KEY secret (never shipped to the client).
// The passkey the user types is held only in sessionStorage for the tab session.

type Prop = {
  address: string; postcode?: string; type?: string; beds?: number; asking?: number;
  floor_area_m2?: number; verdict?: string; verdict_color?: string;
  fair_value?: number; fair_low?: number; fair_high?: number;
  avm_value?: number; avm_low?: number; avm_high?: number;
  ppm2_local?: number; fair_by_area?: number; suggested_offer?: number;
  asking_pct?: number; n_comps?: number; geo_label?: string; confidence?: string;
  url?: string; notes?: string[];
  ratio?: number; portal?: string; uid?: string;
  floor_area_source?: string; full_postcode?: string;
  condition?: { condition?: string; condition_label?: string; value_adjustment_pct?: number;
                confidence?: number; issues?: string[]; highlights?: string[] };
  amenities?: { flood?: { flood_summary?: string; flood_areas_nearby?: number };
                schools?: { primary?: School; secondary?: School }; schools_link?: string };
  photos?: string[]; floorplan?: string[]; key_features?: string[];
  nearest_stations?: { name?: string; miles?: number }[];
  tenure?: string; council_tax_band?: string; epc_graph?: string; description?: string;
  history?: { last_date?: string; last_price?: number; years_ago?: number;
              index_implied_today?: number; index_growth_pct?: number; sales?: [string, number][] };
  area?: { ward?: string; crime_count?: number; crime_month?: string;
           crime_top?: [string, number][]; lat?: number; lng?: number; lsoa?: string };
};
type School = { name?: string; miles?: number; ofsted?: string; ofsted_date?: string; postcode?: string };
// A market row now carries the full valuation basis + enrichment, so the
// click-through detail view can render the same depth as a shortlist card.
type MarketRow = Prop;
type Report = {
  generated?: string; criteria?: string; properties?: Prop[];
  market?: MarketRow[];
  market_summary?: { total?: number; good?: number; fair?: number; over?: number };
  refresh_state?: string;
};

const gbp = (n?: number) => (n || n === 0 ? "£" + n.toLocaleString("en-GB") : "—");

export default function HomeFinder() {
  const [key, setKey] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  async function requestRefresh() {
    const k = sessionStorage.getItem("hf_key") || key;
    setRefreshing(true); setRefreshMsg("");
    try {
      const r = await fetch("/api/homefinder", {
        method: "POST",
        headers: { "x-homefinder-key": k, "content-type": "application/json" },
        body: JSON.stringify({ action: "request_refresh" }),
      });
      if (r.ok) {
        setRefreshMsg("Refresh requested — your home PC will re-scrape new listings and re-publish shortly. Re-open the report in a few minutes.");
      } else if (r.status === 401) {
        setRefreshMsg("Passkey rejected.");
      } else {
        setRefreshMsg("Couldn't request a refresh (" + r.status + ").");
      }
    } catch { setRefreshMsg("Network error requesting refresh."); }
    setTimeout(() => setRefreshing(false), 4000);
  }

  async function load(k: string) {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/homefinder", { headers: { "x-homefinder-key": k } });
      if (r.status === 401) { setErr("Incorrect passkey."); setLoading(false); return; }
      const data = await r.json();
      if (data.error === "no-report-yet") { setErr("No report has been published yet."); setLoading(false); return; }
      if (data.error) { setErr("Service not ready (" + data.error + ")."); setLoading(false); return; }
      sessionStorage.setItem("hf_key", k);
      setReport(data);
    } catch { setErr("Network error — try again."); }
    setLoading(false);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("hf_key");
    if (saved) { setKey(saved); load(saved); }
  }, []);

  if (!report) {
    return (
      <main style={wrap}>
        <div style={gate}>
          <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>🏡 Private Valuation Report</h1>
          <p style={{ color: "#667", fontSize: 14, marginTop: 0 }}>Enter your passkey to view.</p>
          <form onSubmit={(e) => { e.preventDefault(); load(key); }}>
            <input
              type="password" value={key} onChange={(e) => setKey(e.target.value)}
              placeholder="Passkey" autoFocus style={input}
            />
            <button type="submit" disabled={loading || !key} style={btn}>
              {loading ? "Checking…" : "View report"}
            </button>
          </form>
          {err && <p style={{ color: "#c01616", fontSize: 14 }}>{err}</p>}
        </div>
      </main>
    );
  }

  const props = report.properties || [];
  return (
    <main style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>🏡 Private Valuation Report</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={requestRefresh} disabled={refreshing}
                  title="Re-scrape new listings, OCR floor plans and re-value (runs on the home PC; only new properties cost compute)"
                  style={{ ...btn, width: "auto", padding: "6px 12px", fontSize: 13, background: refreshing ? "#9bb" : "#0a7d28" }}>
            {refreshing ? "Refresh requested…" : "↻ Refresh data"}
          </button>
          <button onClick={() => { sessionStorage.removeItem("hf_key"); setReport(null); setKey(""); }}
                  style={{ ...btn, width: "auto", padding: "6px 12px", fontSize: 13 }}>Lock</button>
        </div>
      </div>
      <p style={{ color: "#778", fontSize: 13 }}>
        {report.criteria || ""} · updated {report.generated ? new Date(report.generated).toLocaleString("en-GB") : ""}
        {report.refresh_state === "running" ? <span style={{ color: "#0a7d28" }}> · refresh running…</span> : null}
      </p>
      {refreshMsg && <p style={{ color: "#0a7d28", fontSize: 12.5, marginTop: -4 }}>{refreshMsg}</p>}

      {report.market && report.market.length > 0 && <Market report={report} />}

      <h2 style={{ fontSize: 18, margin: "26px 0 2px" }}>Your shortlist</h2>
      <p style={{ color: "#889", fontSize: 12.5, marginTop: 0 }}>Detailed valuation, sale history &amp; area for the properties you're tracking.</p>
      {props.length === 0 && <p style={{ color: "#889", fontSize: 13 }}>No shortlisted properties yet.</p>}
      {props.map((p, i) => <Card key={i} p={p} />)}
      <p style={{ color: "#9aa", fontSize: 11, marginTop: 24 }}>
        HM Land Registry sold prices (time-adjusted via UKHPI), EPC floor areas, a LightGBM AVM,
        plus police.uk crime. Guidance only, not a survey.
      </p>
    </main>
  );
}

type SortKey = "ratio" | "asking" | "fair_value" | "delta" | "suggested_offer";

function Market({ report }: { report: Report }) {
  const rows = report.market || [];
  const s = report.market_summary || {};
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("ratio");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [sel, setSel] = useState<Prop | null>(null);

  const val = (m: Prop, k: SortKey): number => {
    if (k === "delta" || k === "ratio") return m.ratio ?? 9;
    return (m[k as "asking" | "fair_value" | "suggested_offer"] as number) ?? (sortDir === 1 ? Infinity : -Infinity);
  };
  const sorted = [...rows].sort((a, b) => (val(a, sortKey) - val(b, sortKey)) * sortDir);
  const shown = showAll ? sorted : sorted.slice(0, 40);
  const setSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === 1 ? -1 : 1);
    else { setSortKey(k); setSortDir(k === "ratio" ? 1 : -1); }
  };
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === 1 ? " ▲" : " ▼") : "");

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Swindon market — {s.total ?? rows.length} current listings</h2>
        <div style={{ fontSize: 12.5 }}>
          <span style={{ color: "#0a7d28", fontWeight: 600 }}>{s.good ?? 0} good value</span> ·{" "}
          <span style={{ color: "#b06b00" }}>{s.fair ?? 0} fair</span> ·{" "}
          <span style={{ color: "#c01616" }}>{s.over ?? 0} overpriced</span>
        </div>
      </div>
      <p style={{ color: "#889", fontSize: 12, margin: "4px 0 8px" }}>
        Every listing valued against time-adjusted sold comps. Click a column to sort; click a row for the full valuation basis.
      </p>
      <Scatter rows={rows} />
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
            <th style={th}>verdict</th>
            <th style={thSort} onClick={() => setSort("asking")}>asking{arrow("asking")}</th>
            <th style={thSort} onClick={() => setSort("fair_value")}>fair{arrow("fair_value")}</th>
            <th style={thSort} onClick={() => setSort("delta")}>Δ{arrow("delta")}</th>
            <th style={thSort} onClick={() => setSort("suggested_offer")}>offer{arrow("suggested_offer")}</th>
            <th style={th}>property</th>
          </tr></thead>
          <tbody>
            {shown.map((m, i) => {
              const d = m.ratio != null ? Math.round((m.ratio - 1) * 100) : null;
              return (
                <tr key={m.uid || i} onClick={() => setSel(m)}
                    style={{ borderBottom: "1px solid #eef", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f9fc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={td}><span style={{ color: m.verdict_color, fontWeight: 600 }}>● </span>{(m.verdict || "").replace(/^\S+\s/, "")}</td>
                  <td style={tdR}>{gbp(m.asking)}</td>
                  <td style={tdR}>{gbp(m.fair_value)}</td>
                  <td style={{ ...tdR, color: m.verdict_color }}>{d != null ? `${d > 0 ? "+" : ""}${d}%` : ""}</td>
                  <td style={tdR}>{gbp(m.suggested_offer)}</td>
                  <td style={td}>{m.address}<span style={{ color: "#aab", fontSize: 11 }}>{m.beds ? ` · ${m.beds} bed` : ""}{m.portal ? ` · ${m.portal}` : ""}{m.condition?.condition ? ` · ${m.condition.condition.replace("_", " ")}` : ""}{m.confidence === "low" ? " · low-confidence" : ""}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 40 && (
        <button onClick={() => setShowAll(!showAll)} style={{ ...btn, width: "auto", padding: "6px 14px", marginTop: 10, fontSize: 13, background: "#eef2f8", color: "#1455c0" }}>
          {showAll ? "Show top 40" : `Show all ${rows.length}`}
        </button>
      )}
      {sel && <DetailModal p={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function DetailModal({ p, onClose }: { p: Prop; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,25,35,.55)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "4vh 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 720, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #eef" }}>
          <b style={{ fontSize: 15 }}>Full valuation report</b>
          <button onClick={onClose} style={{ ...btn, width: "auto", padding: "4px 12px", fontSize: 13, background: "#eef2f8", color: "#334" }}>Close ✕</button>
        </div>
        <div style={{ padding: "4px 16px 16px" }}><Card p={p} /></div>
      </div>
    </div>
  );
}

function Scatter({ rows }: { rows: MarketRow[] }) {
  const pts = rows.filter((r) => r.asking && r.fair_value);
  if (pts.length < 2) return null;
  const W = 640, H = 360, padL = 56, padB = 40, padT = 12, padR = 12;
  const vals = pts.flatMap((p) => [p.asking!, p.fair_value!]);
  const lo = Math.min(...vals) * 0.96, hi = Math.max(...vals) * 1.04;
  const sx = (v: number) => padL + ((v - lo) / (hi - lo)) * (W - padL - padR);
  const sy = (v: number) => H - padB - ((v - lo) / (hi - lo)) * (H - padB - padT);
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => lo + ((hi - lo) * i) / ticks);
  const k = (v: number) => `£${Math.round(v / 1000)}k`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: "#fcfdfe", borderRadius: 8, border: "1px solid #eef" }}>
      {tickVals.map((tv, i) => (
        <g key={i}>
          <line x1={sx(tv)} y1={padT} x2={sx(tv)} y2={H - padB} stroke="#f0f3f7" />
          <line x1={padL} y1={sy(tv)} x2={W - padR} y2={sy(tv)} stroke="#f0f3f7" />
          <text x={sx(tv)} y={H - padB + 16} fontSize="10" fill="#889" textAnchor="middle">{k(tv)}</text>
          <text x={padL - 8} y={sy(tv) + 3} fontSize="10" fill="#889" textAnchor="end">{k(tv)}</text>
        </g>
      ))}
      <line x1={sx(lo)} y1={sy(lo)} x2={sx(hi)} y2={sy(hi)} stroke="#888" strokeDasharray="4 4" />
      {pts.map((p, i) => (
        <circle key={i} cx={sx(p.asking!)} cy={sy(p.fair_value!)} r="4.5"
          fill={p.verdict_color || "#888"} fillOpacity="0.7" stroke="#fff" strokeWidth="0.8" />
      ))}
      <text x={(W) / 2} y={H - 4} fontSize="11" fill="#667" textAnchor="middle">asking price →</text>
      <text x={-H / 2} y={14} fontSize="11" fill="#667" textAnchor="middle" transform="rotate(-90)">estimated fair value →</text>
    </svg>
  );
}

const th: React.CSSProperties = { padding: "7px 8px" };
const thR: React.CSSProperties = { padding: "7px 8px", textAlign: "right" };
const thSort: React.CSSProperties = { padding: "7px 8px", textAlign: "right", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "6px 8px" };
const tdR: React.CSSProperties = { padding: "6px 8px", textAlign: "right" };

function Card({ p }: { p: Prop }) {
  const col = p.verdict_color || "#334";
  const ref = p.avm_value || p.fair_by_area || p.fair_value;
  const delta = p.asking && ref ? Math.round((p.asking / ref - 1) * 100) : null;
  return (
    <div style={{ ...card, borderLeft: `5px solid ${col}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{p.address}</div>
          <div style={{ color: "#778", fontSize: 13 }}>
            {p.type}{p.beds ? ` · ${p.beds} bed` : ""}
            {p.floor_area_m2 ? ` · ${Math.round(p.floor_area_m2)} m² (${Math.round(p.floor_area_m2 * 10.764).toLocaleString()} sq ft${
              p.floor_area_source === "ocr" ? ", floor-plan" : p.floor_area_source ? ", agent" : ""})` : ""}
            {p.full_postcode ? ` · ${p.full_postcode}` : ""}
          </div>
        </div>
        <span style={{ background: col, color: "#fff", padding: "5px 11px", borderRadius: 16, fontWeight: 700, fontSize: 13, height: "fit-content" }}>
          {p.verdict}
        </span>
      </div>

      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", margin: "12px 0" }}>
        <Kpi label="Asking" value={gbp(p.asking)} />
        <Kpi label="Fair value" value={gbp(ref)} />
        {delta !== null && <Kpi label="vs fair" value={`${delta > 0 ? "+" : ""}${delta}%`} color={col} />}
        {p.suggested_offer ? <Kpi label="Suggested offer" value={gbp(p.suggested_offer)} /> : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <Mini title="Comparable sales" big={gbp(p.fair_value)}
              sub={`${gbp(p.fair_low)}–${gbp(p.fair_high)} · ${p.n_comps || 0} comps`} />
        {p.avm_value ? <Mini title="AVM (model)" big={gbp(p.avm_value)} accent="#5a3fb8"
              sub={`typical ${gbp(p.avm_low)}–${gbp(p.avm_high)}`} /> : null}
        {p.fair_by_area ? <Mini title="£ / m²" big={gbp(p.fair_by_area)} accent="#0a7d28"
              sub={p.ppm2_local ? `local £${p.ppm2_local.toLocaleString()}/m²` : ""} /> : null}
      </div>

      {(p.notes?.length || p.n_comps || p.confidence) && (
        <div style={panel}>
          <b style={{ fontSize: 13 }}>How this verdict was reached</b>
          <div style={{ fontSize: 12.5, color: "#445", marginTop: 4 }}>
            {p.n_comps ? <span>Valued against <b>{p.n_comps}</b> sold {p.type} comps in {p.geo_label || "the area"}, time-adjusted to today. </span> : null}
            {p.asking_pct != null ? <span>Asking is pricier than <b>{Math.round(p.asking_pct)}%</b> of them. </span> : null}
            <span>Confidence: <b style={{ color: p.confidence === "high" ? "#0a7d28" : p.confidence === "low" ? "#c01616" : "#b06b00" }}>{p.confidence || "—"}</b>
              {p.confidence === "low" ? " (no full postcode on the listing — town-level comps only)." : "."}</span>
          </div>
          {p.notes && p.notes.length > 0 && (
            <ul style={{ fontSize: 12, color: "#667", margin: "5px 0 0", paddingLeft: 18 }}>
              {p.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </div>
      )}

      {p.condition && p.condition.condition && (
        <div style={panel}>
          <b style={{ fontSize: 13 }}>🛠️ Condition (from photos)</b>{" "}
          <span style={{ fontSize: 13, fontWeight: 700, color: condColor(p.condition.condition) }}>
            {p.condition.condition_label || p.condition.condition}
            {p.condition.value_adjustment_pct ? ` (${p.condition.value_adjustment_pct > 0 ? "+" : ""}${p.condition.value_adjustment_pct}% vs avg)` : ""}
          </span>
          {p.condition.highlights && p.condition.highlights.length > 0 && (
            <div style={{ fontSize: 12.5, color: "#0a7d28", marginTop: 4 }}>✓ {p.condition.highlights.join(" · ")}</div>
          )}
          {p.condition.issues && p.condition.issues.length > 0 && (
            <div style={{ fontSize: 12.5, color: "#b06b00", marginTop: 2 }}>⚠ {p.condition.issues.join(" · ")}</div>
          )}
        </div>
      )}

      {((p.photos && p.photos.length > 0) || (p.floorplan && p.floorplan.length > 0)) && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "10px 0 0", paddingBottom: 4 }}>
          {(p.floorplan || []).map((u, i) => (
            <a key={`f${i}`} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt="floor plan" style={thumb} /></a>
          ))}
          {(p.photos || []).map((u, i) => (
            <a key={`p${i}`} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt="" style={thumb} /></a>
          ))}
        </div>
      )}

      {p.key_features && p.key_features.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0 0" }}>
          {p.key_features.map((k, i) => (
            <span key={i} style={{ fontSize: 11.5, background: "#eef2f8", color: "#445", padding: "3px 8px", borderRadius: 12 }}>{k}</span>
          ))}
        </div>
      )}

      {(p.tenure || p.council_tax_band || (p.nearest_stations && p.nearest_stations.length > 0) || p.epc_graph) && (
        <div style={{ fontSize: 12.5, color: "#667", margin: "10px 0 0" }}>
          {p.tenure ? <span>{p.tenure[0].toUpperCase() + p.tenure.slice(1).toLowerCase()}</span> : null}
          {p.council_tax_band ? <span> · Council tax {p.council_tax_band}</span> : null}
          {p.nearest_stations && p.nearest_stations[0] ? <span> · {p.nearest_stations[0].name} {p.nearest_stations[0].miles != null ? `${p.nearest_stations[0].miles.toFixed(1)} mi` : ""}</span> : null}
          {p.epc_graph ? <span> · <a href={p.epc_graph} target="_blank" rel="noreferrer">EPC ↗</a></span> : null}
        </div>
      )}

      {p.amenities && (p.amenities.flood?.flood_summary || p.amenities.schools || p.amenities.schools_link) && (
        <div style={panel}>
          {(p.amenities.schools?.primary || p.amenities.schools?.secondary) && (
            <div style={{ fontSize: 12.5, color: "#445", marginBottom: 4 }}>
              🏫 {(["primary", "secondary"] as const).map((ph) => {
                const s = p.amenities!.schools![ph];
                if (!s) return null;
                return (
                  <span key={ph} style={{ marginRight: 12 }}>
                    Nearest {ph}: <b>{s.name}</b> ({s.miles} mi)
                    {s.ofsted ? <span style={{ color: ofstedColor(s.ofsted), fontWeight: 700 }}>{" "}· Ofsted {s.ofsted}{s.ofsted_date ? ` ${s.ofsted_date.slice(0, 4)}` : ""}</span> : <span style={{ color: "#889" }}> · not graded</span>}
                  </span>
                );
              })}
              {p.amenities.schools_link && <a href={p.amenities.schools_link} target="_blank" rel="noreferrer" style={{ marginLeft: 4 }}>all ↗</a>}
            </div>
          )}
          {!p.amenities.schools && p.amenities.schools_link && (
            <div style={{ fontSize: 12.5 }}>🏫 <a href={p.amenities.schools_link} target="_blank" rel="noreferrer">Nearest schools &amp; Ofsted ratings ↗</a></div>
          )}
          {p.amenities.flood?.flood_summary && (
            <div style={{ fontSize: 12.5, color: "#445" }}>🌊 {p.amenities.flood.flood_summary}</div>
          )}
        </div>
      )}

      {p.history && p.history.sales && p.history.sales.length > 0 && (
        <div style={panel}>
          <b style={{ fontSize: 13 }}>Sale history</b>
          <div style={{ fontSize: 13, color: "#445", marginTop: 4 }}>
            {p.history.sales.map(([d, pr], i) => <span key={i}>{d}: {gbp(pr)}{i < p.history!.sales!.length - 1 ? " · " : ""}</span>)}
          </div>
          {p.history.index_implied_today ? (
            <div style={{ fontSize: 12.5, color: "#889", marginTop: 4 }}>
              Last sale index-implies {gbp(p.history.index_implied_today)} today
              {p.history.index_growth_pct != null ? ` (${p.history.index_growth_pct > 0 ? "+" : ""}${p.history.index_growth_pct}%)` : ""}.
            </div>
          ) : null}
        </div>
      )}

      {p.area && p.area.crime_count != null && (
        <div style={panel}>
          <b style={{ fontSize: 13 }}>Area — {p.area.ward}</b>
          <div style={{ fontSize: 13, color: "#445", marginTop: 4 }}>
            {p.area.crime_count} crimes within ~1 mile ({p.area.crime_month}) ·{" "}
            {(p.area.crime_top || []).map(([c, n]) => `${c} ×${n}`).join(", ")}
            {p.area.lat ? <> · <a href={`https://www.google.com/maps/search/?api=1&query=${p.area.lat},${p.area.lng}`} target="_blank" rel="noreferrer">map ↗</a></> : null}
          </div>
        </div>
      )}

      {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#1455c0" }}>View listing ↗</a>}
    </div>
  );
}

const Kpi = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div><div style={{ fontSize: 12, color: "#889" }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: color || "#1a1f29" }}>{value}</div></div>
);
const Mini = ({ title, big, sub, accent }: { title: string; big: string; sub: string; accent?: string }) => (
  <div style={{ background: "#f7f9fc", borderRadius: 10, padding: "10px 13px" }}>
    <div style={{ fontSize: 12, color: "#889", fontWeight: 600 }}>{title}</div>
    <div style={{ fontSize: 19, fontWeight: 800, color: accent || "#1455c0", margin: "2px 0" }}>{big}</div>
    <div style={{ fontSize: 11.5, color: "#778" }}>{sub}</div></div>
);

const wrap: React.CSSProperties = { maxWidth: 860, margin: "0 auto", padding: "30px 20px", fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif", color: "#1a1f29" };
const gate: React.CSSProperties = { maxWidth: 360, margin: "12vh auto 0", background: "#fff", padding: 28, borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.08)", textAlign: "center" };
const input: React.CSSProperties = { width: "100%", padding: "11px 13px", fontSize: 15, border: "1px solid #cdd6e0", borderRadius: 9, marginBottom: 10, boxSizing: "border-box" };
const btn: React.CSSProperties = { width: "100%", padding: "11px", fontSize: 15, fontWeight: 600, color: "#fff", background: "#1455c0", border: "none", borderRadius: 9, cursor: "pointer" };
const card: React.CSSProperties = { background: "#fff", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 5px rgba(0,0,0,.07)", margin: "14px 0" };
const panel: React.CSSProperties = { background: "#fafbfc", borderRadius: 9, padding: "10px 13px", margin: "10px 0 0" };
const thumb: React.CSSProperties = { height: 72, width: 96, objectFit: "cover", borderRadius: 7, border: "1px solid #e3e8ee", flex: "0 0 auto" };
const condColor = (c?: string) => ({ new: "#0a7d28", refurbished: "#0a7d28", good: "#1455c0", dated: "#b06b00", needs_work: "#c01616" }[c || ""] || "#445");
const ofstedColor = (g?: string) => ({ Outstanding: "#0a7d28", Good: "#1455c0", "Requires improvement": "#b06b00", Inadequate: "#c01616" }[g || ""] || "#667");
