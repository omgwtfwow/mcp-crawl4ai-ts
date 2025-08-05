import { jest } from '@jest/globals';
import { CrawlHandlers } from '../../handlers/crawl-handlers.js';
import { ContentHandlers } from '../../handlers/content-handlers.js';

type MockService = {
  crawl: jest.Mock;
  getMarkdown: jest.Mock;
  captureScreenshot: jest.Mock;
};

type MockAxiosClient = {
  post: jest.Mock;
  get: jest.Mock;
  head: jest.Mock;
};

describe('Optional Parameter Combinations', () => {
  let crawlHandlers: CrawlHandlers;
  let _contentHandlers: ContentHandlers;
  let mockService: MockService;
  let mockAxiosClient: MockAxiosClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockService = {
      crawl: jest.fn(),
      getMarkdown: jest.fn(),
      captureScreenshot: jest.fn(),
    };

    mockAxiosClient = {
      post: jest.fn(),
      get: jest.fn(),
      head: jest.fn(),
    };

    crawlHandlers = new CrawlHandlers(mockService, mockAxiosClient, new Map());
    _contentHandlers = new ContentHandlers(mockService, mockAxiosClient, new Map());
  });

  describe('Batch Crawl Parameter Combinations', () => {
    const testCases = [
      {
        name: 'default parameters only',
        options: { urls: ['https://example.com'] },
        expectedConfig: undefined,
      },
      {
        name: 'remove_images only',
        options: { urls: ['https://example.com'], remove_images: true },
        expectedConfig: { exclude_tags: ['img', 'picture', 'svg'] },
      },
      {
        name: 'bypass_cache only',
        options: { urls: ['https://example.com'], bypass_cache: true },
        expectedConfig: { cache_mode: 'BYPASS' },
      },
      {
        name: 'both remove_images and bypass_cache',
        options: { urls: ['https://example.com'], remove_images: true, bypass_cache: true },
        expectedConfig: { exclude_tags: ['img', 'picture', 'svg'], cache_mode: 'BYPASS' },
      },
      {
        name: 'with max_concurrent',
        options: { urls: ['https://example.com'], max_concurrent: 5, remove_images: true },
        expectedConfig: { exclude_tags: ['img', 'picture', 'svg'] },
      },
    ];

    testCases.forEach(({ name, options, expectedConfig }) => {
      it(`should handle ${name}`, async () => {
        mockAxiosClient.post.mockResolvedValue({
          data: { results: [{ success: true }] },
        });

        await crawlHandlers.batchCrawl(options);

        expect(mockAxiosClient.post).toHaveBeenCalledWith('/crawl', {
          urls: options.urls,
          max_concurrent: options.max_concurrent,
          crawler_config: expectedConfig,
        });
      });
    });
  });

  describe('Smart Crawl Parameter Combinations', () => {
    const testCases = [
      {
        name: 'minimal configuration',
        options: { url: 'https://example.com' },
        expectedCacheMode: 'ENABLED',
      },
      {
        name: 'with bypass_cache',
        options: { url: 'https://example.com', bypass_cache: true },
        expectedCacheMode: 'BYPASS',
      },
      {
        name: 'with max_depth',
        options: { url: 'https://example.com', max_depth: 5 },
        expectedCacheMode: 'ENABLED',
      },
      {
        name: 'with follow_links and bypass_cache',
        options: { url: 'https://example.com', follow_links: true, bypass_cache: true },
        expectedCacheMode: 'BYPASS',
      },
    ];

    testCases.forEach(({ name, options, expectedCacheMode }) => {
      it(`should handle ${name}`, async () => {
        mockAxiosClient.head.mockResolvedValue({ headers: { 'content-type': 'text/html' } });
        mockAxiosClient.post.mockResolvedValue({
          data: { results: [{ success: true, markdown: { raw_markdown: 'Content' } }] },
        });

        await crawlHandlers.smartCrawl(options);

        expect(mockAxiosClient.post).toHaveBeenCalledWith('/crawl', {
          urls: [options.url],
          crawler_config: {
            cache_mode: expectedCacheMode,
          },
          browser_config: {
            headless: true,
            browser_type: 'chromium',
          },
        });
      });
    });
  });

  describe('Crawl Parameter Combinations', () => {
    // Table-driven tests for various parameter combinations
    const parameterSets = [
      // Browser configuration combinations
      {
        name: 'browser type with viewport',
        params: {
          url: 'https://example.com',
          browser_type: 'firefox',
          viewport_width: 1920,
          viewport_height: 1080,
        },
      },
      {
        name: 'proxy with authentication',
        params: {
          url: 'https://example.com',
          proxy_server: 'http://proxy.example.com:8080',
          proxy_username: 'user',
          proxy_password: 'pass',
        },
      },
      {
        name: 'cookies and headers',
        params: {
          url: 'https://example.com',
          cookies: [{ name: 'session', value: '123', domain: '.example.com' }],
          headers: { 'X-Custom': 'value', Authorization: 'Bearer token' },
        },
      },
      // Content filtering combinations
      {
        name: 'content filtering options',
        params: {
          url: 'https://example.com',
          word_count_threshold: 100,
          excluded_tags: ['script', 'style'],
          remove_overlay_elements: true,
        },
      },
      {
        name: 'text-only with form removal',
        params: {
          url: 'https://example.com',
          only_text: true,
          remove_forms: true,
          keep_data_attributes: false,
        },
      },
      // JavaScript execution combinations
      {
        name: 'js_code with wait conditions',
        params: {
          url: 'https://example.com',
          js_code: ['document.querySelector("button").click()'],
          wait_for: '#result',
          wait_for_timeout: 5000,
        },
      },
      {
        name: 'js_only with session',
        params: {
          url: 'https://example.com',
          js_only: true,
          session_id: 'test-session-123',
        },
      },
      // Dynamic content handling
      {
        name: 'scrolling configuration',
        params: {
          url: 'https://example.com',
          delay_before_scroll: 2000,
          scroll_delay: 500,
          scan_full_page: true,
        },
      },
      {
        name: 'virtual scroll for infinite feeds',
        params: {
          url: 'https://example.com',
          virtual_scroll_config: {
            container_selector: '.feed',
            scroll_count: 10,
            scroll_by: 500,
            wait_after_scroll: 1000,
          },
        },
      },
      // Media handling combinations
      {
        name: 'screenshot with PDF',
        params: {
          url: 'https://example.com',
          screenshot: true,
          screenshot_wait_for: 3,
          pdf: true,
          capture_mhtml: true,
        },
      },
      {
        name: 'image filtering options',
        params: {
          url: 'https://example.com',
          image_description_min_word_threshold: 10,
          image_score_threshold: 0.5,
          exclude_external_images: true,
        },
      },
      // Link filtering combinations
      {
        name: 'link exclusion options',
        params: {
          url: 'https://example.com',
          exclude_social_media_links: true,
          exclude_domains: ['facebook.com', 'twitter.com'],
          exclude_external_links: true,
        },
      },
      // Page interaction combinations
      {
        name: 'stealth mode options',
        params: {
          url: 'https://example.com',
          simulate_user: true,
          override_navigator: true,
          magic: true,
          user_agent: 'Custom Bot 1.0',
        },
      },
      // Complex combinations
      {
        name: 'kitchen sink - many options',
        params: {
          url: 'https://example.com',
          browser_type: 'chromium',
          viewport_width: 1280,
          viewport_height: 720,
          word_count_threshold: 50,
          excluded_tags: ['nav', 'footer'],
          js_code: ['window.scrollTo(0, document.body.scrollHeight)'],
          wait_for: '.loaded',
          screenshot: true,
          exclude_external_links: true,
          session_id: 'complex-session',
          cache_mode: 'BYPASS',
          verbose: true,
        },
      },
    ];

    parameterSets.forEach(({ name, params }) => {
      it(`should correctly process ${name}`, async () => {
        mockService.crawl.mockResolvedValue({
          results: [
            {
              url: params.url,
              success: true,
              markdown: { raw_markdown: 'Test content' },
            },
          ],
        });

        const result = await crawlHandlers.crawl(params);

        // Verify the service was called
        expect(mockService.crawl).toHaveBeenCalled();

        // Verify response structure
        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe('text');
      });
    });

    // Test parameter validation
    it('should handle invalid parameter combinations', async () => {
      const invalidParams = {
        url: 'https://example.com',
        js_only: true,
        // Missing required session_id when js_only is true
      };

      await expect(crawlHandlers.crawl(invalidParams)).rejects.toThrow();
    });

    // Test default values
    it('should apply correct defaults when parameters are omitted', async () => {
      mockService.crawl.mockResolvedValue({
        results: [
          {
            url: 'https://example.com',
            success: true,
            markdown: { raw_markdown: 'Content' },
          },
        ],
      });

      await crawlHandlers.crawl({ url: 'https://example.com' });

      const call = mockService.crawl.mock.calls[0][0];

      // Check browser_config defaults
      expect(call.browser_config).toBeDefined();
      expect(call.browser_config.headless).toBe(true);

      // Check that optional configs are not included when not specified
      expect(call.crawler_config.word_count_threshold).toBeUndefined();
      expect(call.crawler_config.excluded_tags).toBeUndefined();
    });
  });

  describe('Parameter Priority and Conflicts', () => {
    it('should handle conflicting cache modes correctly', async () => {
      mockService.crawl.mockResolvedValue({
        results: [{ success: true, markdown: { raw_markdown: 'Content' } }],
      });

      // Test that explicit cache_mode takes precedence
      await crawlHandlers.crawl({
        url: 'https://example.com',
        cache_mode: 'DISABLED',
        // Even with other params that might suggest caching
        session_id: 'test-session',
      });

      const call = mockService.crawl.mock.calls[0][0];
      expect(call.crawler_config.cache_mode).toBe('DISABLED');
    });

    it('should handle mutually exclusive options', async () => {
      mockService.crawl.mockResolvedValue({
        results: [{ success: true, html: '<p>HTML</p>' }],
      });

      // only_text should override other content options
      await crawlHandlers.crawl({
        url: 'https://example.com',
        only_text: true,
        keep_data_attributes: true, // Should be ignored with only_text
      });

      const call = mockService.crawl.mock.calls[0][0];
      expect(call.crawler_config.only_text).toBe(true);
      expect(call.crawler_config.keep_data_attributes).toBe(true); // Still passed through
    });
  });

  describe('Edge Cases for Optional Parameters', () => {
    it('should handle empty arrays correctly', async () => {
      mockService.crawl.mockResolvedValue({
        results: [{ success: true, markdown: { raw_markdown: 'Content' } }],
      });

      await crawlHandlers.crawl({
        url: 'https://example.com',
        excluded_tags: [], // Empty array
        exclude_domains: [], // Empty array
        cookies: [], // Empty array
      });

      const call = mockService.crawl.mock.calls[0][0];
      expect(call.crawler_config.excluded_tags).toEqual([]);
      expect(call.crawler_config.exclude_domains).toEqual([]);
      expect(call.browser_config.cookies).toEqual([]);
    });

    it('should handle null vs undefined correctly', async () => {
      mockService.crawl.mockResolvedValue({
        results: [{ success: true, markdown: { raw_markdown: 'Content' } }],
      });

      // null js_code should throw error
      await expect(
        crawlHandlers.crawl({
          url: 'https://example.com',
          js_code: null as unknown as string[],
        }),
      ).rejects.toThrow('js_code parameter is null');

      // undefined js_code should be fine
      await crawlHandlers.crawl({
        url: 'https://example.com',
        js_code: undefined,
      });

      expect(mockService.crawl).toHaveBeenCalledTimes(1);
    });

    it('should handle boolean flags in all combinations', async () => {
      const booleanFlags = [
        'remove_overlay_elements',
        'process_iframes',
        'exclude_external_links',
        'screenshot',
        'pdf',
        'verbose',
        'log_console',
        'simulate_user',
        'override_navigator',
        'magic',
      ];

      // Test all flags as true
      const allTrue = booleanFlags.reduce((acc, flag) => ({ ...acc, [flag]: true }), {
        url: 'https://example.com',
      });

      mockService.crawl.mockResolvedValue({
        results: [{ success: true, markdown: { raw_markdown: 'Content' } }],
      });

      await crawlHandlers.crawl(allTrue);

      const call = mockService.crawl.mock.calls[0][0];
      booleanFlags.forEach((flag) => {
        const config = call.crawler_config[flag] || call.browser_config[flag];
        expect(config).toBe(true);
      });
    });
  });
});
