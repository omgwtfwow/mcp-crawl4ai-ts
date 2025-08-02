/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}

describe('capture_screenshot Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('Screenshot capture', () => {
    it(
      'should capture screenshot with default wait time',
      async () => {
        const result = await client.callTool({
          name: 'capture_screenshot',
          arguments: {
            url: 'https://example.com',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toHaveLength(2);

        // First item should be the image
        expect(content[0].type).toBe('image');
        expect(content[0].mimeType).toBe('image/png');
        expect(content[0].data).toBeTruthy();
        expect(content[0].data?.length).toBeGreaterThan(1000); // Should be a substantial base64 string

        // Second item should be text description
        expect(content[1].type).toBe('text');
        expect(content[1].text).toContain('Screenshot captured for: https://example.com');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should capture screenshot with custom wait time',
      async () => {
        const result = await client.callTool({
          name: 'capture_screenshot',
          arguments: {
            url: 'https://example.com',
            screenshot_wait_for: 3,
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toHaveLength(2);

        // First item should be the image
        expect(content[0].type).toBe('image');
        expect(content[0].mimeType).toBe('image/png');
        expect(content[0].data).toBeTruthy();

        // Second item should be text description
        expect(content[1].type).toBe('text');
        expect(content[1].text).toContain('Screenshot captured for: https://example.com');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should reject session_id parameter',
      async () => {
        const result = await client.callTool({
          name: 'capture_screenshot',
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
          name: 'capture_screenshot',
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
          name: 'capture_screenshot',
          arguments: {
            url: 'https://this-domain-definitely-does-not-exist-123456789.com',
          },
        });

        const content = (result as ToolResult).content;
        expect(content).toHaveLength(1);
        expect(content[0].type).toBe('text');
        expect(content[0].text).toContain('Error');
      },
      TEST_TIMEOUTS.short,
    );
  });
});
