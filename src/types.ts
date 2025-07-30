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
  js_code: string;
  wait_after_js?: number;
  screenshot?: boolean;
}

export interface BatchCrawlOptions extends CrawlOptions {
  urls: string[];
  max_concurrent?: number;
}
