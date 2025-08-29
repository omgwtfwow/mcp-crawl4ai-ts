import { z } from 'zod';
import { validateJavaScriptCode, createStatelessSchema } from './helpers.js';

export const JsCodeSchema = z
  .union([
    z.string().refine(validateJavaScriptCode, {
      message:
        'Invalid JavaScript: Contains HTML entities (&quot;), literal \\n outside strings, or HTML tags. Use proper JS syntax with real quotes and newlines.',
    }),
    z.array(
      z.string().refine(validateJavaScriptCode, {
        message:
          'Invalid JavaScript: Contains HTML entities (&quot;), literal \\n outside strings, or HTML tags. Use proper JS syntax with real quotes and newlines.',
      }),
    ),
  ])
  .describe('JavaScript code as string or array of strings');

export const VirtualScrollConfigSchema = z.object({
  container_selector: z.string(),
  scroll_count: z.number().optional(),
  scroll_by: z.union([z.string(), z.number()]).optional(),
  wait_after_scroll: z.number().optional(),
});

const GetMarkdownBaseSchema = z.object({
  url: z.string().url(),
  filter: z.enum(['raw', 'fit', 'bm25', 'llm']).optional().default('fit'),
  query: z.string().optional(),
  cache: z.string().optional().default('0'),
});

export const GetMarkdownSchema = createStatelessSchema(GetMarkdownBaseSchema, 'get_markdown').refine(
  (data) => {
    // If filter is bm25 or llm, query is required
    if ((data.filter === 'bm25' || data.filter === 'llm') && !data.query) {
      return false;
    }
    return true;
  },
  {
    message: 'Query parameter is required when using bm25 or llm filter',
    path: ['query'],
  },
);

export const ExecuteJsSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    scripts: JsCodeSchema,
  }),
  'execute_js',
);

export const GetHtmlSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
  }),
  'get_html',
);

export const CaptureScreenshotSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    screenshot_wait_for: z.number().optional(),
    save_to_directory: z.string().optional().describe('Local directory to save screenshot file'),
    // output_path not exposed as MCP needs base64 data
  }),
  'capture_screenshot',
);

export const GeneratePdfSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    // Only url is supported - output_path not exposed as MCP needs base64 data
  }),
  'generate_pdf',
);

export const ExtractWithLlmSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    query: z.string(),
  }),
  'extract_with_llm',
);

export const BatchCrawlSchema = createStatelessSchema(
  z.object({
    urls: z.array(z.string().url()),
    max_concurrent: z.number().optional(),
    remove_images: z.boolean().optional(),
    bypass_cache: z.boolean().optional(),
  }),
  'batch_crawl',
);

export const SmartCrawlSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    max_depth: z.number().optional(),
    follow_links: z.boolean().optional(),
    bypass_cache: z.boolean().optional(),
  }),
  'smart_crawl',
);

export const ExtractLinksSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    categorize: z.boolean().optional().default(true),
  }),
  'extract_links',
);

export const CrawlRecursiveSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    max_depth: z.number().optional(),
    max_pages: z.number().optional(),
    include_pattern: z.string().optional(),
    exclude_pattern: z.string().optional(),
  }),
  'crawl_recursive',
);

export const ParseSitemapSchema = createStatelessSchema(
  z.object({
    url: z.string().url(),
    filter_pattern: z.string().optional(),
  }),
  'parse_sitemap',
);

// Unified session management schema
export const ManageSessionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    session_id: z.string().optional(),
    initial_url: z.string().url().optional(),
    browser_type: z.enum(['chromium', 'firefox', 'webkit']).optional(),
  }),
  z.object({
    action: z.literal('clear'),
    session_id: z.string(),
  }),
  z.object({
    action: z.literal('list'),
  }),
]);

export const CrawlSchema = z
  .object({
    url: z.string().url(),

    // Browser configuration
    browser_type: z.enum(['chromium', 'firefox', 'webkit']).optional(),
    viewport_width: z.number().optional(),
    viewport_height: z.number().optional(),
    user_agent: z.string().optional(),
    proxy_server: z.string().optional(),
    proxy_username: z.string().optional(),
    proxy_password: z.string().optional(),
    cookies: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
          domain: z.string(),
          path: z.string().optional(),
        }),
      )
      .optional(),
    headers: z.record(z.string()).optional(),
    extra_args: z.array(z.string()).optional(),

    // Content filtering
    word_count_threshold: z.number().optional(),
    excluded_tags: z.array(z.string()).optional(),
    excluded_selector: z.string().optional(),
    remove_overlay_elements: z.boolean().optional(),
    only_text: z.boolean().optional(),
    remove_forms: z.boolean().optional(),
    keep_data_attributes: z.boolean().optional(),

    // JavaScript execution
    js_code: JsCodeSchema.optional(),
    js_only: z.boolean().optional(),
    wait_for: z.string().optional(),
    wait_for_timeout: z.number().optional(),

    // Page navigation & timing
    wait_until: z.enum(['domcontentloaded', 'networkidle', 'load']).optional(),
    page_timeout: z.number().optional(),
    wait_for_images: z.boolean().optional(),
    ignore_body_visibility: z.boolean().optional(),

    // Dynamic content
    delay_before_scroll: z.number().optional(),
    scroll_delay: z.number().optional(),
    scan_full_page: z.boolean().optional(),
    virtual_scroll_config: VirtualScrollConfigSchema.optional(),

    // Content processing
    process_iframes: z.boolean().optional(),
    exclude_external_links: z.boolean().optional(),

    // Media handling
    screenshot: z.boolean().optional(),
    screenshot_wait_for: z.number().optional(),
    screenshot_directory: z
      .string()
      .optional()
      .describe('Local directory to save screenshot file when screenshot=true'),
    pdf: z.boolean().optional(),
    capture_mhtml: z.boolean().optional(),
    image_description_min_word_threshold: z.number().optional(),
    image_score_threshold: z.number().optional(),
    exclude_external_images: z.boolean().optional(),

    // Link filtering
    exclude_social_media_links: z.boolean().optional(),
    exclude_domains: z.array(z.string()).optional(),

    // Page interaction
    simulate_user: z.boolean().optional(),
    override_navigator: z.boolean().optional(),
    magic: z.boolean().optional(),

    // Session and cache
    session_id: z.string().optional(),
    cache_mode: z.enum(['ENABLED', 'BYPASS', 'DISABLED']).optional(),

    // Performance options
    timeout: z.number().optional(),
    verbose: z.boolean().optional(),

    // Debug
    log_console: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // js_only is for subsequent calls in same session, not first call
      // Using it incorrectly causes server errors
      if (data.js_only && !data.session_id) {
        return false;
      }
      return true;
    },
    {
      message:
        "Error: js_only requires session_id (it's for continuing existing sessions).\n" +
        'For first call with js_code, use: {js_code: [...], screenshot: true}\n' +
        'For multi-step: First {js_code: [...], session_id: "x"}, then {js_only: true, session_id: "x"}',
    },
  )
  .refine(
    (data) => {
      // Empty js_code array is not allowed
      if (Array.isArray(data.js_code) && data.js_code.length === 0) {
        return false;
      }
      return true;
    },
    {
      message:
        'Error: js_code array cannot be empty. Either provide JavaScript code to execute or remove the js_code parameter entirely.',
    },
  );

// Re-export types we need
export type { z };
