import { jest } from '@jest/globals';
import axios from 'axios';
import { Crawl4AIService } from '../crawl4ai-service.js';
import { fixtures } from './mocks/fixtures.js';

jest.mock('axios');

describe('Crawl4AIService', () => {
  let service: Crawl4AIService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      head: jest.fn(),
    };

    (axios.create as jest.Mock) = jest.fn().mockReturnValue(mockAxiosInstance);
    service = new Crawl4AIService('https://test.crawl4ai.io', 'test-api-key');
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://test.crawl4ai.io',
        headers: {
          'X-API-Key': 'test-api-key',
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      });
    });
  });

  describe('getMarkdown', () => {
    it('should successfully get markdown with default filter', async () => {
      const mockResponse = {
        url: 'https://example.com',
        filter: 'fit',
        query: null,
        cache: '0',
        markdown: '# Example Domain\n\nThis domain is for use in illustrative examples in documents.',
        success: true,
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await service.getMarkdown({
        url: 'https://example.com',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/md', {
        url: 'https://example.com',
        f: undefined,
        q: undefined,
        c: undefined,
      });

      expect(result).toEqual(mockResponse);
    });

    it('should get markdown with raw filter', async () => {
      const mockResponse = {
        url: 'https://example.com',
        filter: 'raw',
        query: null,
        cache: '0',
        markdown: 'Raw markdown content',
        success: true,
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await service.getMarkdown({
        url: 'https://example.com',
        f: 'raw',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/md', {
        url: 'https://example.com',
        f: 'raw',
        q: undefined,
        c: undefined,
      });

      expect(result).toEqual(mockResponse);
    });

    it('should get markdown with bm25 filter and query', async () => {
      const mockResponse = {
        url: 'https://example.com',
        filter: 'bm25',
        query: 'example domain',
        cache: '0',
        markdown: 'Filtered markdown content',
        success: true,
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await service.getMarkdown({
        url: 'https://example.com',
        f: 'bm25',
        q: 'example domain',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/md', {
        url: 'https://example.com',
        f: 'bm25',
        q: 'example domain',
        c: undefined,
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('Network error');
    });
  });

  describe('captureScreenshot', () => {
    it('should capture screenshot successfully', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: fixtures.screenshot.success });

      const result = await service.captureScreenshot({
        url: 'https://example.com',
        screenshot_wait_for: 3,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/screenshot', {
        url: 'https://example.com',
        screenshot_wait_for: 3,
      });

      expect(result).toEqual(fixtures.screenshot.success);
    });
  });

  describe('generatePDF', () => {
    it('should generate PDF successfully', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: fixtures.pdf.success });

      const result = await service.generatePDF({
        url: 'https://example.com',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/pdf', {
        url: 'https://example.com',
      });

      expect(result).toEqual(fixtures.pdf.success);
    });
  });

  describe('executeJS', () => {
    it('should execute JavaScript successfully', async () => {
      const mockResult = {
        markdown: 'Modified content',
        js_execution_result: {
          success: true,
          results: ['Example Domain'],
        },
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const result = await service.executeJS({
        url: 'https://example.com',
        scripts: 'return document.title',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/execute_js', {
        url: 'https://example.com',
        scripts: ['return document.title'],
      });

      expect(result).toEqual(mockResult);
      expect(result.js_execution_result?.results[0]).toBe('Example Domain');
    });

    it('should handle array of JavaScript scripts', async () => {
      const mockResult = {
        markdown: 'Content',
        js_execution_result: {
          success: true,
          results: ['Example Domain', 10, ['https://link1.com', 'https://link2.com']],
        },
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const result = await service.executeJS({
        url: 'https://example.com',
        scripts: [
          'return document.title',
          'return document.querySelectorAll("a").length',
          'return Array.from(document.querySelectorAll("a")).map(a => a.href)',
        ],
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/execute_js', {
        url: 'https://example.com',
        scripts: [
          'return document.title',
          'return document.querySelectorAll("a").length',
          'return Array.from(document.querySelectorAll("a")).map(a => a.href)',
        ],
      });

      expect(result.js_execution_result?.results).toHaveLength(3);
      expect(result.js_execution_result?.results[0]).toBe('Example Domain');
      expect(result.js_execution_result?.results[1]).toBe(10);
      expect(result.js_execution_result?.results[2]).toEqual(['https://link1.com', 'https://link2.com']);
    });

    it('should reject JavaScript with HTML entities', async () => {
      await expect(
        service.executeJS({
          url: 'https://example.com',
          scripts: 'document.querySelector(&quot;button&quot;).click()',
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should reject JavaScript with literal \\n', async () => {
      await expect(
        service.executeJS({
          url: 'https://example.com',
          scripts: 'console.log("test");\\nreturn true;',
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should accept valid JavaScript with \\n in strings', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: { markdown: 'Content' } });

      await service.executeJS({
        url: 'https://example.com',
        scripts: 'console.log("line1\\nline2")',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });

  describe('batchCrawl', () => {
    it('should batch crawl successfully', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: fixtures.batch.success });

      const result = await service.batchCrawl({
        urls: ['https://example.com', 'https://example.org'],
        max_concurrent: 2,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com', 'https://example.org'],
        max_concurrent: 2,
        remove_images: undefined,
        bypass_cache: undefined,
      });

      expect(result).toEqual(fixtures.batch.success);
    });
  });

  describe('getHTML', () => {
    it('should get HTML successfully', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: fixtures.html.success });

      const result = await service.getHTML({
        url: 'https://example.com',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/html', {
        url: 'https://example.com',
      });

      expect(result).toEqual(fixtures.html.success);
    });
  });

  describe('parseSitemap', () => {
    it('should parse sitemap successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: fixtures.sitemap.xml });

      const result = await service.parseSitemap('https://example.com/sitemap.xml');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('https://example.com/sitemap.xml');
      expect(result).toEqual(fixtures.sitemap.xml);
    });

    it('should handle sitemap errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('404 Not Found'));

      await expect(service.parseSitemap('https://example.com/sitemap.xml')).rejects.toThrow('404 Not Found');
    });
  });

  describe('detectContentType', () => {
    it('should detect content type from headers', async () => {
      mockAxiosInstance.head.mockResolvedValueOnce({
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });

      const result = await service.detectContentType('https://example.com');

      expect(mockAxiosInstance.head).toHaveBeenCalledWith('https://example.com');
      expect(result).toBe('text/html; charset=utf-8');
    });

    it('should return empty string on error', async () => {
      mockAxiosInstance.head.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.detectContentType('https://example.com');

      expect(result).toBe('');
    });
  });

  describe('extractWithLLM', () => {
    it('should extract with LLM successfully', async () => {
      const mockResponse = {
        answer: 'Product A costs $10 and is in stock. Product B costs $20 and is out of stock.',
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await service.extractWithLLM({
        url: 'https://example.com/products',
        query: 'Extract product names and prices',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/llm/https%3A%2F%2Fexample.com%2Fproducts?q=Extract%20product%20names%20and%20prices',
      );
      expect(result).toEqual(mockResponse);
      expect(result.answer).toBe('Product A costs $10 and is in stock. Product B costs $20 and is out of stock.');
    });

    it('should handle timeout errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 120000ms exceeded',
      });

      await expect(
        service.extractWithLLM({
          url: 'https://example.com',
          query: 'Complex extraction query',
        }),
      ).rejects.toThrow('LLM extraction timed out. Try a simpler query or different URL.');
    });

    it('should handle 504 gateway timeout', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 504 },
      });

      await expect(
        service.extractWithLLM({
          url: 'https://example.com',
          query: 'Extract data',
        }),
      ).rejects.toThrow('LLM extraction timed out. Try a simpler query or different URL.');
    });

    it('should handle authentication errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { detail: 'Unauthorized' },
        },
      });

      await expect(
        service.extractWithLLM({
          url: 'https://example.com',
          query: 'Extract data',
        }),
      ).rejects.toThrow(
        'LLM extraction failed: No LLM provider configured on server. Please ensure the server has an API key set.',
      );
    });

    it('should handle generic errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { detail: 'Internal server error' },
        },
      });

      await expect(
        service.extractWithLLM({
          url: 'https://example.com',
          query: 'Extract data',
        }),
      ).rejects.toThrow('LLM extraction failed: Internal server error');
    });

    it('should encode URL and query parameters correctly', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { answer: 'Success' } });

      await service.extractWithLLM({
        url: 'https://example.com/page?param=value&other=test',
        query: 'Extract items with "quotes" and special chars: @#$%',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/llm/https%3A%2F%2Fexample.com%2Fpage%3Fparam%3Dvalue%26other%3Dtest?q=Extract%20items%20with%20%22quotes%22%20and%20special%20chars%3A%20%40%23%24%25',
      );
    });
  });

  describe('crawl', () => {
    it('should crawl with advanced config successfully', async () => {
      const mockResponse = {
        data: {
          results: [{ markdown: 'Content', metadata: { title: 'Test' } }],
        },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.crawl({
        url: 'https://example.com',
        browser_config: {
          viewport_width: 1920,
          viewport_height: 1080,
        },
        crawler_config: {
          word_count_threshold: 100,
          js_code: 'console.log("test")',
          session_id: 'test-session',
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com'],
        browser_config: {
          viewport_width: 1920,
          viewport_height: 1080,
        },
        crawler_config: {
          word_count_threshold: 100,
          js_code: 'console.log("test")',
          session_id: 'test-session',
        },
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle multiple URLs', async () => {
      const mockResponse = {
        data: {
          results: [
            { markdown: 'Content1', metadata: { title: 'Test1' } },
            { markdown: 'Content2', metadata: { title: 'Test2' } },
          ],
        },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.crawl({
        urls: ['https://example.com', 'https://example.org'],
        browser_config: { headless: true },
        crawler_config: { cache_mode: 'BYPASS' },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/crawl', {
        urls: ['https://example.com', 'https://example.org'],
        browser_config: { headless: true },
        crawler_config: { cache_mode: 'BYPASS' },
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should reject invalid JavaScript in js_code', async () => {
      await expect(
        service.crawl({
          url: 'https://example.com',
          crawler_config: {
            js_code: 'document.querySelector(&quot;button&quot;).click()',
          },
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should reject JavaScript arrays with invalid code', async () => {
      await expect(
        service.crawl({
          url: 'https://example.com',
          crawler_config: {
            js_code: ['console.log("valid")', 'document.querySelector(&quot;input&quot;).value = &quot;test&quot;'],
          },
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should accept valid JavaScript code', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: { results: [] } });

      await service.crawl({
        url: 'https://example.com',
        crawler_config: {
          js_code: ['document.querySelector("button").click()', 'return document.title'],
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle 404 errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { detail: 'Not found' },
        },
      });

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toMatchObject({
        response: {
          status: 404,
          data: { detail: 'Not found' },
        },
      });
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toMatchObject({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });
    });
  });
});
