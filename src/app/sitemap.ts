import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/papers";

export const dynamic = "force-static";

const BASE = "https://rahulsp.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/about", priority: 0.9 },
    { path: "/tools", priority: 0.6 },
    { path: "/tools/us30-volatility", priority: 0.6 },
    { path: "/tools/uk-rates", priority: 0.6 },
    { path: "/tools/world-tension", priority: 0.6 },
    { path: "/money-flow", priority: 0.6 },
    { path: "/homefinder", priority: 0.5 },
    { path: "/homefinder-uk", priority: 0.5 },
  ];
  return [
    ...staticRoutes.map((r) => ({ url: `${BASE}${r.path}`, priority: r.priority })),
    ...getAllSlugs().map((slug) => ({
      url: `${BASE}/papers/${slug}`,
      priority: 0.8,
    })),
  ];
}
