/* eslint-env jest */
import { jest } from '@jest/globals';
import { describe, it, expect, beforeEach } from '@jest/globals';

// Set up environment variables before any imports
process.env.CRAWL4AI_BASE_URL = 'http://test.example.com';
process.env.CRAWL4AI_API_KEY = 'test-api-key';

// Create mock functions
const mockGetMarkdown = jest.fn();
const mockCaptureScreenshot = jest.fn();
const mockGeneratePDF = jest.fn();
const mockExecuteJS = jest.fn();
const mockGetHTML = jest.fn();
const mockBatchCrawl = jest.fn();
const mockExtractWithLLM = jest.fn();
const mockCrawl = jest.fn();

// Mock the Crawl4AIService module
jest.unstable_mockModule('../crawl4ai-service.js', () => ({
  Crawl4AIService: jest.fn().mockImplementation(() => ({
    getMarkdown: mockGetMarkdown,
    captureScreenshot: mockCaptureScreenshot,
    generatePDF: mockGeneratePDF,
    executeJS: mockExecuteJS,
    getHTML: mockGetHTML,
    batchCrawl: mockBatchCrawl,
    extractWithLLM: mockExtractWithLLM,
    crawl: mockCrawl,
  })),
}));

// Mock MCP SDK
const mockSetRequestHandler = jest.fn();
const mockTool = jest.fn();
const mockConnect = jest.fn();

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: mockSetRequestHandler,
    tool: mockTool,
    connect: mockConnect,
  })),
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

// Mock axios
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockHead = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    create: jest.fn(() => ({
      post: mockPost,
      get: mockGet,
      head: mockHead,
    })),
    get: mockGet,
  },
}));

// Now dynamically import the modules after mocks are set up
const {
  Crawl4AIServer,
  GetMarkdownSchema,
  CrawlSchema,
  BatchCrawlSchema,
  CreateSessionSchema,
  CaptureScreenshotSchema: _CaptureScreenshotSchema,
  GeneratePdfSchema: _GeneratePdfSchema,
  ExecuteJsSchema: _ExecuteJsSchema,
  ExtractWithLlmSchema: _ExtractWithLlmSchema,
  SmartCrawlSchema: _SmartCrawlSchema,
  CrawlRecursiveSchema: _CrawlRecursiveSchema,
} = await import('../index.js');
const { Crawl4AIService } = await import('../crawl4ai-service.js');

// Import types statically (these are removed at compile time)
import type {
  MarkdownEndpointResponse,
  ScreenshotEndpointResponse,
  PDFEndpointResponse,
  HTMLEndpointResponse,
  CrawlEndpointResponse,
} from '../types.js';

// Define types for test results
interface ContentItem {
  type: string;
  text?: string;
  data?: string;
  resource?: {
    uri: string;
    mimeType: string;
    blob: string;
  };
}

interface ToolResult {
  content: ContentItem[];
}

type RequestHandler = (request: { method: string; params: unknown }) => Promise<ToolResult>;

// Create a test interface for server methods
interface TestServerMethods {
  getMarkdown: (params: unknown) => Promise<ToolResult>;
  captureScreenshot: (params: unknown) => Promise<ToolResult>;
  generatePDF: (params: unknown) => Promise<ToolResult>;
  executeJS: (params: unknown) => Promise<ToolResult>;
  getHTML: (params: unknown) => Promise<ToolResult>;
  batchCrawl: (params: unknown) => Promise<ToolResult>;
  crawl: (params: unknown) => Promise<ToolResult>;
  createSession: (params: unknown) => Promise<ToolResult>;
  clearSession: (params: unknown) => Promise<ToolResult>;
  listSessions: () => Promise<ToolResult>;
  extractWithLLM: (params: unknown) => Promise<ToolResult>;
  extractLinks: (params: unknown) => Promise<ToolResult>;
  crawlRecursive: (params: unknown) => Promise<ToolResult>;
  parseSitemap: (params: unknown) => Promise<ToolResult>;
  smartCrawl: (params: unknown) => Promise<ToolResult>;
}

