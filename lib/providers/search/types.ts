export interface SearchResult { title: string; url: string; snippet: string; }

export interface SearchProvider {
  name: string;
  search(prompt: string): Promise<SearchResult[] | null>;
}
