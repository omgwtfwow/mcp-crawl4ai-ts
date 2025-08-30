import { BaseHandler } from './base-handler.js';
import {
  BatchCrawlOptions,
  CrawlResultItem,
  AdvancedCrawlConfig,
  CrawlEndpointResponse,
  ExtractionStrategy,
  TableExtractionStrategy,
  MarkdownGeneratorOptions,
} from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class CrawlHandlers extends BaseHandler {
  async batchCrawl(options: BatchCrawlOptions) {
    try {
      let response;

      // Check if we have per-URL configs (new in 0.7.3/0.7.4)
      if (options.configs && options.configs.length > 0) {
        // Use the new configs array format
        // Extract URLs from configs for the urls field
        const urls = options.configs.map((config) => config.url);
        const requestBody = {
          urls: urls,
          configs: options.configs,
          max_concurrent: options.max_concurrent,
        };
        response = await this.axiosClient.post('/crawl', requestBody);
      } else {
        // Use the legacy format with single crawler_config
        // Build crawler config if needed
        const crawler_config: Record<string, unknown> = {};

        // Handle remove_images by using exclude_tags
        if (options.remove_images) {
          crawler_config.exclude_tags = ['img', 'picture', 'svg'];
        }

        if (options.bypass_cache) {
          crawler_config.cache_mode = 'BYPASS';
        }

        response = await this.axiosClient.post('/crawl', {
          urls: options.urls,
          max_concurrent: options.max_concurrent,
          crawler_config: Object.keys(crawler_config).length > 0 ? crawler_config : undefined,
        });
      }

      const results = response.data.results || [];

      // Add memory metrics if available
      let metricsText = '';
      const responseData = response.data as CrawlEndpointResponse;
      if (responseData.server_memory_delta_mb !== undefined || responseData.server_peak_memory_mb !== undefined) {
        const memoryInfo = [];
        if (responseData.server_processing_time_s !== undefined) {
          memoryInfo.push(`Processing time: ${responseData.server_processing_time_s.toFixed(2)}s`);
        }
        if (responseData.server_memory_delta_mb !== undefined) {
          memoryInfo.push(`Memory delta: ${responseData.server_memory_delta_mb.toFixed(1)}MB`);
        }
        if (responseData.server_peak_memory_mb !== undefined) {
          memoryInfo.push(`Peak memory: ${responseData.server_peak_memory_mb.toFixed(1)}MB`);
        }
        if (memoryInfo.length > 0) {
          metricsText = `\n\nServer metrics: ${memoryInfo.join(', ')}`;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Batch crawl completed. Processed ${results.length} URLs:\n\n${results
              .map(
                (r: CrawlResultItem, i: number) => `${i + 1}. ${options.urls[i]}: ${r.success ? 'Success' : 'Failed'}`,
              )
              .join('\n')}${metricsText}`,
          },
        ],
      };
    } catch (error) {
      throw this.formatError(error, 'batch crawl');
    }
  }

  async smartCrawl(options: { url: string; max_depth?: number; follow_links?: boolean; bypass_cache?: boolean }) {
    try {
      // First, try to detect the content type from URL or HEAD request
      let contentType = '';
      try {
        const headResponse = await this.axiosClient.head(options.url);
        contentType = headResponse.headers['content-type'] || '';
      } catch {
        // If HEAD request fails, continue anyway - we'll detect from the crawl response
        console.debug('HEAD request failed, will detect content type from response');
      }

      let detectedType = 'html';
      if (options.url.includes('sitemap') || options.url.endsWith('.xml')) {
        detectedType = 'sitemap';
      } else if (options.url.includes('rss') || options.url.includes('feed')) {
        detectedType = 'rss';
      } else if (contentType.includes('text/plain') || options.url.endsWith('.txt')) {
        detectedType = 'text';
      } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        detectedType = 'xml';
      } else if (contentType.includes('application/json')) {
        detectedType = 'json';
      }

      // Crawl without the unsupported 'strategy' parameter
      const response = await this.axiosClient.post('/crawl', {
        urls: [options.url],
        crawler_config: {
          cache_mode: options.bypass_cache ? 'BYPASS' : 'ENABLED',
        },
        browser_config: {
          headless: true,
          browser_type: 'chromium',
        },
      });

      const results = response.data.results || [];
      const result = results[0] || {};

      // Handle follow_links for sitemaps and RSS feeds
      if (options.follow_links && (detectedType === 'sitemap' || detectedType === 'rss' || detectedType === 'xml')) {
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

          return {
            content: [
              {
                type: 'text',
                text: `Smart crawl detected content type: ${detectedType}\n\nMain content:\n${result.markdown?.raw_markdown || result.html || 'No content extracted'}\n\n---\nFollowed ${urlsToFollow.length} links:\n${urlsToFollow.map((url, i) => `${i + 1}. ${url}`).join('\n')}`,
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
            text: `Smart crawl detected content type: ${detectedType}\n\n${result.markdown?.raw_markdown || result.html || 'No content extracted'}`,
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
    } catch (error) {
      throw this.formatError(error, 'smart crawl');
    }
  }

  async crawlRecursive(options: {
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
      const results: Array<{ url: string; content: string; internal_links_found: number; depth: number }> = [];
      let maxDepthReached = 0;

      const includeRegex = options.include_pattern ? new RegExp(options.include_pattern) : null;
      const excludeRegex = options.exclude_pattern ? new RegExp(options.exclude_pattern) : null;

      const maxDepth = options.max_depth !== undefined ? options.max_depth : 3;
      const maxPages = options.max_pages || 50;

      while (toVisit.length > 0 && results.length < maxPages) {
        const current = toVisit.shift();
        if (!current || visited.has(current.url) || current.depth > maxDepth) {
          continue;
        }

        visited.add(current.url);

        try {
          // Check URL patterns
          if (excludeRegex && excludeRegex.test(current.url)) continue;
          if (includeRegex && !includeRegex.test(current.url)) continue;

          // Crawl the page using the crawl endpoint to get links
          const response = await this.axiosClient.post('/crawl', {
            urls: [current.url],
            crawler_config: {
              cache_mode: 'BYPASS',
            },
          });

          const crawlResults = response.data.results || [response.data];
          const result: CrawlResultItem = crawlResults[0];

          if (result && result.success) {
            const markdownContent = result.markdown?.fit_markdown || result.markdown?.raw_markdown || '';
            const internalLinksCount = result.links?.internal?.length || 0;
            maxDepthReached = Math.max(maxDepthReached, current.depth);
            results.push({
              url: current.url,
              content: markdownContent,
              internal_links_found: internalLinksCount,
              depth: current.depth,
            });

            // Add internal links to crawl queue
            if (current.depth < maxDepth && result.links?.internal) {
              for (const linkObj of result.links.internal) {
                const linkUrl = linkObj.href || linkObj;
                try {
                  const absoluteUrl = new URL(linkUrl, current.url).toString();
                  if (!visited.has(absoluteUrl) && new URL(absoluteUrl).hostname === startUrl.hostname) {
                    toVisit.push({ url: absoluteUrl, depth: current.depth + 1 });
                  }
                } catch (e) {
                  // Skip invalid URLs
                  console.debug('Invalid URL:', e);
                }
              }
            }
          }
        } catch (error) {
          // Log but continue crawling other pages
          console.error(`Failed to crawl ${current.url}:`, error instanceof Error ? error.message : error);
        }
      }

      // Prepare the output text
      let outputText = `Recursive crawl completed:\n\nPages crawled: ${results.length}\nStarting URL: ${options.url}\n`;

      if (results.length > 0) {
        outputText += `Max depth reached: ${maxDepthReached} (limit: ${maxDepth})\n\nNote: Only internal links (same domain) are followed during recursive crawling.\n\nPages found:\n${results.map((r) => `- [Depth ${r.depth}] ${r.url}\n  Content: ${r.content.length} chars\n  Internal links found: ${r.internal_links_found}`).join('\n')}`;
      } else {
        outputText += `\nNo pages could be crawled. This might be due to:\n- The starting URL returned an error\n- No internal links were found\n- All discovered links were filtered out by include/exclude patterns`;
      }

      return {
        content: [
          {
            type: 'text',
            text: outputText,
          },
        ],
      };
    } catch (error) {
      throw this.formatError(error, 'crawl recursively');
    }
  }

  async parseSitemap(options: { url: string; filter_pattern?: string }) {
    try {
      // Fetch the sitemap directly (not through Crawl4AI server)
      const axios = (await import('axios')).default;
      const response = await axios.get(options.url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MCP-Crawl4AI/1.0)',
        },
      });
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
    } catch (error) {
      throw this.formatError(error, 'parse sitemap');
    }
  }

  async crawl(options: Record<string, unknown>) {
    try {
      // Ensure options is an object
      if (!options || typeof options !== 'object') {
        throw new Error('crawl requires options object with at least a url parameter');
      }

      // Build browser_config
      const browser_config: Record<string, unknown> = {
        headless: true, // Always true as noted
      };

      if (options.browser_type) browser_config.browser_type = options.browser_type;
      if (options.viewport_width) browser_config.viewport_width = options.viewport_width;
      if (options.viewport_height) browser_config.viewport_height = options.viewport_height;
      if (options.user_agent) browser_config.user_agent = options.user_agent;
      if (options.headers) browser_config.headers = options.headers;
      if (options.cookies) browser_config.cookies = options.cookies;

      // Handle proxy configuration - support both unified and legacy formats
      if (options.proxy) {
        // New unified format (0.7.3/0.7.4)
        browser_config.proxy = options.proxy;
      } else if (options.proxy_server) {
        // Legacy format for backward compatibility
        browser_config.proxy_config = {
          server: options.proxy_server,
          username: options.proxy_username,
          password: options.proxy_password,
        };
      }

      // Build crawler_config
      const crawler_config: Record<string, unknown> = {};

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
        const session = this.sessions.get(String(options.session_id));
        if (session) {
          session.last_used = new Date();
        }
      }
      if (options.cache_mode) crawler_config.cache_mode = String(options.cache_mode).toLowerCase();

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
      if (options.capture_mhtml) crawler_config.capture_mhtml = options.capture_mhtml;

      // New parameters from 0.7.3/0.7.4
      if (options.delay_before_return_html) crawler_config.delay_before_return_html = options.delay_before_return_html;
      if (options.css_selector) crawler_config.css_selector = options.css_selector;
      if (options.include_links !== undefined) crawler_config.include_links = options.include_links;
      if (options.resolve_absolute_urls !== undefined)
        crawler_config.resolve_absolute_urls = options.resolve_absolute_urls;

      // Call service with proper configuration
      const crawlConfig: AdvancedCrawlConfig = {
        url: options.url ? String(options.url) : undefined,
        crawler_config,
      };

      // Add extraction strategy passthrough objects if provided
      if (options.extraction_strategy)
        crawlConfig.extraction_strategy = options.extraction_strategy as ExtractionStrategy;
      if (options.table_extraction_strategy)
        crawlConfig.table_extraction_strategy = options.table_extraction_strategy as TableExtractionStrategy;
      if (options.markdown_generator_options)
        crawlConfig.markdown_generator_options = options.markdown_generator_options as MarkdownGeneratorOptions;

      // Only include browser_config if we're not using a session
      if (!options.session_id) {
        crawlConfig.browser_config = browser_config;
      }

      const response: CrawlEndpointResponse = await this.service.crawl(crawlConfig);

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
        // Save to local directory if requested
        let savedFilePath: string | undefined;
        if (options.screenshot_directory && typeof options.screenshot_directory === 'string') {
          try {
            // Resolve home directory path
            let screenshotDir = options.screenshot_directory;
            if (screenshotDir.startsWith('~')) {
              const homedir = os.homedir();
              screenshotDir = path.join(homedir, screenshotDir.slice(1));
            }

            // Check if user provided a file path instead of directory
            if (screenshotDir.endsWith('.png') || screenshotDir.endsWith('.jpg')) {
              console.warn(
                `Warning: screenshot_directory should be a directory path, not a file path. Using parent directory.`,
              );
              screenshotDir = path.dirname(screenshotDir);
            }

            // Ensure directory exists
            await fs.mkdir(screenshotDir, { recursive: true });

            // Generate filename from URL and timestamp
            const url = new URL(String(options.url));
            const hostname = url.hostname.replace(/[^a-z0-9]/gi, '-');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `${hostname}-${timestamp}.png`;

            savedFilePath = path.join(screenshotDir, filename);

            // Convert base64 to buffer and save
            const buffer = Buffer.from(result.screenshot, 'base64');
            await fs.writeFile(savedFilePath, buffer);
          } catch (saveError) {
            // Log error but don't fail the operation
            console.error('Failed to save screenshot locally:', saveError);
          }
        }

        // If saved locally and screenshot is large (>800KB), don't return the base64 data
        const screenshotSize = Buffer.from(result.screenshot, 'base64').length;
        const shouldReturnImage = !savedFilePath || screenshotSize < 800 * 1024; // 800KB threshold

        if (shouldReturnImage) {
          content.push({
            type: 'image',
            data: result.screenshot,
            mimeType: 'image/png',
          });
        }

        if (savedFilePath) {
          const sizeInfo = !shouldReturnImage
            ? ` (${Math.round(screenshotSize / 1024)}KB - too large to display inline)`
            : '';
          content.push({
            type: 'text',
            text: `\n---\nScreenshot saved to: ${savedFilePath}${sizeInfo}`,
          });
        }
      }

      // PDF if available
      if (result.pdf) {
        content.push({
          type: 'resource',
          resource: {
            uri: `data:application/pdf;name=${encodeURIComponent(new URL(String(options.url)).hostname)}.pdf;base64,${result.pdf}`,
            mimeType: 'application/pdf',
            blob: result.pdf,
          },
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
          .map((res: unknown, idx: number) => {
            return `Result ${idx + 1}: ${JSON.stringify(res, null, 2)}`;
          })
          .join('\n');
        content.push({
          type: 'text',
          text: `\n---\nJavaScript Execution Results:\n${jsResults}`,
        });
      }

      // Add memory metrics if available
      if (response.server_memory_delta_mb !== undefined || response.server_peak_memory_mb !== undefined) {
        const memoryInfo = [];
        if (response.server_processing_time_s !== undefined) {
          memoryInfo.push(`Processing time: ${response.server_processing_time_s.toFixed(2)}s`);
        }
        if (response.server_memory_delta_mb !== undefined) {
          memoryInfo.push(`Memory delta: ${response.server_memory_delta_mb.toFixed(1)}MB`);
        }
        if (response.server_peak_memory_mb !== undefined) {
          memoryInfo.push(`Peak memory: ${response.server_peak_memory_mb.toFixed(1)}MB`);
        }
        if (memoryInfo.length > 0) {
          content.push({
            type: 'text',
            text: `\n---\nServer metrics: ${memoryInfo.join(', ')}`,
          });
        }
      }

      return { content };
    } catch (error) {
      throw this.formatError(error, 'crawl');
    }
  }
}
