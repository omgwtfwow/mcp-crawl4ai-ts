export interface CrawlOptions {
  remove_images?: boolean;
  bypass_cache?: boolean;
  filter_mode?: 'blacklist' | 'whitelist';
  filter_list?: string[];
  screenshot?: boolean;
  wait_for?: string;
  timeout?: number;
}

export interface JSExecuteOptions {
  js_code: string | string[];
  // Only url and js_code (scripts) are supported by /execute_js endpoint
}

export interface JSExecuteEndpointOptions {
  url: string;
  scripts: string | string[];
  // Only url and scripts are supported by /execute_js endpoint
}

export interface JSExecuteEndpointResponse {
  success: boolean;
  js_execution_result: {
    success: boolean;
    results: any[];
  };
  markdown?: string;
}

export interface ScreenshotEndpointOptions {
  url: string;
  screenshot_wait_for?: number;
  // output_path is omitted to get base64 response
}

export interface ScreenshotEndpointResponse {
  success: boolean;
  screenshot: string; // base64 encoded image
}

export interface PDFEndpointOptions {
  url: string;
  // Only url is supported by /pdf endpoint
}

export interface PDFEndpointResponse {
  success: boolean;
  pdf: string; // base64 encoded PDF
}

export interface HTMLEndpointOptions {
  url: string;
  // Only url is supported by /html endpoint
}

export interface HTMLEndpointResponse {
  html: string;
  url: string;
  success: boolean;
}

export type FilterType = 'raw' | 'fit' | 'bm25' | 'llm';

export interface MarkdownEndpointOptions {
  url: string;
  f?: FilterType; // Filter type: raw, fit (default), bm25, llm
  q?: string; // Query string for bm25/llm filters
  c?: string; // Cache-bust parameter
}

export interface MarkdownEndpointResponse {
  url: string;
  filter: string;
  query: string | null;
  cache: string;
  markdown: string;
  success: boolean;
}

export interface LLMEndpointOptions {
  url: string;
  query: string;
}

export interface LLMEndpointResponse {
  answer: string;
}

export interface BatchCrawlOptions extends CrawlOptions {
  urls: string[];
  max_concurrent?: number;
}

// Browser configuration options
export interface BrowserConfig {
  browser_type?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  viewport_width?: number;
  viewport_height?: number;
  user_agent?: string;
  proxy_config?: {
    server: string;
    username?: string;
    password?: string;
  };
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path?: string;
  }>;
  headers?: Record<string, string>;
  extra_args?: string[];
}

// Virtual scroll configuration for sites like Twitter/Instagram
export interface VirtualScrollConfig {
  container_selector: string;
  scroll_count?: number;
  scroll_by?: string | number;
  wait_after_scroll?: number;
}

// Crawler configuration options
export interface CrawlerConfig {
  // Content filtering
  word_count_threshold?: number;
  excluded_tags?: string[];
  excluded_selector?: string;
  remove_overlay_elements?: boolean;
  only_text?: boolean;
  remove_forms?: boolean;
  keep_data_attributes?: boolean;

  // JavaScript execution
  js_code?: string | string[];
  js_only?: boolean;
  wait_for?: string;
  wait_for_timeout?: number;

  // Page navigation & timing
  wait_until?: 'domcontentloaded' | 'networkidle' | 'load';
  page_timeout?: number;
  wait_for_images?: boolean;
  ignore_body_visibility?: boolean;

  // Dynamic content handling
  delay_before_scroll?: number;
  scroll_delay?: number;
  scan_full_page?: boolean;
  virtual_scroll_config?: VirtualScrollConfig;

  // Content processing
  process_iframes?: boolean;
  exclude_external_links?: boolean;

  // Media handling
  screenshot?: boolean;
  screenshot_wait_for?: number;
  pdf?: boolean;
  capture_mhtml?: boolean;
  image_description_min_word_threshold?: number;
  image_score_threshold?: number;
  exclude_external_images?: boolean;

  // Link filtering
  exclude_social_media_links?: boolean;
  exclude_domains?: string[];

  // Page interaction
  simulate_user?: boolean;
  override_navigator?: boolean;
  magic?: boolean;

  // Session management
  session_id?: string;

  // Cache control
  cache_mode?: 'ENABLED' | 'BYPASS' | 'DISABLED';

  // Performance options
  timeout?: number;
  verbose?: boolean;

  // Debug
  log_console?: boolean;
}

// Advanced crawl configuration combining browser and crawler configs
export interface AdvancedCrawlConfig {
  url?: string;
  urls?: string[];
  browser_config?: BrowserConfig;
  crawler_config?: CrawlerConfig;
  priority?: number;
}

// Session management types (used internally by MCP server)
export interface SessionInfo {
  id: string;
  created_at: Date;
  last_used: Date;
  initial_url?: string;
  metadata?: Record<string, any>;
}

// Crawl endpoint types
export interface CrawlEndpointOptions {
  urls: string[];
  browser_config?: BrowserConfig;
  crawler_config?: CrawlerConfig;
}

export interface CrawlMarkdownResult {
  raw_markdown: string;
  markdown_with_citations: string;
  references_markdown: string;
  fit_markdown: string;
  fit_html: string;
}

export interface CrawlMediaResult {
  images: Array<{
    src?: string | null;
    data?: string;
    alt?: string | null;
    desc?: string;
    score?: number;
    type?: string;
    group_id?: number;
    format?: string | null;
    width?: number | null;
  }>;
  videos: Array<{
    src?: string | null;
    data?: string;
    alt?: string | null;
    desc?: string;
    score?: number;
    type?: string;
    group_id?: number;
    format?: string | null;
    width?: number | null;
  }>;
  audios: Array<{
    src?: string | null;
    data?: string;
    alt?: string | null;
    desc?: string;
    score?: number;
    type?: string;
    group_id?: number;
    format?: string | null;
    width?: number | null;
  }>;
}

export interface CrawlLinksResult {
  internal: Array<{
    href: string;
    text: string;
    title: string;
    base_domain?: string | null;
    head_data?: any | null;
    head_extraction_status?: string | null;
    head_extraction_error?: string | null;
    intrinsic_score?: number;
    contextual_score?: number | null;
    total_score?: number | null;
  }>;
  external: Array<{
    href: string;
    text: string;
    title: string;
    base_domain?: string | null;
    head_data?: any | null;
    head_extraction_status?: string | null;
    head_extraction_error?: string | null;
    intrinsic_score?: number;
    contextual_score?: number | null;
    total_score?: number | null;
  }>;
}

export interface CrawlResultItem {
  url: string;
  html: string;
  cleaned_html: string;
  fit_html: string;
  success: boolean;
  error_message?: string;
  status_code: number;
  response_headers: Record<string, any>;
  redirected_url?: string;
  session_id: string | null;
  metadata: Record<string, any>;
  links: CrawlLinksResult;
  media: CrawlMediaResult;
  markdown: CrawlMarkdownResult;
  tables: any[];
  extracted_content: any | null;
  screenshot: string | null; // base64 PNG when screenshot: true
  pdf: string | null; // base64 PDF when pdf: true
  mhtml: string | null;
  js_execution_result: {
    success: boolean;
    results: any[];
  } | null;
  downloaded_files: any | null;
  network_requests: any | null;
  console_messages: any | null;
  ssl_certificate: any | null;
  dispatch_result: any | null;
}

export interface CrawlEndpointResponse {
  success: boolean;
  results: CrawlResultItem[];
  server_processing_time_s: number;
  server_memory_delta_mb: number;
  server_peak_memory_mb: number;
}
