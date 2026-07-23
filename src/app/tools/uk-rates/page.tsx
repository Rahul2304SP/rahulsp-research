"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * UK Rate Watch: where UK interest rates are, and where the market prices them to go.
 * Data: Bank of England (Bank Rate, SONIA, OIS/SONIA-swap curve, daily gilt par yields)
 * and the ONS (CPI, wages), refreshed a few times a day by a local monitor that POSTs
 * to /api/ukrates. The market-implied forward path is read from the OIS curve — the
 * honest position is that this curve IS the best available Bank-Rate forecast; the
 * page reads it rather than claiming to beat it. Informational only, not advice.
 */

interface PathSeg {
  seg: string;
  rate: number;
}
interface SparkPt {
  d: string;
  v: number;
}
interface Snap {
  as_of_utc?: string;
  bank_rate?: number;
  sonia?: number;
  cpi?: { val?: number; ref?: string };
  core_cpi?: number;
  wages_total?: { val?: number; ref?: string };
  wages_regular?: number;
  ois_curve?: { asof?: string; spots?: Record<string, number> };
  forward_path?: PathSeg[];
  swap2y_live_est?: number;
  gilt5y?: { date?: string; val?: number; chg_1m?: number; chg_3m?: number };
  gilt10y?: { val?: number; chg_1m?: number };
  gilt5y_daily?: SparkPt[];
  next_events?: { date: string; label: string }[];
  flags?: string[];
}

type Status = "loading" | "live" | "waiting" | "error";

const POLL_MS = 10 * 60_000;
const STALE_S = 4 * 24 * 3600; // daily-cadence feed; banner if older than ~4 days

// Bundled snapshot of the REAL readings at build time (preview fallback for localhost /
// before the relay has data). The deployed page replaces this on first successful fetch.
const PREVIEW: Snap = {
  as_of_utc: "2026-07-23T15:33:42Z",
  bank_rate: 3.75,
  sonia: 3.7302,
  cpi: { val: 2.6, ref: "2026-06-01" },
  core_cpi: 2.6,
  wages_total: { val: 4.3, ref: "2026-05-01" },
  wages_regular: 3.3,
  ois_curve: {
    asof: "2026-06-30",
    spots: { "1y": 3.91, "2y": 3.98, "3y": 3.99, "5y": 4.03, "10y": 4.33 },
  },
  forward_path: [
    { seg: "0-1y", rate: 3.91 },
    { seg: "1-2y", rate: 4.06 },
    { seg: "2-3y", rate: 3.99 },
    { seg: "3-5y", rate: 4.09 },
    { seg: "5-10y", rate: 4.63 },
  ],
  swap2y_live_est: 4.25,
  gilt5y: { date: "2026-07-21", val: 4.55, chg_1m: 0.27, chg_3m: 0.17 },
  gilt10y: { val: 5.02, chg_1m: 0.3 },
  gilt5y_daily: [],
  next_events: [
    { date: "2026-07-30", label: "MPC rate decision + Monetary Policy Report" },
    { date: "2026-08-14", label: "AWE wages (ref 2026-06)" },
    { date: "2026-08-17", label: "CPI (ref 2026-07)" },
  ],
  flags: [],
};

