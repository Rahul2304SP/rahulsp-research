"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WORLD } from "../../../lib/world-land";

/**
 * World Tension — a realtime geopolitical-risk gauge. A custom news-based index is rebuilt every
 * minute from ~25 global news feeds and calibrated to the Caldara-Iacoviello GPR scale (100 = the
 * long-run average). Polls /api/gpr, which a local emitter publishes; falls back to a bundled
 * snapshot for preview. Informational only; it is a news-based proxy, not the official index.
 */

interface Driver {
  name: string;
  share: number;
}
interface GeoPoint {
  name: string;
  lat: number;
  lon: number;
  count: number;
  share: number;
}
interface Snap {
  as_of_utc?: string;
  level?: number; // current smoothed level, CI-anchored (100 = long-run average)
  label?: string;
  percentile_90d?: number; // e.g. 2 = calmer than 98% of the past 90 days
  trend_30d?: number[]; // daily smoothed values
  drivers?: Driver[];
  geography?: GeoPoint[];
  context_median?: number;
  peak_value?: number;
  peak_label?: string;
  feeds_ok?: number;
  feeds_total?: number;
}

type Status = "loading" | "live" | "waiting" | "error";

const POLL_MS = 60_000;
const STALE_S = 3 * 3600; // news index updates continuously; flag if older than ~3h

const LEVELS: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "#2A9D8F" },
  moderate: { label: "Moderate", color: "#1e40af" },
  elevated: { label: "Elevated", color: "#d97706" },
  severe: { label: "Severe", color: "#C1432E" },
};
const LEVEL_ORDER = ["low", "moderate", "elevated", "severe"];

// needle scale: 0 .. 250 on the CI scale (100 = long-run average). Live 99th pct ~222.
const SCALE_HI = 250;
function needlePos(level?: number): number {
  if (!level || level <= 0) return 0;
  return Math.max(0, Math.min(1, level / SCALE_HI));
}
function levelKey(level?: number): string {
  const v = level ?? 0;
  if (v < 60) return "low";
  if (v < 110) return "moderate";
  if (v < 170) return "elevated";
  return "severe";
}
const ZONES = [
  { to: needlePos(60), color: LEVELS.low.color },
  { to: needlePos(110), color: LEVELS.moderate.color },
  { to: needlePos(170), color: LEVELS.elevated.color },
  { to: 1, color: LEVELS.severe.color },
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

// ── speedometer geometry (same as the volatility dial) ────────────────────────
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

// Bundled snapshot of the REAL current readings (preview fallback for localhost / before the
// relay is wired). Refreshed from the live v2 emitter (CI-anchored, 2026-06-22).
const PREVIEW: Snap = {
  as_of_utc: "2026-06-22T22:00:00Z",
  level: 224,
  label: "Severe",
  percentile_90d: 52,
  trend_30d: [
    201.6, 198.9, 191.4, 186.3, 190.2, 199.6, 207.0, 195.5, 187.4, 196.1, 195.7, 199.0, 183.7,
    175.1, 175.1, 193.6, 193.4, 186.5, 176.6, 185.7, 194.3, 211.4, 204.6, 215.2, 220.8, 234.1,
    245.5, 248.3, 225.3, 215.0,
  ],
  drivers: [
    { name: "Territorial disputes", share: 39 },
    { name: "Sanctions", share: 27 },
    { name: "Escalation", share: 20 },
    { name: "Terrorism", share: 8 },
  ],
  geography: [
    { name: "Iran", lat: 32.4, lon: 53.7, count: 122, share: 24 },
    { name: "Israel", lat: 31.4, lon: 35.0, count: 49, share: 16 },
    { name: "Russia", lat: 57.0, lon: 45.0, count: 36, share: 14 },
    { name: "Lebanon", lat: 33.9, lon: 35.5, count: 59, share: 11 },
    { name: "Sudan", lat: 15.5, lon: 32.5, count: 45, share: 8 },
    { name: "Ukraine", lat: 48.4, lon: 31.2, count: 31, share: 6 },
    { name: "Strait of Hormuz", lat: 26.6, lon: 56.4, count: 21, share: 4 },
    { name: "China", lat: 35.9, lon: 104.2, count: 13, share: 3 },
    { name: "Pakistan", lat: 30.4, lon: 69.3, count: 17, share: 3 },
    { name: "Gaza", lat: 31.4, lon: 34.4, count: 12, share: 2 },
  ],
  context_median: 92,
  peak_value: 1046,
  peak_label: "September 2001",
  feeds_ok: 222,
  feeds_total: 223,
};

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const w = 320, h = 46, pad = 3;
  const lo = Math.min(...data), hi = Math.max(...data);
  const span = hi - lo || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - (v - lo) / span) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = data[data.length - 1];
  const [lx, ly] = pts[pts.length - 1].split(",").map(Number);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 46 }}>
      <polyline points={pts.join(" ")} fill="none" stroke="#1e40af" strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={2.6} fill={LEVELS[levelKey(last)].color} />
    </svg>
  );
}

