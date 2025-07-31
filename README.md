# MCP Server for Crawl4AI

TypeScript implementation of an MCP server for Crawl4AI. Provides tools for web crawling, content extraction, and browser automation.

## Prerequisites

- Node.js 16+ and npm
- A running Crawl4AI server

## Quick Start

### Option 1: Using npx (Recommended)

```bash
# 1. Start the Crawl4AI server
docker run -d -p 11235:11235 --name crawl4ai --shm-size=1g unclecode/crawl4ai:latest

# 2. Run the MCP server directly (no installation needed)
CRAWL4AI_BASE_URL=http://localhost:11235 npx mcp-crawl4ai-ts

# 3. Add to your MCP client (see Usage section)
```

### Option 2: Clone Repository

```bash
# 1. Start the Crawl4AI server
docker run -d -p 11235:11235 --name crawl4ai --shm-size=1g unclecode/crawl4ai:latest

# 2. Install MCP server
git clone https://github.com/omgwtfwow/mcp-crawl4ai-ts.git
cd mcp-crawl4ai-ts
npm install
cp .env.example .env
npm run build

# 3. Add to your MCP client (see Usage section)
```

## Features

- **Core Tools**: Web crawling, screenshots, PDF generation, JavaScript execution
- **Smart Tools**: Auto-detect content types (HTML/sitemap/RSS), recursive crawling, link analysis
- **Advanced**: Custom headers, cache control, batch processing, URL filtering

## Configuration

```env
# Required
CRAWL4AI_BASE_URL=http://localhost:11235

# Optional
CRAWL4AI_API_KEY=          # If your server requires auth
SERVER_NAME=crawl4ai-mcp   # Custom name
SERVER_VERSION=1.0.0       # Custom version
```

## Usage

This MCP server works with any MCP-compatible client (Claude Desktop, Claude Code, Cursor, LMStudio, etc.).

### Configuration Examples

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

### Client-Specific Instructions

#### Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`

#### Claude Code
```bash
claude mcp add crawl4ai -e CRAWL4AI_BASE_URL=http://localhost:11235 -- npx mcp-crawl4ai-ts
```

#### Other MCP Clients
Consult your client's documentation for MCP server configuration. The key details:
- Command: `npx mcp-crawl4ai-ts` or `node /path/to/dist/index.js`
- Required env: `CRAWL4AI_BASE_URL`
- Optional env: `CRAWL4AI_API_KEY`, `SERVER_NAME`, `SERVER_VERSION`

## Available Tools

### 1. `crawl_page` - Extract markdown with filters
```typescript
{ url: string, remove_images?: boolean, bypass_cache?: boolean, 
  filter_mode?: 'blacklist'|'whitelist', filter_list?: string[],
  screenshot?: boolean, wait_for?: string, timeout?: number }
```

### 2. `capture_screenshot` - Full-page screenshots
```typescript
{ url: string, full_page?: boolean, wait_for?: string, timeout?: number }
```

### 3. `generate_pdf` - Convert to PDF
```typescript
{ url: string, wait_for?: string, timeout?: number }
```

### 4. `execute_js` - Run JS before crawling
```typescript
{ url: string, js_code: string, wait_after_js?: number, screenshot?: boolean }
```

### 5. `batch_crawl` - Parallel processing
```typescript
{ urls: string[], max_concurrent?: number, remove_images?: boolean, bypass_cache?: boolean }
```

### 6. `smart_crawl` - Auto-detect content type
```typescript
{ url: string, max_depth?: number, follow_links?: boolean, bypass_cache?: boolean }
```

### 7. `get_html` - Raw HTML extraction
```typescript
{ url: string, wait_for?: string, bypass_cache?: boolean }
```

### 8. `extract_links` - Analyze all links
```typescript
{ url: string, categorize?: boolean }  // Returns internal/external/social/etc
```

### 9. `crawl_recursive` - Deep site crawling
```typescript
{ url: string, max_depth?: number, max_pages?: number, 
  include_pattern?: string, exclude_pattern?: string }
```

### 10. `parse_sitemap` - Extract URLs from sitemap
```typescript
{ url: string, filter_pattern?: string }
```

### 11. `crawl_with_config` - Advanced options
```typescript
{ url: string, cache_mode?: string, headers?: Record<string,string>,
  wait_until?: string, exclude_tags?: string[], include_links?: boolean }
```

## Development

```bash
npm run dev    # Development mode
npm test       # Run tests
npm run lint   # Check code quality
npm run build  # Production build
```

## License

MIT