#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { z } from 'zod';
import {
  CrawlResult,
  BatchCrawlOptions,
  CrawlEndpointResponse,
  CrawlResultItem,
  HTMLEndpointOptions,
  HTMLEndpointResponse,
  JSExecuteEndpointOptions,
  JSExecuteEndpointResponse,
  ScreenshotEndpointOptions,
  ScreenshotEndpointResponse,
  PDFEndpointOptions,
  PDFEndpointResponse,
  MarkdownEndpointOptions,
  MarkdownEndpointResponse,
  FilterType,
} from './types.js';
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

// Validation schemas
// Helper to validate JavaScript code
const validateJavaScriptCode = (code: string): boolean => {
  // Check for common HTML entities that shouldn't be in JS
  if (/&quot;|&amp;|&lt;|&gt;|&#\d+;|&\w+;/.test(code)) {
    return false;
  }

  // Basic check to ensure it's not HTML
  if (/<(!DOCTYPE|html|body|head|script|style)\b/i.test(code)) {
    return false;
  }

  // Check for literal \n, \t, \r outside of strings (common LLM mistake)
  // This is tricky - we'll check if the code has these patterns in a way that suggests
  // they're meant to be actual newlines/tabs rather than escape sequences in strings
  // Look for patterns like: ;\n or }\n or )\n which suggest literal newlines
  if (/[;})]\s*\\n|\\n\s*[{(/]/.test(code)) {
    return false;
  }

  // Check for obvious cases of literal \n between statements
  if (/[;})]\s*\\n\s*\w/.test(code)) {
    return false;
  }

  return true;
};

const JsCodeSchema = z
  .union([
    z.string().refine(validateJavaScriptCode, {
      message:
        'Invalid JavaScript: Contains HTML entities (&quot;), literal \\n outside strings, or HTML tags. Use proper JS syntax with real quotes and newlines.',
    }),
    z.array(
      z.string().refine(validateJavaScriptCode, {
        message:
          'Invalid JavaScript: Contains HTML entities (&quot;), literal \\n outside strings, or HTML tags. Use proper JS syntax with real quotes and newlines.',
      }),
    ),
  ])
  .describe('JavaScript code as string or array of strings');

// Helper to create schema that rejects session_id
const createStatelessSchema = <T extends z.ZodTypeAny>(schema: T, toolName: string) => {
  // Tool-specific guidance for common scenarios
  const toolGuidance: Record<string, string> = {
    capture_screenshot: 'To capture screenshots with sessions, use crawl(session_id, screenshot: true)',
    generate_pdf: 'To generate PDFs with sessions, use crawl(session_id, pdf: true)',
    execute_js: 'To run JavaScript with sessions, use crawl(session_id, js_code: [...])',
    get_html: 'To get HTML with sessions, use crawl(session_id)',
    extract_with_llm: 'To extract data with sessions, first use crawl(session_id) then extract from the response',
  };

  const message = `${toolName} does not support session_id. This tool is stateless - each call creates a new browser. ${
    toolGuidance[toolName] || 'For persistent operations, use crawlg with session_id.'
  }`;

  return z
    .object({
      session_id: z.never({ message }).optional(),
    })
    .passthrough()
    .and(schema)
    .transform((data) => {
      const { session_id, ...rest } = data as any;
      if (session_id !== undefined) {
        throw new Error(message);
      }
      return rest;
    });
};

const ExecuteJsSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    scripts: JsCodeSchema,
  }),
  'execute_js',
);

const GetMarkdownSchema = createStatelessSchema(
  z
    .object({
      url: z.string().url(),
      filter: z.enum(['raw', 'fit', 'bm25', 'llm']).optional().default('fit'),
      query: z.string().optional(),
      cache: z.string().optional().default('0'),
    })
    .refine(
      (data) => {
        // If filter is bm25 or llm, query is required
        if ((data.filter === 'bm25' || data.filter === 'llm') && !data.query) {
          return false;
        }
        return true;
      },
      {
        message: 'Query parameter is required when using bm25 or llm filter',
        path: ['query'],
      },
    ),
  'get_markdown',
);

