/**
 * HTML → Markdown conversion for WeChat article content.
 * Pure-function: no network, no side effects, easy to test.
 */

const BLOCK_TAGS = new Set([
  "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
  "li", "blockquote", "pre", "section", "article"
]);

export function htmlToMarkdown(html: string): string {
  let s = html;

  // 处理图片：提取 data-src 或 src
  s = s.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const ds = imgTag.match(/data-src="([^"]+)"/i);
    const src = imgTag.match(/\ssrc="([^"]+)"/i);
    const url = ds?.[1] || src?.[1];
    return url ? `\n![图片](${decodeEntities(url)})\n` : "";
  });

  // 处理链接
  s = s.replace(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    if (!text) return "";
    if (href && href.startsWith("http")) {
      return `[${text}](${decodeEntities(href)})`;
    }
    return text;
  });

  // 处理粗体和斜体
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, inner) => `**${inner.replace(/<[^>]+>/g, "")}**`);
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, inner) => `*${inner.replace(/<[^>]+>/g, "")}*`);

  // 标题（JS 正则的 backreference 必须显式拼出前缀，不能用 <\/\1>）
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    return `\n\n${"#".repeat(Number(level))} ${text}\n\n`;
  });

  // 列表
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    return `\n- ${text}`;
  });

  // 引用
  s = s.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    return `\n> ${text.replace(/\n/g, "\n> ")}\n`;
  });

  // 段落 / 块级元素 → 双换行
  s = s.replace(/<(p|div|section|article)\b[^>]*>/gi, "\n\n");
  s = s.replace(/<\/(p|div|section|article)>/gi, "");

  // 显式换行
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // 移除所有剩余标签
  s = s.replace(/<[^>]+>/g, "");

  // 实体解码
  s = decodeEntities(s);

  // 空白整理
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/\r/g, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * Decode the most common HTML entities without pulling a heavyweight dep.
 * For anything fancier we'd reach for `he` or `entities`, but WeChat content
 * rarely uses anything outside this set.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/'/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/**
 * 兜底清理：去掉微信文章特有的内联样式/类名残留。
 */
export function tidy(md: string, maxLength = 20_000): string {
  let out = md;
  // 微信特有的"阅读原文"角标（容忍其前后空白与换行）
  out = out.replace(/\s*阅读原文\s*$/u, "").trimEnd();
  // 控制长度
  if (out.length > maxLength) {
    out = out.slice(0, maxLength) + "\n\n…（内容已截断，原始文章更长）";
  }
  return out;
}

// 让 BLOCK_TAGS 不被 unused warning 干掉
export const _BLOCK_TAGS = BLOCK_TAGS;
