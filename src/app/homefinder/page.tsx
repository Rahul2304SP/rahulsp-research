"use client";

import { useEffect, useRef, useState } from "react";

// Private property valuation report. Gated by a passkey checked server-side by
// /api/homefinder against the HOMEFINDER_KEY secret (never shipped to the client).
// The passkey the user types is held only in sessionStorage for the tab session.

type Prop = {
  address: string; postcode?: string; type?: string; beds?: number; asking?: number;
  floor_area_m2?: number; verdict?: string; verdict_color?: string;
  fair_value?: number; fair_low?: number; fair_high?: number;
  fair_ref?: number; ref_basis?: string; median_comp_area?: number; ppm2_basis?: string;
  avm_value?: number; avm_low?: number; avm_high?: number;
  ppm2_local?: number; fair_by_area?: number; suggested_offer?: number;
  asking_pct?: number; n_comps?: number; geo_label?: string; confidence?: string;
  url?: string; notes?: string[];
  ratio?: number; portal?: string; uid?: string; lat?: number; lon?: number;
  crime_grade?: string; crime_count?: number; crime_penalty_pct?: number; crime_adj_offer?: number;
  negotiation?: string[]; opening_offer?: number; epc_rating?: string; listing_update?: string;
  floor_area_source?: string; full_postcode?: string;
  has_garden?: boolean; has_parking?: boolean; south_garden?: boolean; busy_road?: boolean;
  council_tax_cost?: number; epc_potential?: string;
  own_last_sale?: { last_date?: string; last_price?: number; n_sales?: number; years_ago?: number;
                    index_implied_today?: number; index_growth_pct?: number };
  orientation?: { verdict?: string; north_method?: string; score?: number;
                  rooms?: { type?: string; sector?: string; bearing?: number }[];
                  geom?: { A?: number | null; facing?: number | null;
                           centres?: Record<string, [number, number]>;
                           rooms?: { type?: string; x?: number; y?: number; floor?: number }[];
                           entrance?: { type?: string; x?: number; y?: number; floor?: number } | null } };
  condition?: { condition?: string; condition_label?: string; value_adjustment_pct?: number;
                confidence?: number; issues?: string[]; highlights?: string[] };
  amenities?: { flood?: { flood_summary?: string; flood_areas_nearby?: number };
                schools?: { primary?: School; secondary?: School }; schools_link?: string;
                crime?: { crime_count?: number; crime_month?: string; crime_top?: [string, number][] };
                road_rail?: { busy_road?: boolean; major_road_m?: number; major_road_name?: string;
                              railway_m?: number; road_rail_summary?: string } };
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
          <a href="/homefinder/customise"
             title="Visualise renovations on the real listing photos (opens your PC's Flux.1 Kontext tool)"
             style={{ ...btn, width: "auto", padding: "6px 12px", fontSize: 13, background: "#7a3ea8", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            🎨 Customise
          </a>
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

      <PasteBar />

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

// Paste any supported listing link → your home PC scrapes, values and image-
// analyses it, and the finished report opens in the same detail card. The URL is
// queued via the relay (auth: passkey); a local worker does the work and posts
// the result back, which we poll for here.
function PasteBar() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<Prop | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function poll(id: string, k: string, tries: number) {
    if (tries > 70) { setState("error"); setMsg("Timed out. Is your home PC on with the on-demand worker running?"); return; }
    try {
      const r = await fetch("/api/homefinder-value?id=" + encodeURIComponent(id), { headers: { "x-homefinder-key": k } });
      const j = await r.json();
      if (j.status === "done") {
        if (j.record?.error) { setState("error"); setMsg(j.record.error); }
        else { setState("idle"); setMsg(""); setUrl(""); setResult(j.record); }
        return;
      }
    } catch { /* keep polling */ }
    timer.current = setTimeout(() => poll(id, k, tries + 1), 2500);
  }

  async function submit() {
    const u = url.trim();
    if (!u) return;
    const k = sessionStorage.getItem("hf_key") || "";
    setState("working"); setMsg("Sending to your PC…"); setResult(null);
    try {
      const r = await fetch("/api/homefinder-value", {
        method: "POST", headers: { "x-homefinder-key": k, "content-type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const j = await r.json();
      if (!r.ok || !j.id) { setState("error"); setMsg(j.error || "Couldn't queue that link."); return; }
      setMsg("Your PC is scraping + image-analysing this listing… (~40s)");
      poll(j.id, k, 0);
    } catch { setState("error"); setMsg("Network error — try again."); }
  }

  const working = state === "working";
  return (
    <div style={{ background: "linear-gradient(180deg,#f1f6fe,#eef3fb)", border: "1px solid #d7e3f5", borderRadius: 12, padding: "12px 14px", margin: "10px 0 16px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 15 }}>🔗</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} disabled={working}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Paste a Rightmove, Zoopla or Richard James / Charles Harding / Miles & Byron link…"
          style={{ flex: 1, minWidth: 220, padding: "9px 12px", border: "1px solid #c7d5ea", borderRadius: 9, fontSize: 13.5 }} />
        <button onClick={submit} disabled={working || !url.trim()}
          style={{ padding: "9px 16px", border: "none", borderRadius: 9, background: working ? "#9bb3d6" : "#1455c0", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: working ? "wait" : "pointer" }}>
          {working ? "Valuing…" : "Value it"}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: state === "error" ? "#c0392b" : "#5a6b86", marginTop: 6 }}>
        {msg || "Get an instant full report for any listing — valued against sold comps with floor-plan, compass & condition analysis, computed on your home PC."}
      </div>
      {result && <DetailModal p={result} onClose={() => setResult(null)} />}
    </div>
  );
}

type SortKey = "ratio" | "asking" | "fair_value" | "delta" | "suggested_offer" | "crime" | "size";

type Filters = {
  beds3: boolean; garden: boolean; parking: boolean; quiet: boolean;
  // null = "Any". Kept separate from the boolean must-haves because these carry a
  // value, not an on/off state.
  minPrice: number | null; maxPrice: number | null;
};
const DEFAULT_FILTERS: Filters = {
  beds3: true, garden: true, parking: true, quiet: true, minPrice: null, maxPrice: null,
};

// Budget dropdown steps. £25k granularity is how people actually think about a
// ceiling ("under £350k"), and a native <select> gives phones a proper picker —
// easier than dragging a slider handle, especially for non-technical users.
const priceSteps = (rows: { asking?: number | null }[]): number[] => {
  const vals = rows.map((r) => r.asking || 0).filter((v) => v > 0);
  if (!vals.length) return [];
  const lo = Math.floor(Math.min(...vals) / 25000) * 25000;
  const hi = Math.ceil(Math.max(...vals) / 25000) * 25000;
  const out: number[] = [];
  for (let v = lo; v <= hi; v += 25000) out.push(v);
  return out;
};
// compact form for the dropdown ("£350k"); gbp() above stays the full "£350,000"
const gbpK = (n: number): string => "£" + n / 1000 + "k";

function Market({ report }: { report: Report }) {
  const rows = report.market || [];
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("ratio");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [sel, setSel] = useState<Prop | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<"table" | "gallery" | "map" | "saved">("table");
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [isNarrow, setIsNarrow] = useState(false);

  // On phones, swap the wide sortable table for a stacked card list so nothing runs
  // off the right edge. Tablets / desktop keep the table.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    if (mq.addEventListener) mq.addEventListener("change", sync);
    else mq.addListener(sync);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", sync); else mq.removeListener(sync); };
  }, []);

  // saved homes persist across visits, in this browser (same store as the filters)
  useEffect(() => {
    try { const v = localStorage.getItem("hf_likes"); if (v) setLikes(new Set(JSON.parse(v))); } catch { /* ignore */ }
  }, []);
  const liked = (m: Prop) => likes.has(likeKey(m));
  const toggleLike = (m: Prop) => setLikes((prev) => {
    const next = new Set(prev); const k = likeKey(m);
    next.has(k) ? next.delete(k) : next.add(k);
    try { localStorage.setItem("hf_likes", JSON.stringify([...next])); } catch { /* ignore */ }
    return next;
  });

  // remember the user's must-have toggles across visits
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hf_filters");
      if (saved) setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(saved) });
    } catch { /* ignore */ }
  }, []);
  const persist = (next: Filters) => {
    try { localStorage.setItem("hf_filters", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  };
  const flip = (k: "beds3" | "garden" | "parking" | "quiet") =>
    setFilters((f) => persist({ ...f, [k]: !f[k] }));
  const setPrice = (k: "minPrice" | "maxPrice", v: number | null) =>
    setFilters((f) => {
      const next = { ...f, [k]: v };
      // keep the range coherent if the two ends cross over
      if (next.minPrice != null && next.maxPrice != null && next.minPrice > next.maxPrice) {
        if (k === "minPrice") next.maxPrice = v;
        else next.minPrice = v;
      }
      return persist(next);
    });

  // must-have filters: only ever HIDE on a known-failing value, never on unknowns
  const matches = (m: Prop): boolean => {
    if (filters.beds3 && (m.beds ?? 3) < 3) return false;
    if (filters.garden && m.has_garden === false) return false;
    if (filters.parking && m.has_parking === false) return false;
    if (filters.quiet && m.busy_road === true) return false;
    // price: an unknown asking is never hidden (same "don't punish gaps" rule)
    if (filters.minPrice != null && (m.asking ?? 0) > 0 && (m.asking as number) < filters.minPrice) return false;
    if (filters.maxPrice != null && (m.asking ?? 0) > 0 && (m.asking as number) > filters.maxPrice) return false;
    return true;
  };
  const steps = priceSteps(rows);
  const filtered = rows.filter(matches);
  const hidden = rows.length - filtered.length;
  const s = {
    total: filtered.length,
    good: filtered.filter((m) => m.ratio && m.ratio < 0.97).length,
    fair: filtered.filter((m) => m.ratio && m.ratio >= 0.97 && m.ratio < 1.03).length,
    over: filtered.filter((m) => m.ratio && m.ratio >= 1.03).length,
  };

  const val = (m: Prop, k: SortKey): number => {
    if (k === "delta" || k === "ratio") return m.ratio ?? 9;
    if (k === "fair_value") return (m.fair_ref ?? m.fair_value ?? (sortDir === 1 ? Infinity : -Infinity));
    if (k === "size") return m.floor_area_m2 ?? (sortDir === 1 ? Infinity : -Infinity);   // unknowns always sink
    if (k === "crime") return m.crime_count ?? (sortDir === 1 ? Infinity : -Infinity);
    return (m[k as "asking" | "suggested_offer"] as number) ?? (sortDir === 1 ? Infinity : -Infinity);
  };
  const sorted = [...filtered].sort((a, b) => (val(a, sortKey) - val(b, sortKey)) * sortDir);
  const shown = showAll ? sorted : sorted.slice(0, 40);
  // saved homes ignore the must-have pills (you liked them on purpose) but honour the sort
  const savedRows = [...rows].filter(liked).sort((a, b) => (val(a, sortKey) - val(b, sortKey)) * sortDir);
  const isSaved = view === "saved";
  const tableData = isSaved ? savedRows : shown;
  const setSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === 1 ? -1 : 1);
    else { setSortKey(k); setSortDir(k === "ratio" ? 1 : -1); }
  };
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === 1 ? " ▲" : " ▼") : "");

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Swindon market — {s.total} of {rows.length} listings</h2>
        <div style={{ fontSize: 12.5 }}>
          <span style={{ color: "#0a7d28", fontWeight: 600 }}>{s.good} good value</span> ·{" "}
          <span style={{ color: "#b06b00" }}>{s.fair} fair</span> ·{" "}
          <span style={{ color: "#c01616" }}>{s.over} overpriced</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "10px 0 2px" }}>
        <span style={{ fontSize: 12, color: "#778", fontWeight: 600 }}>Budget:</span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#556" }}>
          from
          <select value={filters.minPrice ?? ""} aria-label="Minimum price"
            onChange={(e) => setPrice("minPrice", e.target.value ? Number(e.target.value) : null)}
            style={priceSelect}>
            <option value="">Any</option>
            {steps.map((v) => <option key={v} value={v}>{gbpK(v)}</option>)}
          </select>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#556" }}>
          up to
          <select value={filters.maxPrice ?? ""} aria-label="Maximum price"
            onChange={(e) => setPrice("maxPrice", e.target.value ? Number(e.target.value) : null)}
            style={priceSelect}>
            <option value="">Any</option>
            {steps.map((v) => <option key={v} value={v}>{gbpK(v)}</option>)}
          </select>
        </label>
        {(filters.minPrice != null || filters.maxPrice != null) && (
          <button onClick={() => { setPrice("minPrice", null); setPrice("maxPrice", null); }}
            style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 12, cursor: "pointer",
              border: "1px solid #cdd6e0", background: "#fff", color: "#667" }}>
            ✕ clear
          </button>
        )}
        <span style={{ fontSize: 11.5, color: "#aab" }}>
          {filters.minPrice == null && filters.maxPrice == null
            ? "showing every price"
            : `showing ${filters.minPrice != null ? gbpK(filters.minPrice) : "any"} – ${filters.maxPrice != null ? gbpK(filters.maxPrice) : "any"}`}
        </span>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", margin: "8px 0 2px" }}>
        <span style={{ fontSize: 12, color: "#778", fontWeight: 600 }}>Must-haves:</span>
        <FilterPill on={filters.beds3} onClick={() => flip("beds3")} label="3+ beds" />
        <FilterPill on={filters.garden} onClick={() => flip("garden")} label="🌳 Garden" />
        <FilterPill on={filters.parking} onClick={() => flip("parking")} label="🅿️ Parking" />
        <FilterPill on={filters.quiet} onClick={() => flip("quiet")} label="🔇 Quiet road" />
        <span style={{ fontSize: 11.5, color: "#aab" }}>
          {hidden > 0 ? `${hidden} hidden` : "all match"} · tap a pill to toggle
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", border: "1px solid #cdd6e0", borderRadius: 8, overflow: "hidden" }}>
          {(["table", "gallery", "map", "saved"] as const).map((mode) => (
            <button key={mode} onClick={() => setView(mode)}
              style={{ fontSize: 12, fontWeight: 600, padding: "4px 11px", border: "none", cursor: "pointer", borderLeft: mode === "saved" ? "1px solid #cdd6e0" : "none",
                background: view === mode ? (mode === "saved" ? "#e0245e" : "#1455c0") : "#fff", color: view === mode ? "#fff" : (mode === "saved" ? "#e0245e" : "#667") }}>
              {mode === "table" ? "▦ Table" : mode === "gallery" ? "🖼️ Gallery" : mode === "map" ? "🗺️ Map" : `♥ Saved${likes.size ? ` (${likes.size})` : ""}`}
            </button>
          ))}
        </span>
      </div>
      <p style={{ color: "#889", fontSize: 12, margin: "4px 0 8px" }}>
        Every listing valued against time-adjusted sold comps. Click a column to sort; click a card for the full valuation basis.
      </p>
      <Scatter rows={isSaved ? savedRows : filtered} />
      {isSaved && savedRows.length === 0 ? (
        <div style={{ textAlign: "center", color: "#889", padding: "40px 16px", marginTop: 12, border: "1px dashed #d7dee6", borderRadius: 10 }}>
          <div style={{ fontSize: 30 }}>♡</div>
          <div style={{ fontSize: 14, fontWeight: 600, margin: "6px 0 2px", color: "#556" }}>No saved homes yet</div>
          <div style={{ fontSize: 12.5 }}>Tap the ♡ on any listing to save it here.</div>
        </div>
      ) : view === "gallery" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 12, marginTop: 12 }}>
          {shown.map((m, i) => <GalleryTile key={m.uid || i} m={m} onClick={() => setSel(m)} liked={liked(m)} onLike={() => toggleLike(m)} />)}
        </div>
      ) : view === "map" ? (
        <MapView rows={filtered} onSelect={setSel} />
      ) : isNarrow ? (
        <MobileList rows={tableData} onSelect={setSel} liked={liked} onLike={toggleLike}
          sortKey={sortKey} sortDir={sortDir}
          onSortKey={(k) => { setSortKey(k); setSortDir(k === "ratio" ? 1 : -1); }}
          onFlip={() => setSortDir(sortDir === 1 ? -1 : 1)} />
      ) : (
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
            <th style={th} aria-label="saved"></th>
            <th style={th}>verdict</th>
            <th style={thSort} onClick={() => setSort("asking")}>asking{arrow("asking")}</th>
            <th style={thSort} onClick={() => setSort("fair_value")}>fair{arrow("fair_value")}</th>
            <th style={thSort} onClick={() => setSort("delta")}>vs fair{arrow("delta")}</th>
            <th style={thSort} onClick={() => setSort("suggested_offer")}>offer{arrow("suggested_offer")}</th>
            <th style={thSort} onClick={() => setSort("size")}>sq ft{arrow("size")}</th>
            <th style={th}>features</th>
            <th style={th}>property</th>
          </tr></thead>
          <tbody>
            {tableData.map((m, i) => (
                <tr key={m.uid || i} onClick={() => setSel(m)}
                    style={{ borderBottom: "1px solid #eef", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f9fc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={td}><LikeHeart on={liked(m)} onClick={() => toggleLike(m)} /></td>
                  <td style={td}><VerdictChip m={m} /></td>
                  <td style={tdR}>{gbp(m.asking)}</td>
                  <td style={tdR}>{gbp(m.fair_ref ?? m.fair_value)}</td>
                  <td style={td}><ValueBar ratio={m.ratio} color={m.verdict_color} /></td>
                  <td style={tdR}>{gbp(m.suggested_offer)}</td>
                  <td style={tdR}>{m.floor_area_m2 ? Math.round(m.floor_area_m2 * 10.764).toLocaleString() : <span style={{ color: "#c2cad3" }}>—</span>}</td>
                  <td style={td}><AtAGlance p={m} /></td>
                  <td style={td}>{m.address}<span style={{ color: "#aab", fontSize: 11 }}>{m.beds ? ` · ${m.beds} bed` : ""}{m.portal ? ` · ${m.portal}` : ""}{m.condition?.condition ? ` · ${m.condition.condition.replace("_", " ")}` : ""}{m.confidence === "low" ? " · low-confidence" : ""}</span></td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {view === "table" && sorted.length > 40 && (
        <button onClick={() => setShowAll(!showAll)} style={{ ...btn, width: "auto", padding: "6px 14px", marginTop: 10, fontSize: 13, background: "#eef2f8", color: "#1455c0" }}>
          {showAll ? "Show top 40" : `Show all ${sorted.length}`}
        </button>
      )}
      {sel && <DetailModal p={sel} onClose={() => setSel(null)} allAsking={filtered.map((r) => r.asking).filter((x): x is number => !!x)} liked={liked(sel)} onLike={() => toggleLike(sel)} />}
    </div>
  );
}

// Phone view of the market list: one stacked card per listing so nothing runs off
// the right edge. Column headers are gone here, so a compact sort control replaces
// them. The wide sortable table (above) is kept for tablet / desktop.
function MobileList({ rows, onSelect, liked, onLike, sortKey, sortDir, onSortKey, onFlip }: {
  rows: Prop[]; onSelect: (p: Prop) => void; liked: (m: Prop) => boolean; onLike: (m: Prop) => void;
  sortKey: SortKey; sortDir: 1 | -1; onSortKey: (k: SortKey) => void; onFlip: () => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12.5, flexWrap: "wrap" }}>
        <span style={{ color: "#778", fontWeight: 600 }}>Sort by</span>
        <select value={sortKey === "delta" ? "ratio" : sortKey} onChange={(e) => onSortKey(e.target.value as SortKey)}
          style={{ fontSize: 12.5, padding: "5px 8px", borderRadius: 8, border: "1px solid #cdd6e0", background: "#fff", color: "#334" }}>
          <option value="ratio">Best value</option>
          <option value="asking">Asking price</option>
          <option value="fair_value">Fair value</option>
          <option value="suggested_offer">Suggested offer</option>
          <option value="size">Size (sq ft)</option>
          <option value="crime">Crime level</option>
        </select>
        <button onClick={onFlip} title="Reverse order"
          style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 11px", borderRadius: 8, border: "1px solid #cdd6e0", background: "#fff", color: "#1455c0", cursor: "pointer" }}>
          {sortDir === 1 ? "▲" : "▼"} Reverse
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((m, i) => (
          <div key={m.uid || i} onClick={() => onSelect(m)}
            style={{ border: "1px solid #e6eaf0", borderLeft: `4px solid ${m.verdict_color || "#8a94a0"}`, borderRadius: 10, padding: "10px 12px", background: "#fff", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <LikeHeart on={liked(m)} onClick={() => onLike(m)} size={20} />
                <VerdictChip m={m} />
              </span>
              <ValueBar ratio={m.ratio} color={m.verdict_color} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1f29", margin: "8px 0 6px", lineHeight: 1.3 }}>{m.address}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 14px", fontSize: 12.5, color: "#556" }}>
              <span>Asking <b style={{ color: "#1a1f29" }}>{gbp(m.asking)}</b></span>
              <span>Fair <b style={{ color: "#1a1f29" }}>{gbp(m.fair_ref ?? m.fair_value)}</b></span>
              {m.suggested_offer ? <span>Offer <b style={{ color: "#0a7d28" }}>{gbp(m.suggested_offer)}</b></span> : null}
              {m.floor_area_m2 ? <span><b style={{ color: "#1a1f29" }}>{Math.round(m.floor_area_m2 * 10.764).toLocaleString()}</b> sq ft</span> : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <AtAGlance p={m} />
              <span style={{ fontSize: 11, color: "#aab", whiteSpace: "nowrap", marginLeft: "auto" }}>
                {[m.beds ? `${m.beds} bed` : "", m.portal || ""].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailModal({ p, onClose, allAsking, liked, onLike }: { p: Prop; onClose: () => void; allAsking?: number[]; liked?: boolean; onLike?: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,25,35,.55)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "4vh 12px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 720, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #eef" }}>
          <b style={{ fontSize: 15, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {onLike && <LikeHeart on={!!liked} onClick={onLike} size={19} />}Full valuation report
          </b>
          <button onClick={onClose} style={{ ...btn, width: "auto", padding: "4px 12px", fontSize: 13, background: "#eef2f8", color: "#334" }}>Close ✕</button>
        </div>
        <div style={{ padding: "4px 16px 16px" }}><Card p={p} allAsking={allAsking} /></div>
      </div>
    </div>
  );
}

// ---- Photos: prettier previews + an in-page, swipeable / zoomable lightbox ----
// Tapping a photo used to open a raw image URL in a new browser tab. Now it opens
// a sub-window you can swipe through and tap to zoom (pan a big floor plan), all
// without leaving the report.
type Shot = { u: string; kind: "photo" | "plan" };
const planTag: React.CSSProperties = { position: "absolute", left: 10, top: 10, background: "rgba(20,85,192,.94)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 };
const navBtn = (off: boolean): React.CSSProperties => ({ border: "none", borderRadius: 22, padding: "9px 20px", fontSize: 17, fontWeight: 700, lineHeight: 1, cursor: off ? "default" : "pointer", background: off ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.18)", color: off ? "rgba(255,255,255,.35)" : "#fff" });

function PhotoGallery({ photos, floorplan }: { photos?: string[]; floorplan?: string[] }) {
  const shots: Shot[] = [
    ...(photos || []).map((u) => ({ u, kind: "photo" as const })),
    ...(floorplan || []).map((u) => ({ u, kind: "plan" as const })),
  ];
  const [open, setOpen] = useState<number | null>(null);
  if (!shots.length) return null;
  const nPhoto = shots.filter((s) => s.kind === "photo").length;
  const nPlan = shots.length - nPhoto;
  const hero = shots[0], rest = shots.slice(1);
  const label = nPhoto ? `${nPhoto} photo${nPhoto > 1 ? "s" : ""}${nPlan ? " + floor plan" : ""}` : "Floor plan";
  return (
    <div style={{ margin: "12px 0 0" }}>
      <button onClick={() => setOpen(0)} aria-label="View photos"
        style={{ position: "relative", display: "block", width: "100%", padding: 0, border: "1px solid #e3e8ee", borderRadius: 12, overflow: "hidden", cursor: "pointer", background: "#eef1f5" }}>
        <img src={hero.u} alt="" style={{ display: "block", width: "100%", height: 210, objectFit: "cover" }} />
        {hero.kind === "plan" && <span style={planTag}>Floor plan</span>}
        <span style={{ position: "absolute", right: 10, bottom: 10, background: "rgba(15,18,24,.74)", color: "#fff", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 20 }}>📷 {label} · tap to view</span>
      </button>
      {rest.length > 0 && (
        <div style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 7, paddingBottom: 4 }}>
          {rest.map((s, i) => (
            <button key={i} onClick={() => setOpen(i + 1)} aria-label={s.kind === "plan" ? "View floor plan" : "View photo"}
              style={{ position: "relative", flex: "0 0 auto", padding: 0, border: "1px solid #e3e8ee", borderRadius: 9, overflow: "hidden", cursor: "pointer", background: "#eef1f5" }}>
              <img src={s.u} alt="" style={{ display: "block", width: 96, height: 70, objectFit: "cover" }} />
              {s.kind === "plan" && <span style={{ position: "absolute", left: 3, top: 3, background: "rgba(20,85,192,.94)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4 }}>Plan</span>}
            </button>
          ))}
        </div>
      )}
      {open !== null && <Lightbox shots={shots} start={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Lightbox({ shots, start, onClose }: { shots: Shot[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [zoom, setZoom] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = (d: number) => { setZoom(false); setI((p) => Math.max(0, Math.min(shots.length - 1, p + d))); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") { setZoom(false); setI((p) => Math.max(0, p - 1)); }
      else if (e.key === "ArrowRight") { setZoom(false); setI((p) => Math.min(shots.length - 1, p + 1)); }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [shots.length, onClose]);
  const s = shots[i];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(8,10,14,.95)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", color: "#fff", flex: "0 0 auto" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{s.kind === "plan" ? "📐 Floor plan" : "📷 Photo"} · {i + 1} / {shots.length}</span>
        <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,.16)", color: "#fff", fontSize: 14, fontWeight: 700, padding: "7px 15px", borderRadius: 20, cursor: "pointer" }}>Close ✕</button>
      </div>
      <div
        onClick={() => setZoom((z) => !z)}
        onTouchStart={(e) => { if (!zoom) touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          if (zoom || !touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x, dy = e.changedTouches[0].clientY - touch.current.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
        style={{ flex: 1, minHeight: 0, overflow: zoom ? "auto" : "hidden", display: "flex", alignItems: zoom ? "flex-start" : "center", justifyContent: zoom ? "flex-start" : "center", cursor: zoom ? "zoom-out" : "zoom-in", WebkitOverflowScrolling: "touch" }}>
        <img src={s.u} alt="" draggable={false}
          style={zoom ? { width: s.kind === "plan" ? "185%" : "155%", maxWidth: "none", height: "auto" }
                      : { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", margin: "auto" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px calc(16px + env(safe-area-inset-bottom))", flex: "0 0 auto" }}>
        <button onClick={() => go(-1)} disabled={i === 0} style={navBtn(i === 0)} aria-label="Previous">‹</button>
        <span style={{ color: "rgba(255,255,255,.7)", fontSize: 11.5, textAlign: "center" }}>{zoom ? "tap image to fit" : "tap to zoom · swipe to browse"}</span>
        <button onClick={() => go(1)} disabled={i === shots.length - 1} style={navBtn(i === shots.length - 1)} aria-label="Next">›</button>
      </div>
    </div>
  );
}

// A tap-to-open section — keeps the deep detail available but out of the way, so a
// first-time reader isn't overwhelmed while nothing is actually hidden.
function Foldable({ title, sub, children, defaultOpen = false }: { title: string; sub?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...panel, padding: 0, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "11px 13px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#334" }}>{title}{sub ? <span style={{ fontWeight: 400, color: "#889", fontSize: 12 }}> · {sub}</span> : null}</span>
        <span style={{ color: "#1455c0", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{open ? "Hide ▴" : "Show ▾"}</span>
      </button>
      {open ? <div style={{ padding: "0 13px 12px" }}>{children}</div> : null}
    </div>
  );
}

// plain-English headline of the verdict, for a non-technical reader
function plainVerdict(p: Prop, ref?: number, delta?: number | null) {
  const diff = p.asking && ref ? Math.abs(p.asking - ref) : null;
  const money = diff ? "£" + Math.round(diff).toLocaleString("en-GB") : null;
  const d = delta ?? null;
  if (d != null && d <= -3)
    return { emoji: "✅", fg: "#0a7d28", bg: "#eef8f0", bd: "#cce9d4", head: "Good value for money",
      sub: money ? `About ${money} (${Math.abs(d)}%) cheaper than similar homes that have sold nearby.` : "Priced below similar homes that have sold nearby." };
  if (d != null && d >= 3)
    return { emoji: "🔴", fg: "#c01616", bg: "#fdeeee", bd: "#f3d2d2", head: "Looks expensive",
      sub: money ? `About ${money} (${d}%) dearer than similar homes that have sold nearby.` : "Priced above similar homes that have sold nearby." };
  return { emoji: "🟠", fg: "#b06b00", bg: "#fff7ea", bd: "#f0e0c0", head: "Around the right price",
    sub: "Priced about in line with similar homes that have sold nearby." };
}

// compact verdict pill for the market table (no more 4-line-wrapping cells)
function VerdictChip({ m }: { m: Prop }) {
  const r = m.ratio;
  const [label, col]: [string, string] = r == null ? ["—", "#98a4b0"]
    : r < 0.97 ? ["Good value", "#0a7d28"]
    : r < 1.03 ? ["Fair", "#b06b00"]
    : ["Overpriced", "#c01616"];
  return <span style={{ display: "inline-block", whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 700, color: col, background: col + "16", border: `1px solid ${col}38`, padding: "2px 9px", borderRadius: 11 }}>{label}</span>;
}

// Verdict-coloured pins on a Swindon map. Leaflet is loaded from CDN on demand
// (like KaTeX) so we add no npm dependency to the static build.
function MapView({ rows, onSelect }: { rows: Prop[]; onSelect: (p: Prop) => void }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<unknown>(null);
  const layer = useRef<unknown>(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const rowKey = rows.map((r) => r.uid || "").join("|");

  useEffect(() => {
    const w = window as unknown as { L?: unknown };
    if (w.L) { setReady(true); return; }
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    let s = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = "leaflet-js"; s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = () => setReady(true);
      document.body.appendChild(s);
    } else { s.addEventListener("load", () => setReady(true)); }
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || mapObj.current) return;
    const L = (window as unknown as { L: any }).L;
    const map = L.map(mapRef.current).setView([51.5558, -1.7797], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
    mapObj.current = map;
    layer.current = L.layerGroup().addTo(map);
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapObj.current || !layer.current) return;
    const L = (window as unknown as { L: any }).L;
    const lg = layer.current as any;
    lg.clearLayers();
    const pts = rows.filter((r) => r.lat && r.lon);
    pts.forEach((r) => {
      const d = r.ratio != null ? Math.round((r.ratio - 1) * 100) : null;
      const mk = L.circleMarker([r.lat, r.lon], { radius: 7, color: "#fff", weight: 1.2, fillColor: r.verdict_color || "#888", fillOpacity: 0.9 });
      mk.bindTooltip(`${gbp(r.asking)}${d != null ? ` · ${d > 0 ? "+" : ""}${d}%` : ""}`, { direction: "top" });
      mk.on("click", () => onSelect(r));
      mk.addTo(lg);
    });
    if (!fitted.current && pts.length) {
      try { (mapObj.current as any).fitBounds(pts.map((r) => [r.lat, r.lon]), { padding: [30, 30], maxZoom: 14 }); fitted.current = true; } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rowKey]);

  const withGeo = rows.filter((r) => r.lat && r.lon).length;
  return (
    <div>
      <div ref={mapRef} style={{ height: 460, borderRadius: 10, marginTop: 12, border: "1px solid #e6eaf0" }} />
      <div style={{ fontSize: 11.5, color: "#889", marginTop: 4 }}>
        {withGeo} of {rows.length} mapped · pin colour = verdict (green good value → red overpriced) · click a pin for the full report
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

function Card({ p, allAsking }: { p: Prop; allAsking?: number[] }) {
  const col = p.verdict_color || "#334";
  const ref = p.fair_ref ?? (p.avm_value || p.fair_by_area || p.fair_value);
  const delta = p.asking && ref ? Math.round((p.asking / ref - 1) * 100) : null;
  const fit = Math.round((scoreAxes(p).reduce((s, a) => s + a.v, 0) / 6) * 100);
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

      {(() => { const vb = plainVerdict(p, ref, delta); return (
        <div style={{ background: vb.bg, border: `1px solid ${vb.bd}`, borderRadius: 11, padding: "11px 14px", margin: "12px 0 0", display: "flex", gap: 11, alignItems: "center" }}>
          <span style={{ fontSize: 25, lineHeight: 1 }}>{vb.emoji}</span>
          <div><div style={{ fontSize: 15.5, fontWeight: 800, color: vb.fg }}>{vb.head}</div>
            <div style={{ fontSize: 12.5, color: "#556", marginTop: 2 }}>{vb.sub}</div></div>
        </div>
      ); })()}

      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", margin: "12px 0" }}>
        <Kpi label="Asking" value={gbp(p.asking)} />
        <Kpi label="Fair value" value={gbp(ref)} />
        {delta !== null && <Kpi label="vs fair" value={`${delta > 0 ? "+" : ""}${delta}%`} color={col} />}
        {p.suggested_offer ? <Kpi label="Suggested offer" value={gbp(p.suggested_offer)} /> : null}
      </div>

      <PhotoGallery photos={p.photos} floorplan={p.floorplan} />

      <Foldable title="How we worked out the value" sub="the comparables, score & confidence">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        {p.fair_by_area ? <Mini title="Similar-size comps" big={gbp(p.fair_by_area)} accent="#0a7d28"
              sub={p.ppm2_basis || (p.ppm2_local ? `≈ £${p.ppm2_local.toLocaleString()}/m²` : "")} /> : null}
        <Mini title="Type median (all sizes)" big={gbp(p.fair_value)}
              sub={`${gbp(p.fair_low)}–${gbp(p.fair_high)} · ${p.n_comps || 0} comps`} />
        {p.avm_value ? <Mini title="AVM (model)" big={gbp(p.avm_value)} accent="#5a3fb8"
              sub={`typical ${gbp(p.avm_low)}–${gbp(p.avm_high)}`} /> : null}
      </div>

      <div style={{ ...panel, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Radar p={p} />
          <div style={{ fontSize: 11, color: "#889", marginTop: -6 }}>fit score</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1455c0", lineHeight: 1 }}>{fit}<span style={{ fontSize: 12, color: "#aab" }}>/100</span></div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <b style={{ fontSize: 13 }}>How it scores</b>
          <div style={{ fontSize: 12, color: "#778", margin: "2px 0 6px" }}>
            Value · Size · Condition · Quiet · Safety · Schools — bigger shape = better fit. A first cut of the Ideal-Home score.
          </div>
          {allAsking && allAsking.length >= 8 && (
            <>
              <div style={{ fontSize: 12, color: "#556", fontWeight: 600 }}>Where its asking price sits in the market</div>
              <PriceHistogram all={allAsking} mine={p.asking} color={col} />
            </>
          )}
        </div>
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
      </Foldable>

      {p.negotiation && p.negotiation.length > 0 && (
        <div style={{ ...panel, borderLeft: "3px solid #1455c0", background: "#eef4ff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
            <b style={{ fontSize: 13.5 }}>💬 Reasons to negotiate the price down</b>
            {p.opening_offer ? <span style={{ fontSize: 12.5, color: "#556" }}>suggested opening offer <b style={{ color: "#0a7d28" }}>{gbp(p.opening_offer)}</b></span> : null}
          </div>
          <ul style={{ fontSize: 12.5, color: "#334", margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.5 }}>
            {p.negotiation.map((n, i) => <li key={i} style={{ marginBottom: 3 }}>{n}</li>)}
          </ul>
          {p.listing_update ? <div style={{ fontSize: 11.5, color: "#889", marginTop: 4 }}>Listing status: {p.listing_update}</div> : null}
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

      {(p.has_garden != null || p.council_tax_cost || p.amenities?.road_rail?.road_rail_summary) && (
        <div style={panel}>
          <b style={{ fontSize: 13 }}>🏡 Living here</b>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "5px 0" }}>
            {p.has_garden ? <Tag c="#0a7d28">🌳 Garden{p.south_garden ? " · S-facing" : ""}</Tag>
              : p.has_garden === false ? <Tag c="#b06b00">No garden mentioned</Tag> : null}
            {p.has_parking ? <Tag c="#0a7d28">🅿️ Parking / garage</Tag>
              : p.has_parking === false ? <Tag c="#b06b00">No parking mentioned</Tag> : null}
            {p.busy_road === true ? <Tag c="#c01616">🔊 On a busy road / railway</Tag>
              : p.busy_road === false ? <Tag c="#1455c0">🔇 Quiet for routes</Tag> : null}
          </div>
          {p.council_tax_cost ? (
            <div style={{ fontSize: 12.5, color: "#445" }}>Council tax <b>£{p.council_tax_cost.toLocaleString()}/yr</b>
              {" "}(≈£{Math.round(p.council_tax_cost / 12)}/mo){p.council_tax_band ? ` · band ${p.council_tax_band}` : ""}</div>
          ) : null}
          {p.amenities?.road_rail?.road_rail_summary ? (
            <div style={{ fontSize: 12.5, color: "#556", marginTop: 2 }}>🛣️ {p.amenities.road_rail.road_rail_summary}</div>
          ) : null}
        </div>
      )}

      {p.orientation?.verdict && <Orientation o={p.orientation} floorplan={p.floorplan?.[0]} pid={p.uid || p.address || ""} />}

      {p.own_last_sale?.last_price && (
        <div style={panel}>
          <b style={{ fontSize: 13 }}>What the seller paid</b>
          <div style={{ fontSize: 12.5, color: "#445", marginTop: 4 }}>
            Last sold {p.own_last_sale.last_date} for <b>{gbp(p.own_last_sale.last_price)}</b>
            {p.own_last_sale.years_ago != null ? ` (${p.own_last_sale.years_ago} yr ago)` : ""}.
            {p.own_last_sale.index_implied_today ? (
              <> Local index implies <b>{gbp(p.own_last_sale.index_implied_today)}</b> today
                {p.own_last_sale.index_growth_pct != null ? ` (${p.own_last_sale.index_growth_pct > 0 ? "+" : ""}${p.own_last_sale.index_growth_pct}%)` : ""}.</>
            ) : null}
          </div>
        </div>
      )}

      {p.crime_grade && (
        <div style={{ ...panel, borderLeft: `3px solid ${crimeColor(p.crime_grade)}` }}>
          🚨 Crime: <b style={{ color: crimeColor(p.crime_grade) }}>{p.crime_grade}</b>
          {p.crime_count != null ? <span style={{ fontSize: 12.5, color: "#556" }}> · {p.crime_count} crimes/month within ~1 mile (police.uk), vs the rest of the Swindon market</span> : null}
          {(p.amenities?.crime?.crime_top && p.amenities.crime.crime_top.length > 0) && (
            <div style={{ fontSize: 12, color: "#778", marginTop: 3 }}>{p.amenities.crime.crime_top.map(([c, n]) => `${c.replace(/-/g, " ")} ×${n}`).join(" · ")}</div>
          )}
          {p.crime_penalty_pct ? (
            <div style={{ fontSize: 12.5, color: "#b06b00", marginTop: 3 }}>
              ⚠ {p.crime_grade} crime knocks ~{p.crime_penalty_pct}% off what it's worth to live in — crime-adjusted offer <b>{gbp(p.crime_adj_offer)}</b> (vs {gbp(p.suggested_offer)} on price alone).
            </div>
          ) : null}
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

      {((p.history?.sales && p.history.sales.length > 0) || (p.area && p.area.crime_count != null)) && (
      <Foldable title="Sale history & area detail">
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
      </Foldable>
      )}

      {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#1455c0" }}>View listing ↗</a>}
    </div>
  );
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// compact at-a-glance feature icons for a listing (read symbols, not sentences)
function AtAGlance({ p }: { p: Prop }) {
  const sch = p.amenities?.schools;
  const ofsted = sch?.primary?.ofsted || sch?.secondary?.ofsted || "";
  const items: { t: string; title: string; c: string }[] = [];
  if (p.has_garden) items.push({ t: "🌳", title: "Garden" + (p.south_garden ? " · south-facing" : ""), c: "#0a7d28" });
  if (p.has_parking) items.push({ t: "🅿️", title: "Parking / garage", c: "#0a7d28" });
  if (p.busy_road === true) items.push({ t: "🔊", title: "On/near a busy road or railway", c: "#c01616" });
  else if (p.busy_road === false) items.push({ t: "🔇", title: "Quiet for routes", c: "#1455c0" });
  if (p.crime_grade) items.push({ t: "🚨", title: `${p.crime_grade} crime area`, c: crimeColor(p.crime_grade) });
  if (ofsted) items.push({ t: "🏫", title: `Nearest school Ofsted: ${ofsted}`, c: ofstedColor(ofsted) });
  if (p.amenities?.flood?.flood_areas_nearby) items.push({ t: "💧", title: "Within a flood-warning area", c: "#b06b00" });
  if (!items.length) return null;
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center", verticalAlign: "middle" }}>
      {items.map((it, i) => (
        <span key={i} title={it.title}
          style={{ fontSize: 12, lineHeight: 1, paddingBottom: 1, borderBottom: `2px solid ${it.c}` }}>{it.t}</span>
      ))}
    </span>
  );
}

// horizontal gauge: how far asking sits above/below fair (centre = on the money)
function ValueBar({ ratio, color }: { ratio?: number; color?: string }) {
  if (ratio == null) return <span style={{ color: "#bbc" }}>—</span>;
  const pct = Math.round((ratio - 1) * 100);
  const clamped = Math.max(-25, Math.min(25, pct));
  const half = 30, w = (Math.abs(clamped) / 25) * half;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      <span style={{ position: "relative", width: half * 2, height: 8, background: "#eef1f5", borderRadius: 4, display: "inline-block" }}>
        <span style={{ position: "absolute", left: half, top: -1, width: 1, height: 10, background: "#aab" }} />
        <span style={{ position: "absolute", top: 0, height: 8, borderRadius: 4, background: color || "#888",
          left: clamped < 0 ? half - w : half, width: w }} />
      </span>
      <span style={{ fontSize: 12, color: color || "#445", fontWeight: 600 }}>{pct > 0 ? "+" : ""}{pct}%</span>
    </span>
  );
}

// 0–1 score per axis — the visual preview of the future Ideal-Home Fit Score
function scoreAxes(p: Prop): { label: string; v: number }[] {
  const ratio = p.ratio ?? 1;
  const value = clamp01(1 - (ratio - 0.85) / 0.30);              // 0.85×→1.0, 1.15×→0.0
  const size = clamp01((p.floor_area_m2 || 0) / 130);           // 130 m² = full marks
  const adj = p.condition?.value_adjustment_pct;
  const condition = adj == null ? 0.5 : clamp01((adj + 12) / 18); // −12%→0, +6%→1
  const quiet = p.busy_road === true ? 0 : p.busy_road === false ? 1 : 0.5;
  const safety = ({ Low: 1, Moderate: 0.66, Elevated: 0.33, High: 0 } as Record<string, number>)[p.crime_grade || ""] ?? 0.5;
  const ofsted = p.amenities?.schools?.primary?.ofsted || p.amenities?.schools?.secondary?.ofsted || "";
  const schools = ({ Outstanding: 1, Good: 0.78, "Requires improvement": 0.4, Inadequate: 0.12 } as Record<string, number>)[ofsted] ?? 0.5;
  return [
    { label: "Value", v: value }, { label: "Size", v: size }, { label: "Condition", v: condition },
    { label: "Quiet", v: quiet }, { label: "Safety", v: safety }, { label: "Schools", v: schools },
  ];
}

function Radar({ p }: { p: Prop }) {
  const axes = scoreAxes(p);
  const N = axes.length, R = 50, cx = 70, cy = 66;
  const ang = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const pt = (i: number, r: number): [number, number] => [cx + Math.cos(ang(i)) * R * r, cy + Math.sin(ang(i)) * R * r];
  const overall = Math.round((axes.reduce((s, a) => s + a.v, 0) / N) * 100);
  return (
    <svg viewBox="0 0 140 134" style={{ width: 148, height: 142, flex: "0 0 auto" }}>
      {[0.25, 0.5, 0.75, 1].map((r, i) => (
        <polygon key={i} points={axes.map((_, j) => pt(j, r).join(",")).join(" ")} fill="none" stroke="#e6eaf0" strokeWidth="0.7" />
      ))}
      {axes.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e6eaf0" strokeWidth="0.7" />; })}
      <polygon points={axes.map((a, i) => pt(i, a.v).join(",")).join(" ")} fill="#1455c044" stroke="#1455c0" strokeWidth="1.5" />
      {axes.map((a, i) => { const [x, y] = pt(i, 1.2); return (
        <text key={i} x={x} y={y} fontSize="7.5" fill="#667" textAnchor="middle" dominantBaseline="middle">{a.label}</text>); })}
    </svg>
  );
}

function PriceHistogram({ all, mine, color }: { all: number[]; mine?: number; color?: string }) {
  if (all.length < 8 || !mine) return null;
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
  const bins = 20, w = 260, h = 54;
  const counts = new Array(bins).fill(0);
  all.forEach((v) => { counts[Math.min(bins - 1, Math.floor(((v - lo) / span) * bins))]++; });
  const max = Math.max(...counts, 1);
  const mineBin = Math.min(bins - 1, Math.floor(((mine - lo) / span) * bins));
  const bw = w / bins;
  return (
    <svg viewBox={`0 0 ${w} ${h + 15}`} style={{ width: "100%", maxWidth: 320 }}>
      {counts.map((c, i) => (
        <rect key={i} x={i * bw} y={h - (c / max) * h} width={bw - 1} height={(c / max) * h} rx="1"
          fill={i === mineBin ? (color || "#1455c0") : "#dde3ec"} />
      ))}
      <text x={0} y={h + 12} fontSize="8" fill="#889">£{Math.round(lo / 1000)}k</text>
      <text x={w} y={h + 12} fontSize="8" fill="#889" textAnchor="end">£{Math.round(hi / 1000)}k</text>
      <text x={Math.max(12, Math.min(w - 12, (mineBin + 0.5) * bw))} y={h - (counts[mineBin] / max) * h - 2}
        fontSize="8" fill={color || "#1455c0"} textAnchor="middle" fontWeight="700">this one</text>
    </svg>
  );
}

function GalleryTile({ m, onClick, liked, onLike }: { m: Prop; onClick: () => void; liked?: boolean; onLike?: () => void }) {
  const col = m.verdict_color || "#888";
  const d = m.ratio != null ? Math.round((m.ratio - 1) * 100) : null;
  const img = (m.photos && m.photos[0]) || "";
  return (
    <div onClick={onClick} style={{ cursor: "pointer", border: "1px solid #e6eaf0", borderTop: `4px solid ${col}`,
      borderRadius: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
      <div style={{ height: 122, background: "#eef1f5", position: "relative" }}>
        {img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aab", fontSize: 12 }}>no photo</div>}
        {d != null && <span style={{ position: "absolute", top: 6, right: 6, background: col, color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>{d > 0 ? "+" : ""}{d}%</span>}
        {onLike && <span style={{ position: "absolute", top: 2, left: 4, textShadow: "0 1px 3px rgba(0,0,0,.5)" }}><LikeHeart on={!!liked} onClick={onLike} size={20} /></span>}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
          <b style={{ fontSize: 14 }}>{gbp(m.asking)}</b>
          <span style={{ fontSize: 11, color: "#889" }}>fair {gbp(m.fair_ref ?? m.fair_value)}</span>
        </div>
        <div style={{ fontSize: 12, color: "#445", margin: "2px 0 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.address}</div>
        {(m.suggested_offer || m.floor_area_m2) ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, fontSize: 11.5, color: "#667", margin: "0 0 5px" }}>
            <span>{m.suggested_offer ? <>offer <b style={{ color: "#0a7d28" }}>{gbp(m.suggested_offer)}</b></> : ""}</span>
            <span>{m.floor_area_m2 ? <><b style={{ color: "#445" }}>{Math.round(m.floor_area_m2 * 10.764).toLocaleString()}</b> sq ft</> : ""}</span>
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <AtAGlance p={m} />
          <span style={{ fontSize: 10.5, color: "#aab" }}>{m.beds ? `${m.beds} bed` : ""}</span>
        </div>
      </div>
    </div>
  );
}

const likeKey = (m: Prop): string => m.uid || m.address || "";
const LikeHeart = ({ on, onClick, size = 17 }: { on: boolean; onClick: () => void; size?: number }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick(); }}
    title={on ? "Saved — click to remove" : "Save this home"} aria-pressed={on}
    style={{ border: "none", background: "none", cursor: "pointer", fontSize: size, lineHeight: 1, padding: 2, color: on ? "#e0245e" : "#c2cad3" }}>
    {on ? "♥" : "♡"}
  </button>
);
const FilterPill = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
  <button onClick={onClick} title={on ? "On — hiding non-matches. Click to show all." : "Off — not filtering. Click to require it."}
    style={{
      fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 14, cursor: "pointer",
      border: on ? "1px solid #0a7d28" : "1px solid #cdd6e0",
      background: on ? "#e7f6ec" : "#fff", color: on ? "#0a7d28" : "#99a3b0",
      textDecoration: on ? "none" : "line-through",
    }}>
    {on ? "✓ " : ""}{label}
  </button>
);
const SECTOR_WORD: Record<string, string> = { N: "North", NE: "North-east", E: "East", SE: "South-east", S: "South", SW: "South-west", W: "West", NW: "North-west" };
const ORIENT_ROOM: Record<string, string> = { entrance: "#1d4ed8", kitchen: "#d97706", bathroom: "#dc2626", wc: "#dc2626" };
const ORIENT_VCOL: Record<string, string> = { Good: "#2f8f5b", Mixed: "#c98a1e", Avoid: "#c0392b", "Can't tell": "#7a8794" };
const STCOL: Record<string, string> = { ok: "#2f8f5b", warn: "#c98a1e", bad: "#c0392b", neutral: "#98a4b0" };
const bxy = (b: number, r: number): [number, number] => [50 + r * Math.sin(b * Math.PI / 180), 50 - r * Math.cos(b * Math.PI / 180)];

// --- client-side re-orientation (so a user's front-door fix recomputes instantly) ---
const SECTORS8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const sectorOf = (b: number) => SECTORS8[Math.floor(((((b % 360) + 360) % 360) + 22.5) / 45) % 8];
const phiOf = (x: number, y: number, c: [number, number]) =>
  (((Math.atan2(x - c[0], -(y - c[1])) * 180) / Math.PI) % 360 + 360) % 360;
const FACING_DEG: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
type RoomS = { type?: string; sector?: string; bearing?: number };
// port of orientation.apply_rules → the same PASS/WEAK/FAIL logic, in words
function vastuVerdict(rooms: RoomS[]): { verdict: string; score: number | null } {
  const ws = rooms.filter((r) => r.sector);
  if (!ws.length) return { verdict: "Can't tell", score: null };
  const baths = ws.filter((r) => r.type === "bathroom" || r.type === "wc");
  const kit = ws.filter((r) => r.type === "kitchen");
  const ent = ws.filter((r) => r.type === "entrance");
  const hardFail = baths.some((b) => b.sector === "NE");
  const soft: boolean[] = [];
  if (ent.length) soft.push(ent.some((e) => e.sector === "E" || e.sector === "N"));
  if (kit.length) soft.push(kit.some((k) => k.sector === "NW"));
  soft.push(!baths.some((b) => b.sector === "N"));
  const score = soft.length ? Math.round((100 * soft.filter(Boolean).length) / soft.length) : 0;
  return { verdict: hardFail ? "Avoid" : score >= 60 ? "Good" : "Mixed", score };
}

type Draft = { x: number; y: number; floor: number; facing: number };

function Orientation({ o, floorplan, pid }: { o: NonNullable<Prop["orientation"]>; floorplan?: string; pid: string }) {
  const geom = o.geom;
  const hasGeom = !!(geom?.rooms?.length && geom.centres);
  const lsKey = "hf_orient_" + pid;
  const [corr, setCorr] = useState<Draft | null>(null);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    try { const v = localStorage.getItem(lsKey); if (v) setCorr(JSON.parse(v)); } catch { /* ignore */ }
  }, [lsKey]);

  const centres = geom?.centres || {};
  const cOf = (f?: number): [number, number] =>
    centres[String(f ?? 1)] || centres["1"] || (Object.values(centres)[0] as [number, number]) || [0.5, 0.5];
  const floorOf = (x: number): number => {
    let best = 1, bd = Infinity;
    for (const [f, c] of Object.entries(centres)) { const d = Math.abs(x - c[0]); if (d < bd) { bd = d; best = +f; } }
    return best;
  };
  const defaultDraft = (): Draft => {
    if (corr) return { ...corr };
    const e = geom?.entrance;
    return { x: e?.x ?? 0.5, y: e?.y ?? 0.9, floor: e?.floor ?? 1, facing: geom?.facing ?? 0 };
  };

  // the anchor currently in effect: the live draft while editing, else the saved fix
  const active = edit ? draft : corr;

  // --- resolve rooms + north offset A, either from the anchor or the auto value ---
  let rooms: RoomS[] = [];
  let A: number | null = null;
  if (hasGeom) {
    if (active) { A = ((phiOf(active.x, active.y, cOf(active.floor)) - active.facing) % 360 + 360) % 360; }
    else { A = geom!.A ?? null; }
    rooms = (geom!.rooms || []).map((r) => {
      const phi = phiOf(r.x ?? 0.5, r.y ?? 0.5, cOf(r.floor));
      if (A == null) return { type: r.type };
      const b = ((phi - A) % 360 + 360) % 360;
      return { type: r.type, sector: sectorOf(b), bearing: b };
    });
  } else {
    rooms = (o.rooms || []).filter((r) => r.sector);
  }
  const shown = rooms.filter((r) => r.sector);
  const vv = hasGeom ? vastuVerdict(rooms) : { verdict: o.verdict || "Can't tell", score: o.score ?? null };
  const verdict = vv.verdict;
  const corrected = !!corr && !edit;

  const roomName = (t?: string) => t === "entrance" ? "🚪 Front door" : t === "kitchen" ? "🍳 Kitchen" : t === "wc" ? "🚽 Toilet" : "🚽 Bathroom";
  const assess = (t?: string, s?: string): [keyof typeof STCOL, string] => {
    if (t === "bathroom" || t === "wc")
      return s === "NE" ? ["bad", "the north-east — the corner to avoid"]
        : s === "N" ? ["warn", "in the north — you wanted it kept clear"] : ["ok", "clear of the north-east"];
    if (t === "kitchen") return s === "NW" ? ["ok", "your preferred spot"] : ["neutral", "you'd hoped for north-west"];
    return s === "E" || s === "N" ? ["ok", "east or north, as you like"] : ["warn", "you preferred east or north"];
  };
  const method = o.north_method || "unknown";
  const trust = corrected
    ? <span style={{ color: "#1d4ed8" }}>✎ You set the front door yourself — directions worked out from that.</span>
    : method === "compass on plan"
      ? <span style={{ color: "#2f8f5b" }}>✓ Read from the compass printed on the plan.</span>
      : method.startsWith("satellite")
        ? <span style={{ color: "#a56311" }}>≈ North estimated from the building outline on the map — rough, worth double-checking.</span>
        : <span style={{ color: "#889" }}>This plan has no compass. Tap “Set the front door” to work out the directions.</span>;
  const [wx0, wy0] = bxy(22.5, 38), [wx1, wy1] = bxy(67.5, 38);

  const openEdit = () => { setDraft(defaultDraft()); setEdit(true); };
  const save = () => { if (draft) { try { localStorage.setItem(lsKey, JSON.stringify(draft)); } catch { /* ignore */ } setCorr(draft); } setEdit(false); };
  const reset = () => { try { localStorage.removeItem(lsKey); } catch { /* ignore */ } setCorr(null); setEdit(false); };
  const onPlan = (e: React.MouseEvent) => {
    const el = imgRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setDraft((d) => ({ ...(d as Draft), x, y, floor: floorOf(x) }));
  };

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <b style={{ fontSize: 13 }}>🧭 Orientation{corrected && <span style={{ color: "#1d4ed8", fontWeight: 600, fontSize: 11 }}> · your fix</span>}</b>
        <span style={{ background: ORIENT_VCOL[verdict] || "#7a8794", color: "#fff", fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 12 }}>{verdict}</span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <svg viewBox="0 0 100 100" style={{ width: 108, height: 108, flex: "0 0 108px" }} aria-hidden="true">
          <circle cx="50" cy="50" r="38" fill="#fff" stroke="#d7dee6" strokeWidth="1.2" />
          <path d={`M50 50 L${wx0.toFixed(1)} ${wy0.toFixed(1)} A38 38 0 0 1 ${wx1.toFixed(1)} ${wy1.toFixed(1)} Z`} fill="#c0392b" fillOpacity="0.12" />
          {[0, 90, 180, 270].map((b) => { const [ex, ey] = bxy(b, 38); return <line key={b} x1="50" y1="50" x2={ex.toFixed(1)} y2={ey.toFixed(1)} stroke="#eef1f4" strokeWidth="0.8" />; })}
          {([[0, "N"], [90, "E"], [180, "S"], [270, "W"]] as [number, string][]).map(([b, l]) => { const [lx, ly] = bxy(b, 46); return <text key={l} x={lx.toFixed(1)} y={ly.toFixed(1)} fontSize="6.5" fill="#5b6b7c" textAnchor="middle" dominantBaseline="central" fontWeight="700">{l}</text>; })}
          {shown.map((r, i) => { if (r.bearing == null) return null; const [dx, dy] = bxy(r.bearing, 23); return <circle key={i} cx={dx.toFixed(1)} cy={dy.toFixed(1)} r="3.6" fill={ORIENT_ROOM[r.type || ""] || "#64748b"} stroke="#fff" strokeWidth="1" />; })}
        </svg>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 12.5, flex: 1, minWidth: 168 }}>
          {shown.length ? shown.map((r, i) => {
            const [st, msg] = assess(r.type, r.sector);
            const mk = { ok: "✓", warn: "!", bad: "✕", neutral: "·" }[st];
            return (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "3px 0", lineHeight: 1.4 }}>
                <span style={{ flex: "0 0 16px", height: 16, borderRadius: "50%", background: STCOL[st], color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{mk}</span>
                <span>{roomName(r.type)} is in the <b>{SECTOR_WORD[r.sector || ""] || r.sector}</b><span style={{ color: "#778" }}> — {msg}</span></span>
              </li>
            );
          }) : <li style={{ color: "#889", fontSize: 12.5 }}>Directions not worked out yet.</li>}
        </ul>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5 }}>{trust}</span>
        {hasGeom && floorplan && !edit &&
          <button onClick={openEdit} style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 12, cursor: "pointer", border: "1px solid #c7d2e0", background: "#f3f7fc", color: "#1d4ed8", whiteSpace: "nowrap" }}>
            {corrected ? "✎ Edit front door" : "Set the front door"}
          </button>}
      </div>
      {edit && draft && floorplan &&
        <div style={{ marginTop: 10, borderTop: "1px dashed #dbe2ea", paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: "#556", marginBottom: 6 }}>
            <b>1.</b> Tap the real <b>front door</b> on the plan &nbsp; <b>2.</b> Pick the way it <b>faces</b> outside.
          </div>
          <div style={{ position: "relative", display: "inline-block", maxWidth: "100%", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <img ref={imgRef} src={floorplan} alt="floor plan" onClick={onPlan}
              style={{ display: "block", maxWidth: "100%", maxHeight: 360, cursor: "crosshair" }} />
            {(geom!.rooms || []).map((r, i) => r.type === "entrance" ? null : (
              <span key={i} title={r.type} style={{ position: "absolute", left: `${(r.x ?? 0.5) * 100}%`, top: `${(r.y ?? 0.5) * 100}%`,
                transform: "translate(-50%,-50%)", width: 9, height: 9, borderRadius: "50%", border: "1.5px solid #fff",
                background: ORIENT_ROOM[r.type || ""] || "#64748b", opacity: 0.85, pointerEvents: "none" }} />
            ))}
            <span style={{ position: "absolute", left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, transform: "translate(-50%,-100%)",
              fontSize: 20, lineHeight: 1, pointerEvents: "none", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.4))" }}>📍</span>
          </div>
          <div style={{ fontSize: 12, color: "#556", margin: "10px 0 4px" }}>Front door faces:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {SECTORS8.map((s) => {
              const on = sectorOf(draft.facing) === s;
              return <button key={s} onClick={() => setDraft((d) => ({ ...(d as Draft), facing: FACING_DEG[s] }))}
                style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 9px", borderRadius: 10, cursor: "pointer",
                  border: on ? "1px solid #1d4ed8" : "1px solid #cdd6e0", background: on ? "#e5edfb" : "#fff", color: on ? "#1d4ed8" : "#7a8794" }}>{s}</button>;
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={save} style={{ fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 10, cursor: "pointer", border: "none", background: "#1d4ed8", color: "#fff" }}>Save</button>
            <button onClick={() => setEdit(false)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 10, cursor: "pointer", border: "1px solid #cdd6e0", background: "#fff", color: "#556" }}>Cancel</button>
            {corr && <button onClick={reset} style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 10, cursor: "pointer", border: "1px solid #eecaca", background: "#fff", color: "#c0392b", marginLeft: "auto" }}>Reset to auto</button>}
            <span style={{ fontSize: 11.5, color: "#889", flexBasis: "100%" }}>Preview: <b style={{ color: ORIENT_VCOL[verdict] }}>{verdict}</b> — saved only in this browser.</span>
          </div>
        </div>}
    </div>
  );
}

const Tag = ({ c, children }: { c: string; children: React.ReactNode }) => (
  <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: c + "14", border: `1px solid ${c}40`, padding: "2px 8px", borderRadius: 11 }}>{children}</span>
);
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
// 16px font stops iOS Safari zooming the page when the picker opens; 44px min-height
// keeps it a comfortable tap target on a phone.
const priceSelect: React.CSSProperties = {
  fontSize: 16, fontWeight: 600, color: "#1a1f29", padding: "7px 8px", minHeight: 40,
  border: "1px solid #cdd6e0", borderRadius: 8, background: "#fff", cursor: "pointer",
};
const condColor = (c?: string) => ({ new: "#0a7d28", refurbished: "#0a7d28", good: "#1455c0", dated: "#b06b00", needs_work: "#c01616" }[c || ""] || "#445");
const ofstedColor = (g?: string) => ({ Outstanding: "#0a7d28", Good: "#1455c0", "Requires improvement": "#b06b00", Inadequate: "#c01616" }[g || ""] || "#667");
const crimeColor = (g?: string) => ({ Low: "#0a7d28", Moderate: "#1455c0", Elevated: "#b06b00", High: "#c01616" }[g || ""] || "#889");
