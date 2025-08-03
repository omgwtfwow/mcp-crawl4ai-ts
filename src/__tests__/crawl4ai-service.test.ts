import nock from 'nock';
import { Crawl4AIService } from '../crawl4ai-service.js';
import type {
  MarkdownEndpointResponse,
  ScreenshotEndpointResponse,
  PDFEndpointResponse,
  HTMLEndpointResponse,
  CrawlEndpointResponse,
} from '../types.js';

describe('Crawl4AIService', () => {
  let service: Crawl4AIService;
  const baseURL = 'https://api.crawl4ai.com';
  const apiKey = 'test-api-key';

  beforeEach(() => {
    service = new Crawl4AIService(baseURL, apiKey);
    // Clean all nock interceptors before each test
    nock.cleanAll();
  });

  afterEach(() => {
    // Clean up any remaining interceptors
    nock.cleanAll();
  });

  describe('getMarkdown', () => {
    it('should fetch markdown with default parameters', async () => {
      const mockResponse: MarkdownEndpointResponse = {
        url: 'https://example.com',
        filter: 'fit',
        query: null,
        cache: 'false',
        markdown: '# Example Page\n\nThis is example content.',
        success: true,
      };

      // Mock the HTTP request
      nock(baseURL)
        .post('/md', {
          url: 'https://example.com',
          f: 'fit',
          q: undefined,
          c: undefined,
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.getMarkdown({
        url: 'https://example.com',
        f: 'fit',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should fetch markdown with all parameters', async () => {
      const mockResponse: MarkdownEndpointResponse = {
        url: 'https://example.com',
        filter: 'bm25',
        query: 'test query',
        cache: 'true',
        markdown: '# Filtered Content\n\nMatching content for test query.',
        success: true,
      };

      nock(baseURL)
        .post('/md', {
          url: 'https://example.com',
          f: 'bm25',
          q: 'test query',
          c: 'true',
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.getMarkdown({
        url: 'https://example.com',
        f: 'bm25',
        q: 'test query',
        c: 'true',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      nock(baseURL).post('/md').matchHeader('x-api-key', apiKey).reply(500, { detail: 'Internal server error' });

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow(
        'Request failed with status code 500',
      );
    });
  });

  describe('captureScreenshot', () => {
    it('should capture screenshot successfully', async () => {
      const mockResponse: ScreenshotEndpointResponse = {
        success: true,
        screenshot: 'base64-encoded-screenshot-data',
      };

      nock(baseURL)
        .post('/screenshot', {
          url: 'https://example.com',
          screenshot_wait_for: 2,
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.captureScreenshot({
        url: 'https://example.com',
        screenshot_wait_for: 2,
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('generatePDF', () => {
    it('should generate PDF successfully', async () => {
      const mockResponse: PDFEndpointResponse = {
        success: true,
        pdf: 'base64-encoded-pdf-data',
      };

      nock(baseURL)
        .post('/pdf', {
          url: 'https://example.com',
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.generatePDF({
        url: 'https://example.com',
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getHTML', () => {
    it('should fetch HTML successfully', async () => {
      const mockResponse: HTMLEndpointResponse = {
        html: '<html><body><h1>Example</h1></body></html>',
        url: 'https://example.com',
        success: true,
      };

      nock(baseURL)
        .post('/html', {
          url: 'https://example.com',
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.getHTML({
        url: 'https://example.com',
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('crawl', () => {
    it('should crawl with basic configuration', async () => {
      const mockResponse: CrawlEndpointResponse = {
        success: true,
        results: [
          {
            url: 'https://example.com',
            html: '<html>...</html>',
            cleaned_html: '<html>...</html>',
            fit_html: '<html>...</html>',
            success: true,
            status_code: 200,
            response_headers: {},
            session_id: null,
            metadata: {},
            links: { internal: [], external: [] },
            media: { images: [], videos: [], audios: [] },
            markdown: {
              raw_markdown: '# Example',
              markdown_with_citations: '# Example [1]',
              references_markdown: '[1]: https://example.com',
              fit_markdown: '# Example',
              fit_html: '<h1>Example</h1>',
            },
            tables: [],
            extracted_content: null,
            screenshot: null,
            pdf: null,
            mhtml: null,
            js_execution_result: null,
            downloaded_files: null,
            network_requests: null,
            console_messages: null,
            ssl_certificate: null,
            dispatch_result: null,
          },
        ],
        server_processing_time_s: 1.5,
        server_memory_delta_mb: 10,
        server_peak_memory_mb: 100,
      };

      nock(baseURL)
        .post('/crawl', {
          urls: ['https://example.com'],
          browser_config: { headless: true },
          crawler_config: { cache_mode: 'ENABLED' },
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.crawl({
        urls: ['https://example.com'],
        browser_config: { headless: true },
        crawler_config: { cache_mode: 'ENABLED' },
      });

      expect(result).toEqual(mockResponse);
    });

    // Timeout testing is better suited for integration tests
    // where we can test against real API behavior
  });

  describe('batchCrawl', () => {
    it('should batch crawl multiple URLs', async () => {
      const urls = ['https://example1.com', 'https://example2.com'];
      const mockResponse = {
        success: true,
        results: urls.map((url) => ({
          url,
          success: true,
          markdown: { raw_markdown: `Content from ${url}` },
        })),
      };

      nock(baseURL)
        .post('/crawl', (body) => {
          return body.urls?.length === 2 && body.urls[0] === urls[0] && body.urls[1] === urls[1];
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.batchCrawl({ urls });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
    });
  });

  describe('executeJS', () => {
    it('should execute JavaScript successfully', async () => {
      const mockResponse = {
        success: true,
        js_execution_result: {
          success: true,
          results: ['Example Title'],
        },
        markdown: '# Example Page',
      };

      nock(baseURL)
        .post('/execute_js', {
          url: 'https://example.com',
          scripts: ['return document.title'],
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.executeJS({
        url: 'https://example.com',
        scripts: 'return document.title',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle array of scripts', async () => {
      const scripts = ['return document.title', 'return window.location.href'];
      const mockResponse = {
        success: true,
        js_execution_result: {
          success: true,
          results: ['Example Title', 'https://example.com'],
        },
      };

      nock(baseURL)
        .post('/execute_js', {
          url: 'https://example.com',
          scripts: scripts,
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.executeJS({
        url: 'https://example.com',
        scripts,
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('extractWithLLM', () => {
    it('should extract content with LLM', async () => {
      const mockResponse = {
        answer: 'The main topic of this page is JavaScript testing.',
      };

      nock(baseURL)
        .get('/llm/https%3A%2F%2Fexample.com?q=What%20is%20the%20main%20topic%3F')
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.extractWithLLM({
        url: 'https://example.com',
        query: 'What is the main topic?',
      });

      expect(result).toEqual(mockResponse);
    });

    // Timeout testing moved to integration tests

    it('should handle missing LLM provider', async () => {
      nock(baseURL)
        .get(/\/llm\/.*/)
        .matchHeader('x-api-key', apiKey)
        .reply(401, { detail: 'No LLM provider configured' });

      await expect(
        service.extractWithLLM({
          url: 'https://example.com',
          query: 'test',
        }),
      ).rejects.toThrow('No LLM provider configured');
    });
  });
});
