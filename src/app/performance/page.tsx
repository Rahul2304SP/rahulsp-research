"use client";

import { useEffect, useState, useCallback } from "react";

const SUPABASE_URL = "https://skthypriuhjcayuxaydf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_31hh1GrQE-w-RgSn2o59OA_FwABMlFe";

const MODELS: ModelName[] = ["GoldSSM-28F", "GoldSSM-34F"];
type ModelName = "GoldSSM-28F" | "GoldSSM-34F";
const MODEL_COLORS: Record<ModelName, string> = {
  "GoldSSM-28F": "#1e40af",
  "GoldSSM-34F": "#7c3aed",
};

interface Signal {
  id: number;
  model: string;
  bar_ts: string;
  close: number;
  direction: string;
  entry_price: number | null;
  sl_price: number | null;
  tp_price: number | null;
  exit_reason: string | null;
  exit_price: number | null;
  pnl: number | null;
  hold_bars: number | null;
  status: string;
}

/* --------------- helpers --------------- */

function computeStats(signals: Signal[]) {
  const closed = signals.filter((s) => s.status === "closed" && s.pnl !== null);
  const wins = closed.filter((s) => (s.pnl ?? 0) > 0);
  const losses = closed.filter((s) => (s.pnl ?? 0) < 0);
  const grossProfit = wins.reduce((a, s) => a + (s.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((a, s) => a + (s.pnl ?? 0), 0));
  const netPnl = closed.reduce((a, s) => a + (s.pnl ?? 0), 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgHold = closed.length > 0 ? closed.reduce((a, s) => a + (s.hold_bars ?? 0), 0) / closed.length : 0;
  const best = closed.length > 0 ? Math.max(...closed.map((s) => s.pnl ?? 0)) : 0;
  const worst = closed.length > 0 ? Math.min(...closed.map((s) => s.pnl ?? 0)) : 0;

  // max drawdown
  let peak = 0;
  let dd = 0;
  let cum = 0;
  const sorted = [...closed].sort((a, b) => new Date(a.bar_ts).getTime() - new Date(b.bar_ts).getTime());
  for (const s of sorted) {
    cum += s.pnl ?? 0;
    if (cum > peak) peak = cum;
    const thisDd = peak - cum;
    if (thisDd > dd) dd = thisDd;
  }

  return {
    total: closed.length,
    winRate,
    profitFactor,
    netPnl,
    maxDrawdown: dd,
    avgHold,
    best,
    worst,
    closed: sorted,
  };
}

function monthKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function allMonths(start: string, end: string): string[] {
  const months: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

/* --------------- Component --------------- */

export default function PerformancePage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/signals?status=eq.closed&order=bar_ts.asc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Signal[] = await res.json();
      setSignals(data);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const iv = setInterval(fetchSignals, 60_000);
    return () => clearInterval(iv);
  }, [fetchSignals]);

  /* ---- per-model stats ---- */
  const byModel: Record<ModelName, Signal[]> = { "GoldSSM-28F": [], "GoldSSM-34F": [] };
  for (const s of signals) {
    if (s.model in byModel) byModel[s.model as ModelName].push(s);
  }
  const allStats = Object.fromEntries(MODELS.map((m) => [m, computeStats(byModel[m])])) as Record<ModelName, ReturnType<typeof computeStats>>;
  const combinedStats = computeStats(signals);

  /* ---- monthly heatmap data ---- */
  const monthlyPnl: Record<ModelName, Record<string, number>> = { "GoldSSM-28F": {}, "GoldSSM-34F": {} };
  for (const m of MODELS) {
    for (const s of allStats[m].closed) {
      const mk = monthKey(s.bar_ts);
      monthlyPnl[m][mk] = (monthlyPnl[m][mk] ?? 0) + (s.pnl ?? 0);
    }
  }
  const allMk = new Set<string>();
  for (const m of MODELS) Object.keys(monthlyPnl[m]).forEach((k) => allMk.add(k));
  const monthList = allMk.size > 0 ? allMonths([...allMk].sort()[0], [...allMk].sort().pop()!) : [];
  const maxAbsMonth = Math.max(1, ...monthList.flatMap((mk) => MODELS.map((m) => Math.abs(monthlyPnl[m][mk] ?? 0))));

  /* ---- equity curve ---- */
  const equityCurves: Record<ModelName, { ts: string; cum: number }[]> = { "GoldSSM-28F": [], "GoldSSM-34F": [] };
  for (const m of MODELS) {
    let cum = 0;
    for (const s of allStats[m].closed) {
      cum += s.pnl ?? 0;
      equityCurves[m].push({ ts: s.bar_ts, cum });
    }
  }

  /* ---- trade distribution ---- */
  const PNL_BUCKETS = ["< -5", "-5 to -2", "-2 to 0", "0 to 2", "2 to 5", "5 to 10", "> 10"];
  function bucketIndex(pnl: number): number {
    if (pnl < -5) return 0;
    if (pnl < -2) return 1;
    if (pnl < 0) return 2;
    if (pnl < 2) return 3;
    if (pnl < 5) return 4;
    if (pnl < 10) return 5;
    return 6;
  }
  const distCounts = PNL_BUCKETS.map(() => 0);
  for (const s of signals) {
    if (s.pnl !== null) distCounts[bucketIndex(s.pnl)]++;
  }
  const maxBucket = Math.max(1, ...distCounts);

  /* ---- win rate by exit reason ---- */
  const exitMap: Record<string, { count: number; wins: number; totalPnl: number }> = {};
  for (const s of signals) {
    const reason = s.exit_reason ?? "unknown";
    if (!exitMap[reason]) exitMap[reason] = { count: 0, wins: 0, totalPnl: 0 };
    exitMap[reason].count++;
    if ((s.pnl ?? 0) > 0) exitMap[reason].wins++;
    exitMap[reason].totalPnl += s.pnl ?? 0;
  }
  const exitReasons = Object.entries(exitMap).sort((a, b) => b[1].count - a[1].count);

  /* ---- SVG equity curve rendering ---- */
  const eqW = 760, eqH = 260;
  const eqPad = { top: 24, right: 24, bottom: 40, left: 64 };
  const eqInnerW = eqW - eqPad.left - eqPad.right;
  const eqInnerH = eqH - eqPad.top - eqPad.bottom;

  // Merged timeline for x-axis
  const allTimes = [...new Set([...equityCurves["GoldSSM-28F"].map((p) => p.ts), ...equityCurves["GoldSSM-34F"].map((p) => p.ts)])].sort();
  const minTime = allTimes.length > 0 ? new Date(allTimes[0]).getTime() : 0;
  const maxTime = allTimes.length > 0 ? new Date(allTimes[allTimes.length - 1]).getTime() : 1;
  const timeRange = maxTime - minTime || 1;

  const allCumVals = [...equityCurves["GoldSSM-28F"].map((p) => p.cum), ...equityCurves["GoldSSM-34F"].map((p) => p.cum), 0];
  const minCum = Math.min(...allCumVals);
  const maxCum = Math.max(...allCumVals);
  const cumRange = maxCum - minCum || 1;

  function eqPath(model: ModelName): string {
    const pts = equityCurves[model];
    if (pts.length < 2) return "";
    return pts
      .map((p, i) => {
        const x = eqPad.left + ((new Date(p.ts).getTime() - minTime) / timeRange) * eqInnerW;
        const y = eqPad.top + eqInnerH - ((p.cum - minCum) / cumRange) * eqInnerH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  const zeroY = eqPad.top + eqInnerH - ((0 - minCum) / cumRange) * eqInnerH;

  // X-axis labels (pick ~5 dates)
  const xLabels: { x: number; label: string }[] = [];
  if (allTimes.length > 0) {
    const step = Math.max(1, Math.floor(allTimes.length / 5));
    for (let i = 0; i < allTimes.length; i += step) {
      const t = new Date(allTimes[i]);
      xLabels.push({
        x: eqPad.left + ((t.getTime() - minTime) / timeRange) * eqInnerW,
        label: t.toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
      });
    }
  }

  /* ---- histogram SVG ---- */
  const histW = 760, histH = 200;
  const histPad = { top: 16, right: 16, bottom: 40, left: 48 };
  const histInnerW = histW - histPad.left - histPad.right;
  const histInnerH = histH - histPad.top - histPad.bottom;
  const barWidth = histInnerW / PNL_BUCKETS.length;
  const BUCKET_COLORS = ["#dc2626", "#ef4444", "#f87171", "#86efac", "#34d399", "#059669", "#047857"];

  /* ---- stat card helper ---- */
  function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
        <p className="text-xs text-[#6b7280] uppercase tracking-wide">{label}</p>
        <p className="mt-1 text-xl font-bold" style={{ color: color ?? "#1a1a2e" }}>
          {value}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center py-20 text-[#6b7280]">Loading performance data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center py-20 text-[#dc2626]">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-serif text-3xl text-[#1a1a2e]">Performance Dashboard</h1>
        <p className="mt-2 text-[#6b7280] text-sm">
          Aggregated metrics for all closed XAUUSD model signals. Auto-refreshes every 60 seconds.
        </p>
        <p className="mt-1 text-xs text-[#9ca3af]">
          Last updated: {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      </div>

      {/* Combined stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Trades" value={combinedStats.total.toString()} />
        <StatCard label="Win Rate" value={combinedStats.total > 0 ? `${combinedStats.winRate.toFixed(1)}%` : "--"} />
        <StatCard
          label="Profit Factor"
          value={combinedStats.total > 0 ? (combinedStats.profitFactor === Infinity ? "inf" : combinedStats.profitFactor.toFixed(2)) : "--"}
        />
        <StatCard
          label="Net PnL (pts)"
          value={combinedStats.total > 0 ? `${combinedStats.netPnl >= 0 ? "+" : ""}${combinedStats.netPnl.toFixed(2)}` : "--"}
          color={combinedStats.netPnl >= 0 ? "#059669" : "#dc2626"}
        />
        <StatCard
          label="Max Drawdown"
          value={combinedStats.total > 0 ? `${combinedStats.maxDrawdown.toFixed(2)}` : "--"}
          color="#dc2626"
        />
        <StatCard label="Avg Hold (bars)" value={combinedStats.total > 0 ? combinedStats.avgHold.toFixed(1) : "--"} />
        <StatCard
          label="Best Trade"
          value={combinedStats.total > 0 ? `+${combinedStats.best.toFixed(2)}` : "--"}
          color="#059669"
        />
        <StatCard
          label="Worst Trade"
          value={combinedStats.total > 0 ? `${combinedStats.worst.toFixed(2)}` : "--"}
          color="#dc2626"
        />
      </div>

      {/* Per-model stat rows */}
      {MODELS.map((m) => {
        const s = allStats[m];
        return (
          <div key={m} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: MODEL_COLORS[m] }} />
              <h2 className="text-sm font-semibold text-[#374151]">{m}</h2>
              <span className="text-xs text-[#9ca3af]">{s.total} trades</span>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3 text-center">
              {[
                { l: "Win Rate", v: s.total > 0 ? `${s.winRate.toFixed(1)}%` : "--" },
                { l: "PF", v: s.total > 0 ? (s.profitFactor === Infinity ? "inf" : s.profitFactor.toFixed(2)) : "--" },
                { l: "Net PnL", v: s.total > 0 ? `${s.netPnl >= 0 ? "+" : ""}${s.netPnl.toFixed(2)}` : "--", c: s.netPnl >= 0 ? "#059669" : "#dc2626" },
                { l: "Max DD", v: s.total > 0 ? s.maxDrawdown.toFixed(2) : "--", c: "#dc2626" },
                { l: "Avg Hold", v: s.total > 0 ? s.avgHold.toFixed(1) : "--" },
                { l: "Best", v: s.total > 0 ? `+${s.best.toFixed(2)}` : "--", c: "#059669" },
                { l: "Worst", v: s.total > 0 ? s.worst.toFixed(2) : "--", c: "#dc2626" },
                { l: "Trades", v: s.total.toString() },
              ].map((x) => (
                <div key={x.l} className="rounded border border-[#e5e7eb] bg-white px-2 py-2">
                  <p className="text-[10px] text-[#9ca3af] uppercase">{x.l}</p>
                  <p className="text-sm font-semibold" style={{ color: (x as { c?: string }).c ?? "#1a1a2e" }}>{x.v}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Monthly Returns Heatmap */}
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-5 mb-8 mt-10">
        <h2 className="text-xs text-[#6b7280] uppercase tracking-wide mb-4">Monthly Returns Heatmap (Points)</h2>
        {monthList.length === 0 ? (
          <p className="text-sm text-[#9ca3af] text-center py-8">No monthly data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <svg width={Math.max(500, 120 + MODELS.length * 100)} height={monthList.length * 32 + 48} className="overflow-visible">
              {/* Header */}
              {MODELS.map((m, mi) => (
                <text key={m} x={130 + mi * 100 + 40} y={20} textAnchor="middle" fill="#6b7280" fontSize="11" fontWeight="600">
                  {m}
                </text>
              ))}
              {/* Rows */}
              {monthList.map((mk, ri) => (
                <g key={mk} transform={`translate(0, ${32 + ri * 32})`}>
                  <text x={110} y={18} textAnchor="end" fill="#374151" fontSize="12">{mk}</text>
                  {MODELS.map((m, mi) => {
                    const val = monthlyPnl[m][mk] ?? 0;
                    const intensity = Math.min(1, Math.abs(val) / maxAbsMonth);
                    const bg = val >= 0
                      ? `rgba(5, 150, 105, ${0.1 + intensity * 0.7})`
                      : `rgba(220, 38, 38, ${0.1 + intensity * 0.7})`;
                    return (
                      <g key={m}>
                        <rect
                          x={130 + mi * 100}
                          y={2}
                          width={80}
                          height={26}
                          rx={4}
                          fill={bg}
                        />
                        <text
                          x={130 + mi * 100 + 40}
                          y={19}
                          textAnchor="middle"
                          fill={val >= 0 ? "#065f46" : "#991b1b"}
                          fontSize="11"
                          fontWeight="600"
                        >
                          {val === 0 ? "--" : `${val >= 0 ? "+" : ""}${val.toFixed(1)}`}
                        </text>
                      </g>
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* Equity Curve */}
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs text-[#6b7280] uppercase tracking-wide">Cumulative PnL (Points)</h2>
          <div className="flex items-center gap-4">
            {MODELS.map((m) => (
              <div key={m} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: MODEL_COLORS[m] }} />
                <span className="text-xs text-[#6b7280]">{m}</span>
              </div>
            ))}
          </div>
        </div>
        {allTimes.length < 2 ? (
          <p className="text-sm text-[#9ca3af] text-center py-12">Not enough data to plot equity curve.</p>
        ) : (
          <svg width="100%" viewBox={`0 0 ${eqW} ${eqH}`} className="overflow-visible">
            {/* Axes */}
            <line x1={eqPad.left} y1={eqPad.top} x2={eqPad.left} y2={eqPad.top + eqInnerH} stroke="#e5e7eb" strokeWidth="1" />
            <line x1={eqPad.left} y1={eqPad.top + eqInnerH} x2={eqPad.left + eqInnerW} y2={eqPad.top + eqInnerH} stroke="#e5e7eb" strokeWidth="1" />
            {/* Zero line */}
            <line x1={eqPad.left} y1={zeroY} x2={eqPad.left + eqInnerW} y2={zeroY} stroke="#d1d5db" strokeWidth="1" strokeDasharray="4,4" />
            <text x={eqPad.left - 8} y={zeroY + 3} textAnchor="end" fill="#9ca3af" fontSize="10">0</text>
            {/* Y labels */}
            <text x={eqPad.left - 8} y={eqPad.top + 4} textAnchor="end" fill="#6b7280" fontSize="10">
              {maxCum.toFixed(1)}
            </text>
            <text x={eqPad.left - 8} y={eqPad.top + eqInnerH + 4} textAnchor="end" fill="#6b7280" fontSize="10">
              {minCum.toFixed(1)}
            </text>
            {/* X labels */}
            {xLabels.map((xl, i) => (
              <text key={i} x={xl.x} y={eqPad.top + eqInnerH + 20} textAnchor="middle" fill="#9ca3af" fontSize="10">
                {xl.label}
              </text>
            ))}
            {/* Lines */}
            {MODELS.map((m) => (
              <path key={m} d={eqPath(m)} fill="none" stroke={MODEL_COLORS[m]} strokeWidth="2" strokeLinejoin="round" />
            ))}
          </svg>
        )}
      </div>

      {/* Trade Distribution */}
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-5 mb-8">
        <h2 className="text-xs text-[#6b7280] uppercase tracking-wide mb-4">Trade PnL Distribution (Points)</h2>
        {signals.length === 0 ? (
          <p className="text-sm text-[#9ca3af] text-center py-8">No data.</p>
        ) : (
          <svg width="100%" viewBox={`0 0 ${histW} ${histH}`} className="overflow-visible">
            {PNL_BUCKETS.map((label, i) => {
              const barH = (distCounts[i] / maxBucket) * histInnerH;
              const x = histPad.left + i * barWidth + barWidth * 0.1;
              const w = barWidth * 0.8;
              const y = histPad.top + histInnerH - barH;
              return (
                <g key={label}>
                  <rect x={x} y={y} width={w} height={barH} rx={3} fill={BUCKET_COLORS[i]} opacity={0.85} />
                  {distCounts[i] > 0 && (
                    <text x={x + w / 2} y={y - 4} textAnchor="middle" fill="#374151" fontSize="10" fontWeight="600">
                      {distCounts[i]}
                    </text>
                  )}
                  <text x={x + w / 2} y={histPad.top + histInnerH + 16} textAnchor="middle" fill="#6b7280" fontSize="9">
                    {label}
                  </text>
                </g>
              );
            })}
            {/* Axis */}
            <line x1={histPad.left} y1={histPad.top + histInnerH} x2={histPad.left + histInnerW} y2={histPad.top + histInnerH} stroke="#e5e7eb" strokeWidth="1" />
          </svg>
        )}
      </div>

      {/* Win Rate by Exit Reason */}
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-5 mb-8">
        <h2 className="text-xs text-[#6b7280] uppercase tracking-wide mb-4">Win Rate by Exit Reason</h2>
        {exitReasons.length === 0 ? (
          <p className="text-sm text-[#9ca3af] text-center py-8">No data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f8f9fa]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Exit Reason</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Count</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Win Rate</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Avg PnL</th>
                </tr>
              </thead>
              <tbody>
                {exitReasons.map(([reason, data]) => {
                  const wr = data.count > 0 ? (data.wins / data.count) * 100 : 0;
                  const avg = data.count > 0 ? data.totalPnl / data.count : 0;
                  return (
                    <tr key={reason} className="border-t border-[#f3f4f6] hover:bg-[#f8f9fa]">
                      <td className="px-4 py-3 text-[#374151] font-mono text-xs">{reason}</td>
                      <td className="px-4 py-3 text-right text-[#374151]">{data.count}</td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: wr >= 50 ? "#059669" : "#dc2626" }}>
                        {wr.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: avg >= 0 ? "#059669" : "#dc2626" }}>
                        {avg >= 0 ? "+" : ""}{avg.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="mt-8 text-xs text-[#9ca3af] text-center">
        All figures are in XAUUSD points. Past performance is not indicative of future results.
      </p>
    </div>
  );
}
