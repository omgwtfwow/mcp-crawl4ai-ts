/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

describe('crawl_recursive Integration Tests', () => {
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
      'should crawl a site recursively with default settings',
      async () => {
        const result = await client.callTool({
          name: 'crawl_recursive',
          arguments: {
            url: 'https://httpbin.org/links/5/0',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toBeDefined();
        expect(Array.isArray(content)).toBe(true);
        expect(content.length).toBeGreaterThan(0);

        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Recursive crawl completed');
        expect(textContent?.text).toContain('Pages crawled:');
        expect(textContent?.text).toContain('Max depth reached:');
        expect(textContent?.text).toContain('Only internal links');
        // Should have found multiple pages since httpbin.org/links/5/0 has internal links
        expect(textContent?.text).toMatch(/Pages crawled: [2-9]|[1-9][0-9]/);
      },
      TEST_TIMEOUTS.long,
    );

    it(
      'should respect max_depth parameter',
      async () => {
        const result = await client.callTool({
          name: 'crawl_recursive',
          arguments: {
            url: 'https://httpbin.org/links/10/0',
            max_depth: 1,
            max_pages: 5,
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Max depth reached: ');
        expect(textContent?.text).toMatch(/Max depth reached: [0-1] \(limit: 1\)/);
        // With max_depth=1, should find some pages but not go too deep
        expect(textContent?.text).toMatch(/Pages crawled: [1-5]/);
      },
      TEST_TIMEOUTS.long,
    );

    it(
      'should apply include pattern filter',
      async () => {
        const result = await client.callTool({
          name: 'crawl_recursive',
          arguments: {
            url: 'https://httpbin.org/links/10/0',
            max_depth: 1,
            max_pages: 5,
            include_pattern: '.*/links/[0-9]+/[0-4]$', // Only include links ending with 0-4
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();

        // Check that we have some results
        expect(textContent?.text).toContain('Pages crawled:');

        // If we crawled pages, they should match our pattern
        if (textContent?.text && textContent.text.includes('Pages found:')) {
          const pagesSection = textContent.text.split('Pages found:')[1];
          if (pagesSection && pagesSection.trim()) {
            // All URLs should end with /0, /1, /2, /3, or /4
            expect(pagesSection).toMatch(/\/[0-4]\b/);
            // Should NOT have URLs ending with /5, /6, /7, /8, /9
            expect(pagesSection).not.toMatch(/\/[5-9]\b/);
          }
        }
      },
      TEST_TIMEOUTS.long,
    );

    it(
      'should apply exclude pattern filter',
      async () => {
        const result = await client.callTool({
          name: 'crawl_recursive',
          arguments: {
            url: 'https://example.com',
            max_depth: 2,
            max_pages: 10,
            exclude_pattern: '.*\\.(pdf|zip|exe)$',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();

        // Should not have crawled any PDF, ZIP, or EXE files
        expect(textContent?.text).not.toMatch(/\.(pdf|zip|exe)/i);
      },
      TEST_TIMEOUTS.long,
    );
  });

  describe('Error handling', () => {
    it(
      'should handle invalid URLs',
      async () => {
        const result = await client.callTool({
          name: 'crawl_recursive',
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
      'should handle sites with internal links',
      async () => {
        const result = await client.callTool({
          name: 'crawl_recursive',
          arguments: {
            url: 'https://httpbin.org/links/5/0',
            max_depth: 2,
            max_pages: 10,
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Pages crawled:');
        // Should crawl multiple pages since httpbin.org/links/5/0 has 5 internal links
        expect(textContent?.text).toMatch(/Pages crawled: [2-9]|1[0-9]/);
        expect(textContent?.text).toContain('Internal links found:');
      },
      TEST_TIMEOUTS.medium,
    );
  });
});
