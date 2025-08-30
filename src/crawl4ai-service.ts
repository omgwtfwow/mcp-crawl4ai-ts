import axios, { AxiosInstance, AxiosError } from 'axios';
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

// Helper to validate URL format
const validateURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Helper to handle axios errors consistently
const handleAxiosError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    // Handle timeout errors
    if (axiosError.code === 'ECONNABORTED') {
      throw new Error('Request timed out');
    }

    if (axiosError.code === 'ETIMEDOUT') {
      throw new Error('Request timeout');
    }

    // Handle network errors
    if (axiosError.code === 'ENOTFOUND') {
      throw new Error(`DNS resolution failed: ${axiosError.message}`);
    }

    if (axiosError.code === 'ECONNREFUSED') {
      throw new Error(`Connection refused: ${axiosError.message}`);
    }

    if (axiosError.code === 'ECONNRESET') {
      throw new Error(`Connection reset: ${axiosError.message}`);
    }

    if (axiosError.code === 'ENETUNREACH') {
      throw new Error(`Network unreachable: ${axiosError.message}`);
    }

    // Handle HTTP errors
    if (axiosError.response) {
      const status = axiosError.response.status;
      const data = axiosError.response.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const message = data?.error || data?.detail || data?.message || axiosError.message;
      throw new Error(`Request failed with status ${status}: ${message}`);
    }

    // Handle request errors (e.g., invalid URL)
    if (axiosError.request) {
      throw new Error(`Request failed: ${axiosError.message}`);
    }
  }

  // Re-throw unknown errors
  throw error;
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
    // Validate URL
    if (!validateURL(options.url)) {
      throw new Error('Invalid URL format');
    }

    try {
      const response = await this.axiosClient.post('/md', {
        url: options.url,
        f: options.f,
        q: options.q,
        c: options.c,
      });

      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  }

  async captureScreenshot(options: ScreenshotEndpointOptions): Promise<ScreenshotEndpointResponse> {
    // Validate URL
    if (!validateURL(options.url)) {
      throw new Error('Invalid URL format');
    }

    try {
      const response = await this.axiosClient.post('/screenshot', {
        url: options.url,
        screenshot_wait_for: options.screenshot_wait_for,
        // output_path is omitted to get base64 response
      });

      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  }

  async generatePDF(options: PDFEndpointOptions): Promise<PDFEndpointResponse> {
    // Validate URL
    if (!validateURL(options.url)) {
      throw new Error('Invalid URL format');
    }

    try {
      const response = await this.axiosClient.post('/pdf', {
        url: options.url,
        // output_path is omitted to get base64 response
      });

      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  }

  async executeJS(options: JSExecuteEndpointOptions): Promise<JSExecuteEndpointResponse> {
    // Validate URL
    if (!validateURL(options.url)) {
      throw new Error('Invalid URL format');
    }

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

    try {
      const response = await this.axiosClient.post('/execute_js', {
        url: options.url,
        scripts: scripts, // Always send as array
        // Only url and scripts are supported by the endpoint
      });

      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  }

  async batchCrawl(options: BatchCrawlOptions) {
    // Validate URLs
    if (!options.urls || options.urls.length === 0) {
      throw new Error('URLs array cannot be empty');
    }

    // Build crawler config if needed
    const crawler_config: Record<string, unknown> = {};

    // Handle remove_images by using exclude_tags
    if (options.remove_images) {
      crawler_config.exclude_tags = ['img', 'picture', 'svg'];
    }

    if (options.bypass_cache) {
      crawler_config.cache_mode = 'BYPASS';
    }

    try {
      const response = await this.axiosClient.post('/crawl', {
        urls: options.urls,
        max_concurrent: options.max_concurrent,
        crawler_config: Object.keys(crawler_config).length > 0 ? crawler_config : undefined,
      });

      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  }

  async getHTML(options: HTMLEndpointOptions): Promise<HTMLEndpointResponse> {
    // Validate URL
    if (!validateURL(options.url)) {
      throw new Error('Invalid URL format');
    }

    try {
      const response = await this.axiosClient.post('/html', {
        url: options.url,
        // Only url is supported by the endpoint
      });

      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  }

  async parseSitemap(url: string) {
    try {
      // Use axios directly without baseURL for fetching external URLs
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  }

  async detectContentType(url: string): Promise<string> {
    try {
      // Use axios directly without baseURL for external URLs
      const response = await axios.head(url);
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

    const requestBody: CrawlEndpointOptions & {
      extraction_strategy?: unknown;
      table_extraction_strategy?: unknown;
      markdown_generator_options?: unknown;
    } = {
      urls,
      browser_config: options.browser_config,
      crawler_config: options.crawler_config || {}, // Always include crawler_config, even if empty
    };

    // Add extraction strategy passthrough fields if present
    if (options.extraction_strategy) {
      requestBody.extraction_strategy = options.extraction_strategy;
    }
    if (options.table_extraction_strategy) {
      requestBody.table_extraction_strategy = options.table_extraction_strategy;
    }
    if (options.markdown_generator_options) {
      requestBody.markdown_generator_options = options.markdown_generator_options;
    }

    try {
      const response = await this.axiosClient.post('/crawl', requestBody);
      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  }

  async extractWithLLM(options: LLMEndpointOptions): Promise<LLMEndpointResponse> {
    // Validate URL
    if (!validateURL(options.url)) {
      throw new Error('Invalid URL format');
    }

    try {
      const encodedUrl = encodeURIComponent(options.url);
      const encodedQuery = encodeURIComponent(options.query);
      const response = await this.axiosClient.get(`/llm/${encodedUrl}?q=${encodedQuery}`);
      return response.data;
    } catch (error) {
      // Special handling for LLM-specific errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.code === 'ECONNABORTED' || axiosError.response?.status === 504) {
          throw new Error('LLM extraction timed out. Try a simpler query or different URL.');
        }
        if (axiosError.response?.status === 401) {
          throw new Error(
            'LLM extraction failed: No LLM provider configured on server. Please ensure the server has an API key set.',
          );
        }
      }
      return handleAxiosError(error);
    }
  }
}
