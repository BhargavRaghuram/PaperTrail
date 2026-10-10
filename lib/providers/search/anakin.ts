import { anakinSearch } from "@/lib/scrapers/anakin";
import type { SearchProvider } from "./types";

export const anakinProvider: SearchProvider = { name: "anakin", search: anakinSearch };
