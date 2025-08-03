import { jest } from '@jest/globals';

// Mock all dependencies before imports
const mockGetMarkdown = jest.fn();
const mockCaptureScreenshot = jest.fn();
const mockGeneratePDF = jest.fn();
const mockExecuteJS = jest.fn();
const mockGetHTML = jest.fn();
const mockBatchCrawl = jest.fn();
const mockExtractWithLLM = jest.fn();
const mockCrawl = jest.fn();
const mockParseSitemap = jest.fn();

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
    parseSitemap: mockParseSitemap,
  })),
}));

// Mock axios
const mockPost = jest.fn();
const mockAxiosCreate = jest.fn(() => ({
  post: mockPost,
}));

jest.unstable_mockModule('axios', () => ({
  default: {
    create: mockAxiosCreate,
  },
}));

// Set environment variables
process.env.CRAWL4AI_BASE_URL = 'http://test.example.com';
process.env.CRAWL4AI_API_KEY = 'test-api-key';

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

// Mock the types module that exports the schemas
const CallToolRequestSchema = { method: 'tools/call' };
const ListToolsRequestSchema = { method: 'tools/list' };

jest.unstable_mockModule('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema,
  ListToolsRequestSchema,
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

// Now import the server after mocks are set up
const { Crawl4AIServer } = await import('../index.js');

type InstanceType<T> = T extends new (...args: unknown[]) => infer R ? R : never;

interface RequestHandlerParams {
  method: string;
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface RequestHandlerResult {
  content: Array<{
    text: string;
  }>;
}

describe('MCP Request Handler Direct Testing', () => {
  let server: InstanceType<typeof Crawl4AIServer>;
  let requestHandler: (params: RequestHandlerParams) => Promise<RequestHandlerResult>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set up mock responses
    mockGetMarkdown.mockResolvedValue({ success: true, content: 'markdown content' });
    mockCaptureScreenshot.mockResolvedValue({ success: true, screenshot: 'base64image' });
    mockGeneratePDF.mockResolvedValue({ success: true, pdf: 'base64pdf' });
    mockExecuteJS.mockResolvedValue({ js_execution_result: { results: [42] } });
    mockGetHTML.mockResolvedValue({ success: true, html: '<html></html>' });
    mockExtractWithLLM.mockResolvedValue({ answer: 'extracted answer' });
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
    mockParseSitemap.mockResolvedValue(['https://example.com/page1']);
    mockPost.mockResolvedValue({
      data: {
        results: [
          {
            links: { internal: [], external: [] },
            success: true,
          },
        ],
      },
    });

    // Create server
    server = new Crawl4AIServer();
    await server.start();

    // Get the request handler for CallToolRequestSchema
    const handlerCalls = mockSetRequestHandler.mock.calls;

    // Find the handler for CallToolRequestSchema (tools/call)
    for (const call of handlerCalls) {
      const [schema, handler] = call;
      if (schema && schema.method === 'tools/call') {
        requestHandler = handler;
        break;
      }
    }
  });

  describe('Tool Handler Coverage', () => {
    it('should handle all valid tool requests', async () => {
      expect(requestHandler).toBeDefined();

      const validRequests = [
        { name: 'get_markdown', arguments: { url: 'https://example.com' } },
        { name: 'capture_screenshot', arguments: { url: 'https://example.com' } },
        { name: 'generate_pdf', arguments: { url: 'https://example.com' } },
        { name: 'execute_js', arguments: { url: 'https://example.com', scripts: 'return 1' } },
        { name: 'batch_crawl', arguments: { urls: ['https://example.com'] } },
        { name: 'smart_crawl', arguments: { url: 'https://example.com' } },
        { name: 'get_html', arguments: { url: 'https://example.com' } },
        { name: 'extract_links', arguments: { url: 'https://example.com' } },
        { name: 'crawl_recursive', arguments: { url: 'https://example.com' } },
        { name: 'parse_sitemap', arguments: { url: 'https://example.com/sitemap.xml' } },
        { name: 'crawl', arguments: { url: 'https://example.com' } },
        { name: 'create_session', arguments: {} },
        { name: 'clear_session', arguments: { session_id: 'test' } },
        { name: 'list_sessions', arguments: {} },
        { name: 'extract_with_llm', arguments: { url: 'https://example.com', prompt: 'test' } },
      ];

      for (const req of validRequests) {
        const result = await requestHandler({
          method: 'tools/call',
          params: req,
        });
        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
      }
    });

    it('should handle all validation error cases', async () => {
      const invalidRequests = [
        { name: 'get_markdown', arguments: {}, expectedError: 'Invalid parameters for get_markdown' },
        { name: 'capture_screenshot', arguments: {}, expectedError: 'Invalid parameters for capture_screenshot' },
        { name: 'generate_pdf', arguments: {}, expectedError: 'Invalid parameters for generate_pdf' },
        {
          name: 'execute_js',
          arguments: { url: 'https://example.com' },
          expectedError: 'Invalid parameters for execute_js',
        },
        { name: 'batch_crawl', arguments: {}, expectedError: 'Invalid parameters for batch_crawl' },
        { name: 'smart_crawl', arguments: {}, expectedError: 'Invalid parameters for smart_crawl' },
        { name: 'get_html', arguments: {}, expectedError: 'Invalid parameters for get_html' },
        { name: 'extract_links', arguments: {}, expectedError: 'Invalid parameters for extract_links' },
        { name: 'crawl_recursive', arguments: {}, expectedError: 'Invalid parameters for crawl_recursive' },
        { name: 'parse_sitemap', arguments: {}, expectedError: 'Invalid parameters for parse_sitemap' },
        { name: 'crawl', arguments: {}, expectedError: 'Invalid parameters for crawl' },
        { name: 'clear_session', arguments: {}, expectedError: 'Invalid parameters for clear_session' },
        {
          name: 'extract_with_llm',
          arguments: { url: 'https://example.com' },
          expectedError: 'Invalid parameters for extract_with_llm',
        },
      ];

      for (const req of invalidRequests) {
        const result = await requestHandler({
          method: 'tools/call',
          params: req,
        });
        expect(result.content[0].text).toContain(req.expectedError);
      }
    });

    it('should handle unknown tool', async () => {
      const result = await requestHandler({
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      });
      expect(result.content[0].text).toContain('Error: Unknown tool: unknown_tool');
    });

    it('should handle non-ZodError exceptions', async () => {
      // Make the service method throw a non-Zod error
      mockGetMarkdown.mockRejectedValue(new Error('Service error'));

      const result = await requestHandler({
        method: 'tools/call',
        params: {
          name: 'get_markdown',
          arguments: { url: 'https://example.com' },
        },
      });

      expect(result.content[0].text).toContain('Error: Failed to get markdown: Service error');
    });

    it('should handle create_session with initial_url', async () => {
      const result = await requestHandler({
        method: 'tools/call',
        params: {
          name: 'create_session',
          arguments: {
            session_id: 'test-session',
            initial_url: 'https://example.com',
            browser_type: 'firefox',
          },
        },
      });

      expect(result.content[0].text).toContain('Session created successfully');
      expect(result.content[0].text).toContain('firefox');
    });

    it('should handle create_session with initial_url error', async () => {
      // Make crawl fail for initial_url
      mockPost.mockRejectedValue(new Error('Initial crawl failed'));

      const result = await requestHandler({
        method: 'tools/call',
        params: {
          name: 'create_session',
          arguments: {
            initial_url: 'https://example.com',
          },
        },
      });

      // Session should still be created even if initial crawl fails
      expect(result.content[0].text).toContain('Session created successfully');
    });

    it('should handle clear_session for non-existent session', async () => {
      const result = await requestHandler({
        method: 'tools/call',
        params: {
          name: 'clear_session',
          arguments: { session_id: 'non-existent' },
        },
      });

      expect(result.content[0].text).toContain('Session not found: non-existent');
    });

    it('should handle list_sessions with existing sessions', async () => {
      // First create a session
      await requestHandler({
        method: 'tools/call',
        params: {
          name: 'create_session',
          arguments: { session_id: 'test-session' },
        },
      });

      const result = await requestHandler({
        method: 'tools/call',
        params: {
          name: 'list_sessions',
          arguments: {},
        },
      });

      expect(result.content[0].text).toContain('Active sessions (1)');
      expect(result.content[0].text).toContain('test-session');
    });
  });
});
