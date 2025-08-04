/* eslint-env jest */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import type { CrawlHandlers as CrawlHandlersType } from '../../handlers/crawl-handlers.js';
import type { Crawl4AIService } from '../../crawl4ai-service.js';

// Mock the service
const mockCrawl = jest.fn();
const mockService = {
  crawl: mockCrawl,
} as unknown as Crawl4AIService;

// Mock axios client
const mockPost = jest.fn();
const mockHead = jest.fn();
const mockAxiosClient = {
  post: mockPost,
  head: mockHead,
} as unknown;

// Mock axios for parseSitemap
const mockAxiosGet = jest.fn();
jest.unstable_mockModule('axios', () => ({
  default: {
    get: mockAxiosGet,
  },
  AxiosError,
}));

// Import after setting up mocks
const { CrawlHandlers: CrawlHandlersClass } = await import('../../handlers/crawl-handlers.js');

describe('CrawlHandlers', () => {
  let handler: CrawlHandlersType;
  let sessions: Map<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    sessions = new Map();
    handler = new CrawlHandlersClass(mockService, mockAxiosClient, sessions);
  });

  describe('batchCrawl', () => {
    it('should handle API errors gracefully', async () => {
      // Mock API error response
      mockPost.mockRejectedValue(
        new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', undefined, undefined, {
          status: 500,
          statusText: 'Internal Server Error',
          data: 'Internal Server Error',
          headers: {},
          config: {} as unknown,
        } as unknown),
      );

      await expect(
        handler.batchCrawl({
          urls: ['not-a-valid-url', 'https://invalid-domain.com'],
          max_concurrent: 2,
        }),
      ).rejects.toThrow('Failed to batch crawl: Request failed with status code 500');
    });
  });

  describe('smartCrawl', () => {
    it('should detect XML content type from HEAD request', async () => {
      // Mock HEAD response with XML content type
      mockHead.mockResolvedValue({
        headers: {
          'content-type': 'application/xml',
        },
      });

      // Mock crawl response
      mockPost.mockResolvedValue({
        data: {
          results: [
            {
              success: true,
              markdown: {
                raw_markdown: '<xml>Test content</xml>',
              },
            },
          ],
        },
      });

      const result = await handler.smartCrawl({
        url: 'https://example.com/data.xml',
      });

      expect(result.content[0].text).toContain('Smart crawl detected content type: sitemap');
      expect(result.content[0].text).toContain('<xml>Test content</xml>');
    });

    it('should handle HEAD request failure gracefully', async () => {
      // Mock HEAD request failure
      mockHead.mockRejectedValue(new Error('HEAD request failed'));

      // Mock successful crawl
      mockPost.mockResolvedValue({
        data: {
          results: [
            {
              success: true,
              markdown: {
                raw_markdown: 'Test content',
              },
            },
          ],
        },
      });

      const result = await handler.smartCrawl({
        url: 'https://example.com',
      });

      expect(result.content[0].text).toContain('Smart crawl detected content type: html');
    });

    it('should follow links from sitemap when follow_links is true', async () => {
      // Mock successful HEAD request
      mockHead.mockResolvedValue({
        headers: {
          'content-type': 'application/xml',
        },
      });

      // Mock initial crawl with sitemap content
      mockPost.mockResolvedValueOnce({
        data: {
          results: [
            {
              success: true,
              markdown: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
  </url>
</urlset>`,
            },
          ],
        },
      });

      // Mock follow-up crawl
      mockPost.mockResolvedValueOnce({
        data: {
          results: [{ success: true }, { success: true }],
        },
      });

      const result = await handler.smartCrawl({
        url: 'https://example.com/sitemap.xml',
        follow_links: true,
        max_depth: 2,
      });

      expect(result.content[0].text).toContain('Smart crawl detected content type: sitemap');
      expect(result.content[0].text).toContain('Followed 2 links:');
      expect(result.content[0].text).toContain('https://example.com/page1');
      expect(result.content[0].text).toContain('https://example.com/page2');
    });

    it('should handle smartCrawl API errors', async () => {
      mockHead.mockResolvedValue({ headers: {} });
      // Mock crawl to get empty results first, then error on follow-up
      mockPost.mockResolvedValueOnce({
        data: {
          results: [],
        },
      });

      const result = await handler.smartCrawl({
        url: 'https://example.com',
      });

      // With empty results, it should still return a response
      expect(result.content[0].text).toContain('Smart crawl detected content type: html');
      expect(result.content[0].text).toContain('No content extracted');
    });
  });

  describe('crawlRecursive', () => {
    it('should handle max_depth limit correctly', async () => {
      // Mock successful crawl with links
      mockPost.mockResolvedValueOnce({
        data: {
          results: [
            {
              success: true,
              markdown: {
                raw_markdown: 'Test content',
              },
              links: {
                internal: [{ href: 'https://example.com/page1' }, { href: 'https://example.com/page2' }],
                external: [],
              },
            },
          ],
        },
      });

      // Mock second crawl for page1
      mockPost.mockResolvedValueOnce({
        data: {
          results: [
            {
              success: true,
              markdown: {
                raw_markdown: 'Page 1 content',
              },
              links: {
                internal: [],
                external: [],
              },
            },
          ],
        },
      });

      // Mock third crawl for page2
      mockPost.mockResolvedValueOnce({
        data: {
          results: [
            {
              success: true,
              markdown: {
                raw_markdown: 'Page 2 content',
              },
              links: {
                internal: [],
                external: [],
              },
            },
          ],
        },
      });

      const result = await handler.crawlRecursive({
        url: 'https://example.com',
        max_depth: 1, // Should crawl initial URL and one level deep
      });

      expect(result.content[0].text).toContain('Pages crawled: 3'); // Initial + 2 pages at depth 1
      expect(result.content[0].text).toContain('Max depth reached: 1');
      expect(mockPost).toHaveBeenCalledTimes(3); // Initial crawl + two more
    });

    it('should handle invalid URLs in discovered links', async () => {
      // Mock crawl with invalid link
      mockPost.mockResolvedValue({
        data: {
          results: [
            {
              success: true,
              markdown: {
                raw_markdown: 'Test content',
              },
              links: {
                internal: [
                  { href: 'javascript:void(0)' }, // Invalid URL
                  { href: 'https://example.com/valid' }, // Valid URL
                ],
                external: [],
              },
            },
          ],
        },
      });

      const result = await handler.crawlRecursive({
        url: 'https://example.com',
        max_depth: 1,
      });

      // Should continue despite invalid URL
      expect(result.content[0].text).toContain('Pages crawled:');
    });

    it('should handle crawl failures during recursion', async () => {
      // First crawl succeeds
      mockPost.mockResolvedValueOnce({
        data: {
          results: [
            {
              success: true,
              markdown: {
                raw_markdown: 'Test content',
              },
              links: {
                internal: [{ href: 'https://example.com/page1' }],
                external: [],
              },
            },
          ],
        },
      });

      // Second crawl fails
      mockPost.mockRejectedValueOnce(new Error('Crawl failed'));

      const result = await handler.crawlRecursive({
        url: 'https://example.com',
        max_depth: 1,
      });

      // Should continue despite failure
      expect(result.content[0].text).toContain('Pages crawled: 1');
    });

    it('should handle crawlRecursive API errors', async () => {
      mockPost.mockRejectedValue(new Error('API Error'));

      const result = await handler.crawlRecursive({
        url: 'https://example.com',
      });

      // When the initial crawl fails, it should return a result with no pages crawled
      expect(result.content[0].text).toContain('Pages crawled: 0');
      expect(result.content[0].text).toContain('No pages could be crawled');
    });
  });

  describe('parseSitemap', () => {
    it('should handle network errors gracefully', async () => {
      // Mock ENOTFOUND error
      const error = new Error('getaddrinfo ENOTFOUND not-a-real-domain-12345.com');
      (error as { code?: string }).code = 'ENOTFOUND';
      mockAxiosGet.mockRejectedValue(error);

      await expect(
        handler.parseSitemap({
          url: 'https://not-a-real-domain-12345.com/sitemap.xml',
        }),
      ).rejects.toThrow('Failed to parse sitemap: getaddrinfo ENOTFOUND not-a-real-domain-12345.com');
    });
  });

  describe('crawl', () => {
    it('should handle word_count_threshold parameter', async () => {
      mockCrawl.mockResolvedValue({
        results: [
          {
            success: true,
            markdown: {
              raw_markdown: 'Test content',
            },
          },
        ],
      });

      const result = await handler.crawl({
        url: 'https://example.com',
        word_count_threshold: 100,
      });

      expect(mockCrawl).toHaveBeenCalledWith(
        expect.objectContaining({
          crawler_config: expect.objectContaining({
            word_count_threshold: 100,
          }),
        }),
      );
      expect(result.content[0].text).toBe('Test content');
    });

    it('should update session last_used time when using session_id', async () => {
      const sessionId = 'test-session';
      const session = {
        id: sessionId,
        created_at: new Date(),
        last_used: new Date('2025-08-01'),
      };
      sessions.set(sessionId, session);

      mockCrawl.mockResolvedValue({
        results: [
          {
            success: true,
            markdown: {
              raw_markdown: 'Test content',
            },
          },
        ],
      });

      await handler.crawl({
        url: 'https://example.com',
        session_id: sessionId,
      });

      const updatedSession = sessions.get(sessionId) as { last_used: Date };
      expect(updatedSession.last_used.getTime()).toBeGreaterThan(new Date('2025-08-01').getTime());
    });

    it('should handle image description parameters', async () => {
      mockCrawl.mockResolvedValue({
        results: [
          {
            success: true,
            markdown: {
              raw_markdown: 'Test content',
            },
          },
        ],
      });

      await handler.crawl({
        url: 'https://example.com',
        image_description_min_word_threshold: 10,
        image_score_threshold: 0.5,
      });

      expect(mockCrawl).toHaveBeenCalledWith(
        expect.objectContaining({
          crawler_config: expect.objectContaining({
            image_description_min_word_threshold: 10,
            image_score_threshold: 0.5,
          }),
        }),
      );
    });

    it('should handle exclude_social_media_links parameter', async () => {
      mockCrawl.mockResolvedValue({
        results: [
          {
            success: true,
            markdown: {
              raw_markdown: 'Test content',
            },
          },
        ],
      });

      await handler.crawl({
        url: 'https://example.com',
        exclude_social_media_links: true,
      });

      expect(mockCrawl).toHaveBeenCalledWith(
        expect.objectContaining({
          crawler_config: expect.objectContaining({
            exclude_social_media_links: true,
          }),
        }),
      );
    });

    it('should use extracted_content when available as string', async () => {
      mockCrawl.mockResolvedValue({
        results: [
          {
            success: true,
            extracted_content: 'Extracted text content',
          },
        ],
      });

      const result = await handler.crawl({
        url: 'https://example.com',
      });

      expect(result.content[0].text).toBe('Extracted text content');
    });

    it('should handle extracted_content as object', async () => {
      const extractedObj = { title: 'Test', body: 'Content' };
      mockCrawl.mockResolvedValue({
        results: [
          {
            success: true,
            extracted_content: extractedObj,
          },
        ],
      });

      const result = await handler.crawl({
        url: 'https://example.com',
      });

      expect(result.content[0].text).toBe(JSON.stringify(extractedObj, null, 2));
    });

    it('should fallback to html when markdown is not available', async () => {
      mockCrawl.mockResolvedValue({
        results: [
          {
            success: true,
            html: '<html><body>HTML content</body></html>',
          },
        ],
      });

      const result = await handler.crawl({
        url: 'https://example.com',
      });

      expect(result.content[0].text).toBe('<html><body>HTML content</body></html>');
    });

    it('should fallback to fit_html when neither markdown nor html is available', async () => {
      mockCrawl.mockResolvedValue({
        results: [
          {
            success: true,
            fit_html: '<div>Fit HTML content</div>',
          },
        ],
      });

      const result = await handler.crawl({
        url: 'https://example.com',
      });

      expect(result.content[0].text).toBe('<div>Fit HTML content</div>');
    });

    it('should handle js_code as null error', async () => {
      await expect(
        handler.crawl({
          url: 'https://example.com',
          js_code: null,
        }),
      ).rejects.toThrow(
        'Failed to crawl: js_code parameter is null. Please provide JavaScript code as a string or array of strings.',
      );
    });
  });
});
