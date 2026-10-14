import { htmlToMarkdown, tidy } from "./markdown.js";
import type { FetchResult } from "./types.js";

const UA_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1";

const ACCEPT_LANG = "zh-CN,zh;q=0.9,en;q=0.8";

/**
 * 入口：拉取并解析一个微信公众号文章，返回结构化 Markdown。
 *
 * 解析策略（按优先级）：
 *   1. 抓 HTML，提取 msg_title / nickname / js_content 等关键字段；
 *   2. 如常规方式拿不到正文（type 9 / 10002 等新版文章），回退到
 *      cgiDataNew.content_noencode 的 JS 变量解码路径。
 */
export async function fetchWechatArticle(
  url: string,
  options: { includeImages?: boolean; maxLength?: number } = {}
): Promise<FetchResult> {
  if (!url || typeof url !== "string") {
    return { error: "URL 不能为空", url };
  }
  if (!url.includes("mp.weixin.qq.com")) {
    return { error: "仅支持 mp.weixin.qq.com 域名的微信文章链接", url };
  }

  const includeImages = options.includeImages !== false;
  const maxLength = options.maxLength ?? 20_000;

  // 第一次：桌面 UA
  let html = await httpGet(url, UA_DESKTOP);
  if (!html || html.length < 500) {
    // 第二次：移动 UA，部分新型文章仅对移动 UA 渲染完整正文
    html = await httpGet(url, UA_MOBILE);
  }

  if (!html) {
    return { error: "请求失败：网络错误或文章需要登录", url };
  }

  // 先试"标准 js_content"路径
  let parsed = parseStandardHtml(html);
  if (!parsed) {
    // 回退到 cgiDataNew.content_noencode 路径（type 9 文章）
    parsed = parseCgiDataNewHtml(html);
  }

  if (!parsed) {
    if (/关注后查看|关注公众号/.test(html)) {
      return { error: "该文章需要关注公众号后才能查看完整内容", url };
    }
    return { error: "无法提取文章正文，页面结构可能已变化", url };
  }

  const content = includeImages ? parsed.content : stripImages(parsed.content);

  return {
    title: parsed.title || "未知标题",
    author: parsed.author || "未知公众号",
    content: tidy(content, maxLength),
    cover: parsed.cover,
    url,
    publishTime: parsed.publishTime,
  };
}

async function httpGet(url: string, ua: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": ACCEPT_LANG,
      },
      // 30s 超时，参考 Python 版本
      signal: AbortSignal.timeout(30_000),
      redirect: "follow",
    });
    if (resp.status === 404) return null;
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    return new TextDecoder("utf-8").decode(buf);
  } catch {
    return null;
  }
}

interface ParsedArticle {
  title: string;
  author: string;
  content: string;
  cover?: string;
  publishTime?: string;
}