// ── world bubble map: red bubbles (sized by share of risk chatter) over the land outline ──
function WorldMap({ geography }: { geography?: GeoPoint[] }) {
  if (!geography || geography.length === 0) return null;
  const W = WORLD.w, H = WORLD.h; // equirectangular 800 x 400
  const proj = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * W,
    ((90 - lat) / 180) * H,
  ];
  const maxShare = Math.max(...geography.map((g) => g.share), 1);
  const rOf = (share: number) => 5 + 26 * Math.sqrt(share / maxShare); // area ~ share
  // biggest first so smaller bubbles draw on top and stay clickable/visible
  const ordered = [...geography].sort((a, b) => b.share - a.share);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: "#f7f9fc", borderRadius: 10 }}>
      <path d={WORLD.path} fill="#e7e9ee" stroke="#d6d9e0" strokeWidth={0.4} fillRule="evenodd" />
      {ordered.map((g) => {
        const [x, y] = proj(g.lon, g.lat);
        const r = rOf(g.share);
        return (
          <g key={g.name}>
            <circle cx={x} cy={y} r={r} fill="#C1432E" fillOpacity={0.3} stroke="#C1432E" strokeOpacity={0.55} strokeWidth={0.8} />
            <circle cx={x} cy={y} r={1.8} fill="#7f1d1d" />
            <title>{`${g.name}: ${g.share}% of risk chatter (${g.count} mentions)`}</title>
          </g>
        );
      })}
    </svg>
  );
}

