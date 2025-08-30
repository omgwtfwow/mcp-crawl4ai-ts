import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { Crawl4AIService } from './crawl4ai-service.js';
import { SessionInfo } from './handlers/base-handler.js';
import { ContentHandlers } from './handlers/content-handlers.js';
import { SessionHandlers } from './handlers/session-handlers.js';
import { UtilityHandlers } from './handlers/utility-handlers.js';
import { CrawlHandlers } from './handlers/crawl-handlers.js';
import { BatchCrawlOptions } from './types.js';
// Define the tool call result type
type ToolCallResult = {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  session_id?: string;
  browser_type?: string;
};
import {
  GetMarkdownSchema,
  CaptureScreenshotSchema,
  GeneratePdfSchema,
  ExecuteJsSchema,
  BatchCrawlSchema,
  SmartCrawlSchema,
  GetHtmlSchema,
  ExtractLinksSchema,
  CrawlRecursiveSchema,
  ParseSitemapSchema,
  CrawlSchema,
  ManageSessionSchema,
  ExtractWithLlmSchema,
} from './schemas/validation-schemas.js';

export class Crawl4AIServer {
  private server: Server;
  protected axiosClient: AxiosInstance;
  protected service: Crawl4AIService;
  private sessions: Map<string, SessionInfo> = new Map();
  private serverName: string;
  private serverVersion: string;

  // Handler instances
  private contentHandlers: ContentHandlers;
  private sessionHandlers: SessionHandlers;
  private utilityHandlers: UtilityHandlers;
  private crawlHandlers: CrawlHandlers;

