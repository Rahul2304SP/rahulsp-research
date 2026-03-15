import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Rahul S. P.",
  description: "Senior Analyst at Deloitte. Independent quantitative researcher in market microstructure, neural architectures, and systematic trading.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-serif text-3xl text-[#1a1a2e] mb-10">About</h1>

      <div className="max-w-2xl space-y-6 text-[#374151] leading-relaxed">
        <p className="text-lg text-[#1a1a2e]">
          Senior Analyst at <strong>Deloitte</strong>. Independent quantitative researcher
          focused on market microstructure, neural architectures for financial time series,
          and systematic trading.
        </p>

        <p>
          By day, I work across financial due diligence, business performance reviews,
          and financial modelling for clients in TMT, Energy, Industrials, and Consumer
          sectors. By night, I build and test quantitative trading systems on live markets.
        </p>

        <p>
          My research sits at the intersection of applied statistics and real-time execution.
          I am interested in questions like: how fast does edge decay at the tick level?
          Can state-space models replace Transformers for financial sequences? Which
          cross-asset relationships survive multi-year stability testing? All studies
          published here are empirical, grounded in live market data, and tested under
          realistic execution constraints.
        </p>
      </div>

      {/* Background */}
      <div className="mt-12 pt-8 border-t border-[#e5e7eb] max-w-2xl">
        <h2 className="text-lg font-semibold text-[#1a1a2e] mb-4">Background</h2>
        <div className="space-y-4 text-[#374151] text-sm leading-relaxed">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-[#1a1a2e]">Senior Analyst</p>
              <p>Deloitte</p>
            </div>
            <p className="text-[#6b7280] whitespace-nowrap">2024 &ndash; Present</p>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-[#1a1a2e]">ICAEW ACA (in progress)</p>
              <p>Institute of Chartered Accountants in England and Wales</p>
              <p className="text-[#6b7280]">Certificate Level: 6/6 first-time passes &middot; Professional Level: 6/6 first-time passes</p>
            </div>
            <p className="text-[#6b7280] whitespace-nowrap">2024 &ndash; 2026</p>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-[#1a1a2e]">B.Sc. (Hons) Banking and Finance</p>
              <p>University of the West of England, Bristol</p>
              <p className="text-[#6b7280]">2:1 &middot; Dean&apos;s List (top 10%)</p>
            </div>
            <p className="text-[#6b7280] whitespace-nowrap">2020 &ndash; 2024</p>
          </div>
        </div>
      </div>

      {/* Research Interests */}
      <div className="mt-10 pt-8 border-t border-[#e5e7eb] max-w-2xl">
        <h2 className="text-lg font-semibold text-[#1a1a2e] mb-4">Research Interests</h2>
        <div className="flex flex-wrap gap-2">
          {[
            "Market Microstructure",
            "Tick-Level Price Dynamics",
            "State-Space Models (Mamba/SSM)",
            "Neural Architecture Design",
            "Cross-Asset Signal Extraction",
            "Feature Engineering",
            "Time-Series Forecasting",
            "Systematic Trading",
          ].map((interest) => (
            <span
              key={interest}
              className="px-3 py-1 text-sm rounded-full bg-[#f0f4ff] text-[#1e40af] border border-[#dbeafe]"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>

      {/* Publications */}
      <div className="mt-10 pt-8 border-t border-[#e5e7eb] max-w-2xl">
        <h2 className="text-lg font-semibold text-[#1a1a2e] mb-4">Publications</h2>
        <div className="space-y-3 text-sm text-[#374151]">
          <div>
            <p className="font-medium text-[#1a1a2e]">
              The Analysis of Technical Trading Strategies in Developed and Emerging Stock Markets
            </p>
            <p className="text-[#6b7280]">University of the West of England &middot; 2024</p>
          </div>
          <div>
            <p className="font-medium text-[#1a1a2e]">
              A Neural Meta-Policy for Gold Trading
            </p>
            <p className="text-[#6b7280]">Independent Research &middot; 2025 &ndash; 2026</p>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="mt-10 pt-8 border-t border-[#e5e7eb] max-w-2xl">
        <h2 className="text-lg font-semibold text-[#1a1a2e] mb-4">Contact</h2>
        <a
          href="https://www.linkedin.com/in/rahul-parmeshwar/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1e40af] text-sm hover:underline"
        >
          LinkedIn &rarr;
        </a>
      </div>
    </div>
  );
}
