import axios, { AxiosInstance } from 'axios';
import { CrawlOptions, CrawlResult, JSExecuteOptions, BatchCrawlOptions, AdvancedCrawlConfig } from './types.js';

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

  async crawlPage(options: CrawlOptions & { url: string }) {
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

    return response.data as CrawlResult;
  }

  async captureScreenshot(options: { url: string; full_page?: boolean; wait_for?: string; timeout?: number }) {
    const response = await this.axiosClient.post('/screenshot', {
      url: options.url,
      full_page: options.full_page,
      wait_for: options.wait_for,
      timeout: options.timeout,
    });

    return response.data;
  }

  async generatePDF(options: { url: string; wait_for?: string; timeout?: number }) {
    const response = await this.axiosClient.post('/pdf', {
      url: options.url,
      wait_for: options.wait_for,
      timeout: options.timeout,
    });

    return response.data;
  }

  async executeJS(options: JSExecuteOptions & { url: string }) {
    // Ensure scripts is always an array
    const scripts = Array.isArray(options.js_code) ? options.js_code : [options.js_code];

    const response = await this.axiosClient.post('/execute_js', {
      url: options.url,
      scripts: scripts,
      wait_after_js: options.wait_after_js,
      screenshot: options.screenshot,
    });

    return response.data as CrawlResult;
  }

  async batchCrawl(options: BatchCrawlOptions) {
    const response = await this.axiosClient.post('/crawl', {
      urls: options.urls,
      max_concurrent: options.max_concurrent,
      remove_images: options.remove_images,
      bypass_cache: options.bypass_cache,
    });

    return response.data;
  }

  async getHTML(options: { url: string; wait_for?: string; bypass_cache?: boolean }) {
    const response = await this.axiosClient.post('/html', {
      url: options.url,
      wait_for: options.wait_for,
      bypass_cache: options.bypass_cache,
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

  async crawlWithConfig(options: AdvancedCrawlConfig) {
    const requestBody: any = {
      urls: options.url ? [options.url] : options.urls,
      browser_config: options.browser_config,
      crawler_config: options.crawler_config,
    };

    const response = await this.axiosClient.post('/crawl', requestBody);
    return response.data;
  }

  async extractWithLLM(options: { url: string; query: string }) {
    try {
      const encodedUrl = encodeURIComponent(options.url);
      const encodedQuery = encodeURIComponent(options.query);
      const response = await this.axiosClient.get(`/llm/${encodedUrl}?q=${encodedQuery}`);
      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
        throw new Error('LLM extraction timed out. Try a simpler query or different URL.');
      }
      if (error.response?.status === 401) {
        throw new Error(
          'LLM extraction failed: No LLM provider configured on server. Please ensure the server has an API key set.',
        );
      }
      throw new Error(`LLM extraction failed: ${error.response?.data?.detail || error.message}`);
    }
  }
}
