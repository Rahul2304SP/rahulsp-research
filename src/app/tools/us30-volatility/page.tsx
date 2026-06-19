"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * US30 Volatility Dial — a live window into the US30 LGB forward-60-minute volatility model
 * (the IC-0.70 forecast from "How Much, Not Which Way"). Polls /api/us30vol, which a local
 * emitter beside the daemon publishes each minute. Informational only; see disclaimer.
 */

interface Snap {
  as_of_utc?: string;
  symbol?: string;
  model?: string;
  price?: number;
  horizon_min?: number;
  sigma_pts?: number;
  sigma_pct?: number;
  range_low?: number;
  range_high?: number;
  regime?: string;
  market_open?: boolean;
}

type Status = "loading" | "live" | "waiting" | "error";

const POLL_MS = 30_000;
const STALE_S = 180;

const REGIMES: Record<string, { label: string; color: string; bg: string }> = {
  calm: { label: "Calm", color: "#2A9D8F", bg: "#e6f5f2" },
  normal: { label: "Normal", color: "#1e40af", bg: "#eaf0fb" },
  elevated: { label: "Elevated", color: "#d97706", bg: "#fef3e2" },
  extreme: { label: "Extreme", color: "#C1432E", bg: "#fbeae7" },
};
const REGIME_ORDER = ["calm", "normal", "elevated", "extreme"];

// needle scale: 0.1% (calm) .. 1.5% (extreme) 60-min sigma, log-spaced (matches emitter regime bands)
const SCALE_LO = 0.001;
const SCALE_HI = 0.015;
function needlePos(sigmaPct?: number): number {
  if (!sigmaPct || sigmaPct <= 0) return 0;
  const p = (Math.log(sigmaPct) - Math.log(SCALE_LO)) / (Math.log(SCALE_HI) - Math.log(SCALE_LO));
  return Math.max(0, Math.min(1, p));
}
// zone boundaries on the gauge = where the needle lands at each regime threshold
const ZONES = [
  { to: needlePos(0.0025), color: REGIMES.calm.color },
  { to: needlePos(0.005), color: REGIMES.normal.color },
  { to: needlePos(0.01), color: REGIMES.elevated.color },
  { to: 1, color: REGIMES.extreme.color },
];

