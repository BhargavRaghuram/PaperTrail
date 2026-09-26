import type { PriceComp } from "@/lib/contracts";
import { anakinSearch } from "./anakin";
import { priceCompsFor } from "./mockData";

const LAKH = 100000;
const SITES = /cars24|spinny|cardekho|olx|carwale|droom|truebil/i;

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

function host(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

export async function fetchMarket(make?: string, model?: string, year?: number, asking?: number): Promise<Market | null> {
  const q = [year, make, model].filter(Boolean).join(" ");
  if (q) {
    const results = await anakinSearch(
      `used ${q} price second hand car India site:cars24.com OR site:spinny.com OR site:cardekho.com`,
    );
    if (results && results.length) {
      const range = priceRange(results.map((r) => `${r.snippet} ${r.title}`).join(" "));
      const seen = new Set<string>();
      const comps: PriceComp[] = [];
      for (const r of results) {
        if (!r.url || !SITES.test(r.url)) continue;
        const h = host(r.url);
        if (seen.has(h)) continue;
        seen.add(h);
        comps.push({
          source: h.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()),
          title: (r.title || q).replace(/\s+/g, " ").trim().slice(0, 80),
          price_inr: 0, // real per-listing price is unreliable to parse; link out instead
          url: r.url,
        });
        if (comps.length >= 4) break;
      }
      if (comps.length && range) {
        return { comps, low: range.low, high: range.high, count: results.length, source: "live" };
      }
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
