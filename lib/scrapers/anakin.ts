// Anakin.io — web scraping + search API. Base https://api.anakin.io/v1, header X-API-Key.
// ANAKIN_API holds the key. All functions degrade to null on any failure — never throw.
const KEY = (process.env.ANAKIN_API ?? "").trim();
const BASE = "https://api.anakin.io/v1";

async function call(path: string, body: Record<string, unknown>): Promise<any | null> {
  if (!KEY) {
    console.log(`[anakin] SKIP ${path} — no ANAKIN_API key set (using sample fallback)`);
    return null;
  }
  const started = Date.now();
  const preview = JSON.stringify(body).slice(0, 80);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const ms = Date.now() - started;
    if (!res.ok) {
      console.log(`[anakin] ${path} <- HTTP ${res.status} in ${ms}ms (fallback) body=${preview}`);
      return null;
    }
    const json = await res.json();
    const n = Array.isArray(json?.results) ? json.results.length : json?.status ?? "ok";
    console.log(`[anakin] LIVE ${path} <- 200 in ${ms}ms · ${typeof n === "number" ? n + " results" : n} · ${preview}`);
    return json;
  } catch (e) {
    console.log(`[anakin] ${path} <- ERROR ${String(e).slice(0, 80)} (fallback)`);
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
