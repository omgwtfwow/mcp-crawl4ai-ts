/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

describe('parse_sitemap Integration Tests', () => {
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
      'should parse nodejs.org sitemap successfully',
      async () => {
        const result = await client.callTool({
          name: 'parse_sitemap',
          arguments: {
            url: 'https://nodejs.org/sitemap.xml',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        expect(content).toBeDefined();
        expect(Array.isArray(content)).toBe(true);
        expect(content.length).toBeGreaterThan(0);

        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Sitemap parsed successfully');
        expect(textContent?.text).toContain('Total URLs found:');
        expect(textContent?.text).toContain('https://nodejs.org');
        
        // Should find many URLs in the nodejs sitemap
        expect(textContent?.text).toMatch(/Total URLs found: [1-9][0-9]+/);
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should filter URLs with regex pattern',
      async () => {
        const result = await client.callTool({
          name: 'parse_sitemap',
          arguments: {
            url: 'https://nodejs.org/sitemap.xml',
            filter_pattern: '.*/learn/.*',  // Only URLs containing /learn/
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        
        // Check that filtering worked
        expect(textContent?.text).toContain('Filtered URLs:');
        
        // All URLs in the result should contain /learn/
        const urlsSection = textContent?.text?.split('URLs:\n')[1];
        if (urlsSection) {
          const urls = urlsSection.split('\n').filter(url => url.trim());
          urls.forEach(url => {
            if (url && !url.includes('... and')) {
              expect(url).toContain('/learn/');
            }
          });
        }
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle empty sitemaps',
      async () => {
        // Using a URL that returns valid XML but not a sitemap
        const result = await client.callTool({
          name: 'parse_sitemap',
          arguments: {
            url: 'https://www.w3schools.com/xml/note.xml',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Total URLs found: 0');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle large sitemaps with truncation',
      async () => {
        const result = await client.callTool({
          name: 'parse_sitemap',
          arguments: {
            url: 'https://nodejs.org/sitemap.xml',
            filter_pattern: '.*',  // Match all to test truncation
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        
        // Should show max 100 URLs and indicate there are more
        if (textContent?.text && textContent.text.includes('... and')) {
          expect(textContent.text).toMatch(/\.\.\. and \d+ more/);
        }
      },
      TEST_TIMEOUTS.medium,
    );
  });

  describe('Error handling', () => {
    it(
      'should handle invalid URLs',
      async () => {
        const result = await client.callTool({
          name: 'parse_sitemap',
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
      'should handle non-existent URLs',
      async () => {
        const result = await client.callTool({
          name: 'parse_sitemap',
          arguments: {
            url: 'https://this-domain-definitely-does-not-exist-12345.com/sitemap.xml',
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Error');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle non-XML content',
      async () => {
        const result = await client.callTool({
          name: 'parse_sitemap',
          arguments: {
            url: 'https://example.com',  // HTML page, not XML
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        // Should still parse but likely find 0 URLs since it's not a sitemap
        expect(textContent?.text).toContain('Total URLs found:');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should handle invalid regex patterns',
      async () => {
        const result = await client.callTool({
          name: 'parse_sitemap',
          arguments: {
            url: 'https://nodejs.org/sitemap.xml',
            filter_pattern: '[invalid(regex',  // Invalid regex
          },
        });

        expect(result).toBeDefined();
        const content = (result as ToolResult).content;
        const textContent = content.find((c) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent?.text).toContain('Error');
        expect(textContent?.text?.toLowerCase()).toMatch(/failed|error|invalid/);
      },
      TEST_TIMEOUTS.medium,
    );
  });
});