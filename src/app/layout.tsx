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
              className="text-[#1a1a2e] font-semibold tracking-tight"
            >
              Rahul S. P.
            </a>
            <div className="flex items-center gap-6 text-sm">
              <a
                href="/"
                className="text-[#6b7280] hover:text-[#1e40af] transition-colors"
              >
                Research
              </a>
              <a
                href="/signals"
                className="text-[#6b7280] hover:text-[#1e40af] transition-colors"
              >
                Live Signals
              </a>
              <a
                href="/about"
                className="text-[#6b7280] hover:text-[#1e40af] transition-colors"
              >
                About
              </a>
            </div>
          </div>
        </nav>

        <main>{children}</main>

        <footer className="border-t border-[#e5e7eb] bg-[#f8f9fa] mt-24">
          <div className="mx-auto max-w-4xl px-6 py-8 text-sm text-[#6b7280]">
            <p>&copy; 2026 Rahul S. P. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
