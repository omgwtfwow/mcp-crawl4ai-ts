/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

describe('extract_links Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('Basic functionality', () => {
    it(
      'should extract links with categorization (default)',
      async () => {
      const result = await client.callTool({
        name: 'extract_links',
        arguments: {
          url: 'https://example.com',
        },
      });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toBeDefined();
        expect(Array.isArray(content)).toBe(true);
        expect(content.length).toBeGreaterThan(0);

        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Link analysis for https://example.com');
        // Should show categorized output
        expect(textContent?.text).toMatch(/internal \(\d+\)/);
        expect(textContent?.text).toMatch(/external \(\d+\)/);
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should extract links without categorization',
      async () => {
        const result = await client.callTool({
          name: 'extract_links',
          arguments: {
            url: 'https://example.com',
            categorize: false,
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toBeDefined();
        expect(Array.isArray(content)).toBe(true);
        expect(content.length).toBeGreaterThan(0);

        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('All links from https://example.com');
        // Should NOT show categorized output
        expect(textContent?.text).not.toMatch(/internal \(\d+\)/);
        expect(textContent?.text).not.toMatch(/external \(\d+\)/);
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle sites with no links',
      async () => {
        // Test with a simple status page
        const result = await client.callTool({
          name: 'extract_links',
          arguments: {
            url: 'https://httpstat.us/200',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toBeDefined();
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should detect JSON endpoints',
      async () => {
        const result = await client.callTool({
          name: 'extract_links',
          arguments: {
            url: 'https://api.github.com',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toBeDefined();
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        // Should show note about JSON endpoint
        expect(textContent?.text).toContain('appears to return JSON data');
      },
      TEST_TIMEOUTS.medium,
    );
  });

  describe('Error handling', () => {
    it(
      'should handle invalid URLs',
      async () => {
        const result = await client.callTool({
          name: 'extract_links',
          arguments: {
            url: 'not-a-url',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toBeDefined();
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Error');
        expect(textContent?.text?.toLowerCase()).toContain('invalid');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should handle non-existent domains',
      async () => {
        const result = await client.callTool({
          name: 'extract_links',
          arguments: {
            url: 'https://this-domain-definitely-does-not-exist-12345.com',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toBeDefined();
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Error');
        // Could be various error messages: connection error, DNS error, etc.
        expect(textContent?.text?.toLowerCase()).toMatch(/error|failed/);
      },
      TEST_TIMEOUTS.medium,
    );
  });
});