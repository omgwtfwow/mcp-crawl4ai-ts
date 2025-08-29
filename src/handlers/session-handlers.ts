import { BaseHandler } from './base-handler.js';

export class SessionHandlers extends BaseHandler {
  async manageSession(options: {
    action: 'create' | 'clear' | 'list';
    session_id?: string;
    initial_url?: string;
    browser_type?: string;
  }) {
    switch (options.action) {
      case 'create':
        return this.createSession({
          session_id: options.session_id,
          initial_url: options.initial_url,
          browser_type: options.browser_type,
        });
      case 'clear':
        if (!options.session_id) {
          throw new Error('session_id is required for clear action');
        }
        return this.clearSession({ session_id: options.session_id });
      case 'list':
        return this.listSessions();
      default:
        // This should never happen due to TypeScript types, but handle it for runtime safety
        throw new Error(`Invalid action: ${(options as { action: string }).action}`);
    }
  }

  private async createSession(options: { session_id?: string; initial_url?: string; browser_type?: string }) {
    try {
      // Generate session ID if not provided
      const sessionId = options.session_id || `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Store session info locally
      this.sessions.set(sessionId, {
        id: sessionId,
        created_at: new Date(),
        last_used: new Date(),
        initial_url: options.initial_url,
        metadata: {
          browser_type: options.browser_type || 'chromium',
        },
      });

      // If initial_url provided, make first crawl to establish session
      if (options.initial_url) {
        try {
          await this.axiosClient.post(
            '/crawl',
            {
              urls: [options.initial_url],
              browser_config: {
                headless: true,
                browser_type: options.browser_type || 'chromium',
              },
              crawler_config: {
                session_id: sessionId,
                cache_mode: 'BYPASS',
              },
            },
            {
              timeout: 30000, // 30 second timeout for initial crawl
            },
          );

          // Update last_used
          const session = this.sessions.get(sessionId);
          if (session) {
            session.last_used = new Date();
          }
        } catch (error) {
          // Session created but initial crawl failed - still return success
          console.error(`Initial crawl failed for session ${sessionId}:`, error);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Session created successfully:\nSession ID: ${sessionId}\nBrowser: ${options.browser_type || 'chromium'}\n${options.initial_url ? `Pre-warmed with: ${options.initial_url}` : 'Ready for use'}\n\nUse this session_id with the crawl tool to maintain state across requests.`,
          },
        ],
        // Include all session parameters for easier programmatic access
        session_id: sessionId,
        browser_type: options.browser_type || 'chromium',
        initial_url: options.initial_url,
        created_at: this.sessions.get(sessionId)?.created_at.toISOString(),
      };
    } catch (error) {
      throw this.formatError(error, 'create session');
    }
  }

  private async clearSession(options: { session_id: string }) {
    try {
      // Remove from local store
      const deleted = this.sessions.delete(options.session_id);

      // Note: The actual browser session in Crawl4AI will be cleaned up
      // automatically after inactivity or when the server restarts

      return {
        content: [
          {
            type: 'text',
            text: deleted
              ? `Session cleared successfully: ${options.session_id}`
              : `Session not found: ${options.session_id}`,
          },
        ],
      };
    } catch (error) {
      throw this.formatError(error, 'clear session');
    }
  }

  private async listSessions() {
    try {
      // Return locally stored sessions
      const sessions = Array.from(this.sessions.entries()).map(([id, info]) => {
        const ageMinutes = Math.floor((Date.now() - info.created_at.getTime()) / 60000);
        const lastUsedMinutes = Math.floor((Date.now() - info.last_used.getTime()) / 60000);

        return {
          session_id: id,
          created_at: info.created_at.toISOString(),
          last_used: info.last_used.toISOString(),
          age_minutes: ageMinutes,
          last_used_minutes_ago: lastUsedMinutes,
          initial_url: info.initial_url,
          browser_type: info.metadata?.browser_type || 'chromium',
        };
      });

      if (sessions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No active sessions found.',
            },
          ],
        };
      }

      const sessionList = sessions
        .map(
          (session) =>
            `- ${session.session_id} (${session.browser_type}, created ${session.age_minutes}m ago, last used ${session.last_used_minutes_ago}m ago)`,
        )
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Active sessions (${sessions.length}):\n${sessionList}`,
          },
        ],
      };
    } catch (error) {
      throw this.formatError(error, 'list sessions');
    }
  }
}
