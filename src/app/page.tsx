import { getAllCategories, getPapersByCategory, papers } from "@/lib/papers";

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

export default function HomePage() {
  const categories = getAllCategories();

  return (
    <div className="mx-auto max-w-4xl px-6">
      {/* ── Identity ── */}
      <section className="pt-20 pb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-[#1a1a2e] mb-3">Rahul S. P.</h1>
        <p className="text-[#374151] text-lg sm:text-xl leading-relaxed max-w-xl">
          Quantitative research on financial time series: what is real, what is a
          mirage, and how to tell the difference.
        </p>
        <p className="text-[#6b7280] text-sm mt-3">
          {papers.length} papers &middot; Everything is empirical.
        </p>
        <div className="flex gap-4 mt-5 text-sm">
          <a href="https://www.linkedin.com/in/rahul-parmeshwar/" target="_blank" rel="noopener noreferrer" className="text-[#1e40af] hover:underline">LinkedIn</a>
          <a href="/about" className="text-[#1e40af] hover:underline">About</a>
        </div>
      </section>

      {/* ── Live highlight: World Money-Flow Map ── */}
      <section className="pb-10">
        <a href="/money-flow" className="block group" aria-label="Open the live World Money-Flow Map">
          <div className="relative overflow-hidden rounded-2xl border border-[#1c2438] bg-gradient-to-br from-[#0a0f1e] via-[#0b1224] to-[#05070f] px-6 py-7 sm:px-8 sm:py-9 transition-colors group-hover:border-[#3b5bdb]">
            {/* ambient glow */}
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#1e3a8a] opacity-30 blur-3xl" />
            <div className="relative flex items-center gap-5 sm:gap-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2bd4b0] opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2bd4b0]" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#2bd4b0]">Live now</span>
                  <span className="text-[10px] uppercase tracking-widest text-[#64748b]">Interactive globe</span>
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl text-white mb-2 group-hover:text-[#7dd3fc] transition-colors">
                  World Money-Flow Map
                </h2>
                <p className="text-sm sm:text-[15px] text-[#94a3b8] leading-relaxed max-w-md">
                  Watch where capital is rotating right now: gold, crypto, bonds, the dollar and
                  equity indices across the US, Europe and Asia. Rebuilt every minute from measured
                  fund flows, order-flow and price rotation.
                </p>
                <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-[#7dd3fc] transition-all group-hover:gap-2.5">
                  Open the live globe <span aria-hidden>&rarr;</span>
                </span>
              </div>
              {/* spinning globe */}
              <div className="relative hidden shrink-0 sm:block">
                <div className="mf-globe h-32 w-32 md:h-40 md:w-40" />
              </div>
            </div>
          </div>
        </a>
      </section>

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
                complexity, 6x lighter than equivalent Transformer architectures. Drop-in
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
                Cross-index dynamics between DJIA, S&amp;P 500, and NAS100. Literature review complete,
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
