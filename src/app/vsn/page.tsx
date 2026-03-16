"use client";

import { useEffect, useState, useCallback } from "react";

const SUPABASE_URL = "https://skthypriuhjcayuxaydf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_31hh1GrQE-w-RgSn2o59OA_FwABMlFe";

const FEATURE_NAMES = [
  "stdev60", "vol_30m", "xau_volume", "dist_ma120", "abs_dist_ma120",
  "dist_ma_290", "ret_60m", "ret_120m", "corr_xau_xag_30", "corr_xau_xag_60",
  "corr_xau_xag_120", "channel_width", "skew_240m", "kurt_240m",
  "momentum_regime", "trend_strength", "er60", "resid_z60_dxy",
  "beta_xag_to_xau_120", "macro_trend_signal", "dir_disagree_20",
  "hourly_run_signed", "vix_change_120m", "corr_xau_dxy_1440",
  "sign_agree_dxy", "xaucore_60", "vr_120", "sign_ac1",
];

interface VsnRow {
  id: number;
  stream: string;
  timestamp: string;
  weights: Record<string, number> | string;
}

function parseWeights(raw: Record<string, number> | string): number[] {
  // Supabase returns JSONB as parsed object or string
  let obj: Record<string, number>;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return []; }
  } else {
    obj = raw;
  }
  // Map feature names to ordered array
  return FEATURE_NAMES.map((name) => obj[name] ?? 0);
}