function fmt(n?: number, d = 2): string {
  if (n === undefined || n === null || !isFinite(n)) return "--";
  return n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function refMonth(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  return new Date(t).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}
function eventDate(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function ageSeconds(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}
function agoLabel(s: number | null): string {
  if (s === null) return "";
  if (s < 5400) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

// ── forward-path chart (SVG, index-spaced horizons) ──────────────────────────
function PathChart({ path, bankRate }: { path: PathSeg[]; bankRate: number }) {
  const W = 560, H = 210, L = 44, R = 14, T = 26, B = 30;
  const xs = path.map((_, i) => L + ((W - L - R) * i) / Math.max(1, path.length - 1));
  const vals = [...path.map((p) => p.rate), bankRate];
  const lo = Math.floor((Math.min(...vals) - 0.25) * 4) / 4;
  const hi = Math.ceil((Math.max(...vals) + 0.25) * 4) / 4;
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const pts = path.map((p, i) => `${xs[i].toFixed(1)},${y(p.rate).toFixed(1)}`).join(" ");
  const gridVals: number[] = [];
  for (let g = lo; g <= hi + 1e-9; g += 0.5) gridVals.push(Math.round(g * 4) / 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label="Market-implied average short rate per forward segment vs the current Bank Rate">
      {gridVals.map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#eef0f3" strokeWidth={1} />
          <text x={L - 6} y={y(g) + 3.5} textAnchor="end" fontSize={10} fill="#9ca3af">
            {fmt(g, 1)}
          </text>
        </g>
      ))}
      {/* Bank Rate reference */}
      <line x1={L} x2={W - R} y1={y(bankRate)} y2={y(bankRate)} stroke="#6b7280"
        strokeWidth={1.4} strokeDasharray="5 4" />
      <text x={W - R} y={y(bankRate) - 5} textAnchor="end" fontSize={10.5} fill="#6b7280">
        Bank Rate {fmt(bankRate)}%
      </text>
      {/* forward path */}
      <polyline points={pts} fill="none" stroke="#1e40af" strokeWidth={2} />
      {path.map((p, i) => (
        <g key={p.seg}>
          <circle cx={xs[i]} cy={y(p.rate)} r={3.6} fill="#1e40af" stroke="#ffffff" strokeWidth={1.5} />
          <text x={xs[i]} y={y(p.rate) - 8} textAnchor="middle" fontSize={10.5} fill="#1a1a2e" fontWeight={600}>
            {fmt(p.rate)}
          </text>
          <text x={xs[i]} y={H - 10} textAnchor="middle" fontSize={10} fill="#6b7280">
            {p.seg}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── daily 5y-gilt sparkline ──────────────────────────────────────────────────
function Spark({ pts }: { pts: SparkPt[] }) {
  const W = 560, H = 120, L = 44, R = 14, T = 12, B = 22;
  if (pts.length < 2) {
    return <p className="text-sm text-[#6b7280] italic">Daily history appears once the live monitor publishes.</p>;
  }
  const vs = pts.map((p) => p.v);
  const lo = Math.min(...vs) - 0.05, hi = Math.max(...vs) + 0.05;
  const x = (i: number) => L + ((W - L - R) * i) / (pts.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const d = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const first = pts[0], last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label="Daily 5-year gilt yield over roughly the last three months">
      <polyline points={d} fill="none" stroke="#1e40af" strokeWidth={1.8} />
      <circle cx={x(pts.length - 1)} cy={y(last.v)} r={3.2} fill="#1e40af" stroke="#fff" strokeWidth={1.4} />
      <text x={x(0)} y={H - 6} fontSize={10} fill="#6b7280">{eventDate(first.d)}</text>
      <text x={x(pts.length - 1)} y={H - 6} textAnchor="end" fontSize={10} fill="#6b7280">
        {eventDate(last.d)}
      </text>
      <text x={x(pts.length - 1) - 8} y={y(last.v) + 3.5} textAnchor="end" fontSize={10.5}
        fill="#1a1a2e" fontWeight={600}>
        {fmt(last.v)}%
      </text>
    </svg>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] p-4">
      <div className="text-[11px] uppercase tracking-widest text-[#6b7280] mb-1">{label}</div>
      <div className="text-2xl font-semibold text-[#1a1a2e]">{value}</div>
      {sub && <div className="text-xs text-[#6b7280] mt-1">{sub}</div>}
    </div>
  );
}

export default function UkRatesPage() {
  const [snap, setSnap] = useState<Snap>(PREVIEW);
  const [status, setStatus] = useState<Status>("loading");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ukrates", { cache: "no-store" });
      const j = (await r.json()) as Snap & { error?: string };
      if (j && !j.error && typeof j.bank_rate === "number") {
        setSnap(j);
        setStatus("live");
      } else {
        setStatus((s) => (s === "live" ? "live" : "waiting"));
      }
    } catch {
      setStatus((s) => (s === "live" ? "live" : "error"));
    }
  }, []);

  useEffect(() => {
    document.title = "UK Rate Watch | Rahul S. P.";
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const age = ageSeconds(snap.as_of_utc);
  const stale = age !== null && age > STALE_S;
  const badge =
    status === "live" && !stale
      ? { txt: "LIVE", bg: "#1e40af" }
      : status === "live" && stale
        ? { txt: "STALE", bg: "#d97706" }
        : { txt: "PREVIEW", bg: "#6b7280" };

  const br = snap.bank_rate ?? 0;
  const path = snap.forward_path ?? [];
  const y1 = path.find((p) => p.seg === "0-1y")?.rate;
  const spots = snap.ois_curve?.spots ?? {};
  const slope = spots["5y"] !== undefined && spots["2y"] !== undefined ? spots["5y"] - spots["2y"] : undefined;
  const dir =
    y1 === undefined ? "" : y1 > br + 0.05
      ? "the market prices NO cuts — the short rate is priced to drift HIGHER"
      : y1 < br - 0.05
        ? "the market prices rate CUTS over the next year"
        : "the market prices the Bank Rate roughly FLAT over the next year";
  const g5chg = snap.gilt5y?.chg_1m;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="font-serif text-3xl text-[#1a1a2e]">UK Rate Watch</h1>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded text-white"
          style={{ background: badge.bg }}>
          {badge.txt}
        </span>
      </div>
      <p className="text-[#374151] leading-relaxed mb-1 max-w-2xl">
        Where UK interest rates are, and where the market prices them to go — read directly from the
        Bank of England&apos;s OIS (SONIA-swap) curve, daily gilt yields and the latest ONS inflation
        and wage prints. UK fixed mortgages are priced off these same swap rates.
      </p>
      <p className="text-xs text-[#6b7280] mb-8">
        {snap.as_of_utc ? `Updated ${agoLabel(age)}` : ""}
        {snap.ois_curve?.asof ? ` · curve as of ${snap.ois_curve.asof}` : ""} · sources: Bank of England, ONS
      </p>

      {(snap.flags ?? []).length > 0 && (
        <div className="mb-6 space-y-2">
          {(snap.flags ?? []).map((f) => (
            <div key={f}
              className="rounded-lg border border-[#f3d9a4] bg-[#fffbeb] px-4 py-2.5 text-sm text-[#7c5c10]">
              <span className="font-semibold">Flag:</span> {f}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Tile label="Bank Rate" value={`${fmt(br)}%`}
          sub={snap.sonia !== undefined ? `SONIA ${fmt(snap.sonia)}%` : undefined} />
        <Tile label="2y swap (live est.)" value={`${fmt(snap.swap2y_live_est)}%`}
          sub="the base of a 2y fixed mortgage" />
        <Tile label="CPI inflation" value={`${fmt(snap.cpi?.val, 1)}%`}
          sub={`ref ${refMonth(snap.cpi?.ref)} · core ${fmt(snap.core_cpi, 1)}%`} />
        <Tile label="Regular pay growth" value={`${fmt(snap.wages_regular, 1)}%`}
          sub={`total ${fmt(snap.wages_total?.val, 1)}% · ref ${refMonth(snap.wages_total?.ref)}`} />
      </div>

      <div className="rounded-xl border border-[#e5e7eb] p-5 sm:p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1a1a2e] mb-1">Market-implied path of the short rate</h2>
        <p className="text-xs text-[#6b7280] mb-4">
          Average rate the OIS curve implies over each forward segment. This is the market&apos;s
          collective forecast — a fixed mortgage already embeds it.
        </p>
        {path.length > 1 && <PathChart path={path} bankRate={br} />}
        <p className="text-sm text-[#374151] leading-relaxed mt-3">
          Right now {dir}
          {slope !== undefined && (
            <>
              {" "}(1y-avg {fmt(y1)}% vs Bank Rate {fmt(br)}%). The 2y&ndash;5y swap slope is{" "}
              {slope >= 0 ? "+" : ""}{fmt(slope)}pp, so a 5-year fix is priced{" "}
              {Math.abs(slope) < 0.2 ? "barely" : ""} {slope > 0 ? "dearer" : "cheaper"} than a 2-year.
            </>
          )}
        </p>
      </div>

      <div className="rounded-xl border border-[#e5e7eb] p-5 sm:p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1a1a2e] mb-1">What&apos;s moving now — daily 5y gilt yield</h2>
        <p className="text-xs text-[#6b7280] mb-4">
          The monthly OIS curve lags; the daily 5-year gilt is the intra-month canary swap rates
          reprice with. 1-month change:{" "}
          <span className="font-semibold" style={{ color: (g5chg ?? 0) > 0.02 ? "#b45309" : "#1a1a2e" }}>
            {g5chg !== undefined && g5chg !== null ? `${g5chg >= 0 ? "+" : ""}${Math.round(g5chg * 100)}bp` : "--"}
          </span>
          {snap.gilt10y?.val !== undefined ? ` · 10y gilt ${fmt(snap.gilt10y.val)}%` : ""}
        </p>
        <Spark pts={snap.gilt5y_daily ?? []} />
      </div>

      <div className="rounded-xl border border-[#e5e7eb] p-5 sm:p-6 mb-8">
        <h2 className="text-lg font-semibold text-[#1a1a2e] mb-3">What&apos;s coming</h2>
        <ul className="space-y-2">
          {(snap.next_events ?? []).slice(0, 5).map((e) => (
            <li key={e.date + e.label} className="flex items-baseline gap-3 text-sm">
              <span className="shrink-0 font-mono text-[#1e40af]">{eventDate(e.date)}</span>
              <span className="text-[#374151]">{e.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-xs text-[#6b7280] leading-relaxed space-y-2">
        <p>
          Method: the forward path is computed from Bank of England OIS (SONIA) spot curve points;
          the live 2-year swap estimate adds the daily 5-year gilt&apos;s drift since the curve date
          to the last month-end 2-year OIS rate. CPI and earnings are the native ONS series; Bank
          Rate and daily gilt par yields come from the Bank of England database.
        </p>
        <p>
          The honest caveat from the research behind this page: leak-free models do not beat the OIS
          curve at forecasting the Bank Rate — so this page reads the market&apos;s forecast rather
          than claiming a better one. Informational only, not financial advice.
        </p>
        <p>
          <a href="/tools" className="text-[#1e40af] hover:underline">&larr; more tools</a>
        </p>
      </div>
    </div>
  );
}
