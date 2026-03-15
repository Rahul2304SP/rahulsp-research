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
      <body className={`${inter.className} min-h-screen`}>
        <nav className="border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="mx-auto max-w-4xl px-6 h-14 flex items-center justify-between">
            <a
              href="/"
              className="text-[#fafafa] font-semibold tracking-tight"
            >
              Rahul S. P.
            </a>
            <div className="flex items-center gap-6 text-sm">
              <a
                href="/"
                className="text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
              >
                Research
              </a>
              <a
                href="/about"
                className="text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
              >
                About
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="border-t border-[#27272a] mt-24">
          <div className="mx-auto max-w-4xl px-6 py-8 text-sm text-[#71717a]">
            <p>&copy; 2026 Rahul S. P. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