const VirtualScrollConfigSchema = z.object({
  container_selector: z.string(),
  scroll_count: z.number().optional(),
  scroll_by: z.union([z.string(), z.number()]).optional(),
  wait_after_scroll: z.number().optional(),
});

// Add schemas for other stateless tools
const GetHtmlSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
  }),
  'get_html',
);

const CaptureScreenshotSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    screenshot_wait_for: z.number().optional(),
    // output_path not exposed as MCP needs base64 data
  }),
  'capture_screenshot',
);

const GeneratePdfSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    // Only url is supported - output_path not exposed as MCP needs base64 data
  }),
  'generate_pdf',
);

const ExtractWithLlmSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    query: z.string(),
  }),
  'extract_with_llm',
);

const BatchCrawlSchema = createStatelessSchema(
  z.object({
    urls: z.array(z.string().url()),
    max_concurrent: z.number().optional(),
    remove_images: z.boolean().optional(),
    bypass_cache: z.boolean().optional(),
  }),
  'batch_crawl',
);

const SmartCrawlSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    max_depth: z.number().optional(),
    follow_links: z.boolean().optional(),
    bypass_cache: z.boolean().optional(),
  }),
  'smart_crawl',
);

const ExtractLinksSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    categorize: z.boolean().optional().default(true),
  }),
  'extract_links',
);

const CrawlRecursiveSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    max_depth: z.number().optional(),
    max_pages: z.number().optional(),
    filter_pattern: z.string().optional(),
    bypass_cache: z.boolean().optional(),
  }),
  'crawl_recursive',
);

const ParseSitemapSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    filter_pattern: z.string().optional(),
  }),
  'parse_sitemap',
);

// Session management tools don't need stateless schema
const CreateSessionSchema = z.object({
  session_id: z.string(),
  initial_url: z.string().optional(),
  browser_type: z.string().optional(),
});

const ClearSessionSchema = z.object({
  session_id: z.string(),
});

