/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

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
          name: 'clear_session',
          arguments: { session_id: sessionId },
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

  describe('create_session', () => {
    it(
      'should create session with auto-generated ID',
      async () => {
        const result = await client.callTool({
          name: 'create_session',
          arguments: {},
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
        expect(typedResult.initial_url).toBeUndefined();
        expect(typedResult.created_at).toBeDefined();

        // Track for cleanup
        createdSessions.push(typedResult.session_id!);
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should create session with custom ID',
      async () => {
        const customId = `test-session-${Date.now()}`;
        const result = await client.callTool({
          name: 'create_session',
          arguments: {
            session_id: customId,
          },
        });

        const typedResult = result as ToolResult;
        expect(typedResult.session_id).toBe(customId);
        expect(typedResult.browser_type).toBe('chromium');

        // Track for cleanup
        createdSessions.push(customId);
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should create session with initial URL',
      async () => {
        const result = await client.callTool({
          name: 'create_session',
          arguments: {
            initial_url: 'https://example.com',
            browser_type: 'chromium',
          },
        });

        const typedResult = result as ToolResult;
        expect(typedResult.session_id).toBeDefined();
        expect(typedResult.browser_type).toBe('chromium');
        expect(typedResult.initial_url).toBe('https://example.com');

        const textContent = typedResult.content.find((c) => c.type === 'text');
        expect(textContent?.text).toContain('Pre-warmed with: https://example.com');

        // Track for cleanup
        createdSessions.push(typedResult.session_id!);
      },
      TEST_TIMEOUTS.medium,
    );
  });

  describe('list_sessions', () => {
    it(
      'should list all active sessions',
      async () => {
        // Create a few sessions
        const session1 = await client.callTool({
          name: 'create_session',
          arguments: {},
        });
        const session2 = await client.callTool({
          name: 'create_session',
          arguments: {
            initial_url: 'https://example.com',
          },
        });

        // List sessions
        const result = await client.callTool({
          name: 'list_sessions',
          arguments: {},
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Active sessions (2):');
        expect(textContent?.text).toContain((session1 as ToolResult).session_id!);
        expect(textContent?.text).toContain((session2 as ToolResult).session_id!);

        // Track for cleanup
        createdSessions.push((session1 as ToolResult).session_id!);
        createdSessions.push((session2 as ToolResult).session_id!);
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should show empty list when no sessions',
      async () => {
        // First, clear any existing sessions
        const listResult = await client.callTool({
          name: 'list_sessions',
          arguments: {},
        });

        // Parse existing sessions and clear them
        const listText = (listResult as ToolResult).content.find((c) => c.type === 'text')?.text || '';
        if (!listText.includes('No active sessions')) {
          // Extract session IDs from the list
          const sessionIdMatches = listText.match(/- (session-[\w-]+|test-session-[\w-]+|lifecycle-test)/g);
          if (sessionIdMatches) {
            for (const match of sessionIdMatches) {
              const sessionId = match.substring(2); // Remove "- " prefix
              await client.callTool({
                name: 'clear_session',
                arguments: { session_id: sessionId },
              });
            }
          }
        }

        // Now check for empty list
        const result = await client.callTool({
          name: 'list_sessions',
          arguments: {},
        });

        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent?.text).toContain('No active sessions');
      },
      TEST_TIMEOUTS.short,
    );
  });

  describe('clear_session', () => {
    it(
      'should clear existing session',
      async () => {
        // Create a session
        const createResult = await client.callTool({
          name: 'create_session',
          arguments: {},
        });
        const sessionId = (createResult as ToolResult).session_id!;

        // Clear it
        const clearResult = await client.callTool({
          name: 'clear_session',
          arguments: { session_id: sessionId },
        });

        const content = (clearResult as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent?.text).toContain('Session cleared successfully');
        expect(textContent?.text).toContain(sessionId);

        // Verify it's gone
        const listResult = await client.callTool({
          name: 'list_sessions',
          arguments: {},
        });
        const listContent = (listResult as ToolResult).content;
        const listText = listContent.find((c) => c.type === 'text');
        expect(listText?.text).not.toContain(sessionId);
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should handle clearing non-existent session',
      async () => {
        const result = await client.callTool({
          name: 'clear_session',
          arguments: { session_id: 'non-existent-session' },
        });

        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent?.text).toContain('Session not found');
      },
      TEST_TIMEOUTS.short,
    );
  });

  describe('Session lifecycle', () => {
    it(
      'should support full session lifecycle',
      async () => {
        // 1. Create session
        const createResult = await client.callTool({
          name: 'create_session',
          arguments: {
            session_id: 'lifecycle-test',
            initial_url: 'https://example.com',
            browser_type: 'chromium',
          },
        });

        const sessionId = (createResult as ToolResult).session_id;
        expect(sessionId).toBe('lifecycle-test');

        // 2. List sessions (should include our session)
        const listResult = await client.callTool({
          name: 'list_sessions',
          arguments: {},
        });
        const listText = (listResult as ToolResult).content.find((c) => c.type === 'text')?.text;
        expect(listText).toContain('lifecycle-test');
        expect(listText).toContain('chromium');

        // 3. Use the session with crawl tool
        const crawlResult = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://example.com/test',
            session_id: sessionId,
          },
        });
        expect(crawlResult).toBeDefined();

        // 4. Clear session
        const clearResult = await client.callTool({
          name: 'clear_session',
          arguments: { session_id: sessionId },
        });
        const clearText = (clearResult as ToolResult).content.find((c) => c.type === 'text')?.text;
        expect(clearText).toContain('Session cleared successfully');

        // 5. Verify it's gone
        const finalListResult = await client.callTool({
          name: 'list_sessions',
          arguments: {},
        });
        const finalListText = (finalListResult as ToolResult).content.find((c) => c.type === 'text')?.text;
        expect(finalListText).not.toContain('lifecycle-test');
      },
      TEST_TIMEOUTS.long,
    );
  });

  describe('Error handling', () => {
    it(
      'should handle invalid initial_url',
      async () => {
        const result = await client.callTool({
          name: 'create_session',
          arguments: {
            initial_url: 'not-a-url',
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
      'should create session even if initial crawl fails',
      async () => {
        // Use a URL that will fail to crawl (non-existent domain)
        const result = await client.callTool({
          name: 'create_session',
          arguments: {
            initial_url: 'https://this-domain-definitely-does-not-exist-12345.com',
            browser_type: 'chromium',
          },
        });

        // Session should still be created successfully
        expect(result).toBeDefined();
        const typedResult = result as ToolResult;
        expect(typedResult.session_id).toBeDefined();
        expect(typedResult.browser_type).toBe('chromium');

        const textContent = typedResult.content.find((c) => c.type === 'text');
        expect(textContent?.text).toContain('Session created successfully');
        expect(textContent?.text).toContain('Pre-warmed with: https://this-domain-definitely-does-not-exist-12345.com');

        // Verify session exists in list
        const listResult = await client.callTool({
          name: 'list_sessions',
          arguments: {},
        });
        const listText = (listResult as ToolResult).content.find((c) => c.type === 'text')?.text;
        expect(listText).toContain(typedResult.session_id);

        // Track for cleanup
        createdSessions.push(typedResult.session_id!);
      },
      TEST_TIMEOUTS.medium,
    );
  });
});
