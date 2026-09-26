// Anakin.io — web scraping + search API. Base https://api.anakin.io/v1, header X-API-Key.
// ANAKIN_API holds the key. All functions degrade to null on any failure — never throw.
const KEY = (process.env.ANAKIN_API ?? "").trim();
const BASE = "https://api.anakin.io/v1";

async function call(path: string, body: Record<string, unknown>): Promise<any | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface SearchResult { title: string; url: string; snippet: string; }

export async function anakinSearch(prompt: string): Promise<SearchResult[] | null> {
  const j = await call("/search", { prompt });
  if (!j || !Array.isArray(j.results)) return null;
  return j.results as SearchResult[];
}

export async function anakinScrape(url: string): Promise<string | null> {
  const j = await call("/url-scraper/scrape", { url });
  return j?.html ?? null;
}

export const normReg = (s?: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
