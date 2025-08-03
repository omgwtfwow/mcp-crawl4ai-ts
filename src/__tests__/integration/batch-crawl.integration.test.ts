/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

describe('batch_crawl Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('Batch crawling', () => {
    it(
      'should crawl multiple URLs',
      async () => {
        const result = await client.callTool({
          name: 'batch_crawl',
          arguments: {
            urls: ['https://example.com/', 'https://httpbingo.org/html'],
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Batch crawl completed');
        expect(text).toContain('Processed 2 URLs');
        expect(text).toContain('https://example.com/: Success');
        expect(text).toContain('https://httpbingo.org/html: Success');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle max_concurrent parameter',
      async () => {
        const result = await client.callTool({
          name: 'batch_crawl',
          arguments: {
            urls: ['https://example.com/', 'https://httpbingo.org/html', 'https://testpages.eviltester.com/styled/basic-web-page-test.html'],
            max_concurrent: 1,
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Processed 3 URLs');
        expect(text).toContain(': Success');
      },
      TEST_TIMEOUTS.long,
    );

    it(
      'should remove images when requested',
      async () => {
        const result = await client.callTool({
          name: 'batch_crawl',
          arguments: {
            urls: ['https://httpbingo.org/html'],
            remove_images: true,
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Batch crawl completed');
        expect(text).toContain('https://httpbingo.org/html: Success');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should bypass cache when requested',
      async () => {
        const result = await client.callTool({
          name: 'batch_crawl',
          arguments: {
            urls: ['https://httpbingo.org/html'],
            bypass_cache: true,
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Batch crawl completed');
        expect(text).toContain('https://httpbingo.org/html: Success');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle mixed content types',
      async () => {
        const result = await client.callTool({
          name: 'batch_crawl',
          arguments: {
            urls: ['https://httpbin.org/html', 'https://httpbin.org/json', 'https://httpbin.org/xml'],
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Processed 3 URLs');
        expect(text).toContain('https://httpbingo.org/html: Success');
        expect(text).toContain('https://httpbin.org/json: Success');
        expect(text).toContain('https://httpbin.org/xml: Success');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle empty URL list',
      async () => {
        const result = await client.callTool({
          name: 'batch_crawl',
          arguments: {
            urls: [],
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].text).toContain('Error');
        // Just check that it's an error about invalid parameters
        expect(content[0].text?.toLowerCase()).toMatch(/error|invalid|failed/);
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should reject session_id parameter',
      async () => {
        const result = await client.callTool({
          name: 'batch_crawl',
          arguments: {
            urls: ['https://httpbingo.org/html'],
            session_id: 'test-session',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');
        expect(content[0].text).toContain('session_id');
        expect(content[0].text).toContain('does not support');
        expect(content[0].text).toContain('stateless');
      },
      TEST_TIMEOUTS.short,
    );
  });
});
