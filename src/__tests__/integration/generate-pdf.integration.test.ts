/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
    resource?: {
      uri: string;
      mimeType?: string;
      blob?: string;
    };
  }>;
}

describe('generate_pdf Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('PDF generation', () => {
    it(
      'should generate PDF from URL',
      async () => {
        const result = await client.callTool({
          name: 'generate_pdf',
          arguments: {
            url: 'https://example.com', // Use example.com which we know works
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toHaveLength(2);

        // First item should be the PDF as embedded resource
        expect(content[0].type).toBe('resource');
        expect(content[0].resource).toBeDefined();
        expect(content[0].resource?.mimeType).toBe('application/pdf');
        expect(content[0].resource?.blob).toBeTruthy();
        expect(content[0].resource?.blob?.length).toBeGreaterThan(1000); // Should be a substantial base64 string
        expect(content[0].resource?.uri).toContain('data:application/pdf');

        // Second item should be text description
        expect(content[1].type).toBe('text');
        expect(content[1].text).toContain('PDF generated for: https://example.com');
      },
      TEST_TIMEOUTS.long,
    );

    it(
      'should reject session_id parameter',
      async () => {
        const result = await client.callTool({
          name: 'generate_pdf',
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
          name: 'generate_pdf',
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
          name: 'generate_pdf',
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
