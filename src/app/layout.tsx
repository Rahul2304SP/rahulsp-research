import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://rahulsp.com"),
  title: "Rahul Parmeshwar | Quantitative Research",
  description:
    "Rahul Parmeshwar (Rahul S. P.) publishes research on quantitative trading, market microstructure, and machine learning for financial markets.",
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    url: "https://rahulsp.com",
    siteName: "Rahul Parmeshwar | Quantitative Research",
    title: "Rahul Parmeshwar | Quantitative Research",
    description:
      "Research papers on quantitative trading, market microstructure, and machine learning for financial markets.",
  },
  twitter: {
    card: "summary",
    title: "Rahul Parmeshwar | Quantitative Research",
  },
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Rahul Parmeshwar",
  alternateName: "Rahul S. P.",
  url: "https://rahulsp.com",
  jobTitle: "Assistant Manager",
  worksFor: { "@type": "Organization", name: "Deloitte" },
  sameAs: ["https://www.linkedin.com/in/rahul-parmeshwar/"],
  knowsAbout: [
    "Quantitative finance",
    "Market microstructure",
    "Machine learning for financial time series",
    "Systematic trading",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Rahul Parmeshwar | Quantitative Research",
  alternateName: "rahulsp.com",
  url: "https://rahulsp.com",
  author: { "@type": "Person", name: "Rahul Parmeshwar" },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
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
            <p className="text-sm text-[#6b7280]">&copy; 2026 Rahul Parmeshwar. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
