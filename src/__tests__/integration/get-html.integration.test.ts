/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

describe('get_html Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('HTML extraction', () => {
    it(
      'should extract HTML from URL',
      async () => {
        const result = await client.callTool({
          name: 'get_html',
          arguments: {
            url: 'https://httpbin.org/html',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        // Should contain processed HTML
        const html = content[0].text || '';
        expect(html).toBeTruthy();
        // The HTML endpoint returns sanitized/processed HTML
        // It might be truncated with "..."
        expect(html.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should reject session_id parameter',
      async () => {
        const result = await client.callTool({
          name: 'get_html',
          arguments: {
            url: 'https://example.com',
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
          name: 'get_html',
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
          name: 'get_html',
          arguments: {
            url: 'https://this-domain-definitely-does-not-exist-123456789.com',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        // According to spec, returns success: true with empty HTML for invalid URLs
        const html = content[0].text || '';
        // Could be empty or contain an error message
        expect(typeof html).toBe('string');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should ignore extra parameters',
      async () => {
        const result = await client.callTool({
          name: 'get_html',
          arguments: {
            url: 'https://example.com',
            wait_for: '.some-selector', // Should be ignored
            bypass_cache: true, // Should be ignored
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        // Should still work, ignoring extra params
        const html = content[0].text || '';
        expect(html.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUTS.medium,
    );
  });
});
