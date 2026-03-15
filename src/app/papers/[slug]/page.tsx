import { notFound } from "next/navigation";
import { getPaperBySlug, getAllSlugs } from "@/lib/papers";
import { MathRenderer } from "@/components/math-renderer";

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
      <MathRenderer />

      {/* Back link */}
      <a
        href="/"
        className="inline-block text-sm text-[#1e40af] hover:text-[#3b82f6] transition-colors mb-10"
      >
        &larr; Back to Research
      </a>

      {/* Paper header */}
      <header className="mb-12">
        <h1 className="font-serif text-3xl sm:text-4xl text-[#1a1a2e] leading-tight mb-4">
          {paper.title}
        </h1>
        <div className="flex items-center gap-2 text-sm text-[#6b7280]">
          <a
            href={`/#${paper.category.toLowerCase().replace(/ & /g, "-").replace(/\s+/g, "-")}`}
            className="inline-block text-xs font-medium text-[#1e40af] bg-[#eff6ff] hover:bg-[#dbeafe] px-2.5 py-0.5 rounded-full transition-colors"
          >
            {paper.category}
          </a>
          <span>&middot;</span>
          <time>{paper.date}</time>
          <span>&middot;</span>
          <span>{paper.author}</span>
        </div>
      </header>

      {/* Abstract */}
      <div className="bg-[#f8f9fc] border border-[#e5e7eb] rounded-lg p-6 mb-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] mb-3">
          Abstract
        </h2>
        <p className="text-[#374151] leading-relaxed text-sm">
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
          <p className="text-[#6b7280] text-sm">
            Full paper content coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
