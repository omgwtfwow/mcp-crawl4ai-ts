/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

describe('execute_js Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('JavaScript execution', () => {
    it(
      'should execute JavaScript and return results',
      async () => {
        const result = await client.callTool({
          name: 'execute_js',
          arguments: {
            url: 'https://example.com',
            scripts: ['return document.title', 'return document.querySelectorAll("a").length'],
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        // Should contain JavaScript execution results
        expect(content[0].text).toContain('JavaScript executed on: https://example.com');
        expect(content[0].text).toContain('Results:');
        expect(content[0].text).toContain('Script: return document.title');
        expect(content[0].text).toContain('Returned: "Example Domain"');
        expect(content[0].text).toContain('Script: return document.querySelectorAll("a").length');
        expect(content[0].text).toMatch(/Returned: \d+/);
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should execute single script as string',
      async () => {
        const result = await client.callTool({
          name: 'execute_js',
          arguments: {
            url: 'https://example.com',
            scripts: 'return window.location.href',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);

        expect(content[0].text).toContain('JavaScript executed on: https://example.com');
        expect(content[0].text).toContain('Script: return window.location.href');
        expect(content[0].text).toContain('Returned: "https://example.com');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should reject session_id parameter',
      async () => {
        const result = await client.callTool({
          name: 'execute_js',
          arguments: {
            url: 'https://example.com',
            scripts: 'return true',
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
      'should reject invalid JavaScript with HTML entities',
      async () => {
        const result = await client.callTool({
          name: 'execute_js',
          arguments: {
            url: 'https://example.com',
            scripts: 'return &quot;test&quot;',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].text).toContain('Error');
        expect(content[0].text).toContain('Invalid JavaScript');
        expect(content[0].text).toContain('HTML entities');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should accept JavaScript with newlines in strings',
      async () => {
        const result = await client.callTool({
          name: 'execute_js',
          arguments: {
            url: 'https://example.com',
            scripts: 'const text = "line1\\nline2"; return text',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].text).toContain('JavaScript executed on: https://example.com');
        expect(content[0].text).toContain('Returned: "line1\\nline2"');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should handle invalid URLs gracefully',
      async () => {
        const result = await client.callTool({
          name: 'execute_js',
          arguments: {
            url: 'not-a-valid-url',
            scripts: 'return true',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].text).toContain('Error');
        expect(content[0].text?.toLowerCase()).toContain('invalid');
      },
      TEST_TIMEOUTS.short,
    );
  });
});