export default function VsnPage() {
  const [rows, setRows] = useState<VsnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeights = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/vsn_weights?stream=eq.long&order=timestamp.desc&limit=60`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: VsnRow[] = await res.json();
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeights();
    const iv = setInterval(fetchWeights, 60_000);
    return () => clearInterval(iv);
  }, [fetchWeights]);

  // Latest weights for bar chart
  const latest = rows.length > 0 ? rows[0] : null;
  const latestWeights = latest ? parseWeights(latest.weights) : [];
  const meanWeight = latestWeights.length > 0 ? latestWeights.reduce((a, b) => a + b, 0) / latestWeights.length : 0;
  const maxWeight = Math.max(0.01, ...latestWeights);

  // Heatmap: rows reversed to show oldest-left, newest-right
  const heatmapRows = [...rows].reverse();

  // Heatmap: parse weights for each row
  const heatmapParsed = heatmapRows.map((r) => ({
    ...r,
    parsed: parseWeights(r.weights),
  }));

  // Heatmap max for color scaling
  const heatmapMax = Math.max(
    0.01,
    ...heatmapParsed.flatMap((r) => r.parsed)
  );

  // Sort features by latest weight for bar chart
  const featureOrder = latestWeights.length > 0
    ? FEATURE_NAMES.map((name, i) => ({ name, weight: latestWeights[i] ?? 0, idx: i })).sort((a, b) => b.weight - a.weight)
    : FEATURE_NAMES.map((name, i) => ({ name, weight: 0, idx: i }));

  /* ---- Bar chart SVG ---- */
  const barH = 20;
  const barGap = 3;
  const barChartW = 700;
  const labelW = 160;
  const valueW = 56;
  const barAreaW = barChartW - labelW - valueW;
  const barChartH = featureOrder.length * (barH + barGap) + 8;

  /* ---- Heatmap SVG ---- */
  const hmCellW = Math.max(8, Math.min(14, 700 / Math.max(1, heatmapParsed.length)));
  const hmCellH = 18;
  const hmLabelW = 160;
  const hmW = hmLabelW + heatmapParsed.length * hmCellW + 16;
  const hmH = FEATURE_NAMES.length * hmCellH + 40;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center py-20 text-[#6b7280]">Loading VSN weights...</div>
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

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-[#1a1a2e]">VSN Feature Attention</h1>
          <p className="mt-2 text-[#6b7280] text-sm">
            Live Variable Selection Network weights for GoldSSM-28F.
          </p>
        </div>
        <div className="text-center py-16 rounded-lg border border-[#e5e7eb] bg-[#f8f9fa]">
          <p className="text-lg text-[#374151] font-medium">No data yet</p>
          <p className="mt-2 text-sm text-[#6b7280]">
            VSN weights will appear here once the model begins generating live signals.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-serif text-3xl text-[#1a1a2e]">VSN Feature Attention</h1>
        <p className="mt-3 text-[#374151] text-sm leading-relaxed max-w-3xl">
          The Variable Selection Network (VSN) is a component of the GoldSSM model that learns
          <strong> how important each input feature is at every moment in time</strong>. Unlike
          traditional models that assign fixed weights to features, the VSN dynamically adjusts
          importance based on current market conditions — for example, upweighting volatility
          measures during turbulent periods and downweighting them during calm markets.
        </p>
        <p className="mt-2 text-[#6b7280] text-sm leading-relaxed max-w-3xl">
          The bar chart below shows the model&apos;s current feature importance ranking, updated
          in real time. Higher weights mean the model is paying more attention to that feature
          right now. The heatmap shows how these weights have evolved over recent bars, revealing
          which features the model considers most informative as market conditions change.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#eff6ff] border border-[#dbeafe]">
          <span className="text-xs text-[#1e40af]">Free plan: 15-minute delay</span>
          <span className="text-[#93c5fd]">&middot;</span>
          <a href="/subscribe" className="text-xs text-[#1e40af] font-medium hover:underline">Upgrade for real-time</a>
        </div>
        <p className="mt-2 text-[#9ca3af] text-xs">
          GoldSSM-28F &middot; Long stream &middot; 28 features &middot; Auto-refreshes every 60 seconds
        </p>
      </div>

      {/* Feature Importance Bar Chart */}
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs text-[#6b7280] uppercase tracking-wide">
            GoldSSM-28F — Live VSN Feature Weights (Long Stream)
          </h2>
          {latest && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-[#eff6ff] text-[#1e40af]">
              Last updated: {new Date(latest.timestamp).toLocaleString("en-GB", {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
              })}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <svg width={barChartW} height={barChartH} className="overflow-visible">
            {featureOrder.map((f, i) => {
              const y = i * (barH + barGap);
              const w = maxWeight > 0 ? (f.weight / maxWeight) * barAreaW : 0;
              const aboveMean = f.weight >= meanWeight;
              return (
                <g key={f.name}>
                  <text
                    x={labelW - 8}
                    y={y + barH / 2 + 4}
                    textAnchor="end"
                    fill="#374151"
                    fontSize="11"
                    fontFamily="monospace"
                  >
                    {f.name}
                  </text>
                  <rect
                    x={labelW}
                    y={y + 2}
                    width={Math.max(1, w)}
                    height={barH - 4}
                    rx={3}
                    fill={aboveMean ? "#1e40af" : "#d1d5db"}
                    opacity={aboveMean ? 0.85 : 0.6}
                  />
                  <text
                    x={labelW + Math.max(1, w) + 6}
                    y={y + barH / 2 + 4}
                    fill="#6b7280"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {f.weight.toFixed(4)}
                  </text>
                </g>
              );
            })}
            {/* Mean line */}
            {maxWeight > 0 && (
              <>
                <line
                  x1={labelW + (meanWeight / maxWeight) * barAreaW}
                  y1={0}
                  x2={labelW + (meanWeight / maxWeight) * barAreaW}
                  y2={barChartH}
                  stroke="#9ca3af"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <text
                  x={labelW + (meanWeight / maxWeight) * barAreaW}
                  y={barChartH + 14}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="9"
                >
                  mean
                </text>
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Weight Evolution Heatmap */}
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-5 mb-8">
        <h2 className="text-xs text-[#6b7280] uppercase tracking-wide mb-4">
          Weight Evolution (Last {heatmapParsed.length} Bars)
        </h2>
        <div className="overflow-x-auto">
          <svg width={hmW} height={hmH} className="overflow-visible">
            {/* Feature labels (Y axis) */}
            {FEATURE_NAMES.map((name, fi) => (
              <text
                key={name}
                x={hmLabelW - 6}
                y={32 + fi * hmCellH + hmCellH / 2 + 3}
                textAnchor="end"
                fill="#374151"
                fontSize="9"
                fontFamily="monospace"
              >
                {name}
              </text>
            ))}
            {/* Heatmap cells */}
            {heatmapParsed.map((row, ti) => (
              <g key={ti}>
                {FEATURE_NAMES.map((_, fi) => {
                  const val = row.parsed[fi] ?? 0;
                  const intensity = Math.min(1, val / heatmapMax);
                  return (
                    <rect
                      key={fi}
                      x={hmLabelW + ti * hmCellW}
                      y={32 + fi * hmCellH}
                      width={hmCellW - 1}
                      height={hmCellH - 1}
                      rx={1}
                      fill={`rgba(30, 64, 175, ${0.05 + intensity * 0.85})`}
                    />
                  );
                })}
              </g>
            ))}
            {/* Time axis labels */}
            {heatmapParsed.length > 0 && (
              <>
                <text x={hmLabelW} y={24} fill="#9ca3af" fontSize="9" textAnchor="start">
                  {new Date(heatmapParsed[0].timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </text>
                <text
                  x={hmLabelW + (heatmapParsed.length - 1) * hmCellW}
                  y={24}
                  fill="#9ca3af"
                  fontSize="9"
                  textAnchor="start"
                >
                  {new Date(heatmapParsed[heatmapParsed.length - 1].timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </text>
              </>
            )}
            {/* Color scale legend */}
            <g transform={`translate(${hmLabelW}, ${32 + FEATURE_NAMES.length * hmCellH + 10})`}>
              <text x={0} y={10} fill="#9ca3af" fontSize="9">Low</text>
              {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                <rect key={i} x={30 + i * 16} y={2} width={14} height={10} rx={1} fill={`rgba(30, 64, 175, ${0.05 + v * 0.85})`} />
              ))}
              <text x={115} y={10} fill="#9ca3af" fontSize="9">High</text>
            </g>
          </svg>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="mt-8 text-xs text-[#9ca3af] text-center">
        VSN weights reflect the model&apos;s learned feature importance at each time step and update in real time.
      </p>
    </div>
  );
}
