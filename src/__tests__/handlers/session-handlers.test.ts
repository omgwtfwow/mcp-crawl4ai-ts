/* eslint-env jest */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import type { SessionHandlers as SessionHandlersType } from '../../handlers/session-handlers.js';

// Mock axios before importing SessionHandlers
const mockPost = jest.fn();
const mockAxiosClient = {
  post: mockPost,
};

// Mock the service
const mockService = {} as unknown;

// Import after setting up mocks
const { SessionHandlers } = await import('../../handlers/session-handlers.js');

describe('SessionHandlers', () => {
  let handler: SessionHandlersType;
  let sessions: Map<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    sessions = new Map();
    handler = new SessionHandlers(mockService, mockAxiosClient as unknown, sessions);
  });

  describe('createSession', () => {
    it('should handle initial crawl failure gracefully', async () => {
      // Mock failed crawl
      mockPost.mockRejectedValue(
        new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', undefined, undefined, {
          status: 500,
          statusText: 'Internal Server Error',
          data: 'Internal Server Error',
          headers: {},
          config: {} as unknown,
        } as unknown),
      );

      const options = {
        initial_url: 'https://this-domain-definitely-does-not-exist-12345.com',
        browser_type: 'chromium' as const,
      };

      // Create session with initial_url that will fail
      const result = await handler.createSession(options);

      // Session should still be created
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Session created successfully');
      expect(result.content[0].text).toContain(
        'Pre-warmed with: https://this-domain-definitely-does-not-exist-12345.com',
      );
      expect(result.session_id).toBeDefined();
      expect(result.browser_type).toBe('chromium');

      // Verify crawl was attempted
      expect(mockPost).toHaveBeenCalledWith('/crawl', {
        urls: ['https://this-domain-definitely-does-not-exist-12345.com'],
        browser_config: {
          headless: true,
          browser_type: 'chromium',
        },
        crawler_config: {
          session_id: expect.stringMatching(/^session-/),
          cache_mode: 'BYPASS',
        },
      });

      // Verify session was stored locally
      expect(sessions.size).toBe(1);
      const session = sessions.get(result.session_id);
      expect(session).toBeDefined();
      expect(session.initial_url).toBe('https://this-domain-definitely-does-not-exist-12345.com');
    });

    it('should not attempt crawl when no initial_url provided', async () => {
      const result = await handler.createSession({});

      // Session should be created without crawl
      expect(result.content[0].text).toContain('Session created successfully');
      expect(result.content[0].text).toContain('Ready for use');
      expect(result.content[0].text).not.toContain('Pre-warmed');

      // Verify no crawl was attempted
      expect(mockPost).not.toHaveBeenCalled();
    });
  });
});
