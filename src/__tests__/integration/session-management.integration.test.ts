import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
  session_id?: string;
  browser_type?: string;
  initial_url?: string;
  created_at?: string;
}

describe('Session Management Integration Tests', () => {
  let client: Client;
  const createdSessions: string[] = [];

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterEach(async () => {
    // Clean up any sessions created during tests
    for (const sessionId of createdSessions) {
      try {
        await client.callTool({
          name: 'manage_session',
          arguments: { action: 'clear', session_id: sessionId },
        });
      } catch (e) {
        // Ignore errors during cleanup
        console.debug('Cleanup error:', e);
      }
    }
    createdSessions.length = 0;
  });

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('manage_session', () => {
    it(
      'should create session with auto-generated ID using manage_session',
      async () => {
        const result = await client.callTool({
          name: 'manage_session',
          arguments: { action: 'create' },
        });

        expect(result).toBeDefined();
        const typedResult = result as ToolResult;
        expect(typedResult.content).toBeDefined();
        expect(Array.isArray(typedResult.content)).toBe(true);

        const textContent = typedResult.content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Session created successfully');

        // Check returned parameters
        expect(typedResult.session_id).toBeDefined();
        expect(typedResult.session_id).toMatch(/^session-/);
        expect(typedResult.browser_type).toBe('chromium');

        // Track for cleanup
        createdSessions.push(typedResult.session_id!);
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should clear session using manage_session',
      async () => {
        // First create a session
        const createResult = await client.callTool({
          name: 'manage_session',
          arguments: {
            action: 'create',
            session_id: 'test-to-clear',
          },
        });

        const typedCreateResult = createResult as ToolResult;
        createdSessions.push(typedCreateResult.session_id!);

        // Then clear it
        const clearResult = await client.callTool({
          name: 'manage_session',
          arguments: {
            action: 'clear',
            session_id: 'test-to-clear',
          },
        });

        const typedClearResult = clearResult as ToolResult;
        expect(typedClearResult.content[0].text).toContain('Session cleared successfully');
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should list sessions using manage_session',
      async () => {
        // Create a session first
        const createResult = await client.callTool({
          name: 'manage_session',
          arguments: {
            action: 'create',
            session_id: 'test-list-session',
          },
        });

        const typedCreateResult = createResult as ToolResult;
        createdSessions.push(typedCreateResult.session_id!);

        // List sessions
        const listResult = await client.callTool({
          name: 'manage_session',
          arguments: { action: 'list' },
        });

        const typedListResult = listResult as ToolResult;
        expect(typedListResult.content[0].text).toContain('Active sessions');
        expect(typedListResult.content[0].text).toContain('test-list-session');
      },
      TEST_TIMEOUTS.short,
    );
  });
});
