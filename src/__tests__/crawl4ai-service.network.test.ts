import { jest } from '@jest/globals';

// Mock axios before importing the service
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
    create: jest.fn(() => mockAxiosInstance),
    isAxiosError: jest.fn((error) => error.isAxiosError === true),
    get: jest.fn(),
    head: jest.fn(),
  },
  isAxiosError: jest.fn((error) => error.isAxiosError === true),
}));

// Import after mocking
const { Crawl4AIService } = await import('../crawl4ai-service.js');

describe('Crawl4AI Service - Network Failures', () => {
  let service: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  interface ErrorWithCode extends Error {
    code?: string;
    response?: {
      status: number;
      data?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    };
    isAxiosError?: boolean;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new Crawl4AIService('http://localhost:11235', 'test-api-key');
  });

  describe('Network Timeouts', () => {
    it('should handle request timeout', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded') as ErrorWithCode;
      timeoutError.code = 'ECONNABORTED';
      timeoutError.isAxiosError = true;
      mockAxiosInstance.post.mockRejectedValue(timeoutError);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow('Request timed out');
    });

    it('should handle response timeout', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded') as ErrorWithCode;
      timeoutError.code = 'ETIMEDOUT';
      timeoutError.isAxiosError = true;
      mockAxiosInstance.post.mockRejectedValue(timeoutError);

      await expect(service.getHTML({ url: 'https://example.com' })).rejects.toThrow('Request timeout');
    });
  });

  describe('HTTP Error Responses', () => {
    it('should handle 401 Unauthorized', async () => {
      const error = {
        response: {
          status: 401,
          data: { error: 'Invalid API key' },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.crawl({ urls: ['https://example.com'] })).rejects.toThrow(
        'Request failed with status 401: Invalid API key',
      );
    });

    it('should handle 403 Forbidden', async () => {
      const error = {
        response: {
          status: 403,
          data: { error: 'Access denied' },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.captureScreenshot({ url: 'https://example.com' })).rejects.toThrow(
        'Request failed with status 403: Access denied',
      );
    });

    it('should handle 404 Not Found', async () => {
      const error = {
        response: {
          status: 404,
          data: { error: 'Endpoint not found' },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.generatePDF({ url: 'https://example.com' })).rejects.toThrow(
        'Request failed with status 404: Endpoint not found',
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
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.executeJS({ url: 'https://example.com', scripts: ['return 1;'] })).rejects.toThrow(
        'Request failed with status 429: Rate limit exceeded',
      );
    });

    it('should handle 500 Internal Server Error', async () => {
      const error = {
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.crawl({ urls: ['https://example.com'] })).rejects.toThrow(
        'Request failed with status 500: Internal server error',
      );
    });

    it('should handle 502 Bad Gateway', async () => {
      const error = {
        response: {
          status: 502,
          data: 'Bad Gateway',
        },
        isAxiosError: true,
        message: 'Request failed with status code 502',
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.getMarkdown({ url: 'https://example.com' })).rejects.toThrow(
        'Request failed with status 502: Request failed with status code 502',
      );
    });

    it('should handle 503 Service Unavailable', async () => {
      const error = {
        response: {
          status: 503,
          data: { error: 'Service temporarily unavailable' },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.extractWithLLM({ url: 'https://example.com', query: 'test' })).rejects.toThrow(
        'Request failed with status 503: Service temporarily unavailable',
      );
    });

    it('should handle 504 Gateway Timeout', async () => {
      const error = {
        response: {
          status: 504,
          data: { error: 'Gateway timeout' },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.getHTML({ url: 'https://example.com' })).rejects.toThrow(
        'Request failed with status 504: Gateway timeout',
      );
    });
  });

  describe('Network Connection Failures', () => {
    it('should handle DNS resolution failure', async () => {
      const error = new Error('getaddrinfo ENOTFOUND invalid.domain') as ErrorWithCode;
      error.code = 'ENOTFOUND';
      error.isAxiosError = true;
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.getMarkdown({ url: 'https://invalid.domain' })).rejects.toThrow(
        'DNS resolution failed: getaddrinfo ENOTFOUND invalid.domain',
      );
    });

    it('should handle connection refused', async () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:11235') as ErrorWithCode;
      error.code = 'ECONNREFUSED';
      error.isAxiosError = true;
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.crawl({ urls: ['https://example.com'] })).rejects.toThrow(
        'Connection refused: connect ECONNREFUSED 127.0.0.1:11235',
      );
    });

    it('should handle connection reset', async () => {
      const error = new Error('socket hang up') as ErrorWithCode;
      error.code = 'ECONNRESET';
      error.isAxiosError = true;
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.captureScreenshot({ url: 'https://example.com' })).rejects.toThrow(
        'Connection reset: socket hang up',
      );
    });

    it('should handle network unreachable', async () => {
      const error = new Error('connect ENETUNREACH') as ErrorWithCode;
      error.code = 'ENETUNREACH';
      error.isAxiosError = true;
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.executeJS({ url: 'https://example.com', scripts: ['return 1;'] })).rejects.toThrow(
        'Network unreachable: connect ENETUNREACH',
      );
    });
  });

  describe('Response Parsing Failures', () => {
    it('should handle invalid JSON response', async () => {
      // This test is not applicable anymore since we handle errors at axios level
      // The service will return whatever axios returns
      mockAxiosInstance.post.mockResolvedValue({
        data: '<html>Not JSON</html>',
        headers: { 'content-type': 'text/html' },
      });

      const result = await service.getHTML({ url: 'https://example.com' });
      expect(result).toBe('<html>Not JSON</html>');
    });

    it('should handle empty response', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: null,
      });

      // The service returns null, which is valid
      const result = await service.crawl({ urls: ['https://example.com'] });
      expect(result).toBeNull();
    });

    it('should handle malformed response structure', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { unexpected: 'structure' },
      });

      // The service returns whatever the API returns
      const result = await service.crawl({ urls: ['https://example.com'] });
      expect(result).toEqual({ unexpected: 'structure' });
    });
  });

  describe('Request Configuration Errors', () => {
    it('should handle invalid URL format', async () => {
      await expect(service.getMarkdown({ url: 'not-a-valid-url' })).rejects.toThrow('Invalid URL format');
    });

    it('should handle missing required parameters', async () => {
      await expect(service.batchCrawl({ urls: [] })).rejects.toThrow('URLs array cannot be empty');
    });

    it('should handle oversized request payload', async () => {
      const error = new Error('Request Entity Too Large') as ErrorWithCode;
      error.response = { status: 413 };
      error.isAxiosError = true;
      error.message = 'Request Entity Too Large';
      mockAxiosInstance.post.mockRejectedValue(error);

      const hugeScript = 'x'.repeat(10 * 1024 * 1024); // 10MB
      await expect(service.executeJS({ url: 'https://example.com', scripts: [hugeScript] })).rejects.toThrow(
        'Request failed with status 413: Request Entity Too Large',
      );
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
      mockAxiosInstance.post.mockResolvedValue({
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
