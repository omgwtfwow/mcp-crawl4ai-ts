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
            url: 'https://httpbin.org/html',
            scripts: ['return document.title', 'return document.querySelectorAll("h1").length'],
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');

        // Should contain JavaScript execution results
        expect(content[0].text).toContain('JavaScript executed on: https://httpbin.org/html');
        expect(content[0].text).toContain('Results:');
        expect(content[0].text).toContain('Script: return document.title');
        expect(content[0].text).toMatch(/Returned: .*/); // Title may be empty or no return value
        expect(content[0].text).toContain('Script: return document.querySelectorAll("h1").length');
        expect(content[0].text).toContain('Returned: 1'); // Should have 1 h1 element
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should execute single script as string',
      async () => {
        console.log('Starting execute_js test...');
        const result = await client.callTool({
          name: 'execute_js',
          arguments: {
            url: 'https://httpbin.org/html',
            scripts: 'return window.location.href',
          },
        });
        console.log('Got result:', result);

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);

        expect(content[0].text).toContain('JavaScript executed on: https://httpbin.org/html');
        expect(content[0].text).toContain('Script: return window.location.href');
        expect(content[0].text).toContain('Returned: "https://httpbin.org/html');
      },
      TEST_TIMEOUTS.long, // Increase timeout to 120s
    );

    it(
      'should reject session_id parameter',
      async () => {
        const result = await client.callTool({
          name: 'execute_js',
          arguments: {
            url: 'https://httpbin.org/html',
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
            url: 'https://httpbin.org/html',
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
            url: 'https://httpbin.org/html',
            scripts: 'const text = "line1\\nline2"; return text',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].text).toContain('JavaScript executed on: https://httpbin.org/html');
        expect(content[0].text).toContain('Returned: "line1\\nline2"');
      },
      TEST_TIMEOUTS.medium, // Increase from short to medium
    );

    it(
      'should handle JavaScript execution errors',
      async () => {
        const result = await client.callTool({
          name: 'execute_js',
          arguments: {
            url: 'https://httpbin.org/html',
            scripts: [
              'return "This works"',
              'throw new Error("This is a test error")',
              'nonExistentVariable.someMethod()',
            ],
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].text).toContain('JavaScript executed on: https://httpbin.org/html');
        
        // First script should succeed
        expect(content[0].text).toContain('Script: return "This works"');
        expect(content[0].text).toContain('Returned: "This works"');
        
        // Second script should show error
        expect(content[0].text).toContain('Script: throw new Error("This is a test error")');
        expect(content[0].text).toContain('Returned: Error: Error: This is a test error');
        
        // Third script should show reference error
        expect(content[0].text).toContain('Script: nonExistentVariable.someMethod()');
        expect(content[0].text).toContain('Returned: Error: ReferenceError: nonExistentVariable is not defined');
      },
      TEST_TIMEOUTS.medium,
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
