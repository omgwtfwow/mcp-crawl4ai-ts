/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestClient, cleanupTestClient, expectSuccessfulCrawl, TEST_TIMEOUTS } from './test-utils.js';

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}

describe('crawl Advanced Features Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
  }, TEST_TIMEOUTS.medium);

  afterAll(async () => {
    if (client) {
      await cleanupTestClient(client);
    }
  });

  describe('Media and Content Extraction', () => {
    it(
      'should extract images with scoring',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://example.com',
            image_score_threshold: 3,
            exclude_external_images: false,
            cache_mode: 'BYPASS',
          },
        });

        await expectSuccessfulCrawl(result);
        const textContent = (result as ToolResult).content.find((c) => c.type === 'text');
        expect(textContent?.text).toBeTruthy();
        // Should have extracted content
        expect(textContent?.text).toContain('Example Domain');
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should capture MHTML',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://example.com',
            capture_mhtml: true,
            cache_mode: 'BYPASS',
          },
        });

        await expectSuccessfulCrawl(result);
        const textContent = (result as ToolResult).content.find((c) => c.type === 'text');
        expect(textContent?.text).toBeTruthy();
        // MHTML should be captured but not in the text output
        expect(textContent?.text).toContain('Example Domain');
      },
      TEST_TIMEOUTS.long,
    );

    it(
      'should extract tables from Wikipedia',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://en.wikipedia.org/wiki/List_of_countries_by_population_(United_Nations)',
            word_count_threshold: 10,
            cache_mode: 'BYPASS',
          },
        });

        await expectSuccessfulCrawl(result);
        const textContent = (result as ToolResult).content.find((c) => c.type === 'text');
        expect(textContent?.text).toBeTruthy();
        // Should contain country data
        expect(textContent?.text).toMatch(/China|India|United States/);
      },
      TEST_TIMEOUTS.long,
    );
  });

  describe('Link and Content Filtering', () => {
    it(
      'should exclude social media links',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://www.bbc.com/news',
            exclude_social_media_links: true,
            exclude_domains: ['twitter.com', 'facebook.com', 'instagram.com'],
            cache_mode: 'BYPASS',
            word_count_threshold: 50,
          },
        });

        await expectSuccessfulCrawl(result);
        const textContent = (result as ToolResult).content.find((c) => c.type === 'text');
        expect(textContent?.text).toBeTruthy();
        // Should have news content but no social media references in extracted links
        expect(textContent?.text).toContain('BBC');
      },
      TEST_TIMEOUTS.long,
    );

    it(
      'should remove excluded selectors',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://httpbin.org/html',
            excluded_selector: 'div:first-child',
            cache_mode: 'BYPASS',
          },
        });

        await expectSuccessfulCrawl(result);
      },
      TEST_TIMEOUTS.medium,
    );
  });

  describe('Page Navigation Options', () => {
    it(
      'should wait for images to load',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://httpbin.org/image/png',
            wait_for_images: true,
            wait_until: 'load',
            page_timeout: 30000,
            cache_mode: 'BYPASS',
          },
        });

        await expectSuccessfulCrawl(result);
      },
      TEST_TIMEOUTS.medium,
    );

    it(
      'should scan full page',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://httpbin.org/html',
            scan_full_page: true,
            delay_before_scroll: 0.5,
            scroll_delay: 0.2,
            cache_mode: 'BYPASS',
          },
        });

        await expectSuccessfulCrawl(result);
      },
      TEST_TIMEOUTS.medium,
    );
  });

  describe('Stealth and Bot Detection', () => {
    it(
      'should use magic mode',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://httpbin.org/headers',
            magic: true,
            simulate_user: true,
            override_navigator: true,
            cache_mode: 'BYPASS',
          },
        });

        await expectSuccessfulCrawl(result);
      },
      TEST_TIMEOUTS.long,
    );
  });

  describe('Extraction Strategies (0.7.3/0.7.4)', () => {
    it(
      'should accept extraction_strategy parameter',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://httpbin.org/html',
            extraction_strategy: {
              type: 'custom',
              provider: 'openai',
              api_key: 'test-key',
              model: 'gpt-4',
            },
            cache_mode: 'BYPASS',
          },
        });

        // The parameter should be accepted even if not fully processed
        await expectSuccessfulCrawl(result);
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should accept table_extraction_strategy parameter',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://httpbin.org/html',
            table_extraction_strategy: {
              enable_chunking: true,
              thresholds: {
                min_rows: 5,
                max_columns: 20,
              },
            },
            cache_mode: 'BYPASS',
          },
        });

        await expectSuccessfulCrawl(result);
      },
      TEST_TIMEOUTS.short,
    );

    it(
      'should accept markdown_generator_options parameter',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://httpbin.org/html',
            markdown_generator_options: {
              include_links: true,
              preserve_formatting: true,
            },
            cache_mode: 'BYPASS',
          },
        });

        await expectSuccessfulCrawl(result);
      },
      TEST_TIMEOUTS.short,
    );
  });

  describe('Virtual Scroll', () => {
    it(
      'should handle virtual scroll configuration',
      async () => {
        const result = await client.callTool({
          name: 'crawl',
          arguments: {
            url: 'https://httpbin.org/html',
            virtual_scroll_config: {
              container_selector: 'body',
              scroll_count: 3,
              scroll_by: 'container_height',
              wait_after_scroll: 0.5,
            },
            cache_mode: 'BYPASS',
          },
        });

        await expectSuccessfulCrawl(result);
      },
      TEST_TIMEOUTS.medium,
    );
  });
});
