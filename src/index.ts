#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { CrawlOptions, CrawlResult, JSExecuteOptions, BatchCrawlOptions } from './types.js';
import { Crawl4AIService } from './crawl4ai-service.js';

// Load environment variables
dotenv.config();

const CRAWL4AI_BASE_URL = process.env.CRAWL4AI_BASE_URL;
const CRAWL4AI_API_KEY = process.env.CRAWL4AI_API_KEY || '';
const SERVER_NAME = process.env.SERVER_NAME || 'crawl4ai-mcp';
const SERVER_VERSION = process.env.SERVER_VERSION || '1.0.0';

if (!CRAWL4AI_BASE_URL) {
  console.error('Error: CRAWL4AI_BASE_URL environment variable is required');
  console.error('Please set it to your Crawl4AI server URL (e.g., http://localhost:8080)');
  process.exit(1);
}

interface SessionInfo {
  id: string;
  created_at: Date;
  last_used: Date;
  initial_url?: string;
  metadata?: Record<string, any>;
}

class Crawl4AIServer {
  private server: Server;
  private axiosClient: AxiosInstance;
  private service: Crawl4AIService;
  private sessions: Map<string, SessionInfo> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Initialize axios client with API key
    this.axiosClient = axios.create({
      baseURL: CRAWL4AI_BASE_URL,
      headers: {
        'X-API-Key': CRAWL4AI_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes timeout
    });

    // Initialize the service
    this.service = new Crawl4AIService(CRAWL4AI_BASE_URL!, CRAWL4AI_API_KEY);

    this.setupHandlers();
  }

