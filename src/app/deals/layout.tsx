import type { Metadata } from "next";

// The /deals page is private: keep it out of search results. The password gate itself
// lives in page.tsx and is checked server-side by /api/resale.
export const metadata: Metadata = {
  title: "Deals",
  robots: { index: false, follow: false },
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
