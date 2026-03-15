import { papers } from "@/lib/papers";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {/* Header */}
      <header className="mb-16">
        <h1 className="font-serif text-4xl text-[#fafafa] mb-3">
          Quantitative Research
        </h1>
        <p className="text-[#a1a1aa] text-lg leading-relaxed max-w-2xl">
          Research on market microstructure, neural architectures for trading,
          and cross-asset dynamics. All studies are empirical, tested on live
          data, and grounded in statistical rigor.
        </p>
      </header>

      {/* Paper list */}
      <section>
        <div className="space-y-12">
          {papers.map((paper) => (
            <article key={paper.slug} className="group">
              <div className="flex items-center gap-3 mb-2">
                <time className="text-sm text-[#71717a]">{paper.date}</time>
                <span className="text-xs font-medium text-[#22c55e] bg-[#22c55e]/10 px-2.5 py-0.5 rounded-full">
                  {paper.category}
                </span>
              </div>
              <a href={`/papers/${paper.slug}`} className="block">
                <h2 className="text-xl font-semibold text-[#fafafa] group-hover:text-[#22c55e] transition-colors leading-snug mb-2">
                  {paper.title}
                </h2>
                <p className="text-[#a1a1aa] text-sm leading-relaxed line-clamp-2">
                  {paper.abstract}
                </p>
              </a>
              <a
                href={`/papers/${paper.slug}`}
                className="inline-block mt-3 text-sm text-[#71717a] hover:text-[#22c55e] transition-colors"
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
