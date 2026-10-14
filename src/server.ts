#!/usr/bin/env node
/**
 * wechat-mcp — MCP server that lets Claude Code / Cursor / Windsurf
 * read WeChat Official Account (mp.weixin.qq.com) articles.
 *
 * Usage (stdio transport):
 *   wechat-mcp            # via `npx wechat-mcp` after install
 *   node dist/server.js   # direct
 *
 * Configure your MCP client:
 *   Claude Desktop:  see examples/claude-desktop-config.json
 *   Cursor:          see examples/cursor-mcp.json
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { fetchWechatArticle } from "./wechat-fetcher.js";
import { globalCache } from "./cache.js";
import { isError, type ReadArticleInput, type ReadMultipleArticlesInput } from "./types.js";

const SERVER_NAME = "wechat-mcp";
const SERVER_VERSION = "0.1.0";

const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool 注册 ────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_wechat_article",
      description:
        "Read a WeChat Official Account (mp.weixin.qq.com) article and return its title, author and Markdown body. Use this whenever the user shares a mp.weixin.qq.com URL or asks you to summarize/read a WeChat article. Returns up to 20,000 chars by default.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "WeChat article URL (must be mp.weixin.qq.com)",
          },
          include_images: {
            type: "boolean",
            description: "Include inline images in the Markdown (default true)",
            default: true,
          },
          max_length: {
            type: "number",
            description: "Max characters in the returned content (default 20000)",
            default: 20000,
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
    {
      name: "read_multiple_wechat_articles",
      description:
        "Read up to 10 WeChat articles at once and return each as Markdown. Use when the user provides a batch of URLs (e.g. from a list they want summarized).",
      inputSchema: {
        type: "object",
        properties: {
          urls: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 10,
            description: "List of WeChat article URLs (each must be mp.weixin.qq.com)",
          },
        },
        required: ["urls"],
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "read_wechat_article":
        return await handleReadArticle(args as unknown as ReadArticleInput);
      case "read_multiple_wechat_articles":
        return await handleReadMultiple(args as unknown as ReadMultipleArticlesInput);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `Internal error: ${msg}` }],
    };
  }
});

// ─── Tool 实现 ────────────────────────────────────────────────

async function handleReadArticle(input: ReadArticleInput) {
  if (!input?.url || typeof input.url !== "string") {
    return errorResult("缺少必填参数 url");
  }

  // 缓存命中
  const cached = globalCache.get(input.url);
  if (cached) {
    return formatSingleResult(cached);
  }

  const result = await fetchWechatArticle(input.url, {
    includeImages: input.include_images,
    maxLength: input.max_length,
  });

  globalCache.set(input.url, result);
  return formatSingleResult(result);
}

async function handleReadMultiple(input: ReadMultipleArticlesInput) {
  if (!input?.urls || !Array.isArray(input.urls) || input.urls.length === 0) {
    return errorResult("缺少必填参数 urls");
  }
  if (input.urls.length > 10) {
    return errorResult("单次最多 10 个 URL");
  }

  const parts: string[] = [];
  for (const url of input.urls) {
    let r = globalCache.get(url);
    if (!r) {
      r = await fetchWechatArticle(url);
      globalCache.set(url, r);
    }
    parts.push(formatForBatch(r));
  }

  return {
    content: [
      {
        type: "text",
        text: parts.join("\n\n---\n\n"),
      },
    ],
  };
}

// ─── 格式化 ────────────────────────────────────────────────

function formatSingleResult(r: Awaited<ReturnType<typeof fetchWechatArticle>>) {
  if (isError(r)) {
    return errorResult(r.error);
  }
  const header = [`# ${r.title}`, `作者：${r.author}`];
  if (r.publishTime) header.push(`发布时间：${r.publishTime}`);
  if (r.cover) header.push(`封面：![封面](${r.cover})`);
  const text = [...header, "", r.content].join("\n");
  return {
    content: [{ type: "text", text }],
  };
}

function formatForBatch(r: Awaited<ReturnType<typeof fetchWechatArticle>>): string {
  if (isError(r)) {
    return `❌ ${r.url}\n${r.error}`;
  }
  return [
    `📄 ${r.title}`,
    `作者：${r.author}`,
    `链接：${r.url}`,
    "",
    r.content,
  ].join("\n");
}

function errorResult(msg: string) {
  return {
    isError: true,
    content: [{ type: "text", text: `❌ ${msg}` }],
  };
}

// ─── 启动 ────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio 是基于行的日志，写到 stderr 避免污染 JSON-RPC 流
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started (stdio transport)`);
  console.error(`Cache stats: ${JSON.stringify(globalCache.stats())}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
