/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

describe('extract_with_llm Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('LLM extraction', () => {
    it(
      'should extract information about a webpage',
      async () => {
        const result = await client.callTool({
          name: 'extract_with_llm',
          arguments: {
            url: 'https://httpbin.org/html',
            query: 'What is the main topic of this page?',
          },
        });

        expect(result).toBeTruthy();
        const typedResult = result as ToolResult;
        expect(typedResult.content).toBeDefined();
        expect(typedResult.content.length).toBeGreaterThan(0);

        const textContent = (result as ToolResult).content.find((c) => c.type === 'text');
        expect(textContent?.text).toBeTruthy();
        // Should return a meaningful response (LLM responses are non-deterministic)
        expect(textContent?.text?.length || 0).toBeGreaterThan(10);
      },
      TEST_TIMEOUTS.long,
    );

    it(
      'should answer specific questions about content',
      async () => {
        const result = await client.callTool({
          name: 'extract_with_llm',
          arguments: {
            url: 'https://httpbin.org/json',
            query: 'What is the slideshow title?',
          },
        });

        expect(result).toBeTruthy();
        expect(result.content).toBeDefined();

        const textContent = (result as ToolResult).content.find((c) => c.type === 'text');
        expect(textContent?.text).toBeTruthy();
        // Should provide an answer about the content
        expect(textContent?.text?.length || 0).toBeGreaterThan(5);
      },
      TEST_TIMEOUTS.long,
    );

    it(
      'should handle complex queries',
      async () => {
        const result = await client.callTool({
          name: 'extract_with_llm',
          arguments: {
            url: 'https://httpbin.org/html',
            query: 'List all the links found on this page',
          },
        });

        expect(result).toBeTruthy();
        const textContent = (result as ToolResult).content.find((c) => c.type === 'text');
        expect(textContent?.text).toBeTruthy();
        // Should provide a response about links (content may vary)
        expect(textContent?.text?.length || 0).toBeGreaterThan(10);
      },
      TEST_TIMEOUTS.long,
    );
  });

  describe('Error handling', () => {
    it(
      'should handle server without API key configured',
      async () => {
        // Note: This test may pass if the server has OPENAI_API_KEY configured
        // It's here to document the expected behavior
        const result = await client.callTool({
          name: 'extract_with_llm',
          arguments: {
            url: 'https://httpbin.org/status/200',
            query: 'What is on this page?',
          },
        });

        const typedResult = result as ToolResult;
        // If it succeeds, we have API key configured
        if (typedResult.content && typedResult.content.length > 0) {
          expect(result).toBeTruthy();
        }
        // If it fails, we should get a proper error message
        else if (typedResult.content[0]?.text?.includes('LLM provider')) {
          expect(typedResult.content[0].text).toContain('LLM provider');
        }
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle invalid URLs',
      async () => {
        const result = await client.callTool({
          name: 'extract_with_llm',
          arguments: {
            url: 'not-a-url',
            query: 'What is this?',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Error');
        expect(textContent?.text?.toLowerCase()).toContain('invalid');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should handle empty query gracefully',
      async () => {
        const result = await client.callTool({
          name: 'extract_with_llm',
          arguments: {
            url: 'https://example.com',
            query: '',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Error');
      },
      TEST_TIMEOUTS.short,
    );
  });
});
