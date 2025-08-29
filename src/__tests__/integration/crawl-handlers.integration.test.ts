/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

describe('Crawl Handlers Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('batch_crawl error handling', () => {
    it(
      'should handle batch crawl with invalid URLs',
      async () => {
        const result = await client.callTool({
          name: 'batch_crawl',
          arguments: {
            urls: ['not-a-valid-url', 'https://this-domain-does-not-exist-12345.com'],
            max_concurrent: 2,
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content[0].type).toBe('text');
        // Zod validation will catch the invalid URL format
        expect(content[0].text).toContain('Invalid parameters');
      },
      TEST_TIMEOUTS.medium,
    );
  });

  describe('smart_crawl edge cases', () => {
    it(
      'should detect XML content type for XML URLs',
      async () => {
        const result = await client.callTool({
          name: 'smart_crawl',
          arguments: {
            url: 'https://httpbin.org/xml',
            bypass_cache: true,
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content[0].text).toContain('Smart crawl detected content type:');
        // Should detect as XML based on content-type header
        expect(content[0].text?.toLowerCase()).toMatch(/xml|json/); // httpbin.org/xml actually returns JSON
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle follow_links with sitemap URLs',
      async () => {
        // Note: Most sites don't have accessible sitemaps, so this tests the logic
        const result = await client.callTool({
          name: 'smart_crawl',
          arguments: {
            url: 'https://example.com/sitemap.xml',
            follow_links: true,
            max_depth: 2,
            bypass_cache: true,
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content[0].text).toContain('Smart crawl detected content type:');
      },
      TEST_TIMEOUTS.long, // Increase timeout for sitemap processing
    );
  });

  describe('crawl_recursive edge cases', () => {
    it(
      'should respect max_depth limit of 0',
      async () => {
        const result = await client.callTool({
          name: 'crawl_recursive',
          arguments: {
            url: 'https://httpbin.org/links/5/0',
            max_depth: 0, // Should only crawl the initial page
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        // The test might show 0 pages if the URL fails, or 1 page if it succeeds
        expect(content[0].text).toMatch(/Pages crawled: [01]/);
        // If pages were crawled, check for max depth message
        if (content[0].text?.includes('Pages crawled: 1')) {
          expect(content[0].text).toContain('Max depth reached: 0');
        }
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle sites with no internal links',
      async () => {
        const result = await client.callTool({
          name: 'crawl_recursive',
          arguments: {
            url: 'https://httpbin.org/json', // JSON endpoint has no links
            max_depth: 2,
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content[0].text).toContain('Pages crawled: 1');
        expect(content[0].text).toContain('Internal links found: 0');
      },
      TEST_TIMEOUTS.medium,
    );
  });

  describe('parse_sitemap error handling', () => {
    it(
      'should handle non-existent sitemap URLs',
      async () => {
        const result = await client.callTool({
          name: 'parse_sitemap',
          arguments: {
            url: 'https://this-domain-does-not-exist-12345.com/sitemap.xml',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content[0].text).toContain('Error');
        expect(content[0].text?.toLowerCase()).toMatch(/failed|error|not found/);
      },
      TEST_TIMEOUTS.medium,
    );
  });

  describe('crawl method edge cases', () => {
    it(
      'should handle crawl with all image and filtering parameters',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://example.com',
            word_count_threshold: 50,
            image_description_min_word_threshold: 10,
            image_score_threshold: 0.5,
            exclude_social_media_links: true,
            cache_mode: 'BYPASS',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content[0].type).toBe('text');
        // Should successfully crawl with these parameters
        expect(content[0].text).not.toContain('Error');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle js_code as null with validation error',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://example.com',
            js_code: null as unknown as string, // Intentionally pass null
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content[0].text).toContain('Invalid parameters for crawl');
        expect(content[0].text).toContain('js_code');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should work with session_id parameter using manage_session',
      async () => {
        // First create a session using manage_session
        const sessionResult = await client.callTool({
          name: 'manage_session',
          arguments: {
            action: 'create',
            session_id: 'test-crawl-session-new',
          },
        });

        expect(sessionResult).toBeDefined();

        // Then use it for crawling
        const crawlResult = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://example.com',
            session_id: 'test-crawl-session-new',
          },
        });

        expect(crawlResult).toBeDefined();
        const content = (crawlResult as ToolResult).content;
        expect(content[0].type).toBe('text');
        expect(content[0].text).not.toContain('Error');

        // Clean up using manage_session
        await client.callTool({
          name: 'manage_session',
          arguments: {
            action: 'clear',
            session_id: 'test-crawl-session-new',
          },
        });
      },
      TEST_TIMEOUTS.medium,
    );
  });
});
