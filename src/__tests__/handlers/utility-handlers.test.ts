/* eslint-env jest */
import { jest } from '@jest/globals';
import type { UtilityHandlers } from '../../handlers/utility-handlers.js';
import type { Crawl4AIService } from '../../crawl4ai-service.js';

// Mock the service
const mockCrawl = jest.fn();
const mockService = {
  crawl: mockCrawl,
} as unknown as Crawl4AIService;

// Mock axios client
const mockPost = jest.fn();
const mockAxiosClient = {
  post: mockPost,
} as unknown;

// Import after setting up mocks
const { UtilityHandlers } = await import('../../handlers/utility-handlers.js');

describe('UtilityHandlers', () => {
  let handler: UtilityHandlers;
  let sessions: Map<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    sessions = new Map();
    handler = new UtilityHandlers(mockService, mockAxiosClient, sessions);
  });

  describe('extractLinks', () => {
    it('should manually extract links from markdown when API returns empty links', async () => {
      // Mock crawl response with empty links but markdown containing href attributes
      mockPost.mockResolvedValue({
        data: {
          results: [{
            success: true,
            links: {
              internal: [],
              external: [],
            },
            markdown: {
              raw_markdown: `
            # Test Page
            
            Here are some links:
            <a href="https://example.com/page1">Internal Link</a>
            <a href="https://external.com/page">External Link</a>
            <a href="/relative/path">Relative Link</a>
            <a href='https://example.com/page2'>Another Internal</a>
          `,
            },
          }],
        },
      });

      const result = await handler.extractLinks({
        url: 'https://example.com',
        categorize: true,
      });

      // Should have manually extracted and categorized links
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Link analysis for https://example.com');
      expect(result.content[0].text).toContain('internal (3)');
      expect(result.content[0].text).toContain('https://example.com/page1');
      expect(result.content[0].text).toContain('https://example.com/page2');
      expect(result.content[0].text).toContain('https://example.com/relative/path');
      expect(result.content[0].text).toContain('external (1)');
      expect(result.content[0].text).toContain('https://external.com/page');
    });

    it('should handle manual extraction without categorization', async () => {
      // Mock crawl response with empty links
      mockPost.mockResolvedValue({
        data: {
          results: [{
            success: true,
            links: {
              internal: [],
              external: [],
            },
            markdown: {
              raw_markdown: `<a href="https://example.com/page1">Link 1</a>
                         <a href="https://external.com/page">Link 2</a>`,
            },
          }],
        },
      });

      const result = await handler.extractLinks({
        url: 'https://example.com',
        categorize: false,
      });

      // Should show all links without categorization
      expect(result.content[0].text).toContain('All links from https://example.com');
      expect(result.content[0].text).toContain('https://example.com/page1');
      expect(result.content[0].text).toContain('https://external.com/page');
      expect(result.content[0].text).not.toContain('Internal links:');
    });

    it('should handle malformed URLs during manual extraction', async () => {
      // Mock crawl response with a malformed URL in href
      mockPost.mockResolvedValue({
        data: {
          results: [{
            success: true,
            links: {
              internal: [],
              external: [],
            },
            markdown: {
              raw_markdown: `<a href="javascript:void(0)">JS Link</a>
                         <a href="https://example.com/valid">Valid Link</a>
                         <a href="not-a-url">Invalid URL</a>`,
            },
          }],
        },
      });

      const result = await handler.extractLinks({
        url: 'https://example.com',
        categorize: true,
      });

      // Should handle invalid URLs gracefully
      expect(result.content[0].text).toContain('https://example.com/valid');
      // Invalid URLs should be treated as relative links
      expect(result.content[0].text).toContain('not-a-url');
      expect(result.content[0].text).toContain('javascript:void(0)');
    });

    it('should return empty results when no links found', async () => {
      // Mock crawl response with no links
      mockPost.mockResolvedValue({
        data: {
          results: [{
            success: true,
            links: {
              internal: [],
              external: [],
            },
            markdown: {
              raw_markdown: 'Just plain text without any links',
            },
          }],
        },
      });

      const result = await handler.extractLinks({
        url: 'https://example.com',
        categorize: true,
      });

      // Should show empty categories
      expect(result.content[0].text).toContain('Link analysis for https://example.com');
      expect(result.content[0].text).toContain('internal (0)');
      expect(result.content[0].text).toContain('external (0)');
    });
  });
});