import type { PriceComp } from "@/lib/contracts";
import { searchProvider } from "@/lib/providers/search";
import { priceCompsFor } from "./mockData";

const LAKH = 100000;

// One targeted SerpApi query per marketplace — guarantees a comp from each site that
// actually has one, instead of hoping several survive a single combined-OR query's
// top 10 results (which in practice often surfaces only one matching host). Google's
// `site:` operator isn't a hard filter — for a thin index it quietly substitutes
// other marketplaces, which the `.includes(host)` check below correctly rejects
// rather than misattributing. Five sites, not three, so a car still gets several
// real comps even when one or two marketplaces have nothing indexed for it.
const SITE_QUERIES: { name: string; host: string }[] = [
  { name: "Cars24", host: "cars24.com" },
  { name: "Spinny", host: "spinny.com" },
  { name: "CarDekho", host: "cardekho.com" },
  { name: "Zigwheels", host: "zigwheels.com" },
  { name: "CarTrade", host: "cartrade.com" },
];

export interface Market {
  comps: PriceComp[];
  low: number;
  high: number;
  count: number;
  source: "live" | "sample";
}

const asLakh = (n: number) => (n >= 1 && n <= 20 ? Math.round(n * LAKH) : 0);

// Prefer an explicit "priced between ₹A lakh and ₹B lakh" phrase; else use the
// 20th/80th percentile of all lakh figures to shrug off outliers (spec pages etc.).
function priceRange(text: string): { low: number; high: number } | null {
  const explicit = text.match(/between\s*₹?\s*([\d.]+)\s*lakh.*?(?:and|to|–|-)\s*₹?\s*([\d.]+)\s*lakh/i);
  if (explicit) {
    const low = asLakh(parseFloat(explicit[1]));
    const high = asLakh(parseFloat(explicit[2]));
    if (low && high && low < high) return { low, high };
  }
  const vals = [...text.matchAll(/(\d{1,2}(?:\.\d{1,2})?)\s*lakh/gi)]
    .map((m) => asLakh(parseFloat(m[1])))
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (vals.length >= 3) {
    const lo = vals[Math.floor(vals.length * 0.2)];
    const hi = vals[Math.floor(vals.length * 0.8)];
    if (lo < hi) return { low: lo, high: hi };
  }
  return null;
}

export async function fetchMarket(make?: string, model?: string, year?: number, asking?: number): Promise<Market | null> {
  const q = [year, make, model].filter(Boolean).join(" ");
  if (q) {
    const perSite = await Promise.all(
      SITE_QUERIES.map((s) => searchProvider.search(`used ${q} price site:${s.host}`)),
    );
    const allResults = perSite.flatMap((r) => r ?? []);
    const range = priceRange(allResults.map((r) => `${r.snippet} ${r.title}`).join(" "));

    const comps: PriceComp[] = [];
    perSite.forEach((results, i) => {
      const site = SITE_QUERIES[i];
      const hit = (results ?? []).find((r) => r.url && r.url.includes(site.host));
      if (hit) {
        comps.push({
          source: site.name,
          title: (hit.title || q).replace(/\s+/g, " ").trim().slice(0, 80),
          price_inr: 0, // real per-listing price is unreliable to parse; link out instead
          url: hit.url,
        });
      }
    });

    if (comps.length && range) {
      return { comps, low: range.low, high: range.high, count: allResults.length, source: "live" };
    }
  }

  // Offline / no-key fallback: synthesize from the branded samples or the asking price.
  const comps = priceCompsFor(make, model, year, asking);
  if (!comps.length) return null;
  const prices = comps.map((c) => c.price_inr).filter(Boolean);
  return {
    comps,
    low: prices.length ? Math.min(...prices) : 0,
    high: prices.length ? Math.max(...prices) : 0,
    count: comps.length,
    source: "sample",
  };
}
