/* eslint-env jest */
import { jest } from '@jest/globals';

// Set up environment variables before any imports
process.env.CRAWL4AI_BASE_URL = 'http://test.example.com';
process.env.CRAWL4AI_API_KEY = 'test-api-key';

// Mock the Crawl4AIService before any imports
const mockGetMarkdown = jest.fn();
const mockCaptureScreenshot = jest.fn();
const mockGeneratePDF = jest.fn();
const mockExecuteJS = jest.fn();
const mockGetHTML = jest.fn();
const mockBatchCrawl = jest.fn();
const mockExtractWithLLM = jest.fn();

const MockCrawl4AIService = jest.fn().mockImplementation(() => ({
  getMarkdown: mockGetMarkdown,
  captureScreenshot: mockCaptureScreenshot,
  generatePDF: mockGeneratePDF,
  executeJS: mockExecuteJS,
  getHTML: mockGetHTML,
  batchCrawl: mockBatchCrawl,
  extractWithLLM: mockExtractWithLLM,
}));

jest.mock('../crawl4ai-service.js', () => ({
  Crawl4AIService: MockCrawl4AIService,
}));

// Mock MCP SDK
const mockSetRequestHandler = jest.fn();
const mockTool = jest.fn();
const mockConnect = jest.fn();

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: mockSetRequestHandler,
    tool: mockTool,
    connect: mockConnect,
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

// Mock axios
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockHead = jest.fn();

jest.mock('axios', () => ({
  default: {
    create: jest.fn(() => ({
      post: mockPost,
      get: mockGet,
      head: mockHead,
    })),
    get: mockGet, // Also expose get directly on default for axios.get() calls
  },
}));

// Now import the server after mocks are set up
import { Crawl4AIServer } from '../index.js';
import type {
  MarkdownEndpointResponse,
  ScreenshotEndpointResponse,
  PDFEndpointResponse,
  HTMLEndpointResponse,
  CrawlEndpointResponse,
} from '../types.js';

