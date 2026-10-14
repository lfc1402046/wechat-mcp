/**
 * Type definitions for wechat-mcp.
 */

export interface ArticleResult {
  /** 微信公众号文章标题 */
  title: string;
  /** 公众号名称 */
  author: string;
  /** Markdown 格式的正文 */
  content: string;
  /** 封面图 URL（可选） */
  cover?: string;
  /** 公众号原始 URL */
  url: string;
  /** 发布时间（ISO 字符串，可选） */
  publishTime?: string;
}

export interface ArticleError {
  error: string;
  url: string;
}

export type FetchResult = ArticleResult | ArticleError;

export function isError(r: FetchResult): r is ArticleError {
  return (r as ArticleError).error !== undefined;
}

/** MCP tool input schema */
export interface ReadArticleInput {
  /** WeChat article URL (must be mp.weixin.qq.com) */
  url: string;
  /** Optional: include inline images (default true) */
  include_images?: boolean;
  /** Optional: max content length in chars (default 20000) */
  max_length?: number;
}

export interface ReadMultipleArticlesInput {
  /** List of WeChat article URLs (max 10) */
  urls: string[];
}

export interface CacheEntry {
  result: FetchResult;
  /** Unix timestamp in ms */
  cachedAt: number;
}
