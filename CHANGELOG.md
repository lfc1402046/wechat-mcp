# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-14

### Added

- 初始发布 🎉
- `read_wechat_article` MCP 工具：单篇文章读取
- `read_multiple_wechat_articles` MCP 工具：批量读取（最多 10 篇）
- 30 分钟 TTL 内存缓存（最多 200 条）
- 两套解析器兜底：
  - 标准 `js_content` 路径
  - 新版文章 `cgiDataNew.content_noencode` 路径（type 9 / 10002）
- HTML→Markdown 转换：图片（data-src 优先）、链接、粗体、斜体、标题、列表、引用、HTML 实体
- 支持 Claude Code / Claude Desktop / Cursor / Windsurf / Cline 等任意 stdio MCP 客户端
- 15 个单元测试全部通过（markdown 转换 + 缓存逻辑）
- GitHub Issue / Feature 模板
