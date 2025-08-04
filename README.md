# MCP Server for Crawl4AI

[![npm version](https://img.shields.io/npm/v/mcp-crawl4ai-ts.svg)](https://www.npmjs.com/package/mcp-crawl4ai-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fgist.githubusercontent.com%2Fomgwtfwow%2Fe2abffb0deb25afa2bf9185f440dae81%2Fraw%2Fcoverage.json)](https://omgwtfwow.github.io/mcp-crawl4ai-ts/coverage/)

TypeScript implementation of an MCP server for Crawl4AI. Provides tools for web crawling, content extraction, and browser automation.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Client-Specific Instructions](#client-specific-instructions)
- [Available Tools](#available-tools)
  - [1. get_markdown](#1-get_markdown---extract-content-as-markdown-with-filtering)
  - [2. capture_screenshot](#2-capture_screenshot---capture-webpage-screenshot)
  - [3. generate_pdf](#3-generate_pdf---convert-webpage-to-pdf)
  - [4. execute_js](#4-execute_js---execute-javascript-and-get-return-values)
  - [5. batch_crawl](#5-batch_crawl---crawl-multiple-urls-concurrently)
  - [6. smart_crawl](#6-smart_crawl---auto-detect-and-handle-different-content-types)
  - [7. get_html](#7-get_html---get-sanitized-html-for-analysis)
  - [8. extract_links](#8-extract_links---extract-and-categorize-page-links)
  - [9. crawl_recursive](#9-crawl_recursive---deep-crawl-website-following-links)
  - [10. parse_sitemap](#10-parse_sitemap---extract-urls-from-xml-sitemaps)
  - [11. crawl](#11-crawl---advanced-web-crawling-with-full-configuration)
  - [12. create_session](#12-create_session---create-persistent-browser-session)
  - [13. clear_session](#13-clear_session---remove-session-from-tracking)
  - [14. list_sessions](#14-list_sessions---list-tracked-browser-sessions)
  - [15. extract_with_llm](#15-extract_with_llm---extract-structured-data-using-ai)
- [Advanced Configuration](#advanced-configuration)
- [Development](#development)
- [License](#license)

## Prerequisites

- Node.js 18+ and npm
- A running Crawl4AI server

## Quick Start

### 1. Start the Crawl4AI server (for example, local docker)

```bash
docker run -d -p 11235:11235 --name crawl4ai --shm-size=1g unclecode/crawl4ai:0.7.2
```

> **Note:** Tested with Crawl4AI version 0.7.2

### 2. Add to your MCP client

This MCP server works with any MCP-compatible client (Claude Desktop, Claude Code, Cursor, LMStudio, etc.).

#### Using npx (Recommended)

```json
{
  "mcpServers": {
    "crawl4ai": {
      "command": "npx",
      "args": ["mcp-crawl4ai-ts"],
      "env": {
        "CRAWL4AI_BASE_URL": "http://localhost:11235"
      }
    }
  }
}
```

#### Using local installation

```json
{
  "mcpServers": {
    "crawl4ai": {
      "command": "node",
      "args": ["/path/to/mcp-crawl4ai-ts/dist/index.js"],
      "env": {
        "CRAWL4AI_BASE_URL": "http://localhost:11235"
      }
    }
  }
}
```

#### With all optional variables

```json
{
  "mcpServers": {
    "crawl4ai": {
      "command": "npx",
      "args": ["mcp-crawl4ai-ts"],
      "env": {
        "CRAWL4AI_BASE_URL": "http://localhost:11235",
        "CRAWL4AI_API_KEY": "your-api-key",
        "SERVER_NAME": "custom-name",
        "SERVER_VERSION": "1.0.0"
      }
    }
  }
}
```

## Configuration

### Environment Variables

```env
# Required
CRAWL4AI_BASE_URL=http://localhost:11235

# Optional - Server Configuration
CRAWL4AI_API_KEY=          # If your server requires auth
SERVER_NAME=crawl4ai-mcp   # Custom name for the MCP server
SERVER_VERSION=1.0.0       # Custom version
```

## Client-Specific Instructions

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`

### Claude Code

```bash
claude mcp add crawl4ai -e CRAWL4AI_BASE_URL=http://localhost:11235 -- npx mcp-crawl4ai-ts
```

### Other MCP Clients

Consult your client's documentation for MCP server configuration. The key details:

- **Command**: `npx mcp-crawl4ai-ts` or `node /path/to/dist/index.js`
- **Required env**: `CRAWL4AI_BASE_URL`
- **Optional env**: `CRAWL4AI_API_KEY`, `SERVER_NAME`, `SERVER_VERSION`

## Available Tools

### 1. `get_markdown` - Extract content as markdown with filtering

```typescript
{ 
  url: string,                              // Required: URL to extract markdown from
  filter?: 'raw'|'fit'|'bm25'|'llm',       // Filter type (default: 'fit')
  query?: string,                           // Query for bm25/llm filters
  cache?: string                            // Cache-bust parameter (default: '0')
}
```

Extracts content as markdown with various filtering options. Use 'bm25' or 'llm' filters with a query for specific content extraction.

### 2. `capture_screenshot` - Capture webpage screenshot

```typescript
{ 
  url: string,                   // Required: URL to capture
  screenshot_wait_for?: number   // Seconds to wait before screenshot (default: 2)
}
```

Returns base64-encoded PNG. Note: This is stateless - for screenshots after JS execution, use `crawl` with `screenshot: true`.

### 3. `generate_pdf` - Convert webpage to PDF

```typescript
{ 
  url: string  // Required: URL to convert to PDF
}
```

Returns base64-encoded PDF. Stateless tool - for PDFs after JS execution, use `crawl` with `pdf: true`.

### 4. `execute_js` - Execute JavaScript and get return values

```typescript
{ 
  url: string,                    // Required: URL to load
  scripts: string | string[]      // Required: JavaScript to execute
}
```

Executes JavaScript and returns results. Each script can use 'return' to get values back. Stateless - for persistent JS execution use `crawl` with `js_code`.

### 5. `batch_crawl` - Crawl multiple URLs concurrently

```typescript
{ 
  urls: string[],           // Required: List of URLs to crawl
  max_concurrent?: number,  // Parallel request limit (default: 5)
  remove_images?: boolean,  // Remove images from output (default: false)
  bypass_cache?: boolean    // Bypass cache for all URLs (default: false)
}
```

Efficiently crawls multiple URLs in parallel. Each URL gets a fresh browser instance.

### 6. `smart_crawl` - Auto-detect and handle different content types

```typescript
{ 
  url: string,            // Required: URL to crawl
  max_depth?: number,     // Maximum depth for recursive crawling (default: 2)
  follow_links?: boolean, // Follow links in content (default: true)
  bypass_cache?: boolean  // Bypass cache (default: false)
}
```

Intelligently detects content type (HTML/sitemap/RSS) and processes accordingly.

### 7. `get_html` - Get sanitized HTML for analysis

```typescript
{ 
  url: string  // Required: URL to extract HTML from
}
```

Returns preprocessed HTML optimized for structure analysis. Use for building schemas or analyzing patterns.

### 8. `extract_links` - Extract and categorize page links

```typescript
{ 
  url: string,          // Required: URL to extract links from
  categorize?: boolean  // Group by type (default: true)
}
```

Extracts all links and groups them by type: internal, external, social media, documents, images.

### 9. `crawl_recursive` - Deep crawl website following links

```typescript
{ 
  url: string,              // Required: Starting URL
  max_depth?: number,       // Maximum depth to crawl (default: 3)
  max_pages?: number,       // Maximum pages to crawl (default: 50)
  include_pattern?: string, // Regex pattern for URLs to include
  exclude_pattern?: string  // Regex pattern for URLs to exclude
}
```

Crawls a website following internal links up to specified depth. Returns content from all discovered pages.

### 10. `parse_sitemap` - Extract URLs from XML sitemaps

```typescript
{ 
  url: string,              // Required: Sitemap URL (e.g., /sitemap.xml)
  filter_pattern?: string   // Optional: Regex pattern to filter URLs
}
```

Extracts all URLs from XML sitemaps. Supports regex filtering for specific URL patterns.

### 11. `crawl` - Advanced web crawling with full configuration

```typescript
{
  url: string,                              // URL to crawl
  // Browser Configuration
  browser_type?: 'chromium'|'firefox'|'webkit',  // Browser engine
  viewport_width?: number,                  // Browser width (default: 1080)
  viewport_height?: number,                 // Browser height (default: 600)
  user_agent?: string,                      // Custom user agent
  proxy_server?: string,                    // Proxy URL
  proxy_username?: string,                  // Proxy auth
  proxy_password?: string,                  // Proxy password
  cookies?: Array<{name, value, domain}>,   // Pre-set cookies
  headers?: Record<string,string>,          // Custom headers
  
  // Crawler Configuration
  word_count_threshold?: number,            // Min words per block (default: 200)
  excluded_tags?: string[],                 // HTML tags to exclude
  remove_overlay_elements?: boolean,        // Remove popups/modals
  js_code?: string | string[],              // JavaScript to execute
  wait_for?: string,                        // Wait condition (selector or JS)
  wait_for_timeout?: number,                // Wait timeout (default: 30000)
  delay_before_scroll?: number,             // Pre-scroll delay
  scroll_delay?: number,                    // Between-scroll delay
  process_iframes?: boolean,                // Include iframe content
  exclude_external_links?: boolean,         // Remove external links
  screenshot?: boolean,                     // Capture screenshot
  pdf?: boolean,                           // Generate PDF
  session_id?: string,                      // Reuse browser session (only works with crawl tool)
  cache_mode?: 'ENABLED'|'BYPASS'|'DISABLED',  // Cache control
  extraction_type?: 'llm',                  // Only 'llm' extraction is supported via REST API
  extraction_schema?: object,               // Schema for structured extraction
  extraction_instruction?: string,          // Natural language extraction prompt
  timeout?: number,                         // Overall timeout (default: 60000)
  verbose?: boolean                         // Detailed logging
}
```

### 12. `create_session` - Create persistent browser session

```typescript
{ 
  session_id?: string,                            // Optional: Custom ID (auto-generated if not provided)
  initial_url?: string,                           // Optional: URL to load when creating session
  browser_type?: 'chromium'|'firefox'|'webkit'   // Optional: Browser engine (default: 'chromium')
}
```

Creates a persistent browser session for maintaining state across multiple requests. Returns the session_id for use with the `crawl` tool.

**Important**: Only the `crawl` tool supports session_id. Other tools are stateless and create new browsers each time.

### 13. `clear_session` - Remove session from tracking

```typescript
{ session_id: string }
```

Removes session from local tracking. Note: The actual browser session on the server persists until timeout.

### 14. `list_sessions` - List tracked browser sessions

```typescript
{}  // No parameters required
```

Returns all locally tracked sessions with creation time, last used time, and initial URL. Note: These are session references - actual server state may differ.

### 15. `extract_with_llm` - Extract structured data using AI

```typescript
{ 
  url: string,          // URL to extract data from
  query: string         // Natural language extraction instructions
}
```

Uses AI to extract structured data from webpages. Returns results immediately without any polling or job management. This is the recommended way to extract specific information since CSS/XPath extraction is not supported via the REST API.

## Advanced Configuration

For detailed information about all available configuration options, extraction strategies, and advanced features, please refer to the official Crawl4AI documentation:

- [Crawl4AI Documentation](https://docs.crawl4ai.com/)
- [Crawl4AI GitHub Repository](https://github.com/unclecode/crawl4ai)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and recent updates.

## Development

### Setup

```bash
# 1. Start the Crawl4AI server
docker run -d -p 11235:11235 --name crawl4ai --shm-size=1g unclecode/crawl4ai:latest

# 2. Install MCP server
git clone https://github.com/omgwtfwow/mcp-crawl4ai-ts.git
cd mcp-crawl4ai-ts
npm install
cp .env.example .env

# 3. Development commands
npm run dev    # Development mode
npm test       # Run tests
npm run lint   # Check code quality
npm run build  # Production build

# 4. Add to your MCP client (See "Using local installation")
```

### Running Integration Tests

Integration tests require a running Crawl4AI server. Configure your environment:

```bash
# Required for integration tests
export CRAWL4AI_BASE_URL=http://localhost:11235
export CRAWL4AI_API_KEY=your-api-key  # If authentication is required

# Optional: For LLM extraction tests
export LLM_PROVIDER=openai/gpt-4o-mini
export LLM_API_TOKEN=your-llm-api-key
export LLM_BASE_URL=https://api.openai.com/v1  # If using custom endpoint

# Run integration tests
npm run test:integration
```

Integration tests cover:

- Dynamic content and JavaScript execution
- Session management and cookies
- Content extraction (LLM-based only)
- Media handling (screenshots, PDFs)
- Performance and caching
- Content filtering
- Bot detection avoidance
- Error handling

## License

MIT