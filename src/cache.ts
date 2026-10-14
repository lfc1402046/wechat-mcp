import type { CacheEntry, FetchResult } from "./types.js";

/**
 * Simple in-memory LRU-ish cache for fetched articles.
 * Default TTL: 30 minutes (微信文章变动不频繁).
 */

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 200;

export class ArticleCache {
  private store = new Map<string, CacheEntry>();
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  get(url: string): FetchResult | null {
    const entry = this.store.get(url);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.store.delete(url);
      return null;
    }
    return entry.result;
  }

  set(url: string, result: FetchResult): void {
    if (this.store.size >= MAX_ENTRIES) {
      // Drop oldest insertion (Map preserves insertion order).
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(url, { result, cachedAt: Date.now() });
  }

  clear(): void {
    this.store.clear();
  }

  stats(): { size: number; ttlMs: number } {
    return { size: this.store.size, ttlMs: this.ttlMs };
  }
}

// Singleton shared by all tool calls in the same MCP server process.
export const globalCache = new ArticleCache();
