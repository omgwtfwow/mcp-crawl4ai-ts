import axios, { AxiosInstance } from 'axios';
import {
  BatchCrawlOptions,
  AdvancedCrawlConfig,
  CrawlEndpointOptions,
  CrawlEndpointResponse,
  JSExecuteEndpointOptions,
  JSExecuteEndpointResponse,
  ScreenshotEndpointOptions,
  ScreenshotEndpointResponse,
  PDFEndpointOptions,
  PDFEndpointResponse,
  HTMLEndpointOptions,
  HTMLEndpointResponse,
  MarkdownEndpointOptions,
  MarkdownEndpointResponse,
  LLMEndpointOptions,
  LLMEndpointResponse,
} from './types.js';

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

export class Crawl4AIService {
  private axiosClient: AxiosInstance;

  constructor(baseURL: string, apiKey: string) {
    this.axiosClient = axios.create({
      baseURL,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    });
  }

  async getMarkdown(options: MarkdownEndpointOptions): Promise<MarkdownEndpointResponse> {
    const response = await this.axiosClient.post('/md', {
      url: options.url,
      f: options.f,
      q: options.q,
      c: options.c,
    });

    return response.data;
  }

  async captureScreenshot(options: ScreenshotEndpointOptions): Promise<ScreenshotEndpointResponse> {
    const response = await this.axiosClient.post('/screenshot', {
      url: options.url,
      screenshot_wait_for: options.screenshot_wait_for,
      // output_path is omitted to get base64 response
    });

    return response.data;
  }

  async generatePDF(options: PDFEndpointOptions): Promise<PDFEndpointResponse> {
    const response = await this.axiosClient.post('/pdf', {
      url: options.url,
      // output_path is omitted to get base64 response
    });

    return response.data;
  }

  async executeJS(options: JSExecuteEndpointOptions): Promise<JSExecuteEndpointResponse> {
    // Ensure scripts is always an array
    const scripts = Array.isArray(options.scripts) ? options.scripts : [options.scripts];

    // Validate each script
    for (const script of scripts) {
      if (!validateJavaScriptCode(script)) {
        throw new Error(
          'Invalid JavaScript: Contains HTML entities (&quot;), literal \\n outside strings, or HTML tags. Use proper JS syntax with real quotes and newlines.',
        );
      }
    }

    const response = await this.axiosClient.post('/execute_js', {
      url: options.url,
      scripts: scripts,
      // Only url and scripts are supported by the endpoint
    });

    return response.data;
  }

  async batchCrawl(options: BatchCrawlOptions) {
    // Build crawler config if needed
    const crawler_config: Record<string, unknown> = {};

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

    return response.data;
  }

  async getHTML(options: HTMLEndpointOptions): Promise<HTMLEndpointResponse> {
    const response = await this.axiosClient.post('/html', {
      url: options.url,
      // Only url is supported by the endpoint
    });

    return response.data;
  }

  async parseSitemap(url: string) {
    const response = await this.axiosClient.get(url);
    return response.data;
  }

  async detectContentType(url: string): Promise<string> {
    try {
      const response = await this.axiosClient.head(url);
      return response.headers['content-type'] || '';
    } catch {
      return '';
    }
  }

  async crawl(options: AdvancedCrawlConfig): Promise<CrawlEndpointResponse> {
    // Validate JS code if present
    if (options.crawler_config?.js_code) {
      const scripts = Array.isArray(options.crawler_config.js_code)
        ? options.crawler_config.js_code
        : [options.crawler_config.js_code];

      for (const script of scripts) {
        if (!validateJavaScriptCode(script)) {
          throw new Error(
            'Invalid JavaScript: Contains HTML entities (&quot;), literal \\n outside strings, or HTML tags. Use proper JS syntax with real quotes and newlines.',
          );
        }
      }
    }

    // Server only accepts urls array, not url string
    const urls = options.url ? [options.url] : options.urls || [];

    const requestBody: CrawlEndpointOptions = {
      urls,
      browser_config: options.browser_config,
      crawler_config: options.crawler_config || {}, // Always include crawler_config, even if empty
    };

    const response = await this.axiosClient.post('/crawl', requestBody);
    return response.data;
  }

  async extractWithLLM(options: LLMEndpointOptions): Promise<LLMEndpointResponse> {
    try {
      const encodedUrl = encodeURIComponent(options.url);
      const encodedQuery = encodeURIComponent(options.query);
      const response = await this.axiosClient.get(`/llm/${encodedUrl}?q=${encodedQuery}`);
      return response.data;
    } catch (error) {
      const axiosError = error as { code?: string; response?: { status?: number; data?: { detail?: string } } };
      if (axiosError.code === 'ECONNABORTED' || axiosError.response?.status === 504) {
        throw new Error('LLM extraction timed out. Try a simpler query or different URL.');
      }
      if (axiosError.response?.status === 401) {
        throw new Error(
          'LLM extraction failed: No LLM provider configured on server. Please ensure the server has an API key set.',
        );
      }
      throw new Error(
        `LLM extraction failed: ${axiosError.response?.data?.detail || (error instanceof Error ? error.message : String(error))}`,
      );
    }
  }
}
