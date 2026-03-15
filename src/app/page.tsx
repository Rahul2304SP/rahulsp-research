import { getAllCategories, getPapersByCategory } from "@/lib/papers";

const categoryDescriptions: Record<string, string> = {
  "Empirical Studies":
    "Experimental results validated on live market data with walk-forward testing.",
  "Architecture & Models":
    "Neural network architectures designed for financial time series.",
  "Feature Engineering":
    "Construction, selection, and validation of predictive features.",
};

function categoryAnchor(category: string): string {
  return category
    .toLowerCase()
    .replace(/ & /g, "-")
    .replace(/\s+/g, "-");
}

export default function HomePage() {
  const categories = getAllCategories();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {/* Author badge */}
      <div className="mb-10">
        <span className="text-sm text-[#6b7280] tracking-wide">
          Rahul S. P. &mdash; Quantitative Researcher
        </span>
      </div>

      {/* Header */}
      <header className="mb-10">
        <h1 className="font-serif text-4xl text-[#1a1a2e] mb-3">
          Quantitative Research
        </h1>
        <p className="text-[#6b7280] text-lg leading-relaxed max-w-2xl">
          Research on market microstructure, neural architectures for trading,
          and cross-asset dynamics. All studies are empirical, tested on live
          data, and grounded in statistical rigor.
        </p>
      </header>

      {/* Section navigation pills */}
      <nav className="flex flex-wrap gap-2 mb-14">
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

      {/* Paper sections by category */}
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
              <p className="text-sm text-[#6b7280]">
                {categoryDescriptions[cat]}
              </p>
            </div>

            <div className="space-y-0">
              {catPapers.map((paper) => (
                <article
                  key={paper.slug}
                  className="group border-b border-[#e5e7eb] py-8 first:pt-0"
                >
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
    </div>
  );
}
