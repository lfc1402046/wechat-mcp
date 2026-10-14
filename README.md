# wechat-mcp

> **Read WeChat Official Account articles directly in Claude Code / Cursor / Windsurf.**
> One config line. Zero API keys. Works in every MCP-compatible client.

<p align="center">
  <a href="https://github.com/lfc1402046/wechat-mcp/stargazers"><img src="https://img.shields.io/github/stars/lfc1402046/wechat-mcp?style=flat-square" alt="stars"/></a>
  <a href="https://www.npmjs.com/package/wechat-mcp"><img src="https://img.shields.io/npm/v/wechat-mcp?style=flat-square" alt="npm"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/lfc1402046/wechat-mcp?style=flat-square" alt="MIT"/></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-1.0-blueviolet?style=flat-square" alt="MCP"/></a>
</p>

[English](#english) · [中文](#中文)

---

## 中文

### 这是什么？

**wechat-mcp** 是一个 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server，让任意 MCP 兼容的 AI 客户端（Claude Code、Claude Desktop、Cursor、Windsurf、Cline 等）**直接读取微信公众号文章**。

为什么需要它？微信公众号的 `robots.txt` 禁止了自动化访问，`fetch_web`、`curl` 默认情况下都拿不到 `mp.weixin.qq.com` 下的文章正文。wechat-mcp 绕过这个限制，把文章转成结构化 Markdown 直接喂给你的 AI。

### ✨ 5 秒演示

把下面这段贴进 Claude Code：

```
帮我总结一下这篇文章：https://mp.weixin.qq.com/s/xxxxxxxxxxxxx
```

Claude Code 自动调用 `read_wechat_article` 工具 → 返回标题、作者、正文 → 总结给你。

### 🚀 安装

#### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）
或 `%APPDATA%\Claude\claude_desktop_config.json`（Windows）：

```json
{
  "mcpServers": {
    "wechat": {
      "command": "npx",
      "args": ["-y", "wechat-mcp"]
    }
  }
}
```

重启 Claude Desktop。搞定。

#### Cursor

`~/.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "wechat": {
      "command": "npx",
      "args": ["-y", "wechat-mcp"]
    }
  }
}
```

#### Claude Code (CLI)

`~/.claude.json` 或项目内 `.claude/settings.json`：

```json
{
  "mcpServers": {
    "wechat": {
      "command": "npx",
      "args": ["-y", "wechat-mcp"]
    }
  }
}
```

### 🛠 工具

#### `read_wechat_article`

读取一篇微信文章并返回 Markdown。

**输入：**
- `url` (string, 必填) — mp.weixin.qq.com 域名的微信文章 URL
- `include_images` (boolean, 默认 true) — 是否包含内联图片
- `max_length` (number, 默认 20000) — 返回内容的最大字符数

**输出：** 标题 / 作者 / 发布时间 / 封面图（可选）/ Markdown 正文

#### `read_multiple_wechat_articles`

批量读取最多 10 篇文章。

**输入：**
- `urls` (string[], 必填, 1-10 项) — URL 列表

### 🔍 它怎么绕过 robots.txt？

微信公众号对 `fetch`/`curl` 默认 UA 返回降级 HTML，且 `robots.txt` 声明禁爬。wechat-mcp 通过模拟桌面 Chrome UA 直接发 HTTP 请求拿原始 HTML，再用两套解析器兜底：

1. **标准路径**：从 `js_content` div 提取正文 + 处理内嵌图片
2. **新版文章路径**：从 JS 变量 `cgiDataNew.content_noencode` 解码（处理 type 9 / 10002 文章）

两套都拿不到时返回结构化错误（404、需关注公众号、登录墙）。

### 💾 缓存

默认 30 分钟 TTL，进程内最多缓存 200 篇文章。同 URL 重复调用直接命中缓存，不会反复打微信服务器。

### 🧩 兼容性

- Node.js ≥ 18
- MCP SDK ≥ 1.0
- Claude Code / Claude Desktop / Cursor / Windsurf / Cline / 任意 stdio MCP 客户端

### 🚧 边界与限制

- 不支持需要登录/付费的会员文章
- 不支持视频号内容（仅图文文章）
- 不支持已被删除/违规下架的文章
- 高频调用建议加你自己的节流层

### 🗺 路线图

- [ ] 知乎文章 Provider（同样的"读不到"痛点）
- [ ] CSDN / 掘金 Provider
- [ ] 微信公众号 RSS 监控模式（定时拉取更新）
- [ ] 多账号 cookie 池（突破登录墙）

### 🤝 贡献

欢迎 PR！思路：

1. 新增 Provider：在 `src/providers/` 下实现 `fetch(url) => Markdown` 接口
2. 新增 MCP 工具：在 `server.ts` 注册 + 在 README 文档化
3. 修复微信页面结构变化：跑一下 `pnpm test`，附上原文链接

### 📜 License

MIT © 2026 lfc1402046

---

## English

**wechat-mcp** is a [Model Context Protocol](https://modelcontextprotocol.io) server that lets any MCP-compatible AI client (Claude Code, Claude Desktop, Cursor, Windsurf, Cline, …) read WeChat Official Account articles directly.

Why? WeChat's `robots.txt` blocks automated access, and `fetch`/`curl` cannot reach `mp.weixin.qq.com` by default. wechat-mcp bypasses this and returns the article as clean Markdown.

### Install

Add this to your MCP client config:

```json
{
  "mcpServers": {
    "wechat": {
      "command": "npx",
      "args": ["-y", "wechat-mcp"]
    }
  }
}
```

That's it. Restart the client and ask your AI to read any `mp.weixin.qq.com` URL.

### Tools

- `read_wechat_article` — read one article, return Markdown
- `read_multiple_wechat_articles` — batch up to 10 URLs

### License

MIT
