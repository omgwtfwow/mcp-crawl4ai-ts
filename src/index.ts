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

class Crawl4AIServer {
  private server: Server;
  private axiosClient: AxiosInstance;

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
          description: 'Crawl with advanced configuration options (cache mode, custom headers, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to crawl',
              },
              cache_mode: {
                type: 'string',
                enum: ['bypass', 'read', 'write', 'read_write'],
                description: 'Cache mode for the request',
                default: 'bypass',
              },
              headers: {
                type: 'object',
                description: 'Custom HTTP headers',
              },
              wait_until: {
                type: 'string',
                enum: ['domcontentloaded', 'networkidle', 'load'],
                description: 'When to consider page loaded',
                default: 'networkidle',
              },
              exclude_tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'HTML tags to exclude from content',
              },
              include_links: {
                type: 'boolean',
                description: 'Include link extraction in response',
                default: true,
              },
            },
            required: ['url'],
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
      const response = await this.axiosClient.post('/execute_js', {
        url: options.url,
        js_code: options.js_code,
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

  private async crawlWithConfig(options: {
    url: string;
    cache_mode?: string;
    headers?: Record<string, string>;
    wait_until?: string;
    exclude_tags?: string[];
    include_links?: boolean;
  }) {
    try {
      // Build request payload with advanced options
      const payload: any = {
        url: options.url,
        bypass_cache: options.cache_mode === 'bypass',
      };

      // Add custom headers if provided
      if (options.headers) {
        payload.headers = options.headers;
      }

      // Add wait condition
      if (options.wait_until) {
        payload.wait_until = options.wait_until;
      }

      // Add tag exclusions
      if (options.exclude_tags && options.exclude_tags.length > 0) {
        payload.filter_mode = 'blacklist';
        payload.filter_list = options.exclude_tags;
      }

      const response = await this.axiosClient.post('/md', payload);
      const result: CrawlResult = response.data;

      const content = [
        {
          type: 'text',
          text: `Advanced crawl completed:\n\nURL: ${options.url}\nCache mode: ${options.cache_mode || 'bypass'}\nContent length: ${result.markdown?.length || 0} chars\n\n${result.markdown || 'No content extracted'}`,
        },
      ];

      // Include links if requested
      if (options.include_links !== false && result.links) {
        content.push({
          type: 'text',
          text: `\n\n---\nLinks found:\nInternal: ${result.links.internal?.length || 0}\nExternal: ${result.links.external?.length || 0}`,
        });
      }

      return { content };
    } catch (error: any) {
      throw new Error(`Failed to crawl with config: ${error.response?.data?.detail || error.message}`);
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
