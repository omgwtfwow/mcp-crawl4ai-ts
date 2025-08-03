/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

describe('get_markdown Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('Markdown extraction', () => {
    it(
      'should extract markdown with default fit filter',
      async () => {
        const result = await client.callTool({
          name: 'get_markdown',
          arguments: {
            url: 'https://httpbin.org/html',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('URL: https://httpbin.org/html');
        expect(text).toContain('Filter: fit');
        expect(text).toContain('Markdown:');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should extract markdown with raw filter',
      async () => {
        const result = await client.callTool({
          name: 'get_markdown',
          arguments: {
            url: 'https://httpbin.org/html',
            filter: 'raw',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Filter: raw');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should extract markdown with bm25 filter and query',
      async () => {
        const result = await client.callTool({
          name: 'get_markdown',
          arguments: {
            url: 'https://httpbin.org/html',
            filter: 'bm25',
            query: 'Herman Melville',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Filter: bm25');
        expect(text).toContain('Query: Herman Melville');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should extract markdown with llm filter and query',
      async () => {
        const result = await client.callTool({
          name: 'get_markdown',
          arguments: {
            url: 'https://httpbin.org/html',
            filter: 'llm',
            query: 'What is this page about?',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Filter: llm');
        expect(text).toContain('Query: What is this page about?');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should use cache parameter',
      async () => {
        const result = await client.callTool({
          name: 'get_markdown',
          arguments: {
            url: 'https://httpbin.org/html',
            cache: '1',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        const text = content[0].text || '';
        expect(text).toContain('Cache: 1');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should reject session_id parameter',
      async () => {
        const result = await client.callTool({
          name: 'get_markdown',
          arguments: {
            url: 'https://httpbin.org/html',
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

    it(
      'should handle invalid URLs gracefully',
      async () => {
        const result = await client.callTool({
          name: 'get_markdown',
          arguments: {
            url: 'not-a-valid-url',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');
        expect(content[0].text).toContain('Error');
        expect(content[0].text?.toLowerCase()).toContain('invalid');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should handle non-existent domains',
      async () => {
        const result = await client.callTool({
          name: 'get_markdown',
          arguments: {
            url: 'https://this-domain-definitely-does-not-exist-123456789.com',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        // According to the pattern from other tests, might return success with empty content
        const text = content[0].text || '';
        expect(typeof text).toBe('string');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should ignore extra parameters',
      async () => {
        const result = await client.callTool({
          name: 'get_markdown',
          arguments: {
            url: 'https://httpbin.org/html',
            filter: 'fit',
            // These should be ignored
            remove_images: true,
            bypass_cache: true,
            screenshot: true,
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        // Should still work, ignoring extra params
        const text = content[0].text || '';
        expect(text).toContain('Filter: fit');
      },
      TEST_TIMEOUTS.medium,
    );
  });
});
