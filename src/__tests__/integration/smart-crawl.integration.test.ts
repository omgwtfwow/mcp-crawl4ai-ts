/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

describe('smart_crawl Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('Smart crawling', () => {
    it(
      'should auto-detect HTML content',
      async () => {
        const result = await client.callTool({
          name: 'smart_crawl',
          arguments: {
            url: 'https://httpbin.org/html',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content.length).toBeGreaterThanOrEqual(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Smart crawl detected content type:');
        expect(text).toContain('html');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle sitemap URLs',
      async () => {
        const result = await client.callTool({
          name: 'smart_crawl',
          arguments: {
            url: 'https://nodejs.org/sitemap.xml',
            max_depth: 1,
          },
        });

        const content = (result as ToolResult).content;
        expect(content.length).toBeGreaterThanOrEqual(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Smart crawl detected content type:');
        expect(text).toContain('sitemap');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle follow_links parameter',
      async () => {
        const result = await client.callTool({
          name: 'smart_crawl',
          arguments: {
            url: 'https://nodejs.org/sitemap.xml',
            follow_links: true,
            max_depth: 1,
          },
        });

        const content = (result as ToolResult).content;
        expect(content.length).toBeGreaterThanOrEqual(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Smart crawl detected content type:');
      },
      TEST_TIMEOUTS.long,
    );

    it(
      'should detect JSON content',
      async () => {
        const result = await client.callTool({
          name: 'smart_crawl',
          arguments: {
            url: 'https://httpbin.org/json',
          },
        });

        const content = (result as ToolResult).content;
        expect(content.length).toBeGreaterThanOrEqual(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Smart crawl detected content type:');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should bypass cache when requested',
      async () => {
        const result = await client.callTool({
          name: 'smart_crawl',
          arguments: {
            url: 'https://httpbin.org/html',
            bypass_cache: true,
          },
        });

        const content = (result as ToolResult).content;
        expect(content.length).toBeGreaterThanOrEqual(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Smart crawl detected content type:');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle invalid URLs gracefully',
      async () => {
        const result = await client.callTool({
          name: 'smart_crawl',
          arguments: {
            url: 'not-a-valid-url',
          },
        });

        const content = (result as ToolResult).content;
        expect(content.length).toBeGreaterThanOrEqual(1);
        expect(content[0].text).toContain('Error');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should handle non-existent domains',
      async () => {
        const result = await client.callTool({
          name: 'smart_crawl',
          arguments: {
            url: 'https://this-domain-definitely-does-not-exist-123456789.com',
          },
        });

        const content = (result as ToolResult).content;
        expect(content.length).toBeGreaterThanOrEqual(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        // Non-existent domains cause 500 errors
        expect(text).toContain('Error');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should reject session_id parameter',
      async () => {
        const result = await client.callTool({
          name: 'smart_crawl',
          arguments: {
            url: 'https://httpbin.org/html',
            session_id: 'test-session',
          },
        });

        const content = (result as ToolResult).content;
        expect(content.length).toBeGreaterThanOrEqual(1);
        expect(content[0].type).toBe('text');
        expect(content[0].text).toContain('session_id');
        expect(content[0].text).toContain('does not support');
        expect(content[0].text).toContain('stateless');
      },
      TEST_TIMEOUTS.short,
    );
  });
});
