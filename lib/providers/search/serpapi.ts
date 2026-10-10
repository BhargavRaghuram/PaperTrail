// SerpApi — Google Search engine. https://serpapi.com/search.json, param api_key.
import type { SearchProvider, SearchResult } from "./types";

const KEY = (process.env.SERPAPI_API_KEY ?? "").trim();

async function search(prompt: string): Promise<SearchResult[] | null> {
  if (!KEY) {
    console.log(`[serpapi] SKIP — no SERPAPI_API_KEY set (using sample fallback)`);
    return null;
  }
  const started = Date.now();
  const preview = prompt.slice(0, 80);
  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", prompt);
    url.searchParams.set("gl", "in");
    url.searchParams.set("hl", "en");
    url.searchParams.set("num", "10");
    url.searchParams.set("api_key", KEY);

    const res = await fetch(url.toString());
    const ms = Date.now() - started;
    if (!res.ok) {
      console.log(`[serpapi] <- HTTP ${res.status} in ${ms}ms (fallback) q=${preview}`);
      return null;
    }
    const json = await res.json();
    const results = (json.organic_results ?? []) as Array<{ title?: string; link?: string; snippet?: string }>;
    console.log(`[serpapi] LIVE <- 200 in ${ms}ms · ${results.length} results · q=${preview}`);
    if (!results.length) return null;
    return results.map((r) => ({ title: r.title ?? "", url: r.link ?? "", snippet: r.snippet ?? "" }));
  } catch (e) {
    console.log(`[serpapi] <- ERROR ${String(e).slice(0, 80)} (fallback)`);
    return null;
  }
}

export const serpapiProvider: SearchProvider = { name: "serpapi", search };
