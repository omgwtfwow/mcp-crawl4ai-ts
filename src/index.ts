#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { CrawlOptions, CrawlResult, JSExecuteOptions, BatchCrawlOptions } from './types.js';

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

    this.setupHandlers();
  }

  private setupHandlers() {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'crawl_page',
          description: 'Crawl a webpage and extract markdown content with various filtering options',
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
                description: 'CSS selector to wait for before extracting content',
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
          description: 'Capture a screenshot of a webpage',
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
          description: 'Generate a PDF from a webpage',
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
          description: 'Execute JavaScript on a webpage before crawling',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to load',
              },
              js_code: {
                type: 'string',
                description: 'JavaScript code to execute',
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
          description: 'Crawl multiple URLs in parallel',
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
                description: 'Maximum concurrent requests',
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
          description: 'Intelligently crawl a URL with automatic detection of content type (sitemap, RSS, text, HTML)',
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
          description: 'Extract raw HTML content from a webpage',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract HTML from',
              },
              wait_for: {
                type: 'string',
                description: 'CSS selector to wait for',
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
          description: 'Extract and analyze all links from a webpage',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract links from',
              },
              categorize: {
                type: 'boolean',
                description: 'Categorize links (internal/external/social/etc)',
                default: true,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'crawl_recursive',
          description: 'Recursively crawl a website following internal links up to a specified depth',
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
                description: 'Regex pattern for URLs to include',
              },
              exclude_pattern: {
                type: 'string',
                description: 'Regex pattern for URLs to exclude',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'parse_sitemap',
          description: 'Parse a sitemap.xml file and extract all URLs',
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
            'Advanced web crawling with full browser and crawler configuration options. Supports JavaScript execution, session management, content filtering, and multiple extraction strategies',
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
                  'Custom browser identification string. Use to bypass bot detection or access mobile-specific content',
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
                description: 'Minimum words per text block to include. Filters out navigation and sparse content',
                default: 200,
              },
              excluded_tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'HTML tags to exclude from extraction (e.g., ["nav", "footer", "aside"])',
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
                  'JavaScript to execute after page loads. String or array of scripts for clicking, scrolling, or data extraction',
              },
              wait_for: {
                type: 'string',
                description:
                  'Wait condition: CSS selector (e.g., ".loaded"), JS expression returning boolean, or "domcontentloaded"/"networkidle"',
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
                description: 'Reuse browser session for multi-step workflows. Maintains cookies and auth state',
              },
              cache_mode: {
                type: 'string',
                enum: ['ENABLED', 'BYPASS', 'DISABLED'],
                description:
                  'ENABLED: Use cache if available, BYPASS: Fetch fresh but update cache, DISABLED: No caching',
                default: 'BYPASS',
              },
              extraction_type: {
                type: 'string',
                enum: ['llm', 'css', 'xpath', 'json_css'],
                description: 'Extraction strategy type. LLM for semantic extraction, CSS/XPath for precise selectors',
              },
              llm_provider: {
                type: 'string',
                description: 'LLM provider for extraction (e.g., "openai/gpt-4o-mini")',
              },
              llm_api_key: {
                type: 'string',
                description: 'API key for LLM provider',
              },
              extraction_schema: {
                type: 'object',
                description: 'JSON schema for structured extraction with LLM',
              },
              extraction_instruction: {
                type: 'string',
                description: 'Natural language instruction for LLM extraction',
              },
              css_selectors: {
                type: 'object',
                description: 'Mapping of field names to CSS selectors for extraction',
              },
              timeout: {
                type: 'number',
                description: 'Overall request timeout in milliseconds',
                default: 60000,
              },
              verbose: {
                type: 'boolean',
                description: 'Enable detailed logging for debugging',
                default: false,
              },

              // Additional Crawler Parameters
              wait_until: {
                type: 'string',
                enum: ['domcontentloaded', 'networkidle', 'load'],
                description: 'Navigation completion condition. "networkidle" waits for no network activity',
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
                description: 'Auto-scroll to load all dynamic content (infinite scroll)',
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
                description: 'CSS selector for elements to exclude (e.g., "#ads, .tracker")',
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
                description: 'Only execute JS without reloading page (requires session_id)',
                default: false,
              },
              simulate_user: {
                type: 'boolean',
                description: 'Simulate human-like mouse movements to avoid bot detection',
                default: false,
              },
              override_navigator: {
                type: 'boolean',
                description: 'Override navigator properties for stealth',
                default: false,
              },
              magic: {
                type: 'boolean',
                description: 'Experimental: Auto-handle popups and consent banners',
                default: false,
              },

              // Virtual Scroll Configuration
              virtual_scroll_config: {
                type: 'object',
                description: 'Configuration for sites with virtual scrolling (Twitter, Instagram)',
                properties: {
                  container_selector: {
                    type: 'string',
                    description: 'CSS selector for the scrollable container',
                  },
                  scroll_count: {
                    type: 'number',
                    description: 'Number of scroll iterations',
                    default: 10,
                  },
                  scroll_by: {
                    type: ['string', 'number'],
                    description: 'Scroll amount: "container_height", "page_height", or pixels',
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
            'Create a new browser session reference for stateful crawling. Sessions persist on the Crawl4AI server and maintain cookies, login state, and JavaScript context across requests',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Unique identifier for the session (auto-generated if not provided)',
              },
              initial_url: {
                type: 'string',
                description: 'Optional URL to pre-warm the session by making an initial crawl',
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
          description: 'Remove session from local tracking (actual browser session on server persists until timeout)',
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
            'List all locally tracked browser sessions. Note: These are session references - actual server state may differ',
          inputSchema: {
            type: 'object',
            properties: {},
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
      // Ensure scripts is always an array
      const scripts = Array.isArray(options.js_code) ? options.js_code : [options.js_code];

      const response = await this.axiosClient.post('/execute_js', {
        url: options.url,
        scripts: scripts,
        wait_after_js: options.wait_after_js,
        screenshot: options.screenshot,
      });

      const result: CrawlResult = response.data;

      return {
        content: [
          {
            type: 'text',
            text: `JavaScript executed successfully on: ${options.url}\n\nExtracted content:\n${result.markdown || result.html || 'No content'}`,
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
      if (options.js_code) crawler_config.js_code = options.js_code;
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
      if (options.cache_mode) crawler_config.cache_mode = options.cache_mode;

      // Extraction strategy
      if (options.extraction_type) {
        crawler_config.extraction_strategy = { type: options.extraction_type };

        if (options.extraction_type === 'llm') {
          if (options.llm_provider) {
            crawler_config.extraction_strategy.llm_config = {
              provider: options.llm_provider,
              api_key: options.llm_api_key,
            };
          }
          if (options.extraction_schema) crawler_config.extraction_strategy.schema = options.extraction_schema;
          if (options.extraction_instruction)
            crawler_config.extraction_strategy.instruction = options.extraction_instruction;
        } else if (options.css_selectors) {
          crawler_config.extraction_strategy.selectors = options.css_selectors;
        }
      }

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

      // Call /crawl endpoint
      const response = await this.axiosClient.post('/crawl', {
        urls: [options.url],
        browser_config,
        crawler_config,
      });

      const results = response.data.results || [];
      const result = results[0] || response.data;

      // Build response content
      const content = [];

      // Main content - ensure we get a string
      let mainContent = 'No content extracted';
      if (result.markdown && typeof result.markdown === 'string') {
        mainContent = result.markdown;
      } else if (result.content && typeof result.content === 'string') {
        mainContent = result.content;
      } else if (result.html && typeof result.html === 'string') {
        mainContent = result.html;
      } else if (result.text && typeof result.text === 'string') {
        mainContent = result.text;
      } else if (typeof result === 'string') {
        mainContent = result;
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

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
  }
}

// Start the server
const server = new Crawl4AIServer();
server.start().catch(console.error);