  private setupHandlers() {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'crawl_page',
          description:
            'Basic webpage crawling for clean markdown extraction. Use when: you need simple content without JavaScript, want to filter specific HTML tags, or need quick markdown conversion. Prefer crawl_with_config for advanced needs',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to crawl',
              },
              remove_images: {
                type: 'boolean',
                description: 'Remove images from the markdown output',
                default: false,
              },
              bypass_cache: {
                type: 'boolean',
                description: 'Bypass the cache and force a fresh crawl',
                default: false,
              },
              filter_mode: {
                type: 'string',
                enum: ['blacklist', 'whitelist'],
                description: 'Filter mode for tags',
              },
              filter_list: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of HTML tags to filter',
              },
              screenshot: {
                type: 'boolean',
                description: 'Include a screenshot',
                default: false,
              },
              wait_for: {
                type: 'string',
                description:
                  'Wait for element before extraction. Use CSS selector like ".content-loaded" or "#main-article". Ensures dynamic content is ready',
              },
              timeout: {
                type: 'number',
                description: 'Timeout in seconds',
                default: 30,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'capture_screenshot',
          description:
            'Capture webpage screenshots as PNG. Use when: documenting visual bugs, archiving page state, or needing visual confirmation. Returns base64-encoded image. For PDF use generate_pdf instead',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to capture',
              },
              full_page: {
                type: 'boolean',
                description: 'Capture the full page',
                default: true,
              },
              wait_for: {
                type: 'string',
                description: 'CSS selector to wait for before capturing',
              },
              timeout: {
                type: 'number',
                description: 'Timeout in seconds',
                default: 30,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'generate_pdf',
          description:
            'Convert webpages to PDF format. Use when: creating printable documents, archiving with exact layout, or generating reports. Returns base64-encoded PDF. Preserves CSS styling better than screenshots',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to convert to PDF',
              },
              wait_for: {
                type: 'string',
                description: 'CSS selector to wait for before generating PDF',
              },
              timeout: {
                type: 'number',
                description: 'Timeout in seconds',
                default: 30,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'execute_js',
          description:
            'Run JavaScript before extracting content. Use when: clicking "Load More" buttons, dismissing popups, scrolling to reveal content, or extracting from JS variables. Example: document.querySelector(".load-more").click()',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to load',
              },
              js_code: {
                type: 'string',
                description:
                  'JavaScript code as a STRING (required, NOT null). Pass exactly like this: js_code: "document.querySelectorAll(\'a\').length" to count links. For multiple commands use array: js_code: ["command1", "command2"]',
              },
              wait_after_js: {
                type: 'number',
                description: 'Time to wait after JS execution (ms)',
                default: 1000,
              },
              screenshot: {
                type: 'boolean',
                description: 'Take a screenshot after JS execution',
                default: false,
              },
            },
            required: ['url', 'js_code'],
          },
        },
        {
          name: 'batch_crawl',
          description:
            'Crawl multiple URLs concurrently for efficiency. Use when: processing URL lists, comparing multiple pages, or bulk data extraction. Faster than sequential crawling. Max 5 concurrent by default',
          inputSchema: {
            type: 'object',
            properties: {
              urls: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of URLs to crawl',
              },
              max_concurrent: {
                type: 'number',
                description:
                  'Parallel request limit. Higher = faster but more resource intensive. Adjust based on server capacity and rate limits',
                default: 5,
              },
              remove_images: {
                type: 'boolean',
                description: 'Remove images from markdown output',
                default: false,
              },
              bypass_cache: {
                type: 'boolean',
                description: 'Bypass cache for all URLs',
                default: false,
              },
            },
            required: ['urls'],
          },
        },
        {
          name: 'smart_crawl',
          description:
            'Auto-detect and handle different content types (HTML, sitemap, RSS, text). Use when: URL type is unknown, crawling feeds/sitemaps, or want automatic format handling. Adapts strategy based on content',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to crawl intelligently',
              },
              max_depth: {
                type: 'number',
                description: 'Maximum crawl depth for sitemaps',
                default: 2,
              },
              follow_links: {
                type: 'boolean',
                description: 'Follow links found in content',
                default: false,
              },
              bypass_cache: {
                type: 'boolean',
                description: 'Force fresh crawl',
                default: false,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'get_html',
          description:
            'Get raw HTML without processing. Use when: need full HTML structure, doing custom parsing, or debugging page issues. Returns complete HTML including scripts/styles',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract HTML from',
              },
              wait_for: {
                type: 'string',
                description: 'CSS selector to wait for before extraction. Example: ".article-content" or "#data-table"',
              },
              bypass_cache: {
                type: 'boolean',
                description: 'Bypass cache',
                default: false,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'extract_links',
          description:
            'Extract and categorize all page links. Use when: building sitemaps, analyzing site structure, finding broken links, or discovering resources. Groups by internal/external/social/documents',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract links from',
              },
              categorize: {
                type: 'boolean',
                description:
                  'Group links by type: internal (same domain), external, social media, documents (PDF/DOC), images. Helpful for link analysis',
                default: true,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'crawl_recursive',
          description:
            'Deep crawl a website following internal links. Use when: mapping entire sites, finding all pages, building comprehensive indexes. Control with max_depth (default 3) and max_pages (default 50)',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'Starting URL to crawl from',
              },
              max_depth: {
                type: 'number',
                description: 'Maximum depth to follow links',
                default: 3,
              },
              max_pages: {
                type: 'number',
                description: 'Maximum number of pages to crawl',
                default: 50,
              },
              include_pattern: {
                type: 'string',
                description:
                  'Regex to match URLs to crawl. Example: ".*\\/blog\\/.*" for blog posts only, ".*\\.html$" for HTML pages',
              },
              exclude_pattern: {
                type: 'string',
                description:
                  'Regex to skip URLs. Example: ".*\\/(login|admin).*" to avoid auth pages, ".*\\.pdf$" to skip PDFs',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'parse_sitemap',
          description:
            'Extract URLs from XML sitemaps. Use when: discovering all site pages, planning crawl strategies, or checking sitemap validity. Supports regex filtering. Try sitemap.xml or robots.txt first',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the sitemap (e.g., https://example.com/sitemap.xml)',
              },
              filter_pattern: {
                type: 'string',
                description: 'Optional regex pattern to filter URLs',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'crawl_with_config',
          description:
            'Advanced web crawling with browser control. Note: For structured data extraction, use extract_with_llm tool. Avoid combining scan_full_page+networkidle+magic (causes loops). Start simple, add params as needed',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to crawl',
              },

              // Browser Configuration
              browser_type: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                description:
                  'Browser engine for crawling. Chromium offers best compatibility, Firefox for specific use cases, WebKit for Safari-like behavior',
                default: 'chromium',
              },
              viewport_width: {
                type: 'number',
                description: 'Browser window width in pixels. Affects responsive layouts and content visibility',
                default: 1080,
              },
              viewport_height: {
                type: 'number',
                description: 'Browser window height in pixels. Impacts content loading and screenshot dimensions',
                default: 600,
              },
              user_agent: {
                type: 'string',
                description:
                  'Custom browser identity. Use for: mobile sites (include "Mobile"), avoiding bot detection, or specific browser requirements. Example: "Mozilla/5.0 (iPhone...)"',
              },
              proxy_server: {
                type: 'string',
                description: 'Proxy server URL (e.g., "http://proxy.example.com:8080")',
              },
              proxy_username: {
                type: 'string',
                description: 'Proxy authentication username',
              },
              proxy_password: {
                type: 'string',
                description: 'Proxy authentication password',
              },
              cookies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Cookie name' },
                    value: { type: 'string', description: 'Cookie value' },
                    domain: { type: 'string', description: 'Domain where cookie is valid' },
                    path: { type: 'string', description: 'URL path scope for cookie' },
                  },
                  required: ['name', 'value', 'domain'],
                },
                description: 'Pre-set cookies for authentication or personalization',
              },
              headers: {
                type: 'object',
                description: 'Custom HTTP headers for API keys, auth tokens, or specific server requirements',
              },

              // Crawler Configuration
              word_count_threshold: {
                type: 'number',
                description:
                  'Min words per text block. Filters out menus, footers, and short snippets. Lower = more content but more noise. Higher = only substantial paragraphs',
                default: 200,
              },
              excluded_tags: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'HTML tags to remove completely. Common: ["nav", "footer", "aside", "script", "style"]. Cleans up content before extraction',
              },
              remove_overlay_elements: {
                type: 'boolean',
                description: 'Automatically remove popups, modals, and overlays that obscure content',
                default: false,
              },
              js_code: {
                type: ['string', 'array'],
                items: { type: 'string' },
                description:
                  'JavaScript code to execute (MUST be a string, not null). Examples: js_code: "document.querySelectorAll(\'a\').length" counts links, js_code: ["window.scrollTo(0, 1000)", "document.title"] runs multiple commands. For js_only mode, also set session_id.',
              },
              wait_for: {
                type: 'string',
                description:
                  'Wait for element/condition. For CSS extraction: use specific selector like ".article-body" not generic "h1". For JS: "() => document.querySelector(\'.data\')?.children.length > 0". Avoid "networkidle" with extraction',
              },
              wait_for_timeout: {
                type: 'number',
                description: 'Maximum milliseconds to wait for condition',
                default: 30000,
              },
              delay_before_scroll: {
                type: 'number',
                description: 'Milliseconds to wait before scrolling. Allows initial content to render',
                default: 1000,
              },
              scroll_delay: {
                type: 'number',
                description: 'Milliseconds between scroll steps for lazy-loaded content',
                default: 500,
              },
              process_iframes: {
                type: 'boolean',
                description: 'Extract content from embedded iframes including videos and forms',
                default: false,
              },
              exclude_external_links: {
                type: 'boolean',
                description: 'Remove links pointing to different domains for cleaner content',
                default: false,
              },
              screenshot: {
                type: 'boolean',
                description: 'Capture full-page screenshot as base64 PNG',
                default: false,
              },
              pdf: {
                type: 'boolean',
                description: 'Generate PDF as base64 preserving exact layout',
                default: false,
              },
              session_id: {
                type: 'string',
                description:
                  'Browser session ID from create_session. Maintains login state, cookies, and JavaScript context. Required for js_only mode. Essential for multi-page auth flows',
              },
              cache_mode: {
                type: 'string',
                enum: ['ENABLED', 'BYPASS', 'DISABLED'],
                description:
                  'Cache strategy. ENABLED: Use cache if available. BYPASS: Fetch fresh (recommended). DISABLED: No cache',
                default: 'BYPASS',
              },
              timeout: {
                type: 'number',
                description: 'Overall request timeout in milliseconds',
                default: 60000,
              },
              verbose: {
                type: 'boolean',
                description:
                  'Enable server-side debug logging (not shown in output). Only for troubleshooting. Does not affect extraction results',
                default: false,
              },

              // Additional Crawler Parameters
              wait_until: {
                type: 'string',
                enum: ['domcontentloaded', 'networkidle', 'load'],
                description:
                  'When to consider page loaded. "domcontentloaded": fast, HTML ready. "load": images loaded. "networkidle": all requests done (slowest, may timeout on dynamic sites). Default: "domcontentloaded"',
                default: 'domcontentloaded',
              },
              page_timeout: {
                type: 'number',
                description: 'Page navigation timeout in milliseconds',
                default: 60000,
              },
              wait_for_images: {
                type: 'boolean',
                description: 'Wait for all images to load before extraction',
                default: false,
              },
              ignore_body_visibility: {
                type: 'boolean',
                description: 'Skip checking if body element is visible',
                default: true,
              },
              scan_full_page: {
                type: 'boolean',
                description:
                  'Auto-scroll entire page to trigger lazy loading. WARNING: Can be slow on long pages. Avoid combining with wait_until:"networkidle" or CSS extraction on dynamic sites. Better to use virtual_scroll_config for infinite feeds',
                default: false,
              },
              remove_forms: {
                type: 'boolean',
                description: 'Remove all form elements from extracted content',
                default: false,
              },
              keep_data_attributes: {
                type: 'boolean',
                description: 'Preserve data-* attributes in cleaned HTML',
                default: false,
              },
              excluded_selector: {
                type: 'string',
                description:
                  'CSS selector for elements to remove. Examples: "#cookie-banner, .advertisement, .social-share". Comma-separate multiple selectors',
              },
              only_text: {
                type: 'boolean',
                description: 'Extract only text content, no HTML structure',
                default: false,
              },

              // Media Handling
              image_description_min_word_threshold: {
                type: 'number',
                description: 'Minimum words for image alt text to be considered valid',
                default: 50,
              },
              image_score_threshold: {
                type: 'number',
                description: 'Minimum relevance score for images (filters low-quality images)',
                default: 3,
              },
              exclude_external_images: {
                type: 'boolean',
                description: 'Exclude images from external domains',
                default: false,
              },
              screenshot_wait_for: {
                type: 'number',
                description: 'Extra wait time in seconds before taking screenshot',
              },

              // Link Filtering
              exclude_social_media_links: {
                type: 'boolean',
                description: 'Remove links to social media platforms',
                default: false,
              },
              exclude_domains: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of domains to exclude from links (e.g., ["ads.com", "tracker.io"])',
              },

              // Page Interaction
              js_only: {
                type: 'boolean',
                description:
                  'Execute JS on existing page without navigation. Requires active session_id. Use for: multi-step interactions, updating dynamic content, or SPA navigation',
                default: false,
              },
              simulate_user: {
                type: 'boolean',
                description:
                  'Mimic human behavior with random mouse movements and delays. Helps bypass bot detection on protected sites. Slows crawling but improves success rate',
                default: false,
              },
              override_navigator: {
                type: 'boolean',
                description: 'Override navigator properties for stealth',
                default: false,
              },
              magic: {
                type: 'boolean',
                description:
                  'EXPERIMENTAL: Auto-dismiss popups/banners. May conflict with wait_for or cause unexpected behavior. Try without this first if having issues. Not recommended with CSS extraction',
                default: false,
              },

              // Virtual Scroll Configuration
              virtual_scroll_config: {
                type: 'object',
                description:
                  'Handle infinite feeds that replace content while scrolling (Twitter, Instagram, TikTok). Different from scan_full_page which handles appending content',
                properties: {
                  container_selector: {
                    type: 'string',
                    description:
                      'CSS selector for scrollable feed container. Examples: "[role=\'feed\']", ".timeline", "#posts-container"',
                  },
                  scroll_count: {
                    type: 'number',
                    description:
                      'How many times to scroll. Each scroll loads new content batch. More = more posts but slower',
                    default: 10,
                  },
                  scroll_by: {
                    type: ['string', 'number'],
                    description:
                      'Distance per scroll. "container_height": one viewport, "page_height": full page, or pixels like 500',
                    default: 'container_height',
                  },
                  wait_after_scroll: {
                    type: 'number',
                    description: 'Seconds to wait after each scroll',
                    default: 0.5,
                  },
                },
                required: ['container_selector'],
              },

              // Other
              log_console: {
                type: 'boolean',
                description: 'Capture browser console logs for debugging',
                default: false,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'create_session',
          description:
            'Start a persistent browser session for stateful crawling. Use when: handling login flows, maintaining cookies across requests, or multi-step interactions. Session persists until timeout. Use session_id in crawl_with_config to reuse',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Unique identifier for the session (auto-generated if not provided)',
              },
              initial_url: {
                type: 'string',
                description:
                  'URL to load when creating session. Useful for: setting cookies, logging in, or reaching a starting point before actual crawling',
              },
              browser_type: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                description: 'Browser engine for the session',
                default: 'chromium',
              },
            },
            required: [],
          },
        },
        {
          name: 'clear_session',
          description:
            'Stop tracking a browser session locally. Use when: done with multi-step crawling, cleaning up after login flows. Note: actual browser on server persists until timeout',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session ID to remove from tracking',
              },
            },
            required: ['session_id'],
          },
        },
        {
          name: 'list_sessions',
          description:
            'Show all active browser sessions with age and usage info. Use when: checking available sessions, debugging session issues, or before creating new sessions. Shows local tracking only',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'extract_with_llm',
          description:
            'Extract structured data from webpages using AI. Direct extraction that returns results immediately. Use when: need specific data extraction, want AI to understand page content, or extracting complex patterns. This is the recommended alternative to CSS/XPath extraction.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract data from',
              },
              query: {
                type: 'string',
                description:
                  'Natural language extraction instructions. Be specific and clear. Example: "Extract all product names, prices, and availability status from the page"',
              },
            },
            required: ['url', 'query'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'crawl_page':
            return await this.crawlPage(args as any);

          case 'capture_screenshot':
            return await this.captureScreenshot(args as any);

          case 'generate_pdf':
            return await this.generatePDF(args as any);

          case 'execute_js':
            return await this.executeJS(args as any);

          case 'batch_crawl':
            return await this.batchCrawl(args as any);

          case 'smart_crawl':
            return await this.smartCrawl(args as any);

          case 'get_html':
            return await this.getHTML(args as any);

          case 'extract_links':
            return await this.extractLinks(args as any);

          case 'crawl_recursive':
            return await this.crawlRecursive(args as any);

          case 'parse_sitemap':
            return await this.parseSitemap(args as any);

          case 'crawl_with_config':
            return await this.crawlWithConfig(args as any);

          case 'create_session':
            return await this.createSession(args as any);

          case 'clear_session':
            return await this.clearSession(args as any);

          case 'list_sessions':
            return await this.listSessions();

          case 'extract_with_llm':
            return await this.extractWithLLM(args as any);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  private async crawlPage(options: CrawlOptions & { url: string }) {
    try {
      const response = await this.axiosClient.post('/md', {
        url: options.url,
        remove_images: options.remove_images,
        bypass_cache: options.bypass_cache,
        filter_mode: options.filter_mode,
        filter_list: options.filter_list,
        screenshot: options.screenshot,
        wait_for: options.wait_for,
        timeout: options.timeout,
      });

      const result: CrawlResult = response.data;

      return {
        content: [
          {
            type: 'text',
            text: result.markdown || 'No content extracted',
          },
          ...(result.screenshot
            ? [
                {
                  type: 'image',
                  data: result.screenshot,
                  mimeType: 'image/png',
                },
              ]
            : []),
          ...(result.metadata
            ? [
                {
                  type: 'text',
                  text: `\n\n---\nMetadata:\n${JSON.stringify(result.metadata, null, 2)}`,
                },
              ]
            : []),
          ...(result.links
            ? [
                {
                  type: 'text',
                  text: `\n\n---\nLinks:\nInternal: ${result.links.internal.length}\nExternal: ${result.links.external.length}`,
                },
              ]
            : []),
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to crawl page: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async captureScreenshot(options: { url: string; full_page?: boolean; wait_for?: string; timeout?: number }) {
    try {
      const response = await this.axiosClient.post('/screenshot', {
        url: options.url,
        full_page: options.full_page,
        wait_for: options.wait_for,
        timeout: options.timeout,
      });

      return {
        content: [
          {
            type: 'image',
            data: response.data.screenshot,
            mimeType: 'image/png',
          },
          {
            type: 'text',
            text: `Screenshot captured for: ${options.url}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to capture screenshot: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async generatePDF(options: { url: string; wait_for?: string; timeout?: number }) {
    try {
      const response = await this.axiosClient.post('/pdf', {
        url: options.url,
        wait_for: options.wait_for,
        timeout: options.timeout,
      });

      return {
        content: [
          {
            type: 'text',
            text: `PDF generated for: ${options.url}\nBase64 PDF data: ${response.data.pdf.substring(0, 100)}...`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to generate PDF: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async executeJS(options: JSExecuteOptions & { url: string }) {
    try {
      // Check if js_code is provided
      if (!options.js_code || options.js_code === null) {
        throw new Error(
          'js_code is required. Please provide a JavaScript string (e.g., "document.querySelectorAll(\'a\').length") or an array of strings (e.g., ["window.scrollTo(0, 1000)", "document.querySelector(\'.more\').click()"])',
        );
      }
      // Ensure scripts is always an array
      const scripts = Array.isArray(options.js_code) ? options.js_code : [options.js_code];

      const response = await this.axiosClient.post('/execute_js', {
        url: options.url,
        scripts: scripts,
        wait_after_js: options.wait_after_js,
        screenshot: options.screenshot,
      });

      const result = response.data;

      // Always stringify the entire response to see what we're getting
      const fullResponse = JSON.stringify(result, null, 2);

      // Try to extract meaningful content
      let jsResult = fullResponse;

      // If we can find specific fields, use them
      if (result && typeof result === 'object') {
        if (result.js_result !== undefined) {
          jsResult = `JavaScript Result: ${JSON.stringify(result.js_result)}\n\nFull Response:\n${fullResponse}`;
        } else if (result.result !== undefined) {
          jsResult = `Result: ${JSON.stringify(result.result)}\n\nFull Response:\n${fullResponse}`;
        } else if (result.extracted_content) {
          jsResult = `Extracted: ${result.extracted_content}\n\nFull Response:\n${fullResponse}`;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `JavaScript executed successfully on: ${options.url}\n\nResult:\n${jsResult}`,
          },
          ...(result.screenshot
            ? [
                {
                  type: 'image',
                  data: result.screenshot,
                  mimeType: 'image/png',
                },
              ]
            : []),
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to execute JavaScript: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async batchCrawl(options: BatchCrawlOptions) {
    try {
      const response = await this.axiosClient.post('/crawl', {
        urls: options.urls,
        max_concurrent: options.max_concurrent,
        remove_images: options.remove_images,
        bypass_cache: options.bypass_cache,
      });

      const results = response.data.results || [];

      return {
        content: [
          {
            type: 'text',
            text: `Batch crawl completed. Processed ${results.length} URLs:\n\n${results
              .map((r: any, i: number) => `${i + 1}. ${options.urls[i]}: ${r.success ? 'Success' : 'Failed'}`)
              .join('\n')}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to batch crawl: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async smartCrawl(options: {
    url: string;
    max_depth?: number;
    follow_links?: boolean;
    bypass_cache?: boolean;
  }) {
    try {
      // First, detect the content type
      const headResponse = await this.axiosClient.head(options.url).catch(() => null);
      const contentType = headResponse?.headers['content-type'] || '';

      let strategy = 'html';
      if (options.url.includes('sitemap') || options.url.endsWith('.xml')) {
        strategy = 'sitemap';
      } else if (options.url.includes('rss') || options.url.includes('feed')) {
        strategy = 'rss';
      } else if (contentType.includes('text/plain') || options.url.endsWith('.txt')) {
        strategy = 'text';
      }

      // Use the smart crawl endpoint if available, otherwise fallback to regular crawl
      const response = await this.axiosClient.post('/crawl', {
        urls: [options.url],
        strategy,
        max_depth: options.max_depth,
        follow_links: options.follow_links,
        bypass_cache: options.bypass_cache,
      });

      const results = response.data.results || [];
      const result = results[0] || {};

      return {
        content: [
          {
            type: 'text',
            text: `Smart crawl detected content type: ${strategy}\n\n${result.markdown || result.content || 'No content extracted'}`,
          },
          ...(result.metadata
            ? [
                {
                  type: 'text',
                  text: `\n\n---\nMetadata:\n${JSON.stringify(result.metadata, null, 2)}`,
                },
              ]
            : []),
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to smart crawl: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async getHTML(options: { url: string; wait_for?: string; bypass_cache?: boolean }) {
    try {
      const response = await this.axiosClient.post('/html', {
        url: options.url,
        wait_for: options.wait_for,
        bypass_cache: options.bypass_cache,
      });

      return {
        content: [
          {
            type: 'text',
            text: response.data.html || 'No HTML content extracted',
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to get HTML: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async extractLinks(options: { url: string; categorize?: boolean }) {
    try {
      // First crawl the page to get content
      const response = await this.axiosClient.post('/md', {
        url: options.url,
        bypass_cache: true,
      });

      const result: CrawlResult = response.data;
      const links = result.links || { internal: [], external: [] };

      if (!options.categorize) {
        return {
          content: [
            {
              type: 'text',
              text: `All links from ${options.url}:\n${[...links.internal, ...links.external].join('\n')}`,
            },
          ],
        };
      }

      // Categorize links
      const categorized: any = {
        internal: links.internal,
        external: links.external,
        social: [],
        documents: [],
        images: [],
        scripts: [],
      };

      // Further categorize external links
      const socialDomains = ['facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 'youtube.com'];
      const docExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
      const scriptExtensions = ['.js', '.css'];

      links.external.forEach((link: string) => {
        if (socialDomains.some((domain) => link.includes(domain))) {
          categorized.social.push(link);
        } else if (docExtensions.some((ext) => link.toLowerCase().endsWith(ext))) {
          categorized.documents.push(link);
        } else if (imageExtensions.some((ext) => link.toLowerCase().endsWith(ext))) {
          categorized.images.push(link);
        } else if (scriptExtensions.some((ext) => link.toLowerCase().endsWith(ext))) {
          categorized.scripts.push(link);
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: `Link analysis for ${options.url}:\n\n${Object.entries(categorized)
              .map(
                ([category, links]: [string, any]) =>
                  `${category} (${links.length}):\n${links.slice(0, 10).join('\n')}${links.length > 10 ? '\n...' : ''}`,
              )
              .join('\n\n')}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to extract links: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async crawlRecursive(options: {
    url: string;
    max_depth?: number;
    max_pages?: number;
    include_pattern?: string;
    exclude_pattern?: string;
  }) {
    try {
      const startUrl = new URL(options.url);
      const visited = new Set<string>();
      const toVisit: Array<{ url: string; depth: number }> = [{ url: options.url, depth: 0 }];
      const results: Array<{ url: string; content: string; links: string[] }> = [];

      const includeRegex = options.include_pattern ? new RegExp(options.include_pattern) : null;
      const excludeRegex = options.exclude_pattern ? new RegExp(options.exclude_pattern) : null;

      while (toVisit.length > 0 && results.length < (options.max_pages || 50)) {
        const current = toVisit.shift();
        if (!current || visited.has(current.url) || current.depth > (options.max_depth || 3)) {
          continue;
        }

        visited.add(current.url);

        try {
          // Check URL patterns
          if (excludeRegex && excludeRegex.test(current.url)) continue;
          if (includeRegex && !includeRegex.test(current.url)) continue;

          // Crawl the page
          const response = await this.axiosClient.post('/md', {
            url: current.url,
            bypass_cache: true,
          });

          const result: CrawlResult = response.data;
          if (result.markdown) {
            results.push({
              url: current.url,
              content: result.markdown,
              links: [...(result.links?.internal || [])],
            });

            // Add internal links to crawl queue
            if (current.depth < (options.max_depth || 3)) {
              const internalLinks = result.links?.internal || [];
              for (const link of internalLinks) {
                const linkUrl = new URL(link, current.url).toString();
                if (!visited.has(linkUrl) && new URL(linkUrl).hostname === startUrl.hostname) {
                  toVisit.push({ url: linkUrl, depth: current.depth + 1 });
                }
              }
            }
          }
        } catch (error) {
          console.error(`Failed to crawl ${current.url}:`, error);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Recursive crawl completed:\n\nPages crawled: ${results.length}\nStarting URL: ${options.url}\nMax depth reached: ${Math.max(...results.map((_, i) => Math.floor(i / 10)))}\n\nPages found:\n${results.map((r) => `- ${r.url} (${r.content.length} chars, ${r.links.length} links)`).join('\n')}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to crawl recursively: ${error.message}`);
    }
  }

  private async parseSitemap(options: { url: string; filter_pattern?: string }) {
    try {
      // First try to fetch the sitemap
      const response = await this.axiosClient.get(options.url);
      const sitemapContent = response.data;

      // Parse XML content - simple regex approach for basic sitemaps
      const urlMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g) || [];
      const urls = urlMatches.map((match: string) => match.replace(/<\/?loc>/g, ''));

      // Apply filter if provided
      let filteredUrls = urls;
      if (options.filter_pattern) {
        const filterRegex = new RegExp(options.filter_pattern);
        filteredUrls = urls.filter((url: string) => filterRegex.test(url));
      }

      return {
        content: [
          {
            type: 'text',
            text: `Sitemap parsed successfully:\n\nTotal URLs found: ${urls.length}\nFiltered URLs: ${filteredUrls.length}\n\nURLs:\n${filteredUrls.slice(0, 100).join('\n')}${filteredUrls.length > 100 ? '\n... and ' + (filteredUrls.length - 100) + ' more' : ''}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to parse sitemap: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async crawlWithConfig(options: any) {
    try {
      // Ensure options is an object
      if (!options || typeof options !== 'object') {
        throw new Error('crawl_with_config requires options object with at least a url parameter');
      }

      // Build browser_config
      const browser_config: any = {
        headless: true, // Always true as noted
      };

      if (options.browser_type) browser_config.browser_type = options.browser_type;
      if (options.viewport_width) browser_config.viewport_width = options.viewport_width;
      if (options.viewport_height) browser_config.viewport_height = options.viewport_height;
      if (options.user_agent) browser_config.user_agent = options.user_agent;
      if (options.headers) browser_config.headers = options.headers;
      if (options.cookies) browser_config.cookies = options.cookies;

      // Handle proxy configuration
      if (options.proxy_server) {
        browser_config.proxy_config = {
          server: options.proxy_server,
          username: options.proxy_username,
          password: options.proxy_password,
        };
      }

      // Build crawler_config
      const crawler_config: any = {};

      // Content filtering
      if (options.word_count_threshold !== undefined)
        crawler_config.word_count_threshold = options.word_count_threshold;
      if (options.excluded_tags) crawler_config.excluded_tags = options.excluded_tags;
      if (options.remove_overlay_elements) crawler_config.remove_overlay_elements = options.remove_overlay_elements;

      // JavaScript execution
      if (options.js_code !== undefined && options.js_code !== null) {
        // If js_code is an array, join it with newlines for the server
        crawler_config.js_code = Array.isArray(options.js_code) ? options.js_code.join('\n') : options.js_code;
      } else if (options.js_code === null) {
        // If js_code is explicitly null, throw a helpful error
        throw new Error(
          'js_code parameter is null. Please provide a JavaScript string (e.g., "document.querySelectorAll(\'a\').length") or an array of strings (e.g., ["window.scrollTo(0, 1000)", "document.querySelector(\'.more\').click()"])',
        );
      }
      if (options.wait_for) crawler_config.wait_for = options.wait_for;
      if (options.wait_for_timeout) crawler_config.wait_for_timeout = options.wait_for_timeout;

      // Dynamic content
      if (options.delay_before_scroll) crawler_config.delay_before_scroll = options.delay_before_scroll;
      if (options.scroll_delay) crawler_config.scroll_delay = options.scroll_delay;

      // Content processing
      if (options.process_iframes) crawler_config.process_iframes = options.process_iframes;
      if (options.exclude_external_links) crawler_config.exclude_external_links = options.exclude_external_links;

      // Export options
      if (options.screenshot) crawler_config.screenshot = options.screenshot;
      if (options.pdf) crawler_config.pdf = options.pdf;

      // Session and cache
      if (options.session_id) {
        crawler_config.session_id = options.session_id;
        // Update session last_used time
        const session = this.sessions.get(options.session_id);
        if (session) {
          session.last_used = new Date();
        }
      }
      if (options.cache_mode) crawler_config.cache_mode = options.cache_mode.toLowerCase();

      // Performance
      if (options.timeout) crawler_config.timeout = options.timeout;
      if (options.verbose) crawler_config.verbose = options.verbose;

      // Additional crawler parameters
      if (options.wait_until) crawler_config.wait_until = options.wait_until;
      if (options.page_timeout) crawler_config.page_timeout = options.page_timeout;
      if (options.wait_for_images) crawler_config.wait_for_images = options.wait_for_images;
      if (options.ignore_body_visibility) crawler_config.ignore_body_visibility = options.ignore_body_visibility;
      if (options.scan_full_page) crawler_config.scan_full_page = options.scan_full_page;
      if (options.remove_forms) crawler_config.remove_forms = options.remove_forms;
      if (options.keep_data_attributes) crawler_config.keep_data_attributes = options.keep_data_attributes;
      if (options.excluded_selector) crawler_config.excluded_selector = options.excluded_selector;
      if (options.only_text) crawler_config.only_text = options.only_text;

      // Media handling
      if (options.image_description_min_word_threshold !== undefined)
        crawler_config.image_description_min_word_threshold = options.image_description_min_word_threshold;
      if (options.image_score_threshold !== undefined)
        crawler_config.image_score_threshold = options.image_score_threshold;
      if (options.exclude_external_images) crawler_config.exclude_external_images = options.exclude_external_images;
      if (options.screenshot_wait_for !== undefined) crawler_config.screenshot_wait_for = options.screenshot_wait_for;

      // Link filtering
      if (options.exclude_social_media_links)
        crawler_config.exclude_social_media_links = options.exclude_social_media_links;
      if (options.exclude_domains) crawler_config.exclude_domains = options.exclude_domains;

      // Page interaction
      if (options.js_only) crawler_config.js_only = options.js_only;
      if (options.simulate_user) crawler_config.simulate_user = options.simulate_user;
      if (options.override_navigator) crawler_config.override_navigator = options.override_navigator;
      if (options.magic) crawler_config.magic = options.magic;

      // Virtual scroll
      if (options.virtual_scroll_config) crawler_config.virtual_scroll_config = options.virtual_scroll_config;

      // Other
      if (options.log_console) crawler_config.log_console = options.log_console;

      // Build request body
      const requestBody: any = {
        urls: [options.url],
        browser_config,
        crawler_config,
      };

      // Call /crawl endpoint
      const response = await this.axiosClient.post('/crawl', requestBody);

      const results = response.data.results || [];
      const result = results[0] || response.data;

      // Build response content
      const content = [];

      // Main content - ensure we get a string
      let mainContent = 'No content extracted';

      if (result.extracted_content) {
        // Handle extraction results which might be objects or strings
        if (typeof result.extracted_content === 'string') {
          mainContent = result.extracted_content;
        } else if (typeof result.extracted_content === 'object') {
          mainContent = JSON.stringify(result.extracted_content, null, 2);
        }
      } else if (result.extraction_result) {
        // Another possible field name for extraction results
        if (typeof result.extraction_result === 'string') {
          mainContent = result.extraction_result;
        } else if (typeof result.extraction_result === 'object') {
          mainContent = JSON.stringify(result.extraction_result, null, 2);
        }
      } else if (result.data && result.data.extracted_content) {
        // Check nested data field
        if (typeof result.data.extracted_content === 'string') {
          mainContent = result.data.extracted_content;
        } else if (typeof result.data.extracted_content === 'object') {
          mainContent = JSON.stringify(result.data.extracted_content, null, 2);
        }
      } else if (result.markdown && typeof result.markdown === 'string') {
        mainContent = result.markdown;
      } else if (result.content && typeof result.content === 'string') {
        mainContent = result.content;
      } else if (result.html && typeof result.html === 'string') {
        mainContent = result.html;
      } else if (result.text && typeof result.text === 'string') {
        mainContent = result.text;
      } else if (typeof result === 'string') {
        mainContent = result;
      } else if (result && typeof result === 'object') {
        // If all else fails, try to stringify the entire result
        mainContent = JSON.stringify(result, null, 2);
      }

      content.push({
        type: 'text',
        text: mainContent,
      });

      // Screenshot if available
      if (result.screenshot) {
        content.push({
          type: 'image',
          data: result.screenshot,
          mimeType: 'image/png',
        });
      }

      // PDF info if available
      if (result.pdf) {
        content.push({
          type: 'text',
          text: `PDF generated (${result.pdf.length} bytes)`,
        });
      }

      // Metadata
      if (result.metadata) {
        content.push({
          type: 'text',
          text: `\n---\nMetadata: ${JSON.stringify(result.metadata, null, 2)}`,
        });
      }

      // Links
      if (result.links) {
        content.push({
          type: 'text',
          text: `\n---\nLinks: Internal: ${result.links.internal?.length || 0}, External: ${result.links.external?.length || 0}`,
        });
      }

      return { content };
    } catch (error: any) {
      throw new Error(`Failed to crawl with config: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async createSession(options: { session_id: string; initial_url?: string; browser_type?: string }) {
    try {
      // Generate session ID if not provided
      const sessionId = options.session_id || `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Store session info locally
      this.sessions.set(sessionId, {
        id: sessionId,
        created_at: new Date(),
        last_used: new Date(),
        initial_url: options.initial_url,
        metadata: {
          browser_type: options.browser_type || 'chromium',
        },
      });

      // If initial_url provided, make first crawl to establish session
      if (options.initial_url) {
        try {
          await this.axiosClient.post('/crawl', {
            urls: [options.initial_url],
            browser_config: {
              headless: true,
              browser_type: options.browser_type || 'chromium',
            },
            crawler_config: {
              session_id: sessionId,
              cache_mode: 'BYPASS',
            },
          });

          // Update last_used
          const session = this.sessions.get(sessionId);
          if (session) {
            session.last_used = new Date();
          }
        } catch (error) {
          // Session created but initial crawl failed - still return success
          console.error(`Initial crawl failed for session ${sessionId}:`, error);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Session created successfully:\nSession ID: ${sessionId}\nBrowser: ${options.browser_type || 'chromium'}\n${options.initial_url ? `Pre-warmed with: ${options.initial_url}` : 'Ready for use'}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  private async clearSession(options: { session_id: string }) {
    try {
      // Remove from local store
      const deleted = this.sessions.delete(options.session_id);

      // Note: The actual browser session in Crawl4AI will be cleaned up
      // automatically after inactivity or when the server restarts

      return {
        content: [
          {
            type: 'text',
            text: deleted
              ? `Session cleared successfully: ${options.session_id}`
              : `Session not found: ${options.session_id}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to clear session: ${error.message}`);
    }
  }

  private async listSessions() {
    try {
      // Return locally stored sessions
      const sessions = Array.from(this.sessions.entries()).map(([id, info]) => {
        const ageMinutes = Math.floor((Date.now() - info.created_at.getTime()) / 60000);
        const lastUsedMinutes = Math.floor((Date.now() - info.last_used.getTime()) / 60000);

        return {
          session_id: id,
          created_at: info.created_at.toISOString(),
          last_used: info.last_used.toISOString(),
          age_minutes: ageMinutes,
          last_used_minutes_ago: lastUsedMinutes,
          initial_url: info.initial_url,
          browser_type: info.metadata?.browser_type || 'chromium',
        };
      });

      if (sessions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No active sessions found.',
            },
          ],
        };
      }

      const sessionList = sessions
        .map(
          (session) =>
            `- ${session.session_id} (${session.browser_type}, created ${session.age_minutes}m ago, last used ${session.last_used_minutes_ago}m ago)`,
        )
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Active sessions (${sessions.length}):\n${sessionList}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to list sessions: ${error.message}`);
    }
  }

  private async extractWithLLM(options: { url: string; query: string }) {
    try {
      const result = await this.service.extractWithLLM(options);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data || result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to extract with LLM: ${error.message}`);
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
  }
}

// Start the server
const server = new Crawl4AIServer();
server.start().catch(console.error);