describe('Crawl4AIServer Tool Handlers', () => {
  let server: Crawl4AIServer;
  let mockServiceInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all mock functions
    mockGetMarkdown.mockReset();
    mockCaptureScreenshot.mockReset();
    mockGeneratePDF.mockReset();
    mockExecuteJS.mockReset();
    mockGetHTML.mockReset();
    mockBatchCrawl.mockReset();
    mockExtractWithLLM.mockReset();
    mockPost.mockReset();
    mockGet.mockReset();
    mockHead.mockReset();
    
    // Create server instance - the mock will be used automatically
    server = new Crawl4AIServer();
    
    // Get the mocked service instance
    mockServiceInstance = MockCrawl4AIService.mock.instances[0];
  });

  // Add a simple test to verify mocking works
  it('should use the mocked service', () => {
    expect(MockCrawl4AIService).toHaveBeenCalledTimes(1);
    expect(mockServiceInstance).toBeDefined();
    expect(mockServiceInstance.getMarkdown).toBe(mockGetMarkdown);
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

        const result = await (server as any).getMarkdown({
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

        const result = await (server as any).getMarkdown({
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

        const result = await (server as any).captureScreenshot({
          url: 'https://example.com',
        });

        expect(result.content).toHaveLength(2);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('Screenshot captured successfully');
        expect(result.content[1].type).toBe('image');
        expect(result.content[1].data).toBe('base64-encoded-screenshot-data');
      });
    });

    describe('generate_pdf', () => {
      it('should handle successful PDF generation', async () => {
        const mockResponse: PDFEndpointResponse = {
          success: true,
          pdf: 'base64-encoded-pdf-data',
        };

        mockGeneratePDF.mockResolvedValue(mockResponse);

        const result = await (server as any).generatePDF({
          url: 'https://example.com',
        });

        expect(result.content).toHaveLength(2);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('PDF generated successfully');
        expect(result.content[0].text).toContain('Size: 48.0 bytes');
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

        mockExecuteJS.mockResolvedValue(mockResponse as any);

        const result = await (server as any).executeJS({
          url: 'https://example.com',
          scripts: ['return document.title', 'return document.links.length'],
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('JavaScript Execution Results');
        expect(result.content[0].text).toContain('Title: Example');
        expect(result.content[0].text).toContain('Link count: 5');
      });

      it('should handle JS execution without results', async () => {
        const mockResponse = {
          markdown: 'Page content',
          js_execution_result: null,
        };

        mockExecuteJS.mockResolvedValue(mockResponse as any);

        const result = await (server as any).executeJS({
          url: 'https://example.com',
          scripts: 'console.log("test")',
        });

        expect(result.content[0].text).toContain('JavaScript executed but no results returned');
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

        const result = await (server as any).getHTML({
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

        mockBatchCrawl.mockResolvedValue(mockResponse as any);

        const result = await (server as any).batchCrawl({
          urls: ['https://example1.com', 'https://example2.com'],
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toContain('Successfully crawled 2 URLs');
        expect(result.content[0].text).toContain('https://example1.com');
        expect(result.content[0].text).toContain('Content 1');
      });

      it('should handle batch crawl with remove_images', async () => {
        mockBatchCrawl.mockResolvedValue({ results: [], success: true } as any);

        await (server as any).batchCrawl({
          urls: ['https://example.com'],
          remove_images: true,
        });

        expect(mockBatchCrawl).toHaveBeenCalledWith({
          urls: ['https://example.com'],
          crawler_config: {
            exclude_tags: ['img', 'picture', 'svg'],
          },
        });
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

        mockPost.mockResolvedValue({ data: mockResponse });

        const result = await (server as any).crawl({
          url: 'https://example.com',
          screenshot: true,
          pdf: true,
          js_code: 'return document.title',
          session_id: 'test-session',
        });

        expect(result.content).toHaveLength(9); // All content types
        // Check text content
        const textContent = result.content.find((c: any) => c.type === 'text' && c.text.includes('# Example'));
        expect(textContent).toBeDefined();
        // Check screenshot
        const screenshotContent = result.content.find((c: any) => c.type === 'image');
        expect(screenshotContent?.data).toBe('screenshot-data');
      });
    });

    describe('Session management', () => {
      it('should create a session successfully', async () => {
        const result = await (server as any).createSession({
          initial_url: 'https://example.com',
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toMatch(/Session created successfully/);
        expect(result.content[0].text).toMatch(/Session ID: session-/);
      });

      it('should clear a session successfully', async () => {
        // First create a session
        const createResult = await (server as any).createSession({});
        const sessionIdMatch = createResult.content[0].text.match(/Session ID: (session-[^\n]+)/);
        const sessionId = sessionIdMatch?.[1] || 'test-session';

        const result = await (server as any).clearSession({
          session_id: sessionId,
        });

        expect(result.content[0].text).toBe(`Session ${sessionId} cleared successfully`);
      });

      it('should list sessions', async () => {
        // Create a couple of sessions
        await (server as any).createSession({ initial_url: 'https://example1.com' });
        await (server as any).createSession({ initial_url: 'https://example2.com' });

        const result = await (server as any).listSessions();

        expect(result.content[0].text).toContain('Active Sessions (2)');
        expect(result.content[0].text).toContain('https://example1.com');
        expect(result.content[0].text).toContain('https://example2.com');
      });
    });

    describe('extract_with_llm', () => {
      it('should handle successful LLM extraction', async () => {
        mockExtractWithLLM.mockResolvedValue({
          answer: 'The main topic is JavaScript testing.',
        });

        const result = await (server as any).extractWithLLM({
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
                  external: [
                    { href: 'https://external.com', text: 'External' },
                  ],
                },
              },
            ],
          },
        });

        const result = await (server as any).extractLinks({
          url: 'https://example.com',
          categorize: true,
        });

        expect(result.content[0].text).toContain('Internal Links (2)');
        expect(result.content[0].text).toContain('/page1 - Page 1');
        expect(result.content[0].text).toContain('External Links (1)');
      });
    });

    describe('crawl_recursive', () => {
      it('should crawl recursively with depth limit', async () => {
        mockPost
          .mockResolvedValueOnce({
            data: {
              results: [
                {
                  url: 'https://example.com',
                  links: {
                    internal: [
                      { href: 'https://example.com/page1', text: 'Page 1' },
                    ],
                  },
                  markdown: { raw_markdown: 'Home page' },
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
                },
              ],
            },
          });

        const result = await (server as any).crawlRecursive({
          url: 'https://example.com',
          max_depth: 2,
        });

        expect(result.content[0].text).toContain('Crawled 2 pages recursively');
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

        const result = await (server as any).parseSitemap({
          url: 'https://example.com/sitemap.xml',
        });

        expect(result.content[0].text).toContain('Found 3 URLs in sitemap');
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

        const result = await (server as any).smartCrawl({
          url: 'https://example.com',
        });

        expect(result.content[0].text).toContain('Smart Crawl Results');
        expect(result.content[0].text).toContain('Content Type: text/html');
      });

      it('should handle smart crawl for PDF content', async () => {
        mockHead.mockResolvedValue({
          headers: { 'content-type': 'application/pdf' },
        });
        
        mockGeneratePDF.mockResolvedValue({
          success: true,
          pdf: 'pdf-data',
        });

        const result = await (server as any).smartCrawl({
          url: 'https://example.com/doc.pdf',
        });

        expect(result.content[0].text).toContain('Content Type: application/pdf');
        expect(result.content[0].text).toContain('This appears to be a PDF document');
      });
    });
  });

  describe('Tool Handler Error Cases', () => {
    describe('Service errors', () => {
      it('should handle service error for get_markdown', async () => {
        mockGetMarkdown.mockRejectedValue(new Error('Network error'));

        await expect((server as any).getMarkdown({ url: 'https://example.com' }))
          .rejects.toThrow('Failed to get markdown: Network error');
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

        await expect((server as any).captureScreenshot({ url: 'https://example.com' }))
          .rejects.toThrow('Failed to capture screenshot: Invalid API key');
      });

      it('should handle missing screenshot data', async () => {
        mockCaptureScreenshot.mockResolvedValue({
          success: false,
          screenshot: '',
        });

        await expect((server as any).captureScreenshot({ url: 'https://example.com' }))
          .rejects.toThrow('Screenshot capture failed - no screenshot data in response');
      });

      it('should handle missing PDF data', async () => {
        mockGeneratePDF.mockResolvedValue({
          success: true,
          pdf: '',
        });

        await expect((server as any).generatePDF({ url: 'https://example.com' }))
          .rejects.toThrow('PDF generation failed - no PDF data in response');
      });
    });

    describe('Validation errors', () => {
      it('should handle missing scripts for execute_js', async () => {
        await expect((server as any).executeJS({ url: 'https://example.com', scripts: null as any }))
          .rejects.toThrow('scripts is required');
      });

      it('should handle empty crawl options', async () => {
        await expect((server as any).crawl(null as any))
          .rejects.toThrow('crawl requires options object with at least a url parameter');
      });

      it('should handle crawl_recursive errors', async () => {
        mockPost.mockRejectedValue(new Error('API error'));

        await expect((server as any).crawlRecursive({ url: 'https://example.com' }))
          .rejects.toThrow('Failed to crawl recursively: API error');
      });

      it('should handle parse_sitemap errors', async () => {
        mockGet.mockRejectedValue(new Error('Failed to fetch sitemap'));

        await expect((server as any).parseSitemap({ url: 'https://example.com/sitemap.xml' }))
          .rejects.toThrow('Failed to parse sitemap: Failed to fetch sitemap');
      });
    });

    describe('Edge cases', () => {
      it('should handle batch crawl with no results', async () => {
        mockBatchCrawl.mockResolvedValue({
          results: [],
          success: true,
        } as any);

        const result = await (server as any).batchCrawl({
          urls: ['https://example.com'],
        });

        expect(result.content[0].text).toContain('Successfully crawled 0 URLs');
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

        const result = await (server as any).extractLinks({
          url: 'https://example.com',
        });

        expect(result.content[0].text).toContain('All Links (0)');
      });

      it('should handle session not found for clear_session', async () => {
        const result = await (server as any).clearSession({
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

        const result = await (server as any).smartCrawl({
          url: 'https://example.com',
        });

        expect(result.content[0].text).toContain('Smart Crawl Results');
      });
    });
  });
});