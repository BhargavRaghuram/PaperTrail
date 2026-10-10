import type { SearchProvider } from "./types";
import { serpapiProvider } from "./serpapi";
import { anakinProvider } from "./anakin";

export * from "./types";

const PROVIDERS: Record<string, SearchProvider> = {
  serpapi: serpapiProvider,
  anakin: anakinProvider,
};

const selected = (process.env.SEARCH_PROVIDER ?? "serpapi").trim().toLowerCase();
export const searchProvider: SearchProvider = PROVIDERS[selected] ?? serpapiProvider;
