"use client";

import { useEffect, useState, useCallback } from "react";
import { getAllCategories, getPapersByCategory, papers } from "@/lib/papers";

const SUPABASE_URL = "https://skthypriuhjcayuxaydf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_31hh1GrQE-w-RgSn2o59OA_FwABMlFe";

const categoryDescriptions: Record<string, string> = {
  "Empirical Studies":
    "Experimental results validated on live market data with walk-forward testing.",
  "Architecture & Models":
    "Neural network architectures designed for financial time series.",
  "Feature Engineering":
    "Construction, selection, and validation of predictive features.",
};

function categoryAnchor(category: string): string {
  return category.toLowerCase().replace(/ & /g, "-").replace(/\s+/g, "-");
}

interface Trade {
  pnl: number;
  bar_ts: string;
  model: string;
}

export default function HomePage() {
  const categories = getAllCategories();
  const [trades, setTrades] = useState<Trade[]>([]);

  const fetchTrades = useCallback(async () => {
    try {
      const baseUrl = `${SUPABASE_URL}/rest/v1/signals?status=eq.closed&pnl=not.is.null&select=pnl,bar_ts,model&order=bar_ts.asc`;
      const allData: Trade[] = [];
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
        if (!res.ok && res.status !== 206) break;
        const page: Trade[] = await res.json();
        allData.push(...page);
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      setTrades(allData);
    } catch {}
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  // Equity curve data
  let cumPnl = 0;
  const equity = trades.map((t) => {
    cumPnl += t.pnl;
    return { ts: t.bar_ts, pnl: cumPnl };
  });

  // Chart dimensions
  const W = 800, H = 220, pad = { t: 20, r: 20, b: 35, l: 55 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const minPnl = Math.min(0, ...equity.map(e => e.pnl));
  const maxPnl = Math.max(1, ...equity.map(e => e.pnl));
  const range = maxPnl - minPnl || 1;

  const points = equity.map((e, i) => {
    const x = pad.l + (i / Math.max(1, equity.length - 1)) * iW;
    const y = pad.t + iH - ((e.pnl - minPnl) / range) * iH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const zeroY = pad.t + iH - ((0 - minPnl) / range) * iH;
  const lastPoint = equity.length > 0 ? equity[equity.length - 1] : null;
  const lastX = pad.l + iW;
  const lastY = lastPoint ? pad.t + iH - ((lastPoint.pnl - minPnl) / range) * iH : 0;

  // Fill area under curve
  const areaPath = points.length > 1
    ? `M${pad.l},${zeroY.toFixed(1)} L${points.join(" L")} L${lastX},${zeroY.toFixed(1)} Z`
    : "";

  return (
    <div className="mx-auto max-w-4xl px-6">
      {/* ── Identity ── */}
      <section className="pt-20 pb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-[#1a1a2e] mb-3">Rahul S. P.</h1>
        <p className="text-[#374151] text-lg sm:text-xl leading-relaxed max-w-xl">
          I build neural trading systems and test them on live markets.
        </p>
        <p className="text-[#6b7280] text-sm mt-3">
          {papers.length} papers &middot; 2 models in production &middot; Everything is empirical.
        </p>
        <div className="flex gap-4 mt-5 text-sm">
          <a href="https://www.linkedin.com/in/rahul-parmeshwar/" target="_blank" rel="noopener noreferrer" className="text-[#1e40af] hover:underline">LinkedIn</a>
          <a href="/signals" className="text-[#1e40af] hover:underline">Live Signals</a>
          <a href="/about" className="text-[#1e40af] hover:underline">About</a>
        </div>
      </section>

      {/* ── Live Equity Curve ── */}
      {equity.length > 5 && (
        <section className="pb-10">
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
              <div>
                <p className="text-xs text-[#6b7280] uppercase tracking-widest">Live Model Performance</p>
                <p className="text-[10px] sm:text-xs text-[#9ca3af] mt-0.5">
                  {trades.length} closed trades &middot; GoldSSM-28F &amp; 34F
                </p>
              </div>
              {lastPoint && (
                <div className="sm:text-right">
                  <p className={`text-lg sm:text-2xl font-bold ${lastPoint.pnl >= 0 ? "text-[#059669]" : "text-[#dc2626]"}`}>
                    {lastPoint.pnl >= 0 ? "+" : ""}{lastPoint.pnl.toFixed(1)} pts
                  </p>
                  <p className="text-[10px] text-[#9ca3af]">
                    since {new Date(equity[0].ts).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                  </p>
                </div>
              )}
            </div>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="mt-2">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = pad.t + iH * (1 - frac);
                const val = minPnl + range * frac;
                return (
                  <g key={frac}>
                    <line x1={pad.l} y1={y} x2={pad.l + iW} y2={y} stroke="#f3f4f6" strokeWidth="1" />
                    <text x={pad.l - 8} y={y + 3} textAnchor="end" fill="#9ca3af" fontSize="9" fontFamily="Inter, sans-serif">
                      {val.toFixed(0)}
                    </text>
                  </g>
                );
              })}
              {/* Zero line */}
              <line x1={pad.l} y1={zeroY} x2={pad.l + iW} y2={zeroY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
              {/* Fill */}
              {areaPath && <path d={areaPath} fill="url(#eqGrad)" opacity="0.3" />}
              {/* Line */}
              {points.length > 1 && (
                <polyline points={points.join(" ")} fill="none" stroke="#1e40af" strokeWidth="2" strokeLinejoin="round" />
              )}
              {/* End dot */}
              {lastPoint && <circle cx={lastX} cy={lastY} r="4" fill="#1e40af" />}
              {/* Gradient def */}
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e40af" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#1e40af" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </section>
      )}

      {/* ── Featured Study ── */}
      <section className="pb-10">
        <a href="/papers/goldssm" className="block group">
          <div className="rounded-xl border border-[#e5e7eb] hover:border-[#1e40af] transition-colors overflow-hidden">
            <div className="bg-[#f8f9fa] px-5 py-2.5 border-b border-[#e5e7eb] flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1e40af] bg-[#eff6ff] px-2 py-0.5 rounded">Featured</span>
              <span className="text-[10px] text-[#9ca3af]">Architecture &amp; Models</span>
            </div>
            <div className="p-5 sm:p-6">
              <h3 className="text-lg sm:text-xl font-semibold text-[#1a1a2e] group-hover:text-[#1e40af] transition-colors mb-2">
                Transformer Models vs SSMs for Financial Time Series
              </h3>
              <p className="text-sm text-[#374151] leading-relaxed mb-4 line-clamp-3">
                A multi-scale selective state space model combining Variable Selection Networks,
                Mamba SSM encoders, and temporal attention pooling. 2.0M parameters with O(T)
                complexity — 6x lighter than equivalent Transformer architectures. Drop-in
                replacement with identical forward signatures.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b7280]">
                <span className="px-2 py-0.5 rounded bg-[#f3f4f6]">Mamba SSM</span>
                <span className="px-2 py-0.5 rounded bg-[#f3f4f6]">Variable Selection</span>
                <span className="px-2 py-0.5 rounded bg-[#f3f4f6]">O(T) Complexity</span>
                <span className="px-2 py-0.5 rounded bg-[#f3f4f6]">2.0M Params</span>
                <span className="ml-auto text-[#1e40af] group-hover:underline">Read paper &rarr;</span>
              </div>
            </div>
          </div>
        </a>
      </section>

      {/* ── Work-in-Progress Study ── */}
      <section className="pb-10">
        <a href="/papers/us-indexes-prediction" className="block group">
          <div className="rounded-xl border border-[#e5e7eb] hover:border-[#d97706] transition-colors overflow-hidden">
            <div className="bg-[#fffbeb] px-5 py-2.5 border-b border-[#fde68a] flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#92400e] bg-[#fef3c7] px-2 py-0.5 rounded">In Progress</span>
              <span className="text-[10px] text-[#9ca3af]">Empirical Studies</span>
            </div>
            <div className="p-5 sm:p-6">
              <h3 className="text-lg sm:text-xl font-semibold text-[#1a1a2e] group-hover:text-[#d97706] transition-colors mb-2">
                US Index Prediction: A Multi-Index Framework
              </h3>
              <p className="text-sm text-[#374151] leading-relaxed mb-4 line-clamp-2">
                Cross-index dynamics between DJIA, S&amp;P 500, and NAS100. Literature review complete &mdash;
                identifying unstudied research gaps in price-weighted divergence signals and trivariate
                cointegration.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b7280]">
                <span className="px-2 py-0.5 rounded bg-[#fef3c7] text-[#92400e]">Phase 1: Literature Review</span>
                <span className="px-2 py-0.5 rounded bg-[#f3f4f6]">US30</span>
                <span className="px-2 py-0.5 rounded bg-[#f3f4f6]">US500</span>
                <span className="px-2 py-0.5 rounded bg-[#f3f4f6]">NAS100</span>
                <span className="ml-auto text-[#d97706] group-hover:underline">Read more &rarr;</span>
              </div>
            </div>
          </div>
        </a>
      </section>

      <hr className="border-[#e5e7eb]" />

      {/* ── Section Navigation ── */}
      <nav className="flex flex-wrap gap-2 pt-10 mb-12">
        {categories.map((cat) => {
          const count = getPapersByCategory(cat).length;
          return (
            <a
              key={cat}
              href={`#${categoryAnchor(cat)}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1e40af] bg-[#eff6ff] hover:bg-[#dbeafe] px-4 py-2 rounded-full transition-colors"
            >
              {cat}
              <span className="text-xs text-[#3b82f6] bg-white px-1.5 py-0.5 rounded-full font-semibold">
                {count}
              </span>
            </a>
          );
        })}
      </nav>

      {/* ── Paper Sections ── */}
      {categories.map((cat) => {
        const catPapers = getPapersByCategory(cat);
        return (
          <section key={cat} id={categoryAnchor(cat)} className="mb-16 scroll-mt-8">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-serif text-2xl text-[#1a1a2e]">{cat}</h2>
                <span className="text-xs font-semibold text-[#6b7280] bg-[#f3f4f6] px-2 py-0.5 rounded-full">
                  {catPapers.length}
                </span>
              </div>
              <p className="text-sm text-[#6b7280]">{categoryDescriptions[cat]}</p>
            </div>

            <div className="space-y-0">
              {catPapers.map((paper) => (
                <article key={paper.slug} className="group border-b border-[#e5e7eb] py-8 first:pt-0">
                  <div className="flex items-center gap-3 mb-2">
                    <time className="text-sm text-[#6b7280]">{paper.date}</time>
                  </div>
                  <a href={`/papers/${paper.slug}`} className="block">
                    <h3 className="text-xl font-semibold text-[#1a1a2e] group-hover:text-[#1e40af] transition-colors leading-snug mb-2">
                      {paper.title}
                    </h3>
                    <p className="text-[#374151] text-sm leading-relaxed line-clamp-2">
                      {paper.abstract}
                    </p>
                  </a>
                  <a
                    href={`/papers/${paper.slug}`}
                    className="inline-block mt-3 text-sm text-[#1e40af] hover:text-[#3b82f6] transition-colors"
                  >
                    Read paper &rarr;
                  </a>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      {/* ── Contact ── */}
      <section className="py-12 border-t border-[#e5e7eb]">
        <p className="text-sm text-[#6b7280]">
          Interested in the research or exploring opportunities?{" "}
          <a
            href="https://www.linkedin.com/in/rahul-parmeshwar/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1e40af] hover:underline"
          >
            Connect on LinkedIn &rarr;
          </a>
        </p>
      </section>
    </div>
  );
}