const CrawlSchema = z
  .object({
    url: z.string().url(),

    // Browser configuration
    browser_type: z.enum(['chromium', 'firefox', 'webkit']).optional(),
    viewport_width: z.number().optional(),
    viewport_height: z.number().optional(),
    user_agent: z.string().optional(),
    proxy_server: z.string().optional(),
    proxy_username: z.string().optional(),
    proxy_password: z.string().optional(),
    cookies: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
          domain: z.string(),
          path: z.string().optional(),
        }),
      )
      .optional(),
    headers: z.record(z.string()).optional(),
    extra_args: z.array(z.string()).optional(),

    // Content filtering
    word_count_threshold: z.number().optional(),
    excluded_tags: z.array(z.string()).optional(),
    excluded_selector: z.string().optional(),
    remove_overlay_elements: z.boolean().optional(),
    only_text: z.boolean().optional(),
    remove_forms: z.boolean().optional(),
    keep_data_attributes: z.boolean().optional(),

    // JavaScript execution
    js_code: JsCodeSchema.optional(),
    js_only: z.boolean().optional(),
    wait_for: z.string().optional(),
    wait_for_timeout: z.number().optional(),

    // Page navigation & timing
    wait_until: z.enum(['domcontentloaded', 'networkidle', 'load']).optional(),
    page_timeout: z.number().optional(),
    wait_for_images: z.boolean().optional(),
    ignore_body_visibility: z.boolean().optional(),

    // Dynamic content
    delay_before_scroll: z.number().optional(),
    scroll_delay: z.number().optional(),
    scan_full_page: z.boolean().optional(),
    virtual_scroll_config: VirtualScrollConfigSchema.optional(),

    // Content processing
    process_iframes: z.boolean().optional(),
    exclude_external_links: z.boolean().optional(),

    // Media handling
    screenshot: z.boolean().optional(),
    screenshot_wait_for: z.number().optional(),
    pdf: z.boolean().optional(),
    capture_mhtml: z.boolean().optional(),
    image_description_min_word_threshold: z.number().optional(),
    image_score_threshold: z.number().optional(),
    exclude_external_images: z.boolean().optional(),

    // Link filtering
    exclude_social_media_links: z.boolean().optional(),
    exclude_domains: z.array(z.string()).optional(),

    // Page interaction
    simulate_user: z.boolean().optional(),
    override_navigator: z.boolean().optional(),
    magic: z.boolean().optional(),

    // Session and cache
    session_id: z.string().optional(),
    cache_mode: z.enum(['ENABLED', 'BYPASS', 'DISABLED']).optional(),

    // Performance options
    timeout: z.number().optional(),
    verbose: z.boolean().optional(),

    // Debug
    log_console: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // js_only is for subsequent calls in same session, not first call
      // Using it incorrectly causes server errors
      if (data.js_only && !data.session_id) {
        return false;
      }
      return true;
    },
    {
      message:
        "Error: js_only requires session_id (it's for continuing existing sessions).\n" +
        'For first call with js_code, use: {js_code: [...], screenshot: true}\n' +
        'For multi-step: First {js_code: [...], session_id: "x"}, then {js_only: true, session_id: "x"}',
    },
  )
  .refine(
    (data) => {
      // Empty js_code array is not allowed
      if (Array.isArray(data.js_code) && data.js_code.length === 0) {
        return false;
      }
      return true;
    },
    {
      message:
        'Error: js_code array cannot be empty. Either provide JavaScript code to execute or remove the js_code parameter entirely.',
    },
  );

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
          name: 'get_markdown',
          description:
            'Extract content as markdown with filtering options. Supports: raw (full content), fit (optimized, default), bm25 (keyword search), llm (AI-powered extraction). Use bm25/llm with query for specific content. STATELESS: Creates new browser each time. For persistence use create_session + crawl.',
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
            "Capture webpage screenshot. Returns base64-encoded PNG data. STATELESS: Creates new browser each time. IMPORTANT: Chained calls (execute_js then capture_screenshot) will NOT work - the screenshot won't see JS changes! For JS changes + screenshot use create_session + crawl(session_id, js_code, screenshot:true) in ONE call.",
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
            },
            required: ['url'],
          },
        },
        {
          name: 'generate_pdf',
          description:
            'Convert webpage to PDF. Returns base64-encoded PDF data. STATELESS: Creates new browser each time. Cannot capture form fills or JS changes. For persistent PDFs use create_session + crawl(session_id, pdf:true).',
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
            'Execute JavaScript and get return values + page content. STATELESS: Creates new browser each time. Use for: extracting data, triggering dynamic content, checking page state. Scripts with "return" statements return actual values (strings, numbers, objects, arrays). Note: null returns as {"success": true}. For persistent operations use create_session + crawl.',
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
            'Crawl multiple URLs concurrently for efficiency. Use when: processing URL lists, comparing multiple pages, or bulk data extraction. Faster than sequential crawling. Max 5 concurrent by default. STATELESS: Each URL gets a fresh browser. Cannot maintain state between URLs. For persistent operations use create_session + crawl.',
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
            'Auto-detect and handle different content types (HTML, sitemap, RSS, text). Use when: URL type is unknown, crawling feeds/sitemaps, or want automatic format handling. Adapts strategy based on content. STATELESS: Creates new browser each time. For persistent operations use create_session + crawl.',
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
            'Get sanitized/processed HTML optimized for schema extraction. Use when: building schemas, analyzing HTML structure, extracting patterns. Returns preprocessed HTML (not raw). For raw HTML or dynamic content use get_markdown or execute_js. STATELESS: Creates new browser each time.',
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
            'Extract and categorize all page links. Use when: building sitemaps, analyzing site structure, finding broken links, or discovering resources. Groups by internal/external/social/documents. STATELESS: Creates new browser each time. For persistent operations use create_session + crawl.',
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
            'Deep crawl a website following internal links. Use when: mapping entire sites, finding all pages, building comprehensive indexes. Control with max_depth (default 3) and max_pages (default 50). Note: May need JS execution for dynamic sites. STATELESS: Each page gets a fresh browser. For persistent operations use create_session + crawl.',
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
            'Extract URLs from XML sitemaps. Use when: discovering all site pages, planning crawl strategies, or checking sitemap validity. Supports regex filtering. Try sitemap.xml or robots.txt first. STATELESS: Creates new browser each time.',
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
            'THE ONLY TOOL WITH BROWSER PERSISTENCE\n\n' +
            'WITH session_id: Maintains browser state (cookies, localStorage, page) across calls\n' +
            'WITHOUT session_id: Creates fresh browser each time (like other tools)\n\n' +
            'CRITICAL FOR js_code:\n' +
            'RECOMMENDED: Always use screenshot: true when running js_code\n' +
            'This avoids server serialization errors and gives visual confirmation\n\n' +
            'ADVANCED (js_only): Only for continuing existing sessions:\n' +
            '1st call: {url, session_id: "s1", js_code: [...], screenshot: true}\n' +
            '2nd call: {url, session_id: "s1", js_code: [...], js_only: true}\n\n' +
            'COMMON USE CASES:\n' +
            '• Form + screenshot: crawl({url, js_code: ["fill & submit"], screenshot: true})\n' +
            '• Multi-step: 1) crawl({url, session_id: "s1", js_code: ["fill form"]})\n' +
            '              2) crawl({url, session_id: "s1", js_code: ["submit"], js_only: true})\n' +
            '• Reuse session: crawl({url: "/page2", session_id: "s1"}) // same browser',
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
                  'USAGE PATTERNS:\n' +
                  '1. WITH screenshot/pdf: {js_code: [...], screenshot: true} ✓\n' +
                  '2. MULTI-STEP: First {js_code: [...], session_id: "x"}, then {js_only: true, session_id: "x"}\n' +
                  '3. AVOID: {js_code: [...], js_only: true} on first call ✗\n\n' +
                  'SELECTOR TIPS: Use get_html first to find:\n' +
                  '  • name="..." (best for forms)\n' +
                  '  • id="..." (if unique)\n' +
                  '  • class="..." (careful, may repeat)\n\n' +
                  'FORM EXAMPLE: [\n' +
                  '  "document.querySelector(\'input[name=\\"email\\"]\').value = \'user@example.com\'",\n' +
                  '  "document.querySelector(\'button[type=\\"submit\\"]\').click()"\n' +
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
          name: 'create_session',
          description:
            'CREATES PERSISTENT BROWSER! Returns session_id for use with crawl. Browser stays alive across multiple calls, maintaining ALL state (cookies, localStorage, page). Other tools CANNOT use sessions - they create new browser each time. Essential for: forms, login flows, multi-step processes.',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description:
                  'Custom session identifier. Auto-generated if not provided. Use this EXACT ID in all subsequent crawl calls to reuse the browser.',
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
            'Ask questions about webpage content using AI. Returns natural language answers. ' +
            'STATELESS: Crawls fresh each time. For dynamic content or sessions, use crawl with session_id first.',
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
            try {
              const validatedArgs = GetMarkdownSchema.parse(args);
              return await this.getMarkdown(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for get_markdown: ${details}`);
              }
              throw error;
            }

          case 'capture_screenshot':
            try {
              const validatedArgs = CaptureScreenshotSchema.parse(args);
              return await this.captureScreenshot(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for capture_screenshot: ${details}`);
              }
              throw error;
            }

          case 'generate_pdf':
            try {
              const validatedArgs = GeneratePdfSchema.parse(args);
              return await this.generatePDF(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for generate_pdf: ${details}`);
              }
              throw error;
            }

          case 'execute_js':
            try {
              const validatedArgs = ExecuteJsSchema.parse(args);
              return await this.executeJS(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for execute_js: ${details}`);
              }
              throw error;
            }

          case 'batch_crawl':
            try {
              const validatedArgs = BatchCrawlSchema.parse(args);
              return await this.batchCrawl(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for batch_crawl: ${details}`);
              }
              throw error;
            }

          case 'smart_crawl':
            try {
              const validatedArgs = SmartCrawlSchema.parse(args);
              return await this.smartCrawl(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for smart_crawl: ${details}`);
              }
              throw error;
            }

          case 'get_html':
            try {
              const validatedArgs = GetHtmlSchema.parse(args);
              return await this.getHTML(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for get_html: ${details}`);
              }
              throw error;
            }

          case 'extract_links':
            try {
              const validatedArgs = ExtractLinksSchema.parse(args);
              return await this.extractLinks(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for extract_links: ${details}`);
              }
              throw error;
            }

          case 'crawl_recursive':
            try {
              const validatedArgs = CrawlRecursiveSchema.parse(args);
              return await this.crawlRecursive(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for crawl_recursive: ${details}`);
              }
              throw error;
            }

          case 'parse_sitemap':
            try {
              const validatedArgs = ParseSitemapSchema.parse(args);
              return await this.parseSitemap(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for parse_sitemap: ${details}`);
              }
              throw error;
            }

          case 'crawl':
            try {
              const validatedArgs = CrawlSchema.parse(args);
              return await this.crawl(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for crawl: ${details}`);
              }
              throw error;
            }

          case 'create_session':
            try {
              const validatedArgs = CreateSessionSchema.parse(args);
              return await this.createSession(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for create_session: ${details}`);
              }
              throw error;
            }

          case 'clear_session':
            try {
              const validatedArgs = ClearSessionSchema.parse(args);
              return await this.clearSession(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for clear_session: ${details}`);
              }
              throw error;
            }

          case 'list_sessions':
            return await this.listSessions();

          case 'extract_with_llm':
            try {
              const validatedArgs = ExtractWithLlmSchema.parse(args);
              return await this.extractWithLLM(validatedArgs);
            } catch (error) {
              if (error instanceof z.ZodError) {
                const details = error.errors
                  .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
                  .join(', ');
                throw new Error(`Invalid parameters for extract_with_llm: ${details}`);
              }
              throw error;
            }

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

  private async getMarkdown(
    options: Omit<MarkdownEndpointOptions, 'f' | 'q' | 'c'> & { filter?: string; query?: string; cache?: string },
  ) {
    try {
      // Map from schema property names to API parameter names
      const result: MarkdownEndpointResponse = await this.service.getMarkdown({
        url: options.url,
        f: options.filter as FilterType | undefined, // Schema provides 'filter', API expects 'f'
        q: options.query, // Schema provides 'query', API expects 'q'
        c: options.cache, // Schema provides 'cache', API expects 'c'
      });

      // Format the response
      let formattedText = `URL: ${result.url}\nFilter: ${result.filter}`;

      if (result.query) {
        formattedText += `\nQuery: ${result.query}`;
      }

      formattedText += `\nCache: ${result.cache}\n\nMarkdown:\n${result.markdown || 'No content found.'}`;

      return {
        content: [
          {
            type: 'text',
            text: formattedText,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to get markdown: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async captureScreenshot(options: ScreenshotEndpointOptions) {
    try {
      const result: ScreenshotEndpointResponse = await this.service.captureScreenshot(options);

      // Response has { success: true, screenshot: "base64string" }
      if (!result.success || !result.screenshot) {
        throw new Error('Screenshot capture failed - no screenshot data in response');
      }

      return {
        content: [
          {
            type: 'image',
            data: result.screenshot,
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

  private async generatePDF(options: PDFEndpointOptions) {
    try {
      const result: PDFEndpointResponse = await this.service.generatePDF(options);

      // Response has { success: true, pdf: "base64string" }
      if (!result.success || !result.pdf) {
        throw new Error('PDF generation failed - no PDF data in response');
      }

      return {
        content: [
          {
            type: 'resource',
            uri: `data:application/pdf;base64,${result.pdf}`,
            data: result.pdf,
            mimeType: 'application/pdf',
          },
          {
            type: 'text',
            text: `PDF generated for: ${options.url}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to generate PDF: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async executeJS(options: JSExecuteEndpointOptions) {
    try {
      // Check if scripts is provided
      if (!options.scripts || options.scripts === null) {
        throw new Error(
          'scripts is required. Please provide JavaScript code to execute. Use "return" statements to get values back.',
        );
      }

      const result: JSExecuteEndpointResponse = await this.service.executeJS(options);

      // Extract JavaScript execution results
      const jsResults = result.js_execution_result?.results || [];
      // Ensure scripts is always an array for mapping
      const scripts = Array.isArray(options.scripts) ? options.scripts : [options.scripts];

      // Format results for display
      let formattedResults = '';
      if (jsResults.length > 0) {
        formattedResults = jsResults
          .map((res: any, idx: number) => {
            const script = scripts[idx] || 'Script ' + (idx + 1);
            // Handle the actual return value or success/error status
            let resultStr = '';
            if (res && typeof res === 'object' && 'success' in res) {
              // This is a status object (e.g., from null return or execution without return)
              resultStr = res.success
                ? 'Executed successfully (no return value)'
                : `Error: ${res.error || 'Unknown error'}`;
            } else {
              // This is an actual return value
              resultStr = JSON.stringify(res, null, 2);
            }
            return `Script: ${script}\nReturned: ${resultStr}`;
          })
          .join('\n\n');
      } else {
        formattedResults = 'No results returned';
      }

      return {
        content: [
          {
            type: 'text',
            text: `JavaScript executed on: ${options.url}\n\nResults:\n${formattedResults}${result.markdown ? `\n\nPage Content After Execution:\n${typeof result.markdown === 'string' ? result.markdown : JSON.stringify(result.markdown, null, 2)}` : ''}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to execute JavaScript: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async batchCrawl(options: BatchCrawlOptions) {
    try {
      // Build crawler config if needed
      const crawler_config: any = {};

      // Handle remove_images by using exclude_tags
      if (options.remove_images) {
        crawler_config.exclude_tags = ['img', 'picture', 'svg'];
      }

      if (options.bypass_cache) {
        crawler_config.cache_mode = 'BYPASS';
      }

      const response = await this.axiosClient.post('/crawl', {
        urls: options.urls,
        max_concurrent: options.max_concurrent,
        crawler_config: Object.keys(crawler_config).length > 0 ? crawler_config : undefined,
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
      const headResponse = await this.axiosClient.head(options.url).catch((error) => {
        // If server returns 500, provide helpful message
        if (error.response?.status === 500) {
          throw new Error(
            `Server error (500) at ${options.url}. The server may be experiencing temporary issues. Please try again later.`,
          );
        }
        return null;
      });
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
      const response = await this.axiosClient
        .post('/crawl', {
          urls: [options.url],
          strategy,
          max_depth: options.max_depth,
          bypass_cache: options.bypass_cache,
        })
        .catch((error) => {
          if (error.response?.status === 500) {
            // Fallback to basic crawl if smart features fail
            console.error('Smart crawl failed with 500, falling back to basic crawl');
            return this.axiosClient.post('/crawl', {
              urls: [options.url],
              bypass_cache: options.bypass_cache,
            });
          }
          throw error;
        });

      const results = response.data.results || [];
      const result = results[0] || {};

      // Handle follow_links for sitemaps and RSS feeds
      if (options.follow_links && (strategy === 'sitemap' || strategy === 'rss')) {
        // Extract URLs from the content
        const urlPattern = /<loc>(.*?)<\/loc>|<link[^>]*>(.*?)<\/link>|href=["']([^"']+)["']/gi;
        const content = result.markdown || result.html || '';
        const foundUrls: string[] = [];
        let match;

        while ((match = urlPattern.exec(content)) !== null) {
          const url = match[1] || match[2] || match[3];
          if (url && url.startsWith('http')) {
            foundUrls.push(url);
          }
        }

        if (foundUrls.length > 0) {
          // Limit to first 10 URLs to avoid overwhelming the system
          const urlsToFollow = foundUrls.slice(0, Math.min(10, options.max_depth || 10));

          // Crawl the found URLs
          await this.axiosClient.post('/crawl', {
            urls: urlsToFollow,
            max_concurrent: 3,
            bypass_cache: options.bypass_cache,
          });

          // const followResults = followResponse.data.results || [];

          return {
            content: [
              {
                type: 'text',
                text: `Smart crawl detected content type: ${strategy}\n\nMain content:\n${result.markdown || result.content || 'No content extracted'}\n\n---\nFollowed ${urlsToFollow.length} links:\n${urlsToFollow.map((url, i) => `${i + 1}. ${url}`).join('\n')}`,
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
        }
      }

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

  private async getHTML(options: HTMLEndpointOptions) {
    try {
      const result: HTMLEndpointResponse = await this.service.getHTML(options);

      // Response has { html: string, url: string, success: true }
      return {
        content: [
          {
            type: 'text',
            text: result.html || '',
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to get HTML: ${error.response?.data?.detail || error.message}`);
    }
  }

  private async extractLinks(options: { url: string; categorize?: boolean }) {
    try {
      // Use crawl endpoint instead of md to get full link data
      const response = await this.axiosClient.post('/crawl', {
        urls: [options.url],
        crawler_config: {
          cache_mode: 'bypass',
        },
      });

      const results = response.data.results || [response.data];
      const result: CrawlResultItem = results[0] || {};

      // Variables for manually extracted links
      let manuallyExtractedInternal: string[] = [];
      let manuallyExtractedExternal: string[] = [];
      let hasManuallyExtractedLinks = false;

      // Check if the response is likely JSON or non-HTML content
      if (!result.links || (result.links.internal.length === 0 && result.links.external.length === 0)) {
        // Try to detect if this might be a JSON endpoint
        const markdownContent = result.markdown?.raw_markdown || result.markdown?.fit_markdown || '';
        const htmlContent = result.html || '';
        
        // Check for JSON indicators
        if (
          // Check URL pattern
          options.url.includes('/api/') || 
          options.url.includes('/api.') ||
          // Check content type (often shown in markdown conversion)
          markdownContent.includes('application/json') ||
          // Check for JSON structure patterns
          (markdownContent.startsWith('{') && markdownContent.endsWith('}')) ||
          (markdownContent.startsWith('[') && markdownContent.endsWith(']')) ||
          // Check HTML for JSON indicators
          htmlContent.includes('application/json') ||
          // Common JSON patterns
          markdownContent.includes('"links"') || 
          markdownContent.includes('"url"') ||
          markdownContent.includes('"data"')
        ) {
          return {
            content: [
              {
                type: 'text',
                text: `Note: ${options.url} appears to return JSON data rather than HTML. The extract_links tool is designed for HTML pages with <a> tags. To extract URLs from JSON, you would need to parse the JSON structure directly.`,
              },
            ],
          };
        }
        // If no links found but it's HTML, let's check the markdown content for href patterns
        if (markdownContent && markdownContent.includes('href=')) {
          // Extract links manually from markdown if server didn't provide them
          const hrefPattern = /href=["']([^"']+)["']/g;
          const foundLinks: string[] = [];
          let match;
          while ((match = hrefPattern.exec(markdownContent)) !== null) {
            foundLinks.push(match[1]);
          }
          if (foundLinks.length > 0) {
            hasManuallyExtractedLinks = true;
            // Categorize found links
            const currentDomain = new URL(options.url).hostname;

            foundLinks.forEach((link) => {
              try {
                const linkUrl = new URL(link, options.url);
                if (linkUrl.hostname === currentDomain) {
                  manuallyExtractedInternal.push(linkUrl.href);
                } else {
                  manuallyExtractedExternal.push(linkUrl.href);
                }
              } catch {
                // Relative link
                manuallyExtractedInternal.push(link);
              }
            });
          }
        }
      }

      // Handle both cases: API-provided links and manually extracted links
      let internalUrls: string[] = [];
      let externalUrls: string[] = [];

      if (result.links && (result.links.internal.length > 0 || result.links.external.length > 0)) {
        // Use API-provided links
        internalUrls = result.links.internal.map((link: any) => link.href || link);
        externalUrls = result.links.external.map((link: any) => link.href || link);
      } else if (hasManuallyExtractedLinks) {
        // Use manually extracted links
        internalUrls = manuallyExtractedInternal;
        externalUrls = manuallyExtractedExternal;
      }

      const allUrls = [...internalUrls, ...externalUrls];

      if (!options.categorize) {
        return {
          content: [
            {
              type: 'text',
              text: `All links from ${options.url}:\n${allUrls.join('\n')}`,
            },
          ],
        };
      }
      
      // Categorize links
      const categorized: any = {
        internal: internalUrls,
        external: externalUrls,
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

      externalUrls.forEach((href: string) => {
        if (socialDomains.some((domain) => href.includes(domain))) {
          categorized.social.push(href);
        } else if (docExtensions.some((ext) => href.toLowerCase().endsWith(ext))) {
          categorized.documents.push(href);
        } else if (imageExtensions.some((ext) => href.toLowerCase().endsWith(ext))) {
          categorized.images.push(href);
        } else if (scriptExtensions.some((ext) => href.toLowerCase().endsWith(ext))) {
          categorized.scripts.push(href);
        }
      });

      // Return based on categorize option (defaults to true)
      if (options.categorize) {
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
      } else {
        // Return simple list without categorization
        const allLinks = [...internalUrls, ...externalUrls];
        return {
          content: [
            {
              type: 'text',
              text: `All links from ${options.url} (${allLinks.length} total):\n\n${allLinks.slice(0, 50).join('\n')}${allLinks.length > 50 ? '\n...' : ''}`,
            },
          ],
        };
      }
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

  private async crawl(options: any) {
    try {
      // Ensure options is an object
      if (!options || typeof options !== 'object') {
        throw new Error('crawl requires options object with at least a url parameter');
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
        throw new Error('js_code parameter is null. Please provide JavaScript code as a string or array of strings.');
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

      // Cache control
      if (options.cache_mode) crawler_config.cache_mode = options.cache_mode;

      // Other
      if (options.log_console) crawler_config.log_console = options.log_console;

      // Call service with proper configuration
      const response: CrawlEndpointResponse = await this.service.crawl({
        url: options.url,
        browser_config,
        crawler_config,
      });

      // Validate response structure
      if (!response || !response.results || response.results.length === 0) {
        throw new Error('Invalid response from server: no results received');
      }

      const result: CrawlResultItem = response.results[0];

      // Build response content
      const content = [];

      // Main content - use markdown.raw_markdown as primary content
      let mainContent = 'No content extracted';

      if (result.extracted_content) {
        // Handle extraction results which might be objects or strings
        if (typeof result.extracted_content === 'string') {
          mainContent = result.extracted_content;
        } else if (typeof result.extracted_content === 'object') {
          mainContent = JSON.stringify(result.extracted_content, null, 2);
        }
      } else if (result.markdown?.raw_markdown) {
        mainContent = result.markdown.raw_markdown;
      } else if (result.html) {
        mainContent = result.html;
      } else if (result.fit_html) {
        mainContent = result.fit_html;
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

      // PDF if available
      if (result.pdf) {
        content.push({
          type: 'resource',
          uri: `data:application/pdf;base64,${result.pdf}`,
          data: result.pdf,
          mimeType: 'application/pdf',
        });
        content.push({
          type: 'text',
          text: `PDF generated for: ${options.url}`,
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
      if (result.links && (result.links.internal.length > 0 || result.links.external.length > 0)) {
        content.push({
          type: 'text',
          text: `\n---\nLinks: Internal: ${result.links.internal.length}, External: ${result.links.external.length}`,
        });
      }

      // JS execution results if available
      if (result.js_execution_result && result.js_execution_result.results.length > 0) {
        const jsResults = result.js_execution_result.results
          .map((res: any, idx: number) => {
            return `Result ${idx + 1}: ${JSON.stringify(res, null, 2)}`;
          })
          .join('\n');
        content.push({
          type: 'text',
          text: `\n---\nJavaScript Execution Results:\n${jsResults}`,
        });
      }

      return { content };
    } catch (error: any) {
      throw new Error(`Failed to crawl: ${error.response?.data?.detail || error.message}`);
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
            text: result.answer,
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
