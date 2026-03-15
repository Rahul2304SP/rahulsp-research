import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Rahul S. P.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-serif text-3xl text-[#fafafa] mb-8">About</h1>

      <div className="max-w-2xl space-y-6 text-[#a1a1aa] leading-relaxed">
        <p>
          Quantitative researcher focused on market microstructure, neural
          architectures, and systematic trading. Research interests include
          tick-level price dynamics, state-space models, and cross-asset signal
          extraction.
        </p>
        <p>
          All research published here is empirical, built on real market data,
          and validated through live execution.
        </p>
      </div>

      <div className="mt-12 pt-8 border-t border-[#27272a]">
        <h2 className="text-lg font-semibold text-[#fafafa] mb-4">Contact</h2>
        <a
          href="https://linkedin.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#22c55e] text-sm hover:underline"
        >
          LinkedIn &rarr;
        </a>
      </div>
    </div>
  );
}
