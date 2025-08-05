import nock from 'nock';
import { Crawl4AIService } from '../crawl4ai-service.js';
import type {
  MarkdownEndpointResponse,
  ScreenshotEndpointResponse,
  PDFEndpointResponse,
  HTMLEndpointResponse,
  CrawlEndpointResponse,
} from '../types.js';

/**
 * Unit tests for Crawl4AIService using nock for HTTP mocking
 *
 * Mock Maintenance:
 * - These mocks are maintained manually based on the actual API responses
 * - When the API changes, update the mock responses to match
 * - Integration tests validate against the real API
 */

describe('Crawl4AIService', () => {
  let service: Crawl4AIService;
  // Unit tests always use localhost as configured in jest.setup.cjs
  const baseURL = 'http://localhost:11235';
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
        'Request failed with status 500: Internal server error',
      );
    });

    it('should validate URL format', async () => {
      await expect(service.getMarkdown({ url: 'invalid-url' })).rejects.toThrow('Invalid URL format');
    });

    it('should handle network errors', async () => {
      nock(baseURL).post('/md').matchHeader('x-api-key', apiKey).replyWithError('Network error');

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('Network error');
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

    it('should validate URL format', async () => {
      await expect(service.captureScreenshot({ url: 'not-a-url' })).rejects.toThrow('Invalid URL format');
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

    it('should validate URL format', async () => {
      await expect(service.generatePDF({ url: 'not a url' })).rejects.toThrow('Invalid URL format');
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

    it('should validate URL format', async () => {
      await expect(service.getHTML({ url: 'just text' })).rejects.toThrow('Invalid URL format');
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

    it('should reject invalid JavaScript in crawler_config', async () => {
      await expect(
        service.crawl({
          url: 'https://example.com',
          crawler_config: {
            js_code: 'console.log(&quot;test&quot;)',
          },
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should handle js_code as array with invalid script', async () => {
      await expect(
        service.crawl({
          url: 'https://example.com',
          crawler_config: {
            js_code: ['valid code', '<script>alert("test")</script>'],
          },
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
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

    it('should validate empty URLs array', async () => {
      await expect(service.batchCrawl({ urls: [] })).rejects.toThrow('URLs array cannot be empty');
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

    it('should reject scripts with HTML entities', async () => {
      await expect(
        service.executeJS({
          url: 'https://httpbin.org/html',
          scripts: 'console.log(&quot;test&quot;)',
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should reject scripts with HTML tags', async () => {
      await expect(
        service.executeJS({
          url: 'https://httpbin.org/html',
          scripts: '<script>alert("test")</script>',
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should reject scripts with literal \\n', async () => {
      await expect(
        service.executeJS({
          url: 'https://httpbin.org/html',
          scripts: 'console.log("test");\\nconsole.log("test2");',
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should reject array with invalid scripts', async () => {
      await expect(
        service.executeJS({
          url: 'https://httpbin.org/html',
          scripts: ['valid script', 'console.log(&amp;&amp; true)'],
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should validate URL format', async () => {
      await expect(service.executeJS({ url: '//no-protocol', scripts: 'return 1' })).rejects.toThrow(
        'Invalid URL format',
      );
    });

    it('should reject scripts with escaped backslash-n pattern', async () => {
      // Test the specific pattern that line 40-41 checks for: })\\nword
      const scriptWithPattern = 'function test() {}\\nconsole.log("test")';
      await expect(
        service.executeJS({
          url: 'https://example.com',
          scripts: scriptWithPattern,
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should allow valid JavaScript with actual newlines', async () => {
      const validScript = `function test() {
        console.log("This has real newlines");
        return true;
      }`;

      const mockResponse = {
        success: true,
        js_execution_result: { results: [true] },
      };

      nock(baseURL).post('/execute_js').matchHeader('x-api-key', apiKey).reply(200, mockResponse);

      const result = await service.executeJS({
        url: 'https://example.com',
        scripts: validScript,
      });

      expect(result.success).toBe(true);
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

  describe('Browser Configuration', () => {
    it('should send cookies configuration correctly', async () => {
      const mockResponse: CrawlEndpointResponse = {
        success: true,
        results: [
          {
            url: 'https://httpbin.org/cookies',
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
              raw_markdown: '{"cookies": {"test": "value"}}',
              markdown_with_citations: '',
              references_markdown: '',
              fit_markdown: '{"cookies": {"test": "value"}}',
              fit_html: '',
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
        server_processing_time_s: 1.0,
        server_memory_delta_mb: 5,
        server_peak_memory_mb: 50,
      };

      nock(baseURL)
        .post('/crawl', {
          urls: ['https://httpbin.org/cookies'],
          browser_config: {
            headless: true,
            cookies: [
              {
                name: 'test',
                value: 'value',
                domain: '.httpbin.org',
                path: '/',
              },
            ],
          },
          crawler_config: {},
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.crawl({
        urls: ['https://httpbin.org/cookies'],
        browser_config: {
          headless: true,
          cookies: [
            {
              name: 'test',
              value: 'value',
              domain: '.httpbin.org',
              path: '/',
            },
          ],
        },
        crawler_config: {},
      });

      expect(result.success).toBe(true);
      expect(result.results[0].markdown?.raw_markdown).toContain('cookies');
    });

    it('should send headers configuration correctly', async () => {
      const mockResponse: CrawlEndpointResponse = {
        success: true,
        results: [
          {
            url: 'https://httpbin.org/headers',
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
              raw_markdown: '{"headers": {"X-Custom": "test-value"}}',
              markdown_with_citations: '',
              references_markdown: '',
              fit_markdown: '{"headers": {"X-Custom": "test-value"}}',
              fit_html: '',
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
        server_processing_time_s: 1.0,
        server_memory_delta_mb: 5,
        server_peak_memory_mb: 50,
      };

      nock(baseURL)
        .post('/crawl', {
          urls: ['https://httpbin.org/headers'],
          browser_config: {
            headless: true,
            headers: {
              'X-Custom': 'test-value',
              'X-Request-ID': '12345',
            },
          },
          crawler_config: {},
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.crawl({
        urls: ['https://httpbin.org/headers'],
        browser_config: {
          headless: true,
          headers: {
            'X-Custom': 'test-value',
            'X-Request-ID': '12345',
          },
        },
        crawler_config: {},
      });

      expect(result.success).toBe(true);
      expect(result.results[0].markdown?.raw_markdown).toContain('headers');
    });

    it('should send viewport configuration correctly', async () => {
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
              raw_markdown: 'Content',
              markdown_with_citations: '',
              references_markdown: '',
              fit_markdown: 'Content',
              fit_html: '',
            },
            tables: [],
            extracted_content: null,
            screenshot: 'base64-screenshot-data',
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
        server_processing_time_s: 2.0,
        server_memory_delta_mb: 10,
        server_peak_memory_mb: 100,
      };

      nock(baseURL)
        .post('/crawl', {
          urls: ['https://example.com'],
          browser_config: {
            headless: true,
            viewport_width: 375,
            viewport_height: 667,
          },
          crawler_config: {
            screenshot: true,
          },
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.crawl({
        urls: ['https://example.com'],
        browser_config: {
          headless: true,
          viewport_width: 375,
          viewport_height: 667,
        },
        crawler_config: {
          screenshot: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.results[0].screenshot).toBeTruthy();
    });

    it('should send user agent configuration correctly', async () => {
      const mockResponse: CrawlEndpointResponse = {
        success: true,
        results: [
          {
            url: 'https://httpbin.org/user-agent',
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
              raw_markdown: '{"user-agent": "Custom-Bot/1.0"}',
              markdown_with_citations: '',
              references_markdown: '',
              fit_markdown: '{"user-agent": "Custom-Bot/1.0"}',
              fit_html: '',
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
        server_processing_time_s: 1.0,
        server_memory_delta_mb: 5,
        server_peak_memory_mb: 50,
      };

      nock(baseURL)
        .post('/crawl', {
          urls: ['https://httpbin.org/user-agent'],
          browser_config: {
            headless: true,
            user_agent: 'Custom-Bot/1.0',
          },
          crawler_config: {},
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.crawl({
        urls: ['https://httpbin.org/user-agent'],
        browser_config: {
          headless: true,
          user_agent: 'Custom-Bot/1.0',
        },
        crawler_config: {},
      });

      expect(result.success).toBe(true);
      expect(result.results[0].markdown?.raw_markdown).toContain('Custom-Bot/1.0');
    });

    it('should handle complex browser configuration', async () => {
      const mockResponse: CrawlEndpointResponse = {
        success: true,
        results: [
          {
            url: 'https://httpbin.org/anything',
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
              raw_markdown: 'Response with all configs',
              markdown_with_citations: '',
              references_markdown: '',
              fit_markdown: 'Response with all configs',
              fit_html: '',
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
        server_memory_delta_mb: 8,
        server_peak_memory_mb: 80,
      };

      const complexConfig = {
        urls: ['https://httpbin.org/anything'],
        browser_config: {
          headless: true,
          viewport_width: 768,
          viewport_height: 1024,
          user_agent: 'Test-Bot/2.0',
          cookies: [
            {
              name: 'session',
              value: 'abc123',
              domain: '.httpbin.org',
              path: '/',
            },
          ],
          headers: {
            'X-Test': 'value',
          },
        },
        crawler_config: {
          cache_mode: 'BYPASS' as const,
        },
      };

      nock(baseURL).post('/crawl', complexConfig).matchHeader('x-api-key', apiKey).reply(200, mockResponse);

      const result = await service.crawl(complexConfig);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
    });
  });

  describe('Crawler Configuration Advanced Parameters', () => {
    it('should send content filtering parameters correctly', async () => {
      const mockResponse: CrawlEndpointResponse = {
        success: true,
        results: [
          {
            url: 'https://httpbin.org/forms/post',
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
              raw_markdown: 'Form content without forms',
              markdown_with_citations: '',
              references_markdown: '',
              fit_markdown: 'Form content without forms',
              fit_html: '',
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
        server_processing_time_s: 1.0,
        server_memory_delta_mb: 5,
        server_peak_memory_mb: 50,
      };

      nock(baseURL)
        .post('/crawl', {
          urls: ['https://httpbin.org/forms/post'],
          browser_config: {
            headless: true,
          },
          crawler_config: {
            remove_forms: true,
            keep_data_attributes: true,
            exclude_external_images: true,
          },
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.crawl({
        urls: ['https://httpbin.org/forms/post'],
        browser_config: {
          headless: true,
        },
        crawler_config: {
          remove_forms: true,
          keep_data_attributes: true,
          exclude_external_images: true,
        },
      });

      expect(result.success).toBe(true);
    });

    it('should send js_only parameter correctly', async () => {
      const mockResponse: CrawlEndpointResponse = {
        success: true,
        results: [
          {
            url: 'https://httpbin.org/html',
            html: '',
            cleaned_html: '',
            fit_html: '',
            success: true,
            status_code: 200,
            response_headers: {},
            session_id: null,
            metadata: {},
            links: { internal: [], external: [] },
            media: { images: [], videos: [], audios: [] },
            markdown: {
              raw_markdown: '',
              markdown_with_citations: '',
              references_markdown: '',
              fit_markdown: '',
              fit_html: '',
            },
            tables: [],
            extracted_content: null,
            screenshot: null,
            pdf: null,
            mhtml: null,
            js_execution_result: {
              success: true,
              results: ['Page Title', '5'],
            },
            downloaded_files: null,
            network_requests: null,
            console_messages: null,
            ssl_certificate: null,
            dispatch_result: null,
          },
        ],
        server_processing_time_s: 1.0,
        server_memory_delta_mb: 5,
        server_peak_memory_mb: 50,
      };

      nock(baseURL)
        .post('/crawl', {
          urls: ['https://httpbin.org/html'],
          browser_config: {
            headless: true,
          },
          crawler_config: {
            js_code: ['return document.title', 'return document.querySelectorAll("p").length'],
            js_only: true,
          },
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.crawl({
        urls: ['https://httpbin.org/html'],
        browser_config: {
          headless: true,
        },
        crawler_config: {
          js_code: ['return document.title', 'return document.querySelectorAll("p").length'],
          js_only: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.results[0].js_execution_result).toBeDefined();
    });

    it('should send visibility and debug parameters correctly', async () => {
      const mockResponse: CrawlEndpointResponse = {
        success: true,
        results: [
          {
            url: 'https://httpbin.org/html',
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
              raw_markdown: 'Content',
              markdown_with_citations: '',
              references_markdown: '',
              fit_markdown: 'Content',
              fit_html: '',
            },
            tables: [],
            extracted_content: null,
            screenshot: null,
            pdf: null,
            mhtml: null,
            js_execution_result: null,
            downloaded_files: null,
            network_requests: null,
            console_messages: ['Test log message 1', 'Test warning', 'Test error'],
            ssl_certificate: null,
            dispatch_result: null,
          },
        ],
        server_processing_time_s: 1.5,
        server_memory_delta_mb: 8,
        server_peak_memory_mb: 80,
      };

      nock(baseURL)
        .post('/crawl', {
          urls: ['https://httpbin.org/html'],
          browser_config: {
            headless: true,
          },
          crawler_config: {
            ignore_body_visibility: true,
            verbose: true,
            log_console: true,
          },
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, mockResponse);

      const result = await service.crawl({
        urls: ['https://httpbin.org/html'],
        browser_config: {
          headless: true,
        },
        crawler_config: {
          ignore_body_visibility: true,
          verbose: true,
          log_console: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.results[0].console_messages).toBeDefined();
    });
  });

  describe('parseSitemap', () => {
    it('should fetch and return sitemap content', async () => {
      const mockSitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page1</loc></url>
          <url><loc>https://example.com/page2</loc></url>
        </urlset>`;

      // parseSitemap now uses axios directly without baseURL
      nock('https://example.com').get('/sitemap.xml').reply(200, mockSitemapXML);

      const response = await service.parseSitemap('https://example.com/sitemap.xml');
      expect(response).toBe(mockSitemapXML);
    });

    it('should handle sitemap fetch errors', async () => {
      nock('https://example.com').get('/sitemap.xml').reply(404, 'Not Found');

      await expect(service.parseSitemap('https://example.com/sitemap.xml')).rejects.toThrow();
    });
  });

  describe('detectContentType', () => {
    it('should return content type from HEAD request', async () => {
      // detectContentType now uses axios directly without baseURL
      nock('https://example.com').head('/document.pdf').reply(200, '', { 'content-type': 'application/pdf' });

      const contentType = await service.detectContentType('https://example.com/document.pdf');
      expect(contentType).toBe('application/pdf');
    });

    it('should return empty string when content-type header is missing', async () => {
      nock('https://example.com').head('/file').reply(200, '');

      const contentType = await service.detectContentType('https://example.com/file');
      expect(contentType).toBe('');
    });

    it('should return empty string on HEAD request failure', async () => {
      nock('https://example.com').head('/file').reply(404, 'Not Found');

      const contentType = await service.detectContentType('https://example.com/file');
      expect(contentType).toBe('');
    });
  });

  describe('Network Error Handling', () => {
    it('should handle ECONNABORTED error', async () => {
      const error = new Error('Connection aborted');
      (error as any).code = 'ECONNABORTED';

      nock(baseURL)
        .post('/md')
        .matchHeader('x-api-key', apiKey)
        .replyWithError(error);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('Request timed out');
    });

    it('should handle ETIMEDOUT error', async () => {
      const error = new Error('Socket timed out');
      (error as any).code = 'ETIMEDOUT';

      nock(baseURL)
        .post('/md')
        .matchHeader('x-api-key', apiKey)
        .replyWithError(error);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('Request timeout');
    });

    it('should handle ENOTFOUND error', async () => {
      const error = new Error('getaddrinfo ENOTFOUND');
      (error as any).code = 'ENOTFOUND';

      nock(baseURL)
        .post('/md')
        .matchHeader('x-api-key', apiKey)
        .replyWithError(error);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('DNS resolution failed');
    });

    it('should handle ECONNREFUSED error', async () => {
      const error = new Error('connect ECONNREFUSED');
      (error as any).code = 'ECONNREFUSED';

      nock(baseURL)
        .post('/md')
        .matchHeader('x-api-key', apiKey)
        .replyWithError(error);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('Connection refused');
    });

    it('should handle ECONNRESET error', async () => {
      const error = new Error('socket hang up');
      (error as any).code = 'ECONNRESET';

      nock(baseURL)
        .post('/md')
        .matchHeader('x-api-key', apiKey)
        .replyWithError(error);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('Connection reset');
    });

    it('should handle ENETUNREACH error', async () => {
      const error = new Error('Network is unreachable');
      (error as any).code = 'ENETUNREACH';

      nock(baseURL)
        .post('/md')
        .matchHeader('x-api-key', apiKey)
        .replyWithError(error);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('Network unreachable');
    });

    it('should handle generic axios errors', async () => {
      const error = new Error('Generic error') as any;
      error.isAxiosError = true;

      nock(baseURL)
        .post('/md')
        .matchHeader('x-api-key', apiKey)
        .replyWithError(error);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('Generic error');
    });
  });

  describe('Optional Parameter Handling', () => {
    it('should handle batchCrawl with remove_images option', async () => {
      const urls = ['https://example.com'];

      nock(baseURL)
        .post('/crawl', (body) => {
          return body.crawler_config?.exclude_tags?.includes('img');
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, { success: true, results: [] });

      await service.batchCrawl({ urls, remove_images: true });
    });

    it('should handle batchCrawl with bypass_cache option', async () => {
      const urls = ['https://example.com'];

      nock(baseURL)
        .post('/crawl', (body) => {
          return body.crawler_config?.cache_mode === 'BYPASS';
        })
        .matchHeader('x-api-key', apiKey)
        .reply(200, { success: true, results: [] });

      await service.batchCrawl({ urls, bypass_cache: true });
    });

    it('should test edge case JavaScript validation pattern', async () => {
      // Test the specific pattern on line 40-41: })\\nword
      const scriptWithEdgeCase = 'if (true) {}\\nwindow.alert("test")';
      await expect(
        service.executeJS({
          url: 'https://example.com',
          scripts: scriptWithEdgeCase,
        }),
      ).rejects.toThrow('Invalid JavaScript: Contains HTML entities');
    });
  });
});