function parseStandardHtml(html: string): ParsedArticle | null {
  const title = matchOne(html, [
    /var\s+msg_title\s*=\s*["'](.+?)["']/,
    /property="og:title"\s+content="([^"]+)"/,
    /id="activity-name"[^>]*>([\s\S]*?)<\/h\d>/,
  ]);

  const author = matchOne(html, [
    /var\s+nickname\s*=\s*["'](.+?)["']/,
    /class="profile_nickname"[^>]*>([\s\S]*?)<\/strong>/,
  ]);

  // 封面图
  const coverMatch = html.match(/msg_cdn_url\s*=\s*["']*(https?:\/\/mmbiz[^"'\s,;)]+)/);
  const cover = coverMatch?.[1];

  // 发布时间
  const ctMatch = html.match(/create_time\s*[=:]\s*["']?(\d{10,13})["']?/);
  const publishTime = ctMatch?.[1] ? normalizeTime(Number(ctMatch[1])) : undefined;

  // 正文
  const articleHtml = extractArticleHtml(html);
  if (!articleHtml) return null;

  // 收集图片（HTML 内嵌 + JS 变量两种来源）
  const images = collectImages(html, articleHtml);

  // 验证：必须有可读中文（>100 字）才算解析成功
  const md = htmlToMarkdown(articleHtml);
  if (!/[㐀-鿿]/.test(md) || md.replace(/\s/g, "").length < 100) return null;

  let content = md;
  // 新版文章图片不在 HTML 里，追加到末尾
  const jsOnlyImgs = images.filter((i) => i.index > 0);
  const existingImgs = (content.match(/!\[图片\]/g) || []).length;
  if (jsOnlyImgs.length && existingImgs === 0) {
    content += "\n\n---\n**文章图片：**\n\n";
    jsOnlyImgs.forEach((img, i) => {
      content += `![图片${i + 1}](${img.url})\n\n`;
    });
  }

  return {
    title: title ? unescapeHtml(title) : "",
    author: author ? unescapeHtml(author) : "",
    content,
    cover,
    publishTime,
  };
}

function parseCgiDataNewHtml(html: string): ParsedArticle | null {
  const key = "content_noencode: '";
  const idx = html.indexOf(key);
  if (idx < 0) return null;

  const start = idx + key.length;
  // 扫描未转义的单引号结束符
  let end = -1;
  let pos = start;
  while (true) {
    const q = html.indexOf("'", pos);
    if (q < 0) break;
    let bs = 0;
    let j = q - 1;
    while (j >= 0 && html[j] === "\\") {
      bs++;
      j--;
    }
    if (bs % 2 === 0) {
      end = q;
      break;
    }
    pos = q + 1;
  }
  if (end <= 0) return null;

  let raw = html.slice(start, end);
  raw = raw.replace(/\\'/g, "'");
  raw = raw.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  raw = raw.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  if (raw.includes("\\u")) {
    raw = Buffer.from(raw, "latin1")
      .toString("utf8")
      // 反向：先用 latin1 把 unicode escape 还原
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
        String.fromCodePoint(parseInt(h, 16))
      );
  }
  let text = raw.replace(/<[^>]+>/g, "\n");
  text = unescapeHtml(text);
  text = text.replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  const chineseCount = (text.match(/[㐀-鿿]/g) || []).length;
  if (chineseCount < 100) return null;

  const title = matchOne(html, [
    /window\.title\s*=\s*'([^']+)'/,
    /title:\s*['"]([^'"]+)['"]/,
    /property="og:title"\s+content="([^"]+)"/,
  ]) || "";

  const author = matchOne(html, [
    /nick_name:\s*['"]([^'"]+)['"]/,
    /var\s+nickname\s*=\s*["'](.+?)["']/,
  ]) || "";

  const ct = matchOne(html, [/create_time:\s*['"](\d+)['"]/]);
  const publishTime = ct ? normalizeTime(Number(ct)) : undefined;

  return {
    title: title ? unescapeHtml(title) : "",
    author: author ? unescapeHtml(author) : "",
    content: text,
    publishTime,
  };
}

function extractArticleHtml(html: string): string {
  let m = html.match(/id="js_content"[^>]*>([\s\S]*?)<\/div>\s*(?:<script|<div\s+class="rich_media_tool)/);
  if (m) return m[1];
  m = html.match(/class="rich_media_content"[^>]*>([\s\S]*?)<\/div>\s*(?:<script|<div\s+class="rich_media_tool)/);
  if (m) return m[1];
  return "";
}

function collectImages(html: string, articleHtml: string): { url: string; index: number }[] {
  const seen = new Set<string>();
  const result: { url: string; index: number }[] = [];

  // 来源 1：JS 变量 cdn_url_N_N
  for (const m of html.matchAll(/cdn_url_(\d+)_(\d+)\s*=\s*["']*(https?:\/\/mmbiz[^"'\s,;)]+)/g)) {
    const url = m[3];
    if (!seen.has(url)) {
      seen.add(url);
      result.push({ url, index: Number(m[1]) });
    }
  }

  // 来源 2：HTML img 标签
  for (const m of articleHtml.matchAll(/<img\b[^>]+>/gi)) {
    const tag = m[0];
    const ds = tag.match(/data-src="([^"]+)"/);
    const src = tag.match(/(?<!data-)\bsrc="([^"]+)"/);
    const url = ds?.[1] || src?.[1];
    if (url && url.includes("mmbiz") && !seen.has(url)) {
      seen.add(url);
      result.push({ url, index: 0 });
    }
  }

  return result.sort((a, b) => a.index - b.index);
}

function stripImages(md: string): string {
  return md.replace(/!\[[^\]]*\]\([^)]+\)/g, "").replace(/\n{3,}/g, "\n\n");
}

function matchOne(html: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/'/g, "'");
}

function normalizeTime(ts: number): string {
  // 微信有时返回秒级、有时毫秒级
  const ms = ts < 1e12 ? ts * 1000 : ts;
  try {
    return new Date(ms).toISOString();
  } catch {
    return String(ts);
  }
}