export default function WorldTensionPage() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [, setTick] = useState(0);
  const previewRef = useRef(false);

  const load = useCallback(async () => {
    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    try {
      const res = await fetch("/api/gpr", { cache: "no-store" });
      const data = await res.json();
      if (data && typeof data.level === "number") {
        previewRef.current = false;
        setSnap(data);
        setStatus("live");
        return;
      }
      throw new Error("no-data");
    } catch {
      if (isLocal) {
        previewRef.current = true;
        setSnap(PREVIEW);
        setStatus("live");
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
  const stale = status === "live" && !previewRef.current && age !== null && age > STALE_S;
  const live = status === "live" && !stale;
  const key = levelKey(snap?.level);
  const lvl = LEVELS[key];
  const pos = needlePos(snap?.level);
  const rot = pos * 180 - 90;
  const pct = snap?.percentile_90d;

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#1e40af]">Live Tool</div>
      <h1 className="font-serif text-3xl text-[#1a1a2e] mb-2">World Tension</h1>
      <p className="text-[#374151] leading-relaxed mb-8 max-w-2xl">
        A live read on <strong>geopolitical risk right now</strong>, rebuilt continuously from{" "}
        <strong>over 200 global news feeds</strong> and placed on the same scale as the academic{" "}
        <span className="whitespace-nowrap">Caldara-Iacoviello</span> Geopolitical Risk Index, where{" "}
        <strong>100</strong> is the long-run average. The published index is monthly; this is a near-realtime
        proxy of the same idea.
      </p>

      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 sm:p-8 shadow-sm">
        {status === "loading" && <p className="py-20 text-center text-[#6b7280]">Connecting to the live feed...</p>}

        {status === "waiting" && (
          <div className="py-16 text-center">
            <p className="text-[#1a1a2e] font-medium">Waiting for the live feed</p>
            <p className="text-sm text-[#6b7280] mt-1">This page fills in automatically once the feed is up.</p>
          </div>
        )}

        {status === "live" && snap && (
          <>
            {/* header row */}
            <div className="flex items-start justify-between gap-3 mb-1">
              <p className="text-xs uppercase tracking-widest text-[#6b7280]">Geopolitical risk, now</p>
              <div className="flex items-center gap-2 text-xs text-[#6b7280] pt-0.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${live ? "bg-[#16a34a] animate-pulse" : "bg-[#d97706]"}`}
                />
                <span>{live ? `Updated ${agoLabel(age)}` : `Feed delayed (${agoLabel(age)})`}</span>
              </div>
            </div>

            {/* speedometer */}
            <div className="mt-2 flex flex-col items-center">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[420px]">
                <path d={arc(0, 1, R)} fill="none" stroke="#eef0f3" strokeWidth={TRACK} strokeLinecap="round" />
                {ZONES.map((z, i) => {
                  const from = i === 0 ? 0 : ZONES[i - 1].to;
                  return (
                    <path key={i} d={arc(from + 0.004, z.to - 0.004, R)} fill="none" stroke={z.color} strokeWidth={TRACK} strokeLinecap="butt" />
                  );
                })}
                <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: "transform 0.7s ease-out" }}>
                  <polygon points={`${CX - 6},${CY} ${CX + 6},${CY} ${CX},${CY - (R - 12)}`} fill="#1a1a2e" />
                </g>
                <circle cx={CX} cy={CY} r={10} fill="#1a1a2e" />
                <circle cx={CX} cy={CY} r={4} fill="#fff" />
              </svg>

              <div className="-mt-2 text-center">
                <span className="text-2xl font-bold" style={{ color: lvl.color }}>
                  {lvl.label}
                </span>
                <span className="text-2xl font-bold text-[#1a1a2e]"> tension</span>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-wider text-[#9ca3af]">
                {LEVEL_ORDER.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: LEVELS[k].color }} />
                    {LEVELS[k].label}
                  </span>
                ))}
              </div>
            </div>

            {/* level + percentile */}
            <div className="mt-6 rounded-xl bg-[#f8fafc] border border-[#eef0f3] p-5 text-center">
              <p className="text-3xl sm:text-4xl font-bold text-[#1a1a2e] tabular-nums">
                {fmt(snap.level)}
                <span className="text-base font-normal text-[#9ca3af]"> / index</span>
              </p>
              <p className="mt-1 text-sm text-[#374151]">
                {pct !== undefined && pct <= 50 ? (
                  <>calmer than <strong>{100 - pct}%</strong> of the past 90 days</>
                ) : (
                  <>higher than <strong>{pct}%</strong> of the past 90 days</>
                )}{" "}
                · long-run average is <strong>100</strong>
              </p>
            </div>

            {/* drivers */}
            {snap.drivers && snap.drivers.length > 0 && (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-widest text-[#6b7280] mb-2">What is driving it (last 24h)</p>
                <div className="space-y-2">
                  {snap.drivers.map((d) => (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-sm text-[#374151]">{d.name}</span>
                      <div className="flex-1 h-2.5 rounded-full bg-[#f0f1f3] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${d.share}%`, background: "#C1432E" }} />
                      </div>
                      <span className="w-9 text-right text-sm tabular-nums text-[#6b7280]">{d.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* where it is coming from (bubble map) */}
            {snap.geography && snap.geography.length > 0 && (
              <div className="mt-6">
                <p className="text-xs uppercase tracking-widest text-[#6b7280] mb-2">
                  Where it is coming from (last 24h)
                </p>
                <WorldMap geography={snap.geography} />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6b7280]">
                  {snap.geography.slice(0, 8).map((g) => (
                    <span key={g.name} className="inline-flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-[#C1432E]" />
                      {g.name} <span className="tabular-nums text-[#9ca3af]">{g.share}%</span>
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-xs text-[#9ca3af]">
                  Bubbles mark where the risk-related news is concentrated, sized by share of the chatter. Hover
                  for detail.
                </p>
              </div>
            )}

            {/* 30-day trend */}
            {snap.trend_30d && (
              <div className="mt-6">
                <p className="text-xs uppercase tracking-widest text-[#6b7280] mb-1">Past 30 days</p>
                <Sparkline data={snap.trend_30d} />
              </div>
            )}

            {/* 26-year context */}
            <div className="mt-5 pt-4 border-t border-[#f0f1f3] text-sm text-[#374151]">
              Over the last 26 years this measure has averaged about <strong>{fmt(snap.context_median)}</strong>,
              and peaked near <strong>{fmt(snap.peak_value)}</strong> after the attacks of {snap.peak_label}.{" "}
              {(snap.level ?? 0) >= (snap.context_median ?? 100) * 1.25
                ? "Today's reading sits well above that long-run average."
                : (snap.level ?? 0) <= (snap.context_median ?? 100) * 0.7
                ? "Today's reading is among the calmer stretches on that record."
                : "Today's reading is around that long-run average."}
            </div>

            <div className="mt-4 pt-4 border-t border-[#f0f1f3] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6b7280]">
              <span>Refreshes every few minutes</span>
              <span className="text-[#d1d5db]">|</span>
              <span>
                {fmt(snap.feeds_ok)} of {fmt(snap.feeds_total)} news feeds live
              </span>
              <span className="text-[#d1d5db]">|</span>
              <span>News-based proxy</span>
              <span className="text-[#d1d5db]">|</span>
              <span
                className="rounded bg-[#fef3e2] px-1.5 py-0.5 text-[#b45309]"
                title="The scale is anchored to the Caldara-Iacoviello daily index and is still being refined; the level may be revised."
              >
                Calibration beta
              </span>
            </div>
          </>
        )}
      </div>

      <details className="mt-6 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-5">
        <summary className="cursor-pointer font-medium text-[#1a1a2e]">How this is computed</summary>
        <div className="mt-3 text-sm text-[#374151] leading-relaxed space-y-3">
          <p>
            Continuously, over 200 international news feeds are read and scored for language associated with
            geopolitical risk: threats and ultimatums, military build-up, active conflict, nuclear and cyber
            events, sanctions, terrorism, and territorial disputes. The raw signal is smoothed and placed on the
            scale of the Caldara-Iacoviello Geopolitical Risk Index, the standard academic measure, where 100 is
            the 1985-2019 average. A 26-year history of that published index provides the long-run context.
          </p>
          <p>
            The mapping onto that scale is anchored to the Caldara-Iacoviello <em>daily</em> index over the
            current overlap and is still being refined, so the exact level is marked <strong>calibration beta</strong>{" "}
            and may be revised. The shape of the series, the percentile, and the drivers are unaffected.
          </p>
          <p>
            Because a single minute of news is noisy, the gauge shows a smoothed level rather than the raw
            per-minute value, and it expresses the present reading as a percentile against its own recent
            history. This is a <strong>news-based proxy</strong> of the published monthly index, not the official
            index itself, and the two will not match exactly.
          </p>
        </div>
      </details>

      <div className="mt-6 rounded-xl border-l-4 border-l-[#d97706] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
        <strong>Informational only.</strong> This is a research tool that summarises news language into a single
        risk gauge. It is a proxy built from public news feeds, it can be wrong or delayed, and it is not advice
        of any kind. Nothing here is a solicitation or a recommendation.
      </div>
    </div>
  );
}
