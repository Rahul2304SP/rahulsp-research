"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const SUPABASE_URL = "https://skthypriuhjcayuxaydf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_31hh1GrQE-w-RgSn2o59OA_FwABMlFe";

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

type ModelTab = "GoldSSM-34F" | "GoldSSM-28F" | "Scalper";

function useMarketStatus() {
  const [status, setStatus] = useState({ isOpen: false, session: "Closed", utcTime: "" });

  useEffect(() => {
    function compute() {
      const now = new Date();
      const utcDay = now.getUTCDay(); // 0=Sun
      const utcH = now.getUTCHours();
      const utcM = now.getUTCMinutes();
      const t = utcH * 60 + utcM;
      const utcTime = `${String(utcH).padStart(2, "0")}:${String(utcM).padStart(2, "0")} UTC`;

      // Market closed: Fri 22:00 UTC to Sun 22:00 UTC
      const isFriClose = utcDay === 5 && t >= 1320;
      const isSaturday = utcDay === 6;
      const isSunClose = utcDay === 0 && t < 1320;
      if (isFriClose || isSaturday || isSunClose) {
        const opensIn = isSunClose
          ? `Opens Sun ${22 - utcH}h ${60 - utcM}m`
          : "Opens Sun 22:00 UTC";
        setStatus({ isOpen: false, session: opensIn, utcTime });
        return;
      }

      // Session detection (overlaps possible)
      const sessions: string[] = [];
      // Asia: 22:00-07:00 UTC
      if (t >= 1320 || t < 420) sessions.push("Asia");
      // London: 07:00-16:00 UTC
      if (t >= 420 && t < 960) sessions.push("London");
      // New York: 13:00-22:00 UTC
      if (t >= 780 && t < 1320) sessions.push("New York");

      if (sessions.length > 0) {
        setStatus({ isOpen: true, session: sessions.join(" / "), utcTime });
      } else {
        setStatus({ isOpen: false, session: "Closed", utcTime });
      }
    }
    compute();
    const iv = setInterval(compute, 1000);
    return () => clearInterval(iv);
  }, []);

  return status;
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModel, setActiveModel] = useState<ModelTab>("GoldSSM-34F");
  const [error, setError] = useState<string | null>(null);
  const { isOpen: isMarketOpen, session: currentSession, utcTime } = useMarketStatus();
  const [user, setUser] = useState<any>(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase
          .from("subscribers")
          .select("status")
          .eq("user_id", user.id)
          .single()
          .then(({ data }) => {
            setIsPro(data?.status === "pro");
          });
      }
    });
  }, []);

  const fetchSignals = useCallback(async () => {
    try {
      const delayFilter = isPro
        ? ""
        : `&published_at=lt.${new Date(Date.now() - 15 * 60 * 1000).toISOString()}`;
      const modelFilter = activeModel === "Scalper"
        ? "model=like.Scalper-*"
        : `model=eq.${activeModel}`;
      const baseUrl = `${SUPABASE_URL}/rest/v1/signals?${modelFilter}${delayFilter}&order=bar_ts.desc`;
      const allData: Signal[] = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const res = await fetch(baseUrl, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Range: `${offset}-${offset + pageSize - 1}`,
          },
        });
        if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
        const page: Signal[] = await res.json();
        allData.push(...page);
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      setSignals(allData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch signals");
    } finally {
      setLoading(false);
    }
  }, [activeModel, isPro]);

  useEffect(() => {
    setLoading(true);
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchSignals]);

  // Compute stats
  const closedSignals = signals.filter((s) => s.status === "closed" && s.pnl !== null);
  const totalPnl = closedSignals.reduce((sum, s) => sum + (s.pnl ?? 0), 0);
  const wins = closedSignals.filter((s) => (s.pnl ?? 0) > 0).length;
  const winRate = closedSignals.length > 0 ? (wins / closedSignals.length) * 100 : 0;
  const grossProfit = closedSignals.filter((s) => (s.pnl ?? 0) > 0).reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(closedSignals.filter((s) => (s.pnl ?? 0) < 0).reduce((s, t) => s + (t.pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const signalsWithMae = closedSignals.filter((s) => (s as any).mae !== null && (s as any).mae !== undefined);
  const avgMae = signalsWithMae.length > 0 ? signalsWithMae.reduce((sum, s) => sum + ((s as any).mae ?? 0), 0) / signalsWithMae.length : 0;

  // Cumulative PnL for chart
  const sortedClosed = [...closedSignals].sort(
    (a, b) => new Date(a.bar_ts).getTime() - new Date(b.bar_ts).getTime()
  );
  let cumPnl = 0;
  const equityCurve = sortedClosed.map((s) => {
    cumPnl += s.pnl ?? 0;
    return { ts: s.bar_ts, pnl: cumPnl };
  });

  // SVG equity curve
  const chartWidth = 700;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  let svgPath = "";
  let svgDots = "";
  if (equityCurve.length > 1) {
    const minPnl = Math.min(0, ...equityCurve.map((p) => p.pnl));
    const maxPnl = Math.max(1, ...equityCurve.map((p) => p.pnl));
    const range = maxPnl - minPnl || 1;

    const points = equityCurve.map((p, i) => {
      const x = padding.left + (i / (equityCurve.length - 1)) * innerW;
      const y = padding.top + innerH - ((p.pnl - minPnl) / range) * innerH;
      return { x, y };
    });

    svgPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    svgDots = points
      .filter((_, i) => i === points.length - 1)
      .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#1e40af"/>`)
      .join("");
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString("en-GB", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-[#1a1a2e]">Live Signals</h1>
        <p className="mt-2 text-[#6b7280] text-sm">
          XAUUSD model and scalper signals{isPro ? "" : " with 15-minute delay"}. Updated every 30 seconds.
        </p>
      </div>

      {/* Auth/subscription banner */}
      {!user && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#eff6ff] px-4 py-3">
          <svg className="h-4 w-4 text-[#1e40af] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <p className="text-sm text-[#374151]">
            <a href="/login" className="font-medium text-[#1e40af] hover:underline">Sign in</a>{" "}
            to access real-time signals.
          </p>
        </div>
      )}
      {user && !isPro && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3">
          <svg className="h-4 w-4 text-[#d97706] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <p className="text-sm text-[#374151]">
            You&apos;re seeing signals with a 15-minute delay.{" "}
            <a href="/subscribe" className="font-medium text-[#1e40af] hover:underline">Upgrade to Pro</a>{" "}
            for instant access.
          </p>
        </div>
      )}
      {user && isPro && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#059669] text-white">
            Pro
          </span>
          <p className="text-sm text-[#166534]">Real-time signals — no delay.</p>
        </div>
      )}

      {/* Market status widget */}
      <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isMarketOpen ? 'bg-[#059669] animate-pulse' : 'bg-[#dc2626]'}`} />
          <span className="text-sm font-medium text-[#1a1a2e]">
            {isMarketOpen ? 'Market Open' : 'Market Closed'}
          </span>
        </div>
        <span className="text-xs text-[#6b7280]">
          {currentSession}
        </span>
        <span className="text-xs text-[#6b7280] ml-auto font-mono">
          {utcTime} &middot; XAUUSD
        </span>
      </div>

      {/* Model tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {(["GoldSSM-34F", "GoldSSM-28F", "Scalper"] as ModelTab[]).map((model) => (
          <button
            key={model}
            onClick={() => setActiveModel(model)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeModel === model
                ? model === "Scalper" ? "bg-[#059669] text-white" : "bg-[#1e40af] text-white"
                : "bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb]"
            }`}
          >
            {model}
          </button>
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total Trades", value: closedSignals.length.toString() },
          { label: "Win Rate", value: closedSignals.length > 0 ? `${winRate.toFixed(1)}%` : "—" },
          { label: "Profit Factor", value: closedSignals.length > 0 ? (profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)) : "—" },
          { label: "Net PnL", value: closedSignals.length > 0 ? `$${totalPnl.toFixed(2)}` : "—", color: totalPnl >= 0 ? "#059669" : "#dc2626" },
          { label: "Avg MAE", value: signalsWithMae.length > 0 ? `$${avgMae.toFixed(2)}` : "—", color: "#d97706" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-[#e5e7eb] bg-white p-4">
            <p className="text-xs text-[#6b7280] uppercase tracking-wide">{stat.label}</p>
            <p
              className="mt-1 text-xl font-bold"
              style={{ color: (stat as { color?: string }).color ?? "#1a1a2e" }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      {equityCurve.length > 1 && (
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 mb-8">
          <p className="text-xs text-[#6b7280] uppercase tracking-wide mb-3">Cumulative PnL</p>
          <svg
            width="100%"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="overflow-visible"
          >
            {/* Grid lines */}
            <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerH} stroke="#e5e7eb" strokeWidth="1" />
            <line x1={padding.left} y1={padding.top + innerH} x2={padding.left + innerW} y2={padding.top + innerH} stroke="#e5e7eb" strokeWidth="1" />
            {/* Zero line */}
            {(() => {
              const minPnl = Math.min(0, ...equityCurve.map((p) => p.pnl));
              const maxPnl = Math.max(1, ...equityCurve.map((p) => p.pnl));
              const range = maxPnl - minPnl || 1;
              const zeroY = padding.top + innerH - ((0 - minPnl) / range) * innerH;
              return <line x1={padding.left} y1={zeroY} x2={padding.left + innerW} y2={zeroY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />;
            })()}
            {/* Line */}
            <path d={svgPath} fill="none" stroke="#1e40af" strokeWidth="2" strokeLinejoin="round" />
            {/* End dot */}
            <g dangerouslySetInnerHTML={{ __html: svgDots }} />
            {/* Labels */}
            <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fill="#6b7280" fontSize="10">
              ${Math.max(...equityCurve.map((p) => p.pnl)).toFixed(0)}
            </text>
            <text x={padding.left - 8} y={padding.top + innerH + 4} textAnchor="end" fill="#6b7280" fontSize="10">
              ${Math.min(0, ...equityCurve.map((p) => p.pnl)).toFixed(0)}
            </text>
          </svg>
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-12 text-[#6b7280]">Loading signals...</div>
      )}
      {error && (
        <div className="text-center py-12 text-[#dc2626]">Error: {error}</div>
      )}

      {/* No signals yet */}
      {!loading && !error && signals.length === 0 && (
        <div className="text-center py-16 rounded-lg border border-[#e5e7eb] bg-[#f8f9fa]">
          <p className="text-lg text-[#374151] font-medium">No signals yet</p>
          <p className="mt-2 text-sm text-[#6b7280]">
            Signals appear here with a 15-minute delay once the models start trading.
          </p>
        </div>
      )}

      {/* Signals table */}
      {!loading && signals.length > 0 && (
        <div className="rounded-lg border border-[#e5e7eb] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f8f9fa]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Time</th>
                  {activeModel === "Scalper" && <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Config</th>}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Direction</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Entry</th>
                  {activeModel !== "Scalper" && <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">SL</th>}
                  {activeModel !== "Scalper" && <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">TP</th>}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Exit</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">PnL</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.id} className="border-t border-[#f3f4f6] hover:bg-[#f8f9fa]">
                    <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{formatTime(s.bar_ts)}</td>
                    {activeModel === "Scalper" && <td className="px-4 py-3 text-xs text-[#6b7280]">{s.model.replace("Scalper-", "")}</td>}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          s.direction === "LONG"
                            ? "bg-[#dcfce7] text-[#166534]"
                            : s.direction === "SHORT"
                            ? "bg-[#fef2f2] text-[#991b1b]"
                            : "bg-[#f3f4f6] text-[#374151]"
                        }`}
                      >
                        {s.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#374151] font-mono">{s.entry_price?.toFixed(2) ?? "—"}</td>
                    {activeModel !== "Scalper" && <td className="px-4 py-3 text-right text-[#dc2626] font-mono">{s.sl_price?.toFixed(2) ?? "—"}</td>}
                    {activeModel !== "Scalper" && <td className="px-4 py-3 text-right text-[#059669] font-mono">{s.tp_price?.toFixed(2) ?? "—"}</td>}
                    <td className="px-4 py-3 text-[#6b7280] text-xs">{s.exit_reason ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{
                      color: s.pnl === null ? "#6b7280" : (s.pnl ?? 0) >= 0 ? "#059669" : "#dc2626"
                    }}>
                      {s.pnl !== null ? `${s.pnl >= 0 ? "+" : ""}$${s.pnl.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer note */}
      <p className="mt-6 text-xs text-[#9ca3af] text-center">
        {isPro ? "Real-time signals." : "Signals are delayed by 15 minutes."} Past performance is not indicative of future results.
      </p>
    </div>
  );
}
