import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tools | Rahul S. P.",
  description:
    "Interactive tools built from the research: a live US30 forward-60-minute volatility dial, and more.",
};

const tools: {
  href: string; badge: string; badgeColor: string; title: string;
  desc: string; note?: string; cta?: string;
}[] = [
  {
    href: "/money-flow",
    badge: "Live",
    badgeColor: "#2bd4b0",
    title: "World Money-Flow Map",
    desc: "A live 3D globe of where capital is rotating between markets right now: gold, silver, crypto, bonds, the dollar, and equity indices across the US, Europe and Asia. Every minute it fuses measured fund flows, dark-pool and on-chain order-flow, price rotation, and risk-off reasoning into one net-flow estimate per market, each tagged by how it was inferred. Descriptive, not a forecast.",
  },
  {
    href: "/tools/world-tension",
    badge: "Live",
    badgeColor: "#C1432E",
    title: "World Tension",
    desc: "A live read on geopolitical risk as it unfolds, rebuilt continuously from over 200 news feeds worldwide, from the major international wires to regional papers inside the active conflict zones, alongside a global monitor that scans news from nearly every country. The signal is placed on the scale of the academic Caldara-Iacoviello index, where 100 is the long-run average, and mapped to show where the tension is concentrated. The published index is monthly and lagged; this is a near-realtime proxy of the same idea.",
  },
  {
    href: "/tools/us30-volatility",
    badge: "Live",
    badgeColor: "#1e40af",
    title: "US30 Volatility Dial",
    desc: "A live forecast of how far the Dow is likely to travel over the next 60 minutes, produced by the same LightGBM model documented in the volatility paper. Magnitude only, never direction.",
  },
  {
    href: "/homefinder",
    badge: "Private",
    badgeColor: "#6b7280",
    title: "Property Valuation Report",
    desc: "A private valuation report for a personal shortlist of properties, combining HM Land Registry sold prices (time-adjusted to today), EPC floor areas, a LightGBM automated valuation model, and per-property sale history and area context. Each property gets a fair-value estimate, a price-position verdict, and a suggested offer.",
    note: "🔒 Passkey required — not public.",
    cta: "Enter passkey",
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
              {t.note && (
                <p className="mt-2 text-xs text-[#6b7280] italic">{t.note}</p>
              )}
              <span className="inline-block mt-3 text-sm text-[#1e40af] group-hover:underline">
                {t.cta ?? "Open tool"} &rarr;
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
