import { jest } from '@jest/globals';
import { Crawl4AIService } from '../crawl4ai-service.js';

// Mock axios using jest.unstable_mockModule
const mockAxiosCreate = jest.fn();
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

jest.unstable_mockModule('axios', () => ({
  default: {
    create: mockAxiosCreate,
  },
}));

describe('Crawl4AI Service - Network Failures', () => {
  let service: Crawl4AIService;

  interface ErrorWithCode extends Error {
    code?: string;
    response?: {
      status: number;
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    mockAxiosCreate.mockReturnValue(mockAxiosInstance);

    // Dynamically import after mocking
    const { Crawl4AIService: ServiceClass } = await import('../crawl4ai-service.js');
    service = new ServiceClass('http://localhost:11235', 'test-api-key');
  });

  describe('Network Timeouts', () => {
    it('should handle request timeout', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded') as ErrorWithCode;
      timeoutError.code = 'ECONNABORTED';
      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('Request timed out');
    });

    it('should handle response timeout', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded') as ErrorWithCode;
      timeoutError.code = 'ETIMEDOUT';
      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      await expect(service.getHTML({ url: 'https://example.com' })).rejects.toThrow('timeout');
    });
  });

  describe('HTTP Error Responses', () => {
    it('should handle 401 Unauthorized', async () => {
      const error = {
        response: {
          status: 401,
          data: { error: 'Invalid API key' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.crawl({ urls: ['https://example.com'] })).rejects.toThrow('Request failed with status 401');
    });

    it('should handle 403 Forbidden', async () => {
      const error = {
        response: {
          status: 403,
          data: { error: 'Access denied' },
        },
      };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.captureScreenshot({ url: 'https://example.com' })).rejects.toThrow(
        'Request failed with status 403',
      );
    });

    it('should handle 404 Not Found', async () => {
      const error = {
        response: {
          status: 404,
          data: { error: 'Endpoint not found' },
        },
      };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.generatePDF({ url: 'https://example.com' })).rejects.toThrow(
        'Request failed with status 404',
      );
    });

    it('should handle 429 Too Many Requests', async () => {
      const error = {
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' },
          headers: {
            'retry-after': '60',
          },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.executeJS({ url: 'https://example.com', scripts: ['return 1;'] })).rejects.toThrow(
        'Request failed with status 429',
      );
    });

    it('should handle 500 Internal Server Error', async () => {
      const error = {
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.crawl({ urls: ['https://example.com'] })).rejects.toThrow('Request failed with status 500');
    });

    it('should handle 502 Bad Gateway', async () => {
      const error = {
        response: {
          status: 502,
          data: 'Bad Gateway',
        },
      };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow(
        'Request failed with status 502',
      );
    });

    it('should handle 503 Service Unavailable', async () => {
      const error = {
        response: {
          status: 503,
          data: { error: 'Service temporarily unavailable' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.extractWithLLM({ url: 'https://example.com', query: 'test' })).rejects.toThrow(
        'Request failed with status 503',
      );
    });

    it('should handle 504 Gateway Timeout', async () => {
      const error = {
        response: {
          status: 504,
          data: { error: 'Gateway timeout' },
        },
      };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.getHTML({ url: 'https://example.com' })).rejects.toThrow('Request failed with status 504');
    });
  });

  describe('Network Connection Failures', () => {
    it('should handle DNS resolution failure', async () => {
      const error = new Error('getaddrinfo ENOTFOUND invalid.domain') as ErrorWithCode;
      error.code = 'ENOTFOUND';
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.getMarkdown({ url: 'https://invalid.domain' })).rejects.toThrow('ENOTFOUND');
    });

    it('should handle connection refused', async () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:11235') as ErrorWithCode;
      error.code = 'ECONNREFUSED';
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.crawl({ urls: ['https://example.com'] })).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle connection reset', async () => {
      const error = new Error('socket hang up') as ErrorWithCode;
      error.code = 'ECONNRESET';
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.captureScreenshot({ url: 'https://example.com' })).rejects.toThrow('ECONNRESET');
    });

    it('should handle network unreachable', async () => {
      const error = new Error('connect ENETUNREACH') as ErrorWithCode;
      error.code = 'ENETUNREACH';
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.executeJS({ url: 'https://example.com', scripts: ['return 1;'] })).rejects.toThrow(
        'ENETUNREACH',
      );
    });
  });

  describe('Response Parsing Failures', () => {
    it('should handle invalid JSON response', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: '<html>Not JSON</html>',
        headers: { 'content-type': 'text/html' },
      });

      // This depends on how the service handles non-JSON responses
      // Adjust based on actual implementation
      const result = await service.getHTML({ url: 'https://example.com' });
      expect(result).toBeDefined();
    });

    it('should handle empty response', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: null,
      });

      await expect(service.crawl({ urls: ['https://example.com'] })).rejects.toThrow();
    });

    it('should handle malformed response structure', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { unexpected: 'structure' },
      });

      // The service might throw or return a default
      const result = await service.crawl({ urls: ['https://example.com'] });
      expect(result.results).toBeUndefined();
    });
  });

  describe('Request Configuration Errors', () => {
    it('should handle invalid URL format', async () => {
      await expect(service.getMarkdown({ url: 'not-a-valid-url' })).rejects.toThrow();
    });

    it('should handle missing required parameters', async () => {
      await expect(service.crawl({ urls: [] })).rejects.toThrow();
    });

    it('should handle oversized request payload', async () => {
      const error = new Error('Request Entity Too Large') as ErrorWithCode;
      error.response = { status: 413 };
      mockAxiosInstance.post.mockRejectedValue(error);

      const hugeScript = 'x'.repeat(10 * 1024 * 1024); // 10MB
      await expect(service.executeJS({ url: 'https://example.com', scripts: [hugeScript] })).rejects.toThrow('413');
    });
  });

  describe('Partial Response Handling', () => {
    it('should handle successful response with partial data', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          results: [
            { success: true, url: 'https://example.com', markdown: 'Content' },
            { success: false, url: 'https://example.com/page2', error: 'Failed' },
          ],
        },
      });

      const result = await service.crawl({ urls: ['https://example.com', 'https://example.com/page2'] });
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });

    it('should handle response with missing optional fields', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          url: 'https://example.com',
          // Missing markdown field
        },
      });

      const result = await service.getMarkdown({ url: 'https://example.com' });
      expect(result.url).toBe('https://example.com');
      expect(result.markdown).toBeUndefined();
    });
  });
});
