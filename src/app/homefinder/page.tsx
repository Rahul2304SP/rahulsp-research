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
  history?: { last_date?: string; last_price?: number; years_ago?: number;
              index_implied_today?: number; index_growth_pct?: number; sales?: [string, number][] };
  area?: { ward?: string; crime_count?: number; crime_month?: string;
           crime_top?: [string, number][]; lat?: number; lng?: number; lsoa?: string };
};
type Report = { generated?: string; criteria?: string; properties?: Prop[] };

const gbp = (n?: number) => (n || n === 0 ? "£" + n.toLocaleString("en-GB") : "—");

export default function HomeFinder() {
  const [key, setKey] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>🏡 Private Valuation Report</h1>
        <button onClick={() => { sessionStorage.removeItem("hf_key"); setReport(null); setKey(""); }}
                style={{ ...btn, width: "auto", padding: "6px 12px", fontSize: 13 }}>Lock</button>
      </div>
      <p style={{ color: "#778", fontSize: 13 }}>
        {props.length} propert{props.length === 1 ? "y" : "ies"} · {report.criteria || ""} ·
        updated {report.generated ? new Date(report.generated).toLocaleString("en-GB") : ""}
      </p>
      {props.map((p, i) => <Card key={i} p={p} />)}
      <p style={{ color: "#9aa", fontSize: 11, marginTop: 24 }}>
        HM Land Registry sold prices (time-adjusted via UKHPI), EPC floor areas, a LightGBM AVM,
        plus police.uk crime. Guidance only, not a survey.
      </p>
    </main>
  );
}

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
            {p.type}{p.beds ? ` · ${p.beds} bed` : ""}{p.floor_area_m2 ? ` · ${Math.round(p.floor_area_m2)} m²` : ""}
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
