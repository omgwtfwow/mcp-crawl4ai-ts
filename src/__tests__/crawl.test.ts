/* eslint-env jest */
import { jest } from '@jest/globals';
import type { AxiosResponse } from 'axios';
import type { MockAxiosInstance } from './types/mocks.js';
import type { Crawl4AIService as Crawl4AIServiceType } from '../crawl4ai-service.js';

// Manual mock for axios
const mockAxios = {
  create: jest.fn(),
};

jest.unstable_mockModule('axios', () => ({
  default: mockAxios,
}));

// Import modules after mocking
const { Crawl4AIService } = await import('../crawl4ai-service.js');

// Helper function to create a complete AxiosResponse object
function createMockAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {
      url: '',
      method: 'post',
      headers: {},
    },
  } as AxiosResponse<T>;
}

describe('crawl parameter mapping', () => {
  let service: Crawl4AIServiceType;
  let mockAxiosInstance: MockAxiosInstance;

  beforeEach(() => {
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      head: jest.fn(),
    };
    mockAxios.create.mockReturnValue(mockAxiosInstance);
    service = new Crawl4AIService('http://test.com', 'test-key');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Browser configuration mapping', () => {
    it('should map all browser config parameters correctly', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        browser_config: {
          browser_type: 'firefox',
          headless: true,
          viewport_width: 1920,
          viewport_height: 1080,
          user_agent: 'Custom User Agent',
          proxy_config: {
            server: 'http://proxy.com:8080',
            username: 'proxyuser',
            password: 'proxypass',
          },
          cookies: [{ name: 'session', value: 'abc123', domain: '.example.com', path: '/' }],
          headers: { 'X-Custom-Header': 'value' },
          extra_args: ['--disable-gpu'],
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: {
          browser_type: 'firefox',
          headless: true,
          viewport_width: 1920,
          viewport_height: 1080,
          user_agent: 'Custom User Agent',
          proxy_config: {
            server: 'http://proxy.com:8080',
            username: 'proxyuser',
            password: 'proxypass',
          },
          cookies: [{ name: 'session', value: 'abc123', domain: '.example.com', path: '/' }],
          headers: { 'X-Custom-Header': 'value' },
          extra_args: ['--disable-gpu'],
        },
        crawler_config: {},
      });
    });

    it('should support undetected browser type', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        browser_config: {
          browser_type: 'undetected',
          headless: true,
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: {
          browser_type: 'undetected',
          headless: true,
        },
        crawler_config: {},
      });
    });

    it('should support unified proxy format (string)', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        browser_config: {
          proxy: 'http://user:pass@proxy.example.com:8080',
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: {
          proxy: 'http://user:pass@proxy.example.com:8080',
        },
        crawler_config: {},
      });
    });

    it('should support unified proxy format (object)', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        browser_config: {
          proxy: {
            server: 'http://proxy.example.com:8080',
            username: 'user',
            password: 'pass',
          },
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: {
          proxy: {
            server: 'http://proxy.example.com:8080',
            username: 'user',
            password: 'pass',
          },
        },
        crawler_config: {},
      });
    });
  });

  describe('Crawler configuration mapping', () => {
    it('should map content filtering parameters', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          word_count_threshold: 150,
          excluded_tags: ['nav', 'footer', 'aside'],
          excluded_selector: '#ads, .popup',
          remove_overlay_elements: true,
          only_text: true,
          remove_forms: true,
          keep_data_attributes: true,
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          word_count_threshold: 150,
          excluded_tags: ['nav', 'footer', 'aside'],
          excluded_selector: '#ads, .popup',
          remove_overlay_elements: true,
          only_text: true,
          remove_forms: true,
          keep_data_attributes: true,
        },
      });
    });

    it('should map JavaScript execution parameters', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          js_code: ['document.querySelector(".load-more").click()', 'window.scrollTo(0, 1000)'],
          js_only: true,
          wait_for: '.content-loaded',
          wait_for_timeout: 10000,
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          js_code: ['document.querySelector(".load-more").click()', 'window.scrollTo(0, 1000)'],
          js_only: true,
          wait_for: '.content-loaded',
          wait_for_timeout: 10000,
        },
      });
    });

    it('should map page navigation and timing parameters', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          wait_until: 'networkidle',
          page_timeout: 45000,
          wait_for_images: true,
          ignore_body_visibility: false,
          scan_full_page: true,
          delay_before_scroll: 2000,
          scroll_delay: 1000,
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          wait_until: 'networkidle',
          page_timeout: 45000,
          wait_for_images: true,
          ignore_body_visibility: false,
          scan_full_page: true,
          delay_before_scroll: 2000,
          scroll_delay: 1000,
        },
      });
    });

    it('should map media handling parameters', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          screenshot: true,
          screenshot_wait_for: 2.5,
          pdf: true,
          capture_mhtml: true,
          image_description_min_word_threshold: 30,
          image_score_threshold: 5,
          exclude_external_images: true,
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          screenshot: true,
          screenshot_wait_for: 2.5,
          pdf: true,
          capture_mhtml: true,
          image_description_min_word_threshold: 30,
          image_score_threshold: 5,
          exclude_external_images: true,
        },
      });
    });

    it('should map link filtering parameters', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          exclude_external_links: true,
          exclude_social_media_links: true,
          exclude_domains: ['ads.com', 'tracker.io', 'analytics.com'],
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          exclude_external_links: true,
          exclude_social_media_links: true,
          exclude_domains: ['ads.com', 'tracker.io', 'analytics.com'],
        },
      });
    });

    it('should map page interaction parameters', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          simulate_user: true,
          override_navigator: true,
          magic: true,
          process_iframes: true,
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          simulate_user: true,
          override_navigator: true,
          magic: true,
          process_iframes: true,
        },
      });
    });

    it('should map virtual scroll configuration', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          virtual_scroll_config: {
            container_selector: '#timeline',
            scroll_count: 20,
            scroll_by: 'container_height',
            wait_after_scroll: 1.5,
          },
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          virtual_scroll_config: {
            container_selector: '#timeline',
            scroll_count: 20,
            scroll_by: 'container_height',
            wait_after_scroll: 1.5,
          },
        },
      });
    });

    // Note: Extraction strategies removed - not supported via REST API
    // Use extract_with_llm tool instead for structured data extraction

    it('should map session and cache parameters', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          session_id: 'test-session-123',
          cache_mode: 'DISABLED',
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          session_id: 'test-session-123',
          cache_mode: 'DISABLED',
        },
      });
    });

    it('should map new crawler parameters', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          delay_before_return_html: 2000,
          css_selector: '.main-content',
          include_links: true,
          resolve_absolute_urls: true,
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          delay_before_return_html: 2000,
          css_selector: '.main-content',
          include_links: true,
          resolve_absolute_urls: true,
        },
      });
    });

    it('should map performance and debug parameters', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          timeout: 90000,
          verbose: true,
          log_console: true,
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          timeout: 90000,
          verbose: true,
          log_console: true,
        },
      });
    });
  });

  describe('Extraction strategies', () => {
    it('should support extraction_strategy passthrough', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        extraction_strategy: {
          provider: 'openai',
          api_key: 'sk-test',
          model: 'gpt-4',
          temperature: 0.7,
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {},
        extraction_strategy: {
          provider: 'openai',
          api_key: 'sk-test',
          model: 'gpt-4',
          temperature: 0.7,
        },
      });
    });

    it('should support table_extraction_strategy passthrough', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        table_extraction_strategy: {
          enable_chunking: true,
          thresholds: {
            min_rows: 5,
            max_columns: 20,
          },
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {},
        table_extraction_strategy: {
          enable_chunking: true,
          thresholds: {
            min_rows: 5,
            max_columns: 20,
          },
        },
      });
    });

    it('should support markdown_generator_options passthrough', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        markdown_generator_options: {
          include_links: true,
          preserve_formatting: true,
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {},
        markdown_generator_options: {
          include_links: true,
          preserve_formatting: true,
        },
      });
    });
  });

  describe('Combined configurations', () => {
    it('should handle both browser and crawler configs together', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        browser_config: {
          viewport_width: 1920,
          viewport_height: 1080,
          user_agent: 'Custom Bot',
        },
        crawler_config: {
          word_count_threshold: 100,
          js_code: 'document.querySelector(".accept").click()',
          wait_for: '.content',
          screenshot: true,
          session_id: 'test-session',
          cache_mode: 'BYPASS',
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: {
          viewport_width: 1920,
          viewport_height: 1080,
          user_agent: 'Custom Bot',
        },
        crawler_config: {
          word_count_threshold: 100,
          js_code: 'document.querySelector(".accept").click()',
          wait_for: '.content',
          screenshot: true,
          session_id: 'test-session',
          cache_mode: 'BYPASS',
        },
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined values correctly', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          word_count_threshold: 0, // Should be included (falsy but defined)
          excluded_tags: undefined, // Should not be included
          remove_overlay_elements: false, // Should be included
          only_text: undefined, // Should not be included
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          word_count_threshold: 0,
          excluded_tags: undefined,
          remove_overlay_elements: false,
          only_text: undefined,
        },
      });
    });

    it('should handle empty arrays correctly', async () => {
      const mockResponse = createMockAxiosResponse({ results: [{ markdown: 'test' }] });
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          excluded_tags: [],
          exclude_domains: [],
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: undefined,
        crawler_config: {
          excluded_tags: [],
          exclude_domains: [],
        },
      });
    });
  });
});
