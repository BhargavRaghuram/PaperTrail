import { searchProvider } from "@/lib/providers/search";

// Plausible spare-part price band in INR — filters out car prices, km figures, phone numbers, etc.
const MIN_PLAUSIBLE = 300;
const MAX_PLAUSIBLE = 150000;

/**
 * Pulls a representative rupee figure out of free text. "k" must be glued to the
 * number (₹7k) to count as a suffix — a space before it (as in "₹500 km") does not.
 * "lakh" may have a space before it, matching how Indian-English sources write it.
 */
export function parseRupeePrice(text: string): number | null {
  const matches = [...text.matchAll(/₹\s*([\d,]+(?:\.\d+)?)(k)?(?:\s*(lakh))?/gi)];
  const vals = matches
    .map((m) => {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (m[3]) return n * 100000;
      if (m[2]) return n * 1000;
      return n;
    })
    .filter((n) => n >= MIN_PLAUSIBLE && n <= MAX_PLAUSIBLE)
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  return Math.round(vals[Math.floor(vals.length / 2)]);
}

export interface LivePartPrice { price_inr: number; source: string; url: string; }

export function hostLabel(u: string): string {
  try {
    const h = new URL(u).hostname.replace(/^www\./, "");
    return h.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return "Web";
  }
}

export async function livePartPrice(
  make: string | undefined,
  model: string | undefined,
  part: string,
): Promise<LivePartPrice | null> {
  if (!make && !model) return null;
  const q = [make, model, part, "price India"].filter(Boolean).join(" ");
  const results = await searchProvider.search(q);
  if (!results || !results.length) return null;
  const price_inr = parseRupeePrice(results.map((r) => `${r.title} ${r.snippet}`).join(" "));
  if (!price_inr) return null;
  const top = results.find((r) => r.url) ?? results[0];
  return { price_inr, source: hostLabel(top.url), url: top.url };
}
