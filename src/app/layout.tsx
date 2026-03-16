import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";

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

        <NavBar />

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
