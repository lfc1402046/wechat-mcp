/**
 * 单元测试：markdown.ts HTML→Markdown 转换
 *
 * 运行：npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToMarkdown, tidy } from "../src/markdown.js";

test("htmlToMarkdown: 基本段落", () => {
  const md = htmlToMarkdown("<p>你好，世界</p>");
  assert.equal(md, "你好，世界");
});

test("htmlToMarkdown: 标题 H1-H6", () => {
  const md = htmlToMarkdown("<h1>一级</h1><h2>二级</h2><h3>三级</h3>");
  assert.ok(md.includes("# 一级"));
  assert.ok(md.includes("## 二级"));
  assert.ok(md.includes("### 三级"));
});

test("htmlToMarkdown: 粗体和斜体", () => {
  const md = htmlToMarkdown("<p><strong>粗</strong>和<em>斜</em></p>");
  assert.ok(md.includes("**粗**"));
  assert.ok(md.includes("*斜*"));
});

test("htmlToMarkdown: 链接", () => {
  const md = htmlToMarkdown('<a href="https://example.com">示例</a>');
  assert.equal(md, "[示例](https://example.com)");
});

test("htmlToMarkdown: 图片 data-src 优先", () => {
  const md = htmlToMarkdown('<img data-src="https://mmbiz.qpic.cn/a.jpg" src="placeholder.gif">');
  assert.ok(md.includes("https://mmbiz.qpic.cn/a.jpg"));
  assert.ok(!md.includes("placeholder.gif"));
});

test("htmlToMarkdown: 列表", () => {
  const md = htmlToMarkdown("<ul><li>第一</li><li>第二</li></ul>");
  assert.ok(md.includes("- 第一"));
  assert.ok(md.includes("- 第二"));
});

test("htmlToMarkdown: 引用", () => {
  const md = htmlToMarkdown("<blockquote>引用的文字</blockquote>");
  assert.ok(md.includes("> 引用的文字"));
});

test("htmlToMarkdown: 实体解码", () => {
  const md = htmlToMarkdown("<p>A & B < C</p>");
  assert.equal(md, "A & B < C");
});

test("htmlToMarkdown: <br> 转换为换行", () => {
  const md = htmlToMarkdown("第一行<br>第二行");
  assert.ok(md.includes("第一行"));
  assert.ok(md.includes("第二行"));
});

test("tidy: 截断超长内容", () => {
  const long = "中".repeat(30_000);
  const out = tidy(long, 1000);
  assert.ok(out.length <= 1100); // 留些 buffer 给截断提示
  assert.ok(out.includes("截断"));
});

test("tidy: 清理阅读原文", () => {
  const out = tidy("正文内容\n阅读原文");
  assert.equal(out, "正文内容");
});
