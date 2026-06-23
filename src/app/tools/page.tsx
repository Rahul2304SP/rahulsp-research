import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tools | Rahul S. P.",
  description:
    "Interactive tools built from the research: a live US30 forward-60-minute volatility dial, and more.",
};

const tools = [
  {
    href: "/money-flow",
    badge: "Live",
    badgeColor: "#2bd4b0",
    title: "World Money-Flow Map",
    desc: "A live 3D globe of where capital is rotating between markets right now — gold, silver, crypto, bonds, the dollar, and equity indices across the US, Europe and Asia. Every minute it fuses measured fund flows, dark-pool and on-chain order-flow, price rotation, and risk-off reasoning into one net-flow estimate per market, each tagged by how it was inferred. Descriptive, not a forecast.",
  },
  {
    href: "/tools/world-tension",
    badge: "Live",
    badgeColor: "#C1432E",
    title: "World Tension",
    desc: "A realtime read on geopolitical risk, rebuilt every minute from around 25 global news feeds and placed on the scale of the academic Caldara-Iacoviello index. The published index is monthly; this is a near-realtime proxy of the same idea.",
  },
  {
    href: "/tools/us30-volatility",
    badge: "Live",
    badgeColor: "#1e40af",
    title: "US30 Volatility Dial",
    desc: "A live forecast of how far the Dow is likely to travel over the next 60 minutes, produced by the same LightGBM model documented in the volatility paper. Magnitude only, never direction.",
  },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-serif text-3xl text-[#1a1a2e] mb-3">Tools</h1>
      <p className="text-[#374151] leading-relaxed mb-10 max-w-2xl">
        Interactive tools built from the research. Informational only, not investment advice.
      </p>

      <div className="space-y-4">
        {tools.map((t) => (
          <a key={t.href} href={t.href} className="block group">
            <div className="rounded-xl border border-[#e5e7eb] hover:border-[#1e40af] transition-colors p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded text-white"
                  style={{ background: t.badgeColor }}
                >
                  {t.badge}
                </span>
                <h2 className="text-lg sm:text-xl font-semibold text-[#1a1a2e] group-hover:text-[#1e40af] transition-colors">
                  {t.title}
                </h2>
              </div>
              <p className="text-sm text-[#374151] leading-relaxed">{t.desc}</p>
              <span className="inline-block mt-3 text-sm text-[#1e40af] group-hover:underline">
                Open tool &rarr;
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
