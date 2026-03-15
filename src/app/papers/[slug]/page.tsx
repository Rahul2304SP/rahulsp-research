import { notFound } from "next/navigation";
import { getPaperBySlug, getAllSlugs } from "@/lib/papers";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const paper = getPaperBySlug(slug);
  if (!paper) return { title: "Paper Not Found" };
  return {
    title: `${paper.title} | Rahul S. P.`,
    description: paper.abstract,
  };
}

export default async function PaperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {/* Back link */}
      <a
        href="/"
        className="inline-block text-sm text-[#71717a] hover:text-[#22c55e] transition-colors mb-10"
      >
        &larr; Back to Research
      </a>

      {/* Paper header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <time className="text-sm text-[#71717a]">{paper.date}</time>
          <span className="text-xs font-medium text-[#22c55e] bg-[#22c55e]/10 px-2.5 py-0.5 rounded-full">
            {paper.category}
          </span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#fafafa] leading-tight mb-4">
          {paper.title}
        </h1>
        <p className="text-[#a1a1aa] text-sm">{paper.author}</p>
      </header>

      {/* Abstract */}
      <div className="bg-[#111113] border border-[#27272a] rounded-lg p-6 mb-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#71717a] mb-3">
          Abstract
        </h2>
        <p className="text-[#a1a1aa] leading-relaxed text-sm">
          {paper.abstract}
        </p>
      </div>

      {/* Paper content */}
      {paper.content ? (
        <div
          className="paper-content"
          dangerouslySetInnerHTML={{ __html: paper.content }}
        />
      ) : (
        <div className="text-center py-16">
          <p className="text-[#71717a] text-sm">
            Full paper content coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
