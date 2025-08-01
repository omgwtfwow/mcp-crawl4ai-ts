export interface CrawlOptions {
  remove_images?: boolean;
  bypass_cache?: boolean;
  filter_mode?: 'blacklist' | 'whitelist';
  filter_list?: string[];
  screenshot?: boolean;
  wait_for?: string;
  timeout?: number;
}

export interface CrawlResult {
  markdown?: string;
  html?: string;
  screenshot?: string;
  pdf?: string;
  metadata?: {
    title?: string;
    description?: string;
    url?: string;
    error?: string;
  };
  links?: {
    internal: string[];
    external: string[];
  };
}

export interface JSExecuteOptions {
  js_code: string | string[];
  wait_after_js?: number;
  screenshot?: boolean;
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
  extraction_strategy?: string; // e.g., 'LLMExtractionStrategy', 'JsonCssExtractionStrategy'
  extraction_strategy_args?: Record<string, any>; // Strategy-specific arguments
}

// Session management types (used internally by MCP server)
export interface SessionInfo {
  id: string;
  created_at: Date;
  last_used: Date;
  initial_url?: string;
  metadata?: Record<string, any>;
}