  constructor(baseUrl: string, apiKey: string, serverName: string = 'crawl4ai-mcp', serverVersion: string = '1.0.0') {
    this.serverName = serverName;
    this.serverVersion = serverVersion;
    this.server = new Server(
      {
        name: serverName,
        version: serverVersion,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Initialize axios client with API key
    this.axiosClient = axios.create({
      baseURL: baseUrl,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes timeout
    });

    // Initialize the service
    this.service = new Crawl4AIService(baseUrl, apiKey);

    // Initialize handlers
    this.contentHandlers = new ContentHandlers(this.service, this.axiosClient, this.sessions);
    this.sessionHandlers = new SessionHandlers(this.service, this.axiosClient, this.sessions);
    this.utilityHandlers = new UtilityHandlers(this.service, this.axiosClient, this.sessions);
    this.crawlHandlers = new CrawlHandlers(this.service, this.axiosClient, this.sessions);

    this.setupHandlers();
  }

  /**
   * Helper method to validate arguments and execute handler with consistent error formatting
   * Preserves the exact error message format that LLMs rely on
   */
  private async validateAndExecute<T>(
    toolName: string,
    args: unknown,
    schema: z.ZodSchema<T>,
    handler: (validatedArgs: T) => Promise<ToolCallResult>,
  ): Promise<ToolCallResult> {
    try {
      const validatedArgs = schema.parse(args);
      return await handler(validatedArgs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // EXACT same formatting as before - critical for LLM understanding
        const details = error.errors
          .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
          .join(', ');
        throw new Error(`Invalid parameters for ${toolName}: ${details}`);
      }
      throw error;
    }
  }

  private setupHandlers() {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_markdown',
          description:
            '[STATELESS] Extract content as markdown with filtering options. Supports: raw (full content), fit (optimized, default), bm25 (keyword search), llm (AI-powered extraction). Use bm25/llm with query for specific content. Creates new browser each time. For persistence use create_session + crawl.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract markdown from',
              },
              filter: {
                type: 'string',
                enum: ['raw', 'fit', 'bm25', 'llm'],
                description: 'Filter type: raw (full), fit (optimized), bm25 (search), llm (AI extraction)',
                default: 'fit',
              },
              query: {
                type: 'string',
                description: 'Query string for bm25/llm filters. Required when using bm25 or llm filter.',
              },
              cache: {
                type: 'string',
                description: 'Cache-bust parameter (use different values to force fresh extraction)',
                default: '0',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'capture_screenshot',
          description:
            "[STATELESS] Capture webpage screenshot. Returns base64-encoded PNG data. Creates new browser each time. Optionally saves screenshot to local directory. IMPORTANT: Chained calls (execute_js then capture_screenshot) will NOT work - the screenshot won't see JS changes! For JS changes + screenshot use create_session + crawl(session_id, js_code, screenshot:true) in ONE call.",
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to capture',
              },
              screenshot_wait_for: {
                type: 'number',
                description: 'Seconds to wait before taking screenshot (allows page loading/animations)',
                default: 2,
              },
              save_to_directory: {
                type: 'string',
                description:
                  "Directory path to save screenshot (e.g., ~/Desktop, /tmp). Do NOT include filename - it will be auto-generated. Large screenshots (>800KB) won't be returned inline when saved.",
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'generate_pdf',
          description:
            '[STATELESS] Convert webpage to PDF. Returns base64-encoded PDF data. Creates new browser each time. Cannot capture form fills or JS changes. For persistent PDFs use create_session + crawl(session_id, pdf:true).',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to convert to PDF',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'execute_js',
          description:
            '[STATELESS] Execute JavaScript and get return values + page content. Creates new browser each time. Use for: extracting data, triggering dynamic content, checking page state. Scripts with "return" statements return actual values (strings, numbers, objects, arrays). Note: null returns as {"success": true}. Returns values but page state is lost. For persistent JS execution, use crawl with session_id.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to load',
              },
              scripts: {
                type: ['string', 'array'],
                items: { type: 'string' },
                description:
                  'JavaScript to execute. Use "return" to get values back! Each string runs separately. Returns appear in results array. Examples: "return document.title", "return document.querySelectorAll(\'a\').length", "return {url: location.href, links: [...document.links].map(a => a.href)}". Use proper JS syntax: real quotes, no HTML entities.',
              },
            },
            required: ['url', 'scripts'],
          },
        },
        {
          name: 'batch_crawl',
          description:
            '[STATELESS] Crawl multiple URLs concurrently for efficiency. Use when: processing URL lists, comparing multiple pages, or bulk data extraction. Faster than sequential crawling. Max 5 concurrent by default. Each URL gets a fresh browser. Cannot maintain state between URLs. For persistent operations use create_session + crawl.',
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
                description: 'Remove images from output by excluding img, picture, and svg tags',
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
            '[STATELESS] Auto-detect and handle different content types (HTML, sitemap, RSS, text). Use when: URL type is unknown, crawling feeds/sitemaps, or want automatic format handling. Adapts strategy based on content. Creates new browser each time. For persistent operations use create_session + crawl.',
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
                description: 'For sitemaps/RSS: crawl found URLs (max 10). For HTML: no effect',
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
            '[STATELESS] Get sanitized/processed HTML for inspection and automation planning. Use when: finding form fields/selectors, analyzing page structure before automation, building schemas. Returns cleaned HTML showing element names, IDs, and classes - perfect for identifying selectors for subsequent crawl operations. Commonly used before crawl to find selectors for automation. Creates new browser each time.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract HTML from',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'extract_links',
          description:
            '[STATELESS] Extract and categorize all page links. Use when: building sitemaps, analyzing site structure, finding broken links, or discovering resources. Groups by internal/external/social/documents. Creates new browser each time. For persistent operations use create_session + crawl.',
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
            '[STATELESS] Deep crawl a website following internal links. Use when: mapping entire sites, finding all pages, building comprehensive indexes. Control with max_depth (default 3) and max_pages (default 50). Note: May need JS execution for dynamic sites. Each page gets a fresh browser. For persistent operations use create_session + crawl.',
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
            '[STATELESS] Extract URLs from XML sitemaps. Use when: discovering all site pages, planning crawl strategies, or checking sitemap validity. Supports regex filtering. Try sitemap.xml or robots.txt first. Creates new browser each time.',
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
          name: 'crawl',
          description:
            '[SUPPORTS SESSIONS] THE ONLY TOOL WITH BROWSER PERSISTENCE\n\n' +
            'RECOMMENDED PATTERNS:\n' +
            '• Inspect first workflow:\n' +
            '  1) get_html(url) → find selectors & verify elements exist\n' +
            '  2) create_session() → "session-123"\n' +
            '  3) crawl({url, session_id: "session-123", js_code: ["action 1"]})\n' +
            '  4) crawl({url: "/page2", session_id: "session-123", js_code: ["action 2"]})\n\n' +
            '• Multi-step with state:\n' +
            '  1) create_session() → "session-123"\n' +
            '  2) crawl({url, session_id: "session-123"}) → inspect current state\n' +
            '  3) crawl({url, session_id: "session-123", js_code: ["verified actions"]})\n\n' +
            'WITH session_id: Maintains browser state (cookies, localStorage, page) across calls\n' +
            'WITHOUT session_id: Creates fresh browser each time (like other tools)\n\n' +
            'WHEN TO USE SESSIONS vs STATELESS:\n' +
            '• Need state between calls? → create_session + crawl\n' +
            '• Just extracting data? → Use stateless tools\n' +
            '• Filling forms? → Inspect first, then use sessions\n' +
            '• Taking screenshot after JS? → Must use crawl with session\n' +
            '• Unsure if elements exist? → Always use get_html first\n\n' +
            'CRITICAL FOR js_code:\n' +
            'RECOMMENDED: Always use screenshot: true when running js_code\n' +
            'This avoids server serialization errors and gives visual confirmation',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to crawl',
              },
              session_id: {
                type: 'string',
                description:
                  'ENABLES PERSISTENCE: Use SAME ID across all crawl calls to maintain browser state.\n' +
                  '• First call with ID: Creates persistent browser\n' +
                  '• Subsequent calls with SAME ID: Reuses browser with all state intact\n' +
                  '• Different/no ID: Fresh browser (stateless)\n' +
                  'WARNING: ONLY works with crawl tool - other tools ignore this parameter',
              },

              // === CORE CONFIGURATION ===
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

              // === CONTENT PROCESSING ===
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
                  'JavaScript to execute. Each string runs separately. Use return to get values.\n\n' +
                  'IMPORTANT: Always verify elements exist before acting on them!\n' +
                  'Use get_html first to find correct selectors, then:\n' +
                  'GOOD: ["if (document.querySelector(\'input[name=\\"email\\"]\')) { ... }"]\n' +
                  'BAD: ["document.querySelector(\'input[name=\\"email\\"]\').value = \'...\'"]\n\n' +
                  'USAGE PATTERNS:\n' +
                  '1. WITH screenshot/pdf: {js_code: [...], screenshot: true} ✓\n' +
                  '2. MULTI-STEP: First {js_code: [...], session_id: "x"}, then {js_only: true, session_id: "x"}\n' +
                  '3. AVOID: {js_code: [...], js_only: true} on first call ✗\n\n' +
                  'SELECTOR TIPS: Use get_html first to find:\n' +
                  '  • name="..." (best for forms)\n' +
                  '  • id="..." (if unique)\n' +
                  '  • class="..." (careful, may repeat)\n\n' +
                  'FORM EXAMPLE WITH VERIFICATION: [\n' +
                  '  "const emailInput = document.querySelector(\'input[name=\\"email\\"]\');",\n' +
                  '  "if (emailInput) emailInput.value = \'user@example.com\';",\n' +
                  '  "const submitBtn = document.querySelector(\'button[type=\\"submit\\"]\');",\n' +
                  '  "if (submitBtn) submitBtn.click();"\n' +
                  ']',
              },
              js_only: {
                type: 'boolean',
                description:
                  'FOR SUBSEQUENT CALLS ONLY: Reuse existing session without navigation\n' +
                  'First call: Use js_code WITHOUT js_only (or with screenshot/pdf)\n' +
                  'Later calls: Use js_only=true to run more JS in same session\n' +
                  'ERROR: Using js_only=true on first call causes server errors',
                default: false,
              },
              wait_for: {
                type: 'string',
                description:
                  'Wait for element that loads AFTER initial page load. Format: "css:.selector" or "js:() => condition"\n\n' +
                  'WHEN TO USE:\n' +
                  '  • Dynamic content that loads after page (AJAX, lazy load)\n' +
                  '  • Elements that appear after animations/transitions\n' +
                  '  • Content loaded by JavaScript frameworks\n\n' +
                  'WHEN NOT TO USE:\n' +
                  '  • Elements already in initial HTML (forms, static content)\n' +
                  '  • Standard page elements (just use wait_until: "load")\n' +
                  '  • Can cause timeouts/errors if element already exists!\n\n' +
                  'SELECTOR TIPS: Use get_html first to check if element exists\n' +
                  'Examples: "css:.ajax-content", "js:() => document.querySelector(\'.lazy-loaded\')"',
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
              screenshot_directory: {
                type: 'string',
                description:
                  "Directory path to save screenshot (e.g., ~/Desktop, /tmp). Do NOT include filename - it will be auto-generated. Large screenshots (>800KB) won't be returned inline when saved.",
              },
              pdf: {
                type: 'boolean',
                description: 'Generate PDF as base64 preserving exact layout',
                default: false,
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

              // === DYNAMIC CONTENT HANDLING ===
              wait_until: {
                type: 'string',
                enum: ['domcontentloaded', 'networkidle', 'load'],
                description:
                  'When to consider page loaded (use INSTEAD of wait_for for initial load):\n' +
                  '• "domcontentloaded" (default): Fast, DOM ready, use for forms/static content\n' +
                  '• "load": All resources loaded, use if you need images\n' +
                  '• "networkidle": Wait for network quiet, use for heavy JS apps\n' +
                  "WARNING: Don't use wait_for for elements in initial HTML!",
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
                  'CSS selector for elements to remove. Comma-separate multiple selectors.\n\n' +
                  'SELECTOR STRATEGY: Use get_html first to inspect page structure. Look for:\n' +
                  '  • id attributes (e.g., #cookie-banner)\n' +
                  '  • CSS classes (e.g., .advertisement, .popup)\n' +
                  '  • data-* attributes (e.g., [data-type="ad"])\n' +
                  '  • Element type + attributes (e.g., div[role="banner"])\n\n' +
                  'Examples: "#cookie-banner, .advertisement, .social-share"',
              },
              only_text: {
                type: 'boolean',
                description: 'Extract only text content, no HTML structure',
                default: false,
              },

              // === OUTPUT OPTIONS ===
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

              // === LINK & DOMAIN FILTERING ===
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

              // === PERFORMANCE & ANTI-BOT ===
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
                  'EXPERIMENTAL: Auto-handles popups, cookies, overlays.\n' +
                  'Use as LAST RESORT - can conflict with wait_for & CSS extraction\n' +
                  'Try first: remove_overlay_elements, excluded_selector\n' +
                  'Avoid with: CSS extraction, precise timing needs',
                default: false,
              },

              // Virtual Scroll Configuration
              virtual_scroll_config: {
                type: 'object',
                description:
                  'For infinite scroll sites that REPLACE content (Twitter/Instagram feeds).\n' +
                  'USE when: Content disappears as you scroll (virtual scrolling)\n' +
                  "DON'T USE when: Content appends (use scan_full_page instead)\n" +
                  'Example: {container_selector: "#timeline", scroll_count: 10, wait_after_scroll: 1}',
                properties: {
                  container_selector: {
                    type: 'string',
                    description:
                      'CSS selector for the scrollable container.\n\n' +
                      'SELECTOR STRATEGY: Use get_html first to inspect page structure. Look for:\n' +
                      '  • id attributes (e.g., #timeline)\n' +
                      '  • role attributes (e.g., [role="feed"])\n' +
                      '  • CSS classes (e.g., .feed, .timeline)\n' +
                      '  • data-* attributes (e.g., [data-testid="primaryColumn"])\n\n' +
                      'Common: "#timeline" (Twitter), "[role=\'feed\']" (generic), ".feed" (Instagram)',
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
          name: 'manage_session',
          description:
            '[SESSION MANAGEMENT] Unified tool for managing browser sessions. Supports three actions:\n\n' +
            '• CREATE: Start a persistent browser session that maintains state across calls\n' +
            '• CLEAR: Remove a session from local tracking\n' +
            '• LIST: Show all active sessions with age and usage info\n\n' +
            'USAGE EXAMPLES:\n' +
            '1. Create session: {action: "create", session_id: "my-session", initial_url: "https://example.com"}\n' +
            '2. Clear session: {action: "clear", session_id: "my-session"}\n' +
            '3. List sessions: {action: "list"}\n\n' +
            'Browser sessions maintain ALL state (cookies, localStorage, page) across multiple crawl calls. Essential for: forms, login flows, multi-step processes, maintaining state across operations.',
          inputSchema: {
            type: 'object',
            oneOf: [
              {
                type: 'object',
                properties: {
                  action: { type: 'string', const: 'create' },
                  session_id: {
                    type: 'string',
                    description: 'Custom session identifier. Auto-generated if not provided.',
                  },
                  initial_url: {
                    type: 'string',
                    description: 'URL to load when creating session.',
                  },
                  browser_type: {
                    type: 'string',
                    enum: ['chromium', 'firefox', 'webkit'],
                    description: 'Browser engine for the session',
                    default: 'chromium',
                  },
                },
                required: ['action'],
              },
              {
                type: 'object',
                properties: {
                  action: { type: 'string', const: 'clear' },
                  session_id: {
                    type: 'string',
                    description: 'Session ID to remove from tracking',
                  },
                },
                required: ['action', 'session_id'],
              },
              {
                type: 'object',
                properties: {
                  action: { type: 'string', const: 'list' },
                },
                required: ['action'],
              },
            ],
          },
        },
        {
          name: 'extract_with_llm',
          description:
            '[STATELESS] Ask questions about webpage content using AI. Returns natural language answers. ' +
            'Crawls fresh each time. For dynamic content or sessions, use crawl with session_id first.',
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
                  'Your question about the webpage content. Examples: "What is the main topic?", ' +
                  '"List all product prices", "Summarize the key points", "What contact information is available?"',
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
          case 'get_markdown':
            return await this.validateAndExecute(
              'get_markdown',
              args,
              GetMarkdownSchema as z.ZodSchema<z.infer<typeof GetMarkdownSchema>>,
              async (validatedArgs) => this.contentHandlers.getMarkdown(validatedArgs),
            );

          case 'capture_screenshot':
            return await this.validateAndExecute(
              'capture_screenshot',
              args,
              CaptureScreenshotSchema,
              async (validatedArgs) => this.contentHandlers.captureScreenshot(validatedArgs),
            );

          case 'generate_pdf':
            return await this.validateAndExecute('generate_pdf', args, GeneratePdfSchema, async (validatedArgs) =>
              this.contentHandlers.generatePDF(validatedArgs),
            );

          case 'execute_js':
            return await this.validateAndExecute('execute_js', args, ExecuteJsSchema, async (validatedArgs) =>
              this.utilityHandlers.executeJS(validatedArgs),
            );

          case 'batch_crawl':
            return await this.validateAndExecute('batch_crawl', args, BatchCrawlSchema, async (validatedArgs) =>
              this.crawlHandlers.batchCrawl(validatedArgs as BatchCrawlOptions),
            );

          case 'smart_crawl':
            return await this.validateAndExecute('smart_crawl', args, SmartCrawlSchema, async (validatedArgs) =>
              this.crawlHandlers.smartCrawl(validatedArgs),
            );

          case 'get_html':
            return await this.validateAndExecute('get_html', args, GetHtmlSchema, async (validatedArgs) =>
              this.contentHandlers.getHTML(validatedArgs),
            );

          case 'extract_links':
            return await this.validateAndExecute(
              'extract_links',
              args,
              ExtractLinksSchema as z.ZodSchema<z.infer<typeof ExtractLinksSchema>>,
              async (validatedArgs) => this.utilityHandlers.extractLinks(validatedArgs),
            );

          case 'crawl_recursive':
            return await this.validateAndExecute('crawl_recursive', args, CrawlRecursiveSchema, async (validatedArgs) =>
              this.crawlHandlers.crawlRecursive(validatedArgs),
            );

          case 'parse_sitemap':
            return await this.validateAndExecute('parse_sitemap', args, ParseSitemapSchema, async (validatedArgs) =>
              this.crawlHandlers.parseSitemap(validatedArgs),
            );

          case 'crawl':
            return await this.validateAndExecute('crawl', args, CrawlSchema, async (validatedArgs) =>
              this.crawlHandlers.crawl(validatedArgs),
            );

          case 'manage_session':
            return await this.validateAndExecute('manage_session', args, ManageSessionSchema, async (validatedArgs) =>
              this.sessionHandlers.manageSession(validatedArgs),
            );

          case 'extract_with_llm':
            return await this.validateAndExecute(
              'extract_with_llm',
              args,
              ExtractWithLlmSchema,
              async (validatedArgs) => this.contentHandlers.extractWithLLM(validatedArgs),
            );

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  // Expose handler methods for testing
  protected async getMarkdown(options: Parameters<ContentHandlers['getMarkdown']>[0]) {
    return this.contentHandlers.getMarkdown(options);
  }

  protected async captureScreenshot(options: Parameters<ContentHandlers['captureScreenshot']>[0]) {
    return this.contentHandlers.captureScreenshot(options);
  }

  protected async generatePDF(options: Parameters<ContentHandlers['generatePDF']>[0]) {
    return this.contentHandlers.generatePDF(options);
  }

  protected async getHTML(options: Parameters<ContentHandlers['getHTML']>[0]) {
    return this.contentHandlers.getHTML(options);
  }

  protected async extractWithLLM(options: Parameters<ContentHandlers['extractWithLLM']>[0]) {
    return this.contentHandlers.extractWithLLM(options);
  }

  protected async executeJS(options: Parameters<UtilityHandlers['executeJS']>[0]) {
    return this.utilityHandlers.executeJS(options);
  }

  protected async extractLinks(options: Parameters<UtilityHandlers['extractLinks']>[0]) {
    return this.utilityHandlers.extractLinks(options);
  }

  protected async batchCrawl(options: Parameters<CrawlHandlers['batchCrawl']>[0]) {
    return this.crawlHandlers.batchCrawl(options);
  }

  protected async smartCrawl(options: Parameters<CrawlHandlers['smartCrawl']>[0]) {
    return this.crawlHandlers.smartCrawl(options);
  }

  protected async crawlRecursive(options: Parameters<CrawlHandlers['crawlRecursive']>[0]) {
    return this.crawlHandlers.crawlRecursive(options);
  }

  protected async parseSitemap(options: Parameters<CrawlHandlers['parseSitemap']>[0]) {
    return this.crawlHandlers.parseSitemap(options);
  }

  protected async crawl(options: Parameters<CrawlHandlers['crawl']>[0]) {
    return this.crawlHandlers.crawl(options);
  }

  // Setter for axiosClient to update all handlers (for testing)
  set axiosClientForTesting(client: AxiosInstance) {
    this.axiosClient = client;
    // Re-initialize handlers with new client
    this.contentHandlers = new ContentHandlers(this.service, client, this.sessions);
    this.sessionHandlers = new SessionHandlers(this.service, client, this.sessions);
    this.utilityHandlers = new UtilityHandlers(this.service, client, this.sessions);
    this.crawlHandlers = new CrawlHandlers(this.service, client, this.sessions);
  }

  /* istanbul ignore next */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`${this.serverName} v${this.serverVersion} started`);
  }
}
