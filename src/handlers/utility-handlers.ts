import { BaseHandler } from './base-handler.js';
import { JSExecuteEndpointOptions, JSExecuteEndpointResponse, CrawlResultItem } from '../types.js';

export class UtilityHandlers extends BaseHandler {
  async executeJS(options: JSExecuteEndpointOptions) {
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
          .map((res: unknown, idx: number) => {
            const script = scripts[idx] || 'Script ' + (idx + 1);
            // Handle the actual return value or success/error status
            let resultStr = '';
            if (res && typeof res === 'object' && 'success' in res) {
              // This is a status object (e.g., from null return or execution without return)
              const statusObj = res as { success: unknown; error?: unknown };
              resultStr = statusObj.success
                ? 'Executed successfully (no return value)'
                : `Error: ${statusObj.error || 'Unknown error'}`;
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

      // Handle markdown content - can be string or object
      let markdownContent = '';
      if (result.markdown) {
        if (typeof result.markdown === 'string') {
          markdownContent = result.markdown;
        } else if (typeof result.markdown === 'object' && result.markdown.raw_markdown) {
          // Use raw_markdown from the object structure
          markdownContent = result.markdown.raw_markdown;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `JavaScript executed on: ${options.url}\n\nResults:\n${formattedResults}${markdownContent ? `\n\nPage Content After Execution:\n${markdownContent}` : ''}`,
          },
        ],
      };
    } catch (error) {
      throw this.formatError(error, 'execute JavaScript');
    }
  }

  async extractLinks(options: { url: string; categorize?: boolean }) {
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
        internalUrls = result.links.internal.map((link) => (typeof link === 'string' ? link : link.href));
        externalUrls = result.links.external.map((link) => (typeof link === 'string' ? link : link.href));
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
      const categorized: Record<string, string[]> = {
        internal: [],
        external: [],
        social: [],
        documents: [],
        images: [],
        scripts: [],
      };

      // Further categorize links
      const socialDomains = ['facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 'youtube.com'];
      const docExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
      const scriptExtensions = ['.js', '.css'];

      // Categorize internal URLs
      internalUrls.forEach((href: string) => {
        if (docExtensions.some((ext) => href.toLowerCase().endsWith(ext))) {
          categorized.documents.push(href);
        } else if (imageExtensions.some((ext) => href.toLowerCase().endsWith(ext))) {
          categorized.images.push(href);
        } else if (scriptExtensions.some((ext) => href.toLowerCase().endsWith(ext))) {
          categorized.scripts.push(href);
        } else {
          categorized.internal.push(href);
        }
      });

      // Categorize external URLs
      externalUrls.forEach((href: string) => {
        if (socialDomains.some((domain) => href.includes(domain))) {
          categorized.social.push(href);
        } else if (docExtensions.some((ext) => href.toLowerCase().endsWith(ext))) {
          categorized.documents.push(href);
        } else if (imageExtensions.some((ext) => href.toLowerCase().endsWith(ext))) {
          categorized.images.push(href);
        } else if (scriptExtensions.some((ext) => href.toLowerCase().endsWith(ext))) {
          categorized.scripts.push(href);
        } else {
          categorized.external.push(href);
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
                  ([category, links]: [string, string[]]) =>
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
    } catch (error) {
      throw this.formatError(error, 'extract links');
    }
  }
}
