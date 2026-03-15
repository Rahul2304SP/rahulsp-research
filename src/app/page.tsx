import { papers } from "@/lib/papers";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {/* Author badge */}
      <div className="mb-10">
        <span className="text-sm text-[#6b7280] tracking-wide">
          Rahul S. P. &mdash; Quantitative Researcher
        </span>
      </div>

      {/* Header */}
      <header className="mb-16">
        <h1 className="font-serif text-4xl text-[#1a1a2e] mb-3">
          Quantitative Research
        </h1>
        <p className="text-[#6b7280] text-lg leading-relaxed max-w-2xl">
          Research on market microstructure, neural architectures for trading,
          and cross-asset dynamics. All studies are empirical, tested on live
          data, and grounded in statistical rigor.
        </p>
      </header>

      {/* Paper list */}
      <section>
        <div className="space-y-0">
          {papers.map((paper) => (
            <article
              key={paper.slug}
              className="group border-b border-[#e5e7eb] py-8 first:pt-0"
            >
              <div className="flex items-center gap-3 mb-2">
                <time className="text-sm text-[#6b7280]">{paper.date}</time>
                <span className="text-xs font-medium text-[#1e40af] bg-[#eff6ff] px-2.5 py-0.5 rounded-full">
                  {paper.category}
                </span>
              </div>
              <a href={`/papers/${paper.slug}`} className="block">
                <h2 className="text-xl font-semibold text-[#1a1a2e] group-hover:text-[#1e40af] transition-colors leading-snug mb-2">
                  {paper.title}
                </h2>
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
    </div>
  );
}