function fmt(n?: number, d = 0): string {
  if (n === undefined || n === null || !isFinite(n)) return "--";
  return n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function ageSeconds(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}
function agoLabel(s: number | null): string {
  if (s === null) return "just now";
  if (s < 90) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min ago`;
  return `${Math.round(m / 60)}h ago`;
}

// ── speedometer geometry ──────────────────────────────────────────────────────
const W = 340, H = 196, CX = 170, CY = 172, R = 132, TRACK = 20;
function polar(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}
function arc(p0: number, p1: number, r: number): string {
  const [x1, y1] = polar(180 - p0 * 180, r);
  const [x2, y2] = polar(180 - p1 * 180, r);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// demo (localhost preview only): a gently moving value so the needle visibly updates
function makeDemo(): Snap {
  const t = Date.now();
  const base = 0.0042 + 0.0022 * Math.sin(t / 90_000) + (Math.random() - 0.5) * 0.0004;
  const sigma_pct = Math.max(0.0012, base);
  const price = 42180 + 90 * Math.sin(t / 120_000);
  const sigma_pts = sigma_pct * price;
  const regime =
    sigma_pct < 0.0025 ? "calm" : sigma_pct < 0.005 ? "normal" : sigma_pct < 0.01 ? "elevated" : "extreme";
  return {
    as_of_utc: new Date().toISOString(),
    symbol: "US30",
    model: "US30 LGB fvol60",
    price,
    horizon_min: 60,
    sigma_pts,
    sigma_pct,
    range_low: price - sigma_pts,
    range_high: price + sigma_pts,
    regime,
    market_open: true,
  };
}

export default function US30VolatilityPage() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [, setTick] = useState(0);
  const demoRef = useRef(false);

  const load = useCallback(async () => {
    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    try {
      const res = await fetch("/api/us30vol", { cache: "no-store" });
      const data = await res.json();
      if (data && typeof data.price === "number" && typeof data.sigma_pts === "number") {
        demoRef.current = false;
        setSnap(data);
        setStatus("live");
        return;
      }
      throw new Error("no-data");
    } catch {
      if (isLocal) {
        demoRef.current = true;
        setSnap(makeDemo());
        setStatus("live"); // preview renders exactly like the live feed
      } else {
        setStatus("waiting");
      }
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    const clk = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(iv);
      clearInterval(clk);
    };
  }, [load]);

  const age = snap ? ageSeconds(snap.as_of_utc) : null;
  const stale = status === "live" && !demoRef.current && age !== null && age > STALE_S;
  const live = status === "live" && !stale;
  const reg = (snap?.regime && REGIMES[snap.regime]) || REGIMES.normal;
  const pos = needlePos(snap?.sigma_pct);
  const rot = pos * 180 - 90; // -90 (left) .. +90 (right), 0 = straight up

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#1e40af]">Live Tool</div>
      <h1 className="font-serif text-3xl text-[#1a1a2e] mb-2">US30 Volatility Dial</h1>
      <p className="text-[#374151] leading-relaxed mb-8 max-w-2xl">
        A live forecast of how far the Dow is likely to travel over the <strong>next 60 minutes</strong>,
        produced by the same LightGBM model whose volatility skill is documented in{" "}
        <a href="/papers/price-predicts-volatility" className="text-[#1e40af] hover:underline">
          How Much, Not Which Way
        </a>
        . It forecasts <em>magnitude</em>, never direction.
      </p>

      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 sm:p-8 shadow-sm">
        {status === "loading" && <p className="py-20 text-center text-[#6b7280]">Connecting to the live feed...</p>}

        {status === "waiting" && (
          <div className="py-16 text-center">
            <p className="text-[#1a1a2e] font-medium">Waiting for the live feed</p>
            <p className="text-sm text-[#6b7280] mt-1">This page fills in automatically once the feed is up.</p>
          </div>
        )}

        {status === "error" && (
          <p className="py-20 text-center text-[#6b7280]">The live feed is temporarily unreachable. Retrying...</p>
        )}

        {status === "live" && snap && (
          <>
            {/* ── live DJ30 price ── */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#6b7280]">Dow Jones (DJ30)</p>
                <p className="text-3xl sm:text-4xl font-bold text-[#1a1a2e] tabular-nums leading-tight">
                  {fmt(snap.price)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6b7280] pt-1">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${live ? "bg-[#16a34a] animate-pulse" : "bg-[#d97706]"}`}
                />
                <span>{live ? `Updated ${agoLabel(age)}` : `Feed delayed (${agoLabel(age)})`}</span>
              </div>
            </div>

            {/* ── speedometer ── */}
            <div className="mt-3 flex flex-col items-center">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[420px]">
                {/* track */}
                <path d={arc(0, 1, R)} fill="none" stroke="#eef0f3" strokeWidth={TRACK} strokeLinecap="round" />
                {/* coloured zones */}
                {ZONES.map((z, i) => {
                  const from = i === 0 ? 0 : ZONES[i - 1].to;
                  return (
                    <path key={i} d={arc(from + 0.004, z.to - 0.004, R)} fill="none" stroke={z.color} strokeWidth={TRACK} strokeLinecap="butt" />
                  );
                })}
                {/* needle */}
                <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: "transform 0.7s ease-out" }}>
                  <polygon points={`${CX - 6},${CY} ${CX + 6},${CY} ${CX},${CY - (R - 12)}`} fill="#1a1a2e" />
                </g>
                <circle cx={CX} cy={CY} r={10} fill="#1a1a2e" />
                <circle cx={CX} cy={CY} r={4} fill="#fff" />
              </svg>

              {/* regime word */}
              <div className="-mt-2 text-center">
                <span className="text-2xl font-bold" style={{ color: reg.color }}>
                  {reg.label}
                </span>
                <span className="text-2xl font-bold text-[#1a1a2e]"> volatility</span>
              </div>

              {/* legend */}
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-wider text-[#9ca3af]">
                {REGIME_ORDER.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: REGIMES[k].color }} />
                    {REGIMES[k].label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── forward 60-min range ── */}
            <div className="mt-7 rounded-xl bg-[#f8fafc] border border-[#eef0f3] p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-[#6b7280]">Forecast range, next 60 minutes</p>
              <p className="mt-1 text-2xl sm:text-3xl font-bold text-[#1a1a2e] tabular-nums">
                {fmt(snap.range_low)} <span className="text-[#9ca3af] font-normal">to</span> {fmt(snap.range_high)}
              </p>
              <p className="mt-1 text-sm text-[#374151]">
                about <strong>&plusmn;{fmt(snap.sigma_pts)} pts</strong> ({fmt((snap.sigma_pct ?? 0) * 100, 2)}%),
                roughly 2 times out of 3
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-[#f0f1f3] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6b7280]">
              <span>Refreshes every minute</span>
              <span className="text-[#d1d5db]">|</span>
              <span>Model: {snap.model || "US30 LGB fvol60"}</span>
              {snap.market_open === false && (
                <>
                  <span className="text-[#d1d5db]">|</span>
                  <span>Market closed</span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <details className="mt-6 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-5">
        <summary className="cursor-pointer font-medium text-[#1a1a2e]">How this is computed</summary>
        <div className="mt-3 text-sm text-[#374151] leading-relaxed space-y-3">
          <p>
            A LightGBM model is trained to predict the realised volatility of the Dow over the coming hour,
            using the same causal, point-in-time feature set as the production US30 system (price-derived,
            cross-asset, and macro inputs). Out-of-sample, it forecasts forward 60-minute volatility with a rank
            correlation of about 0.70, while forecasting direction no better than a coin. This dial shows
            magnitude only.
          </p>
          <p>
            Each minute, a process running beside the live trading system evaluates the model on the current
            feature frame and publishes its forecast here. The forecast is expressed as a one-standard-deviation
            move in index points, shown as a 68% range around the current level. It is a forecast of range, not
            of price level, and not of direction.
          </p>
        </div>
      </details>

      <div className="mt-6 rounded-xl border-l-4 border-l-[#d97706] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
        <strong>Informational only, not investment advice.</strong> This is a research tool that displays a
        volatility forecast. It does not tell you what to buy or sell, in what size, or when, and it makes no
        directional prediction. Markets can move outside the stated range. Nothing here is a solicitation or a
        recommendation. Trade at your own risk.
      </div>
    </div>
  );
}