describe('Crawl4AIServer Tool Handlers', () => {
  let server: InstanceType<typeof Crawl4AIServer> & TestServerMethods;
  let requestHandler: RequestHandler;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset all mock functions
    mockGetMarkdown.mockReset();
    mockCaptureScreenshot.mockReset();
    mockGeneratePDF.mockReset();
    mockExecuteJS.mockReset();
    mockGetHTML.mockReset();
    mockBatchCrawl.mockReset();
    mockExtractWithLLM.mockReset();
    mockCrawl.mockReset();
    mockPost.mockReset();
    mockGet.mockReset();
    mockHead.mockReset();

    // Create server instance - the mock will be used automatically
    server = new Crawl4AIServer() as InstanceType<typeof Crawl4AIServer> & TestServerMethods;

    // Start the server to register handlers
    await server.start();

    // Get the request handler
    requestHandler = mockSetRequestHandler.mock.calls.find((call) => call[0].parse === undefined)?.[1];
  });

  // Add a simple test to verify mocking works
  it('should use the mocked service', () => {
    const MockedService = Crawl4AIService as jest.MockedClass<typeof Crawl4AIService>;
    expect(MockedService).toHaveBeenCalledTimes(1);
    expect(MockedService).toHaveBeenCalledWith('http://test.example.com', 'test-api-key');
  });

  describe('Constructor and setup', () => {
    it('should initialize with correct configuration', () => {
      expect(server).toBeDefined();
      expect((server as InstanceType<typeof Crawl4AIServer>).service).toBeDefined();
      expect((server as InstanceType<typeof Crawl4AIServer>).sessions).toBeDefined();
    });

    it('should set up handlers on construction', () => {
      expect(mockSetRequestHandler).toHaveBeenCalled();
      expect(mockSetRequestHandler.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Handler Success Cases', () => {
    describe('get_markdown', () => {
      it('should handle successful markdown extraction', async () => {
        const mockResponse: MarkdownEndpointResponse = {
          url: 'https://example.com',
          filter: 'fit',
          query: null,
          cache: 'false',
          markdown: '# Example Page\n\nThis is example content.',
          success: true,
        };

        mockGetMarkdown.mockResolvedValue(mockResponse);

        const result: ToolResult = await server.getMarkdown({
          url: 'https://example.com',
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('# Example Page');
        expect(result.content[0].text).toContain('URL: https://example.com');
        expect(result.content[0].text).toContain('Filter: fit');
      });

      it('should handle markdown with query', async () => {
        const mockResponse: MarkdownEndpointResponse = {
          url: 'https://example.com',
          filter: 'bm25',
          query: 'test query',
          cache: 'false',
          markdown: 'Filtered content',
          success: true,
        };

        mockGetMarkdown.mockResolvedValue(mockResponse);

        const result: ToolResult = await server.getMarkdown({
          url: 'https://example.com',
          filter: 'bm25',
          query: 'test query',
        });

        expect(mockGetMarkdown).toHaveBeenCalledWith({
          url: 'https://example.com',
          f: 'bm25',
          q: 'test query',
        });
        expect(result.content[0].text).toContain('Query: test query');
      });
    });

    describe('capture_screenshot', () => {
      it('should handle successful screenshot capture', async () => {
        const mockResponse: ScreenshotEndpointResponse = {
          success: true,
          screenshot: 'base64-encoded-screenshot-data',
        };

        mockCaptureScreenshot.mockResolvedValue(mockResponse);

        const result: ToolResult = await server.captureScreenshot({
          url: 'https://example.com',
        });

        expect(result.content).toHaveLength(2);
        expect(result.content[0].type).toBe('image');
        expect(result.content[0].data).toBe('base64-encoded-screenshot-data');
        expect(result.content[1].type).toBe('text');
        expect(result.content[1].text).toBe('Screenshot captured for: https://example.com');
      });
    });

    describe('generate_pdf', () => {
      it('should handle successful PDF generation', async () => {
        const mockResponse: PDFEndpointResponse = {
          success: true,
          pdf: 'base64-encoded-pdf-data',
        };

        mockGeneratePDF.mockResolvedValue(mockResponse);

        const result: ToolResult = await server.generatePDF({
          url: 'https://example.com',
        });

        expect(result.content).toHaveLength(2);
        expect(result.content[0].type).toBe('resource');
        expect(result.content[0].resource.blob).toBeDefined();
        expect(result.content[1].type).toBe('text');
        expect(result.content[1].text).toContain('PDF generated for: https://example.com');
      });
    });

    describe('execute_js', () => {
      it('should handle successful JS execution', async () => {
        const mockResponse = {
          markdown: 'Page content',
          js_execution_result: {
            success: true,
            results: ['Title: Example', 'Link count: 5'],
          },
        };

        mockExecuteJS.mockResolvedValue(mockResponse);

        const result: ToolResult = await server.executeJS({
          url: 'https://example.com',
          scripts: ['return document.title', 'return document.links.length'],
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('JavaScript executed on: https://example.com');
        expect(result.content[0].text).toContain('Title: Example');
        expect(result.content[0].text).toContain('Link count: 5');
      });

      it('should handle JS execution without results', async () => {
        const mockResponse = {
          markdown: 'Page content',
          js_execution_result: null,
        };

        mockExecuteJS.mockResolvedValue(mockResponse);

        const result: ToolResult = await server.executeJS({
          url: 'https://example.com',
          scripts: 'console.log("test")',
        });

        expect(result.content[0].text).toContain('JavaScript executed on: https://example.com');
        expect(result.content[0].text).toContain('No results returned');
      });
    });

    describe('get_html', () => {
      it('should handle successful HTML retrieval', async () => {
        const mockResponse: HTMLEndpointResponse = {
          html: '<html><body><h1>Example</h1></body></html>',
          url: 'https://example.com',
          success: true,
        };

        mockGetHTML.mockResolvedValue(mockResponse);

        const result: ToolResult = await server.getHTML({
          url: 'https://example.com',
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('<html><body><h1>Example</h1></body></html>');
      });
    });

    describe('batch_crawl', () => {
      it('should handle successful batch crawl', async () => {
        const mockResponse = {
          results: [
            { url: 'https://example1.com', markdown: { raw_markdown: 'Content 1' }, success: true },
            { url: 'https://example2.com', markdown: { raw_markdown: 'Content 2' }, success: true },
          ],
          success: true,
        };

        // Mock axios response since batchCrawl uses axiosClient directly
        mockPost.mockResolvedValue({ data: mockResponse });

        const result: ToolResult = await server.batchCrawl({
          urls: ['https://example1.com', 'https://example2.com'],
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toContain('Batch crawl completed');
        expect(result.content[0].text).toContain('Processed 2 URLs');
      });

      it('should handle batch crawl with remove_images', async () => {
        // Mock axios response since batchCrawl uses axiosClient directly
        mockPost.mockResolvedValue({ data: { results: [] } });

        const result: ToolResult = await server.batchCrawl({
          urls: ['https://example.com'],
          remove_images: true,
        });

        expect(mockPost).toHaveBeenCalledWith('/crawl', {
          urls: ['https://example.com'],
          crawler_config: {
            exclude_tags: ['img', 'picture', 'svg'],
          },
        });
        expect(result.content[0].text).toContain('Batch crawl completed');
      });
    });

    describe('crawl', () => {
      it('should handle successful crawl with all options', async () => {
        const mockResponse: CrawlEndpointResponse = {
          success: true,
          results: [
            {
              url: 'https://example.com',
              html: '<html>...</html>',
              cleaned_html: '<html>clean</html>',
              fit_html: '<html>fit</html>',
              success: true,
              status_code: 200,
              response_headers: {},
              session_id: 'test-session',
              metadata: { title: 'Example' },
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
              screenshot: 'screenshot-data',
              pdf: 'pdf-data',
              mhtml: null,
              js_execution_result: { success: true, results: ['JS result'] },
              downloaded_files: null,
              network_requests: null,
              console_messages: ['Console log'],
              ssl_certificate: null,
              dispatch_result: null,
            },
          ],
          server_processing_time_s: 1.5,
          server_memory_delta_mb: 10,
          server_peak_memory_mb: 100,
        };

        mockCrawl.mockResolvedValue(mockResponse);

        const result: ToolResult = await server.crawl({
          url: 'https://example.com',
          screenshot: true,
          pdf: true,
          js_code: 'return document.title',
          session_id: 'test-session',
        });

        expect(result.content.length).toBeGreaterThan(0); // Multiple content types
        // Check text content
        const textContent = result.content.find((c) => c.type === 'text' && c.text?.includes('# Example'));
        expect(textContent).toBeDefined();
        // Check screenshot
        const screenshotContent = result.content.find((c) => c.type === 'image');
        expect(screenshotContent?.data).toBe('screenshot-data');
      });

      it('should handle crawl with proxy configuration', async () => {
        const mockResponse: CrawlEndpointResponse = {
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Proxied content' },
              success: true,
              status_code: 200,
            },
          ],
        };

        mockCrawl.mockResolvedValue(mockResponse);

        await server.crawl({
          url: 'https://example.com',
          proxy_server: 'http://proxy.example.com:8080',
          proxy_username: 'user',
          proxy_password: 'pass',
        });

        expect(mockCrawl).toHaveBeenCalledWith(
          expect.objectContaining({
            browser_config: expect.objectContaining({
              proxy_config: {
                server: 'http://proxy.example.com:8080',
                username: 'user',
                password: 'pass',
              },
            }),
          }),
        );
      });

      it('should handle crawl with cookies and headers', async () => {
        const mockResponse: CrawlEndpointResponse = {
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Content with auth' },
              success: true,
              status_code: 200,
            },
          ],
        };

        mockCrawl.mockResolvedValue(mockResponse);

        await server.crawl({
          url: 'https://example.com',
          cookies: [{ name: 'session', value: 'abc123' }],
          headers: { Authorization: 'Bearer token123' },
        });

        expect(mockCrawl).toHaveBeenCalledWith(
          expect.objectContaining({
            browser_config: expect.objectContaining({
              cookies: [{ name: 'session', value: 'abc123' }],
              headers: { Authorization: 'Bearer token123' },
            }),
          }),
        );
      });

      it('should handle virtual scroll configuration', async () => {
        const mockResponse: CrawlEndpointResponse = {
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Scrolled content' },
              success: true,
              status_code: 200,
            },
          ],
        };

        mockCrawl.mockResolvedValue(mockResponse);

        await server.crawl({
          url: 'https://example.com',
          virtual_scroll_config: {
            enabled: true,
            scroll_step: 100,
            max_scrolls: 10,
          },
        });

        expect(mockCrawl).toHaveBeenCalledWith(
          expect.objectContaining({
            crawler_config: expect.objectContaining({
              virtual_scroll_config: {
                enabled: true,
                scroll_step: 100,
                max_scrolls: 10,
              },
            }),
          }),
        );
      });

      it('should handle js_code as null error', async () => {
        await expect(
          server.crawl({
            url: 'https://example.com',
            js_code: null,
          }),
        ).rejects.toThrow('js_code parameter is null');
      });
    });

    describe('Session management', () => {
      it('should create a session successfully', async () => {
        const result: ToolResult = await server.createSession({
          initial_url: 'https://example.com',
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toMatch(/Session created successfully/);
        expect(result.content[0].text).toMatch(/Session ID: session-/);
      });

      it('should clear a session successfully', async () => {
        // First create a session
        const createResult = await server.createSession({});
        const sessionIdMatch = createResult.content[0].text.match(/Session ID: (session-[^\n]+)/);
        const sessionId = sessionIdMatch?.[1] || 'test-session';

        const result: ToolResult = await server.clearSession({
          session_id: sessionId,
        });

        expect(result.content[0].text).toBe(`Session cleared successfully: ${sessionId}`);
      });

      it('should list sessions', async () => {
        // Create a couple of sessions
        await server.createSession({ initial_url: 'https://example1.com' });
        await server.createSession({ initial_url: 'https://example2.com' });

        const result: ToolResult = await server.listSessions();

        expect(result.content[0].text).toContain('Active sessions (2)');
        expect(result.content[0].text).toMatch(/session-\w+-\w+/);
      });
    });

    describe('extract_with_llm', () => {
      it('should handle successful LLM extraction', async () => {
        mockExtractWithLLM.mockResolvedValue({
          answer: 'The main topic is JavaScript testing.',
        });

        const result: ToolResult = await server.extractWithLLM({
          url: 'https://example.com',
          query: 'What is the main topic?',
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toBe('The main topic is JavaScript testing.');
      });
    });

    describe('extract_links', () => {
      it('should extract and categorize links', async () => {
        mockPost.mockResolvedValue({
          data: {
            results: [
              {
                links: {
                  internal: [
                    { href: '/page1', text: 'Page 1' },
                    { href: '/page2', text: 'Page 2' },
                  ],
                  external: [{ href: 'https://external.com', text: 'External' }],
                },
              },
            ],
          },
        });

        const result: ToolResult = await server.extractLinks({
          url: 'https://example.com',
          categorize: true,
        });

        expect(result.content[0].text).toContain('Link analysis for https://example.com:');
        expect(result.content[0].text).toContain('internal (2)');
        expect(result.content[0].text).toContain('/page1');
        expect(result.content[0].text).toContain('external (1)');
      });
    });

    describe('crawl_recursive', () => {
      it('should crawl recursively with depth limit', async () => {
        // Ensure mock is clean before setting up
        mockPost.mockReset();

        mockPost
          .mockResolvedValueOnce({
            data: {
              results: [
                {
                  url: 'https://example.com',
                  links: {
                    internal: [{ href: 'https://example.com/page1', text: 'Page 1' }],
                  },
                  markdown: { raw_markdown: 'Home page' },
                  success: true,
                },
              ],
            },
          })
          .mockResolvedValueOnce({
            data: {
              results: [
                {
                  url: 'https://example.com/page1',
                  links: { internal: [] },
                  markdown: { raw_markdown: 'Page 1 content' },
                  success: true,
                },
              ],
            },
          });

        const result: ToolResult = await server.crawlRecursive({
          url: 'https://example.com',
          max_depth: 2,
        });

        expect(result.content[0].text).toContain('Recursive crawl completed:');
        expect(result.content[0].text).toContain('Pages crawled: 2');
        expect(result.content[0].text).toContain('https://example.com');
        expect(result.content[0].text).toContain('https://example.com/page1');
      });
    });

    describe('parse_sitemap', () => {
      it('should parse sitemap successfully', async () => {
        mockGet.mockResolvedValue({
          data: `<?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://example.com/</loc></url>
              <url><loc>https://example.com/page1</loc></url>
              <url><loc>https://example.com/page2</loc></url>
            </urlset>`,
        });

        const result: ToolResult = await server.parseSitemap({
          url: 'https://example.com/sitemap.xml',
        });

        expect(result.content[0].text).toContain('Sitemap parsed successfully:');
        expect(result.content[0].text).toContain('Total URLs found: 3');
        expect(result.content[0].text).toContain('https://example.com/');
        expect(result.content[0].text).toContain('https://example.com/page1');
      });
    });

    describe('smart_crawl', () => {
      it('should handle smart crawl for HTML content', async () => {
        mockHead.mockResolvedValue({
          headers: { 'content-type': 'text/html' },
        });
        mockPost.mockResolvedValue({
          data: {
            results: [
              {
                markdown: { raw_markdown: 'HTML content' },
                links: { internal: [], external: [] },
              },
            ],
          },
        });

        const result: ToolResult = await server.smartCrawl({
          url: 'https://example.com',
        });

        expect(result.content[0].text).toContain('Smart crawl detected content type');
        // Already contains 'Smart crawl detected content type'
      });

      it('should handle smart crawl for PDF content', async () => {
        mockHead.mockResolvedValue({
          headers: { 'content-type': 'application/pdf' },
        });

        // Mock the crawl response for PDF
        mockPost.mockResolvedValue({
          data: {
            results: [
              {
                markdown: { raw_markdown: 'PDF content extracted' },
                links: { internal: [], external: [] },
              },
            ],
          },
        });

        const result: ToolResult = await server.smartCrawl({
          url: 'https://example.com/doc.pdf',
        });

        expect(result.content[0].text).toContain('Smart crawl detected content type');
        expect(result.content[0].text).toContain('PDF content extracted');
      });
    });
  });

  describe('Tool Handler Error Cases', () => {
    describe('Service errors', () => {
      it('should handle service error for get_markdown', async () => {
        mockGetMarkdown.mockRejectedValue(new Error('Network error'));

        await expect(server.getMarkdown({ url: 'https://example.com' })).rejects.toThrow(
          'Failed to get markdown: Network error',
        );
      });

      it('should handle axios error with response detail', async () => {
        const axiosError = {
          response: {
            data: {
              detail: 'Invalid API key',
            },
          },
        };
        mockCaptureScreenshot.mockRejectedValue(axiosError);

        await expect(server.captureScreenshot({ url: 'https://example.com' })).rejects.toThrow(
          'Failed to capture screenshot: Invalid API key',
        );
      });

      it('should handle missing screenshot data', async () => {
        mockCaptureScreenshot.mockResolvedValue({
          success: false,
          screenshot: '',
        });

        await expect(server.captureScreenshot({ url: 'https://example.com' })).rejects.toThrow(
          'Screenshot capture failed - no screenshot data in response',
        );
      });

      it('should handle missing PDF data', async () => {
        mockGeneratePDF.mockResolvedValue({
          success: true,
          pdf: '',
        });

        await expect(server.generatePDF({ url: 'https://example.com' })).rejects.toThrow(
          'PDF generation failed - no PDF data in response',
        );
      });
    });

    describe('Validation errors', () => {
      it('should handle missing scripts for execute_js', async () => {
        await expect(
          server.executeJS({ url: 'https://example.com', scripts: null as unknown as string }),
        ).rejects.toThrow('scripts is required');
      });

      it('should handle empty crawl options', async () => {
        await expect(server.crawl(null as unknown as Parameters<typeof server.crawl>[0])).rejects.toThrow(
          'crawl requires options object with at least a url parameter',
        );
      });

      it('should handle crawl_recursive errors', async () => {
        // Setup the mock to fail - crawlRecursive catches the error internally
        mockPost.mockRejectedValue(new Error('API error'));

        const result: ToolResult = await server.crawlRecursive({ url: 'https://example.com' });

        // The method catches errors and returns a message about no pages crawled
        expect(result.content[0].text).toContain('Pages crawled: 0');
        expect(result.content[0].text).toContain('No pages could be crawled');
      });

      it('should handle parse_sitemap errors', async () => {
        mockGet.mockRejectedValue(new Error('Failed to fetch sitemap'));

        await expect(server.parseSitemap({ url: 'https://example.com/sitemap.xml' })).rejects.toThrow(
          'Failed to parse sitemap: Failed to fetch sitemap',
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle batch crawl with no results', async () => {
        mockPost.mockResolvedValue({
          data: {
            results: [],
          },
        });

        const result: ToolResult = await server.batchCrawl({
          urls: ['https://example.com'],
        });

        expect(result.content[0].text).toContain('Batch crawl completed');
        expect(result.content[0].text).toContain('Processed 0 URLs');
      });

      it('should handle extract_links with no links', async () => {
        mockPost.mockResolvedValue({
          data: {
            results: [
              {
                links: {
                  internal: [],
                  external: [],
                },
              },
            ],
          },
        });

        const result: ToolResult = await server.extractLinks({
          url: 'https://example.com',
        });

        expect(result.content[0].text).toContain('All links from https://example.com:');
        expect(result.content[0].text).toMatch(/\n\s*$/);
      });

      it('should handle session not found for clear_session', async () => {
        const result: ToolResult = await server.clearSession({
          session_id: 'non-existent-session',
        });

        expect(result.content[0].text).toContain('Session not found');
      });

      it('should handle smart crawl with HEAD request failure', async () => {
        mockHead.mockRejectedValue(new Error('HEAD failed'));
        // Fallback to HTML crawl
        mockPost.mockResolvedValue({
          data: {
            results: [
              {
                markdown: { raw_markdown: 'Fallback content' },
                links: { internal: [], external: [] },
              },
            ],
          },
        });

        const result: ToolResult = await server.smartCrawl({
          url: 'https://example.com',
        });

        expect(result.content[0].text).toContain('Smart crawl detected content type');
      });
    });

    describe('ZodError validation tests', () => {
      it('should validate get_markdown parameters', () => {
        // Valid case
        expect(() => {
          GetMarkdownSchema.parse({ url: 'https://example.com' });
        }).not.toThrow();

        // Invalid - missing url
        expect(() => {
          GetMarkdownSchema.parse({ filter: 'fit' });
        }).toThrow();

        // Invalid - bm25 without query
        expect(() => {
          GetMarkdownSchema.parse({ url: 'https://example.com', filter: 'bm25' });
        }).toThrow('Query parameter is required when using bm25 or llm filter');
      });

      it('should validate crawl parameters', () => {
        // Valid case
        expect(() => {
          CrawlSchema.parse({ url: 'https://example.com' });
        }).not.toThrow();

        // Invalid - js_only without session_id
        expect(() => {
          CrawlSchema.parse({ url: 'https://example.com', js_only: true });
        }).toThrow('js_only requires session_id');

        // Invalid - empty js_code array
        expect(() => {
          CrawlSchema.parse({ url: 'https://example.com', js_code: [] });
        }).toThrow('js_code array cannot be empty');
      });

      it('should validate batch_crawl parameters', () => {
        // Valid case
        expect(() => {
          BatchCrawlSchema.parse({ urls: ['https://example.com'] });
        }).not.toThrow();

        // Invalid - not an array
        expect(() => {
          BatchCrawlSchema.parse({ urls: 'not-an-array' });
        }).toThrow();
      });

      it('should validate create_session parameters', () => {
        // Valid case
        expect(() => {
          CreateSessionSchema.parse({});
        }).not.toThrow();

        // Invalid browser type
        expect(() => {
          CreateSessionSchema.parse({ browser_type: 'invalid' });
        }).toThrow();
      });
    });

    describe('Parameter validation edge cases', () => {
      // These tests require proper schema validation which happens at the handler level
      // Skipping direct method calls as they bypass validation
    });

    describe('Additional coverage tests', () => {
      it('should handle crawl with media extraction', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Content' },
              media: {
                images: [
                  { src: 'https://example.com/img1.jpg', alt: 'Image 1' },
                  { src: 'https://example.com/img2.jpg', alt: 'Image 2' },
                ],
                videos: [{ src: 'https://example.com/video.mp4', type: 'video/mp4' }],
                audios: [],
              },
              success: true,
              status_code: 200,
            },
          ],
        });

        const result: ToolResult = await server.crawl({
          url: 'https://example.com',
          media_handling: { images: true, videos: true },
        });

        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('Content');
      });

      it('should handle crawl with tables extraction', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Content' },
              tables: [
                {
                  headers: ['Name', 'Age'],
                  rows: [
                    ['John', '30'],
                    ['Jane', '25'],
                  ],
                  markdown: '| Name | Age |\n|------|-----|\n| John | 30 |\n| Jane | 25 |',
                },
              ],
              success: true,
              status_code: 200,
            },
          ],
        });

        const result: ToolResult = await server.crawl({
          url: 'https://example.com',
        });

        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('Content');
      });

      it('should handle crawl with network_requests', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Content' },
              network_requests: [
                { url: 'https://api.example.com/data', method: 'GET', status: 200 },
                { url: 'https://api.example.com/post', method: 'POST', status: 201 },
              ],
              success: true,
              status_code: 200,
            },
          ],
        });

        const result: ToolResult = await server.crawl({
          url: 'https://example.com',
          network_requests: true,
        });

        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('Content');
      });

      it('should handle crawl with mhtml output', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Content' },
              mhtml: 'MHTML content here',
              success: true,
              status_code: 200,
            },
          ],
        });

        const result: ToolResult = await server.crawl({
          url: 'https://example.com',
          mhtml: true,
        });

        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('Content');
      });

      it('should handle crawl with downloaded_files', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Content' },
              downloaded_files: {
                'file1.pdf': 'base64content1',
                'file2.doc': 'base64content2',
              },
              success: true,
              status_code: 200,
            },
          ],
        });

        const result: ToolResult = await server.crawl({
          url: 'https://example.com',
          download_files: true,
        });

        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('Content');
      });

      it('should handle crawl with ssl_certificate', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Content' },
              ssl_certificate: {
                issuer: "Let's Encrypt",
                subject: '*.example.com',
                validFrom: '2024-01-01',
                validTo: '2024-12-31',
                protocol: 'TLSv1.3',
              },
              success: true,
              status_code: 200,
            },
          ],
        });

        const result: ToolResult = await server.crawl({
          url: 'https://example.com',
          ssl_certificate: true,
        });

        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('Content');
      });

      it('should handle crawl with wait_for conditions', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Dynamic content loaded' },
              success: true,
              status_code: 200,
            },
          ],
        });

        await server.crawl({
          url: 'https://example.com',
          wait_for: {
            selector: '.dynamic-content',
            timeout: 5000,
          },
        });

        expect(mockCrawl).toHaveBeenCalledWith(
          expect.objectContaining({
            crawler_config: expect.objectContaining({
              wait_for: {
                selector: '.dynamic-content',
                timeout: 5000,
              },
            }),
          }),
        );
      });

      it('should handle crawl error scenarios', async () => {
        mockCrawl.mockResolvedValue({
          success: false,
          results: [
            {
              url: 'https://example.com',
              success: false,
              error: 'Page load timeout',
              status_code: 0,
            },
          ],
        });

        const result: ToolResult = await server.crawl({
          url: 'https://example.com',
        });

        expect(result.content[0].text).toBe('No content extracted');
      });

      it('should handle extract_links with categorized output', async () => {
        mockPost.mockResolvedValue({
          data: {
            results: [
              {
                links: {
                  internal: [
                    { href: '/page1', text: 'Page 1' },
                    { href: '/page2', text: 'Page 2' },
                  ],
                  external: [{ href: 'https://external.com', text: 'External' }],
                  social: [{ href: 'https://twitter.com/example', text: 'Twitter' }],
                  documents: [{ href: '/file.pdf', text: 'PDF Document' }],
                  images: [{ href: '/image.jpg', text: 'Image' }],
                },
              },
            ],
          },
        });

        const result: ToolResult = await server.extractLinks({
          url: 'https://example.com',
          categorize: true,
        });

        expect(result.content[0].text).toContain('internal (2)');
        expect(result.content[0].text).toContain('external (1)');
        expect(result.content[0].text).toContain('social (0)'); // No social links in internal/external
        expect(result.content[0].text).toContain('documents (0)'); // No documents in internal/external
        expect(result.content[0].text).toContain('images (0)'); // No images in internal/external
      });

      it('should handle smart_crawl for sitemap', async () => {
        // Set up axios client mock for the server instance
        const axiosClientMock = {
          head: jest.fn().mockResolvedValue({
            headers: { 'content-type': 'application/xml' },
          }),
          post: jest.fn().mockResolvedValue({
            data: {
              results: [
                {
                  url: 'https://example.com/sitemap.xml',
                  markdown: { raw_markdown: 'Sitemap content' },
                  success: true,
                  status_code: 200,
                },
              ],
            },
          }),
        };
        // @ts-expect-error - accessing private property for testing
        (server as InstanceType<typeof Crawl4AIServer>).axiosClient = axiosClientMock;

        const result: ToolResult = await server.smartCrawl({
          url: 'https://example.com/sitemap.xml',
        });

        expect(result.content[0].text).toContain('Smart crawl detected content type: sitemap');
        expect(result.content[0].text).toContain('Sitemap content');
        expect(axiosClientMock.post).toHaveBeenCalledWith(
          '/crawl',
          expect.objectContaining({
            urls: ['https://example.com/sitemap.xml'],
            strategy: 'sitemap',
          }),
        );
      });

      it('should handle smart_crawl for RSS feed', async () => {
        const axiosClientMock = {
          head: jest.fn().mockResolvedValue({
            headers: { 'content-type': 'application/rss+xml' },
          }),
          post: jest.fn().mockResolvedValue({
            data: {
              results: [
                {
                  url: 'https://example.com/feed.rss',
                  markdown: { raw_markdown: 'RSS feed content' },
                  success: true,
                  status_code: 200,
                },
              ],
            },
          }),
        };
        // @ts-expect-error - accessing private property for testing
        (server as InstanceType<typeof Crawl4AIServer>).axiosClient = axiosClientMock;

        const result: ToolResult = await server.smartCrawl({
          url: 'https://example.com/feed.rss',
        });

        expect(result.content[0].text).toContain('Smart crawl detected content type: rss');
        expect(result.content[0].text).toContain('RSS feed content');
        expect(axiosClientMock.post).toHaveBeenCalledWith(
          '/crawl',
          expect.objectContaining({
            urls: ['https://example.com/feed.rss'],
            strategy: 'rss',
          }),
        );
      });

      it('should handle smart_crawl for JSON content', async () => {
        const axiosClientMock = {
          head: jest.fn().mockResolvedValue({
            headers: { 'content-type': 'application/json' },
          }),
          post: jest.fn().mockResolvedValue({
            data: {
              results: [
                {
                  url: 'https://example.com/data.json',
                  markdown: { raw_markdown: 'JSON content' },
                  success: true,
                  status_code: 200,
                },
              ],
            },
          }),
        };
        // @ts-expect-error - accessing private property for testing
        (server as InstanceType<typeof Crawl4AIServer>).axiosClient = axiosClientMock;

        const result: ToolResult = await server.smartCrawl({
          url: 'https://example.com/data.json',
        });

        expect(result.content[0].text).toContain('Smart crawl detected content type: html');
        expect(result.content[0].text).toContain('JSON content');
        expect(axiosClientMock.post).toHaveBeenCalledWith(
          '/crawl',
          expect.objectContaining({
            urls: ['https://example.com/data.json'],
            strategy: 'html',
          }),
        );
      });

      it('should correctly categorize internal documents and images', async () => {
        mockPost.mockResolvedValue({
          data: {
            results: [
              {
                links: {
                  internal: [
                    { href: '/page1', text: 'Page 1' },
                    { href: '/docs/manual.pdf', text: 'Manual' },
                    { href: '/images/logo.png', text: 'Logo' },
                    { href: '/assets/style.css', text: 'Styles' },
                  ],
                  external: [{ href: 'https://example.com/report.pdf', text: 'External Report' }],
                },
              },
            ],
          },
        });

        const result: ToolResult = await server.extractLinks({
          url: 'https://example.com',
          categorize: true,
        });

        expect(result.content[0].text).toContain('internal (1)'); // Only /page1 remains as internal
        expect(result.content[0].text).toContain('external (0)'); // External PDF moved to documents
        expect(result.content[0].text).toContain('documents (2)'); // Both PDFs
        expect(result.content[0].text).toContain('images (1)'); // The PNG
        expect(result.content[0].text).toContain('scripts (1)'); // The CSS
      });

      it('should handle smart_crawl for plain text', async () => {
        const axiosClientMock = {
          head: jest.fn().mockResolvedValue({
            headers: { 'content-type': 'text/plain' },
          }),
          post: jest.fn().mockResolvedValue({
            data: {
              results: [
                {
                  url: 'https://example.com/file.txt',
                  markdown: { raw_markdown: 'This is plain text content' },
                  success: true,
                  status_code: 200,
                },
              ],
            },
          }),
        };
        // @ts-expect-error - accessing private property for testing
        (server as InstanceType<typeof Crawl4AIServer>).axiosClient = axiosClientMock;

        const result: ToolResult = await server.smartCrawl({
          url: 'https://example.com/file.txt',
        });

        expect(result.content[0].text).toContain('Smart crawl detected content type: text');
        expect(result.content[0].text).toContain('This is plain text content');
        expect(axiosClientMock.post).toHaveBeenCalledWith(
          '/crawl',
          expect.objectContaining({
            urls: ['https://example.com/file.txt'],
            strategy: 'text',
          }),
        );
      });
    });

    describe('Additional Method Tests', () => {
      it('should handle parse_sitemap', async () => {
        mockPost.mockResolvedValue({
          data: ['https://example.com/page1', 'https://example.com/page2', 'https://example.com/page3'],
        });

        // parseSitemap now uses the service's parseSitemap method
        // @ts-expect-error - accessing private property for testing
        const service = (server as InstanceType<typeof Crawl4AIServer>).service;
        service.parseSitemap = jest
          .fn()
          .mockResolvedValue(['https://example.com/page1', 'https://example.com/page2', 'https://example.com/page3']);

        const result: ToolResult = await server.parseSitemap({
          url: 'https://example.com/sitemap.xml',
        });

        expect(result.content[0].text).toContain('Parsed sitemap');
        expect(result.content[0].text).toContain('3 URLs found');
      });

      it('should handle parse_sitemap with filter', async () => {
        mockPost.mockResolvedValue({
          data: ['https://example.com/blog/post1', 'https://example.com/blog/post2'],
        });

        // @ts-expect-error - accessing private property for testing
        const service = (server as InstanceType<typeof Crawl4AIServer>).service;
        service.parseSitemap = jest
          .fn()
          .mockResolvedValue(['https://example.com/blog/post1', 'https://example.com/blog/post2']);

        const result: ToolResult = await server.parseSitemap({
          url: 'https://example.com/sitemap.xml',
          filter_pattern: '.*blog.*',
        });

        expect(result.content[0].text).toContain('2 URLs found');
      });

      it('should handle list_sessions', async () => {
        const result: ToolResult = await server.listSessions();

        expect(result.content[0].text).toContain('No active sessions');
      });

      it('should handle create_session', async () => {
        const result: ToolResult = await server.createSession({
          session_id: 'test-session',
        });

        expect(result.content[0].text).toContain('Session created successfully');
        expect(result.content[0].text).toContain('test-session');
      });

      it('should handle create_session with initial_url', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [{ success: true }],
        });

        const result: ToolResult = await server.createSession({
          session_id: 'test-session-2',
          initial_url: 'https://example.com',
          browser_type: 'firefox',
        });

        expect(result.content[0].text).toContain('Session created successfully');
        expect(result.content[0].text).toContain('firefox');
        expect(result.content[0].text).toContain('Pre-warmed with: https://example.com');
      });

      it('should handle clear_session', async () => {
        // First create a session
        await server.createSession({
          session_id: 'test-to-clear',
        });

        const result: ToolResult = await server.clearSession({
          session_id: 'test-to-clear',
        });

        expect(result.content[0].text).toContain('Session cleared successfully: test-to-clear');
      });

      it('should handle crawl_recursive', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Content' },
              links: { internal: [], external: [] },
              success: true,
              status_code: 200,
            },
          ],
        });

        const result: ToolResult = await server.crawlRecursive({
          url: 'https://example.com',
        });

        expect(result.content[0].text).toContain('Recursive crawl completed');
      });

      it('should handle clearSession for non-existent session', async () => {
        const result: ToolResult = await server.clearSession({
          session_id: 'non-existent',
        });

        expect(result.content[0].text).toContain('Session not found: non-existent');
      });

      it('should handle parse_sitemap error', async () => {
        // @ts-expect-error - accessing private property for testing
        const service = (server as InstanceType<typeof Crawl4AIServer>).service;
        service.parseSitemap = jest.fn().mockRejectedValue(new Error('Network error'));

        await expect(
          server.parseSitemap({
            url: 'https://example.com/sitemap.xml',
          }),
        ).rejects.toThrow('Failed to parse sitemap');
      });

      it('should handle crawl with error result', async () => {
        mockCrawl.mockResolvedValue({
          success: false,
          results: [],
        });

        await expect(
          server.crawl({
            url: 'https://example.com',
          }),
        ).rejects.toThrow('Invalid response from server');
      });

      it('should handle crawl with metadata and links', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'Content' },
              metadata: { title: 'Test Page', description: 'Test' },
              links: { internal: ['/page1'], external: ['https://external.com'] },
              js_execution_result: { results: [42, 'test'] },
              success: true,
              status_code: 200,
            },
          ],
        });

        const result: ToolResult = await server.crawl({
          url: 'https://example.com',
        });

        expect(result.content.length).toBeGreaterThan(1);
        expect(result.content.some((c) => c.text?.includes('Metadata'))).toBe(true);
        expect(result.content.some((c) => c.text?.includes('Links'))).toBe(true);
        expect(result.content.some((c) => c.text?.includes('JavaScript Execution Results'))).toBe(true);
      });

      it('should handle executeJS with no scripts', async () => {
        await expect(
          server.executeJS({
            url: 'https://example.com',
            scripts: null,
          }),
        ).rejects.toThrow('scripts is required');
      });

      it('should handle executeJS with array of scripts', async () => {
        mockExecuteJS.mockResolvedValue({
          content: [{ type: 'text', text: 'JS executed' }],
        });

        const result: ToolResult = await server.executeJS({
          url: 'https://example.com',
          scripts: ['return 1', 'return 2'],
        });

        expect(result.content[0].text).toContain('JavaScript executed on:');
      });

      it('should handle batchCrawl with cache bypass', async () => {
        mockPost.mockResolvedValue({
          data: {
            results: [{ success: true }, { success: false }],
          },
        });

        const result: ToolResult = await server.batchCrawl({
          urls: ['https://example.com/1', 'https://example.com/2'],
          bypass_cache: true,
          remove_images: true,
        });

        expect(result.content[0].text).toContain('Batch crawl completed');
        expect(mockPost).toHaveBeenCalledWith(
          '/crawl',
          expect.objectContaining({
            crawler_config: expect.objectContaining({
              cache_mode: 'BYPASS',
              exclude_tags: ['img', 'picture', 'svg'],
            }),
          }),
        );
      });

      it('should handle smart_crawl with follow_links', async () => {
        const axiosClientMock = {
          head: jest.fn().mockResolvedValue({
            headers: { 'content-type': 'application/xml' },
          }),
          post: jest.fn().mockResolvedValue({
            data: {
              results: [
                {
                  url: 'https://example.com/sitemap.xml',
                  markdown: { raw_markdown: '<url><loc>https://example.com/page1</loc></url>' },
                  success: true,
                  status_code: 200,
                },
              ],
            },
          }),
        };
        // @ts-expect-error - accessing private property for testing
        (server as InstanceType<typeof Crawl4AIServer>).axiosClient = axiosClientMock;

        const result: ToolResult = await server.smartCrawl({
          url: 'https://example.com/sitemap.xml',
          follow_links: true,
        });

        expect(result.content[0].text).toContain('Smart crawl detected content type: sitemap');
      });

      it('should handle smart_crawl with server error fallback', async () => {
        const axiosClientMock = {
          head: jest.fn().mockRejectedValue({ response: { status: 500 } }),
          post: jest
            .fn()
            .mockRejectedValueOnce({ response: { status: 500 } })
            .mockResolvedValueOnce({
              data: {
                results: [
                  {
                    url: 'https://example.com',
                    markdown: { raw_markdown: 'Fallback content' },
                    success: true,
                    status_code: 200,
                  },
                ],
              },
            }),
        };
        // @ts-expect-error - accessing private property for testing
        (server as InstanceType<typeof Crawl4AIServer>).axiosClient = axiosClientMock;

        const result: ToolResult = await server.smartCrawl({
          url: 'https://example.com',
        });

        expect(result.content[0].text).toContain('Fallback content');
      });

      it('should handle extractLinks with no links', async () => {
        mockPost.mockResolvedValue({
          data: {
            results: [
              {
                markdown: 'Content without links',
              },
            ],
          },
        });

        const result: ToolResult = await server.extractLinks({
          url: 'https://example.com',
          categorize: false,
        });

        expect(result.content[0].text).toContain('All links from');
      });

      it('should handle extractLinks with manually extracted links', async () => {
        mockPost.mockResolvedValue({
          data: {
            results: [
              {
                markdown: 'Check out <a href="/page1">Page 1</a>',
              },
            ],
          },
        });

        const result: ToolResult = await server.extractLinks({
          url: 'https://example.com',
        });

        expect(result.content[0].text).toContain('All links from');
      });

      it('should handle MCP request handler for all tools', async () => {
        // Request handler should be available from beforeEach
        expect(requestHandler).toBeDefined();

        // Test various tools through the request handler
        const tools = [
          { name: 'get_markdown', args: { url: 'https://example.com' } },
          { name: 'capture_screenshot', args: { url: 'https://example.com' } },
          { name: 'generate_pdf', args: { url: 'https://example.com' } },
          { name: 'execute_js', args: { url: 'https://example.com', scripts: 'return 1' } },
          { name: 'batch_crawl', args: { urls: ['https://example.com'] } },
          { name: 'smart_crawl', args: { url: 'https://example.com' } },
          { name: 'get_html', args: { url: 'https://example.com' } },
          { name: 'extract_links', args: { url: 'https://example.com' } },
          { name: 'crawl_recursive', args: { url: 'https://example.com' } },
          { name: 'parse_sitemap', args: { url: 'https://example.com/sitemap.xml' } },
          { name: 'crawl', args: { url: 'https://example.com' } },
          { name: 'create_session', args: {} },
          { name: 'clear_session', args: { session_id: 'test' } },
          { name: 'list_sessions', args: {} },
          { name: 'extract_with_llm', args: { url: 'https://example.com', prompt: 'test' } },
        ];

        // Mock all service methods to return success
        mockGetMarkdown.mockResolvedValue({ content: [{ type: 'text', text: 'markdown' }] });
        mockCaptureScreenshot.mockResolvedValue({ content: [{ type: 'text', text: 'screenshot' }] });
        mockGeneratePDF.mockResolvedValue({ content: [{ type: 'text', text: 'pdf' }] });
        mockExecuteJS.mockResolvedValue({ content: [{ type: 'text', text: 'js' }] });
        mockBatchCrawl.mockResolvedValue({ content: [{ type: 'text', text: 'batch' }] });
        mockGetHTML.mockResolvedValue({ content: [{ type: 'text', text: 'html' }] });
        mockExtractWithLLM.mockResolvedValue({ content: [{ type: 'text', text: 'llm' }] });
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              markdown: { raw_markdown: 'content' },
              success: true,
              status_code: 200,
            },
          ],
        });
        mockPost.mockResolvedValue({
          data: {
            results: [
              {
                links: { internal: [], external: [] },
              },
            ],
          },
        });

        // @ts-expect-error - accessing private property for testing
        const service = (server as InstanceType<typeof Crawl4AIServer>).service;
        service.parseSitemap = jest.fn().mockResolvedValue(['https://example.com/page1']);

        // Test each tool
        for (const tool of tools) {
          const result = await requestHandler({
            method: 'tools/call',
            params: {
              name: tool.name,
              arguments: tool.args,
            },
          });
          expect(result).toBeDefined();
          expect(result.content).toBeDefined();
        }

        // Test unknown tool
        const unknownResult = await requestHandler({
          method: 'tools/call',
          params: {
            name: 'unknown_tool',
            arguments: {},
          },
        });
        expect(unknownResult.content[0].text).toContain('Error: Unknown tool');

        // Test non-tools/call method
        const otherResult = await requestHandler({
          method: 'other/method',
          params: {},
        });
        expect(otherResult).toBeUndefined();
      });

      it('should handle MCP request handler validation errors', async () => {
        expect(requestHandler).toBeDefined();

        // Test validation errors for various tools
        const invalidRequests = [
          { name: 'get_markdown', args: {} }, // missing url
          { name: 'capture_screenshot', args: {} }, // missing url
          { name: 'generate_pdf', args: {} }, // missing url
          { name: 'execute_js', args: { url: 'https://example.com' } }, // missing scripts
          { name: 'batch_crawl', args: {} }, // missing urls
          { name: 'smart_crawl', args: {} }, // missing url
          { name: 'get_html', args: {} }, // missing url
          { name: 'extract_links', args: {} }, // missing url
          { name: 'crawl_recursive', args: {} }, // missing url
          { name: 'parse_sitemap', args: {} }, // missing url
          { name: 'crawl', args: {} }, // missing url
          { name: 'clear_session', args: {} }, // missing session_id
          { name: 'extract_with_llm', args: { url: 'https://example.com' } }, // missing prompt
        ];

        for (const req of invalidRequests) {
          const result = await requestHandler({
            method: 'tools/call',
            params: {
              name: req.name,
              arguments: req.args,
            },
          });
          expect(result.content[0].text).toContain(`Error: Invalid parameters for ${req.name}`);
        }
      });

      it('should handle crawl with all output types', async () => {
        mockCrawl.mockResolvedValue({
          success: true,
          results: [
            {
              url: 'https://example.com',
              extracted_content: { data: 'extracted' },
              screenshot: 'base64screenshot',
              pdf: 'base64pdf',
              success: true,
              status_code: 200,
            },
          ],
        });

        const result: ToolResult = await server.crawl({
          url: 'https://example.com',
          screenshot: true,
          pdf: true,
        });

        expect(result.content.some((c) => c.type === 'text')).toBe(true);
        expect(result.content.some((c) => c.type === 'image')).toBe(true);
        expect(result.content.some((c) => c.type === 'resource' && c.resource?.mimeType === 'application/pdf')).toBe(
          true,
        );
      });
    });

    describe('MCP Protocol Handler Tests', () => {
      it('should handle tools/list request', async () => {
        // Find the tools/list handler
        const toolsListHandler = mockSetRequestHandler.mock.calls.find((call) => call[0].method === 'tools/list')?.[1];

        expect(toolsListHandler).toBeDefined();

        const result = await toolsListHandler({ method: 'tools/list', params: {} });
        expect(result).toBeDefined();
        expect(result.tools).toBeDefined();
        expect(result.tools.length).toBe(15); // Should have 15 tools
      });

      it('should handle get_markdown query functionality', async () => {
        mockGetMarkdown.mockResolvedValue({
          content: [{ type: 'text', text: 'Page content about products' }],
        });

        const result: ToolResult = await server.getMarkdown({
          url: 'https://example.com',
          query: 'What products are listed?',
        });

        expect(result.content[0].text).toContain('Query: What products are listed?');
        expect(result.content[0].text).toContain('Page content about products');
      });
    });
  });
});
