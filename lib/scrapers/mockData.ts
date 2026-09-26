import type { PriceComp } from "@/lib/contracts";

// Bundled fallback data (Vercel-safe) keyed by normalised registration number.
// Swap for live Anakin calls by setting the app-id env vars in lib/scrapers/anakin.ts.

export interface PublicRecord { owner_count_record: number; chassis?: string; status?: string; }
export interface Challan { date: string; offence: string; amount_inr: number; }

// S13 hero car: KA 99 JD 6645. RC shows owner 2; public record shows 3 → the moat flag.
export const MOCK_RECORDS: Record<string, PublicRecord> = {
  KA99JD6645: { owner_count_record: 3, chassis: "MA3EYD81S00C66452", status: "Active" },
};

export const MOCK_CHALLANS: Record<string, Challan[]> = {
  KA99JD6645: [
    { date: "2023-08-14", offence: "Over-speeding — 82 km/h in a 60 zone", amount_inr: 1000 },
    { date: "2024-02-03", offence: "Over-speeding — Bengaluru ORR", amount_inr: 1000 },
  ],
};

export const MOCK_PRICES: { match: RegExp; comps: PriceComp[] }[] = [
  {
    match: /dzire|swift|baleno/i,
    comps: [
      { source: "Spinny", title: "2018 Maruti Dzire ZDI · 54,000 km · 1 owner", price_inr: 498000, url: "https://www.spinny.com" },
      { source: "Cars24", title: "2019 Maruti Dzire VDI · 61,000 km · 1 owner", price_inr: 515000, url: "https://www.cars24.com" },
      { source: "CarDekho", title: "2018 Maruti Dzire ZDI+ · 48,000 km · 2 owners", price_inr: 472000, url: "https://www.cardekho.com" },
    ],
  },
];

export function priceCompsFor(make?: string, model?: string, year?: number, asking?: number): PriceComp[] {
  const hay = `${make ?? ""} ${model ?? ""}`;
  const branded = MOCK_PRICES.find((p) => p.match.test(hay))?.comps;
  if (branded) return branded;

  // No branded sample: synthesize representative comps around the asking price so the
  // feature works for any car. Replaced by live Anakin marketplace scraping when configured.
  if (!asking) return [];
  const name = [year, make, model].filter(Boolean).join(" ") || "Similar model";
  const round = (n: number) => Math.round(n / 1000) * 1000;
  return [
    { source: "Cars24", title: `${name} · comparable listing`, price_inr: round(asking * 0.92), url: "https://www.cars24.com" },
    { source: "Spinny", title: `${name} · comparable listing`, price_inr: round(asking * 0.97), url: "https://www.spinny.com" },
    { source: "CarDekho", title: `${name} · comparable listing`, price_inr: round(asking * 1.04), url: "https://www.cardekho.com" },
  ];
}
