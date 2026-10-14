/**
 * 单元测试：cache.ts 内存缓存
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { ArticleCache } from "../src/cache.js";

test("ArticleCache: set + get 命中", () => {
  const c = new ArticleCache(60_000);
  c.set("https://a", { title: "A", author: "x", content: "正文", url: "https://a" });
  const r = c.get("https://a");
  assert.ok(r);
  assert.equal((r as any).title, "A");
});

test("ArticleCache: TTL 过期", async () => {
  const c = new ArticleCache(50); // 50ms TTL
  c.set("https://a", { title: "A", author: "x", content: "正文", url: "https://a" });
  await new Promise((r) => setTimeout(r, 80));
  const r = c.get("https://a");
  assert.equal(r, null);
});

test("ArticleCache: 容量上限 MAX_ENTRIES", () => {
  const c = new ArticleCache(60_000);
  for (let i = 0; i < 250; i++) {
    c.set(`https://a${i}`, { title: `A${i}`, author: "x", content: "", url: `https://a${i}` });
  }
  assert.ok(c.stats().size <= 200);
});

test("ArticleCache: clear", () => {
  const c = new ArticleCache(60_000);
  c.set("https://a", { title: "A", author: "x", content: "", url: "https://a" });
  c.clear();
  assert.equal(c.get("https://a"), null);
});
