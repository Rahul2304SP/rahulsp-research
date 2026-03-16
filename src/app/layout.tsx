import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rahul S. P. | Quantitative Research",
  description:
    "Research papers on quantitative trading, market microstructure, and machine learning for financial markets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
        />
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"
        />
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
        />
      </head>
      <body className={`${inter.className} min-h-screen`}>
        {/* Top accent bar */}
        <div className="h-[2px] bg-[#1e40af] w-full" />

        <nav className="border-b border-[#e5e7eb] bg-white sticky top-0 z-50">
          <div className="mx-auto max-w-4xl px-6 h-14 flex items-center justify-between">
            <a
              href="/"
              className="text-[#1a1a2e] font-semibold tracking-tight shrink-0"
            >
              Rahul S. P.
            </a>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6 text-sm">
              <a href="/" className="text-[#6b7280] hover:text-[#1e40af] transition-colors">Research</a>
              <a href="/signals" className="text-[#6b7280] hover:text-[#1e40af] transition-colors">Signals</a>
              <a href="/performance" className="text-[#6b7280] hover:text-[#1e40af] transition-colors">Performance</a>
              <a href="/vsn" className="text-[#6b7280] hover:text-[#1e40af] transition-colors">VSN Live</a>
              <a href="/about" className="text-[#6b7280] hover:text-[#1e40af] transition-colors">About</a>
            </div>
            {/* Mobile nav - scrollable row */}
            <div className="flex md:hidden items-center gap-4 text-xs overflow-x-auto ml-4 no-scrollbar">
              <a href="/" className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap">Research</a>
              <a href="/signals" className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap">Signals</a>
              <a href="/performance" className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap">Performance</a>
              <a href="/vsn" className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap">VSN</a>
              <a href="/about" className="text-[#6b7280] hover:text-[#1e40af] whitespace-nowrap">About</a>
            </div>
          </div>
        </nav>

        <main>{children}</main>

        <footer className="border-t border-[#e5e7eb] bg-[#f8f9fa] mt-24">
          <div className="mx-auto max-w-4xl px-6 py-8 space-y-4">
            <p className="text-xs text-[#9ca3af] leading-relaxed">
              <strong className="text-[#6b7280]">Disclaimer:</strong> The information on this site is for educational and research purposes only. It does not constitute financial advice, investment recommendations, or a solicitation to trade any financial instrument. All signals, model outputs, and performance metrics are provided on an informational basis and should not be relied upon for making investment decisions. Past performance is not indicative of future results. Trading financial instruments carries a high level of risk and may not be suitable for all investors. You should consider your financial situation and consult an independent financial adviser before trading. The author accepts no liability for any loss or damage arising from the use of information on this site. Trade at your own risk.
            </p>
            <p className="text-sm text-[#6b7280]">&copy; 2026 Rahul S. P. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
