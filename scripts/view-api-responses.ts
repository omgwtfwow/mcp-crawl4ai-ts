#!/usr/bin/env tsx
/**
 * View real API responses and save them to a JSON file for reference
 * Usage: npm run view-mocks
 * 
 * This script helps you understand what the API returns so you can write better tests.
 * The responses are saved to mock-responses.json (gitignored).
 */

/// <reference types="node" />

import { Crawl4AIService } from '../src/crawl4ai-service.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const MOCK_FILE = path.join(process.cwd(), 'src', '__tests__', 'mock-responses.json');

async function captureRealResponses() {
  const baseURL = process.env.CRAWL4AI_BASE_URL || 'https://crawl.in8.io:8443';
  const apiKey = process.env.CRAWL4AI_API_KEY || '';

  if (!apiKey) {
    console.error('❌ CRAWL4AI_API_KEY environment variable is required');
    console.log('Usage: CRAWL4AI_API_KEY=your-key npm run update-mocks');
    process.exit(1);
  }

  console.log('🔄 Capturing real API responses...');
  console.log(`Base URL: ${baseURL}`);

  const service = new Crawl4AIService(baseURL, apiKey);
  const responses: Record<string, any> = {};

  // Capture getMarkdown response
  try {
    console.log('📝 Fetching markdown...');
    const markdown = await service.getMarkdown({ url: 'https://example.com' });
    responses.markdown = {
      default: markdown,
    };
    console.log('✅ Markdown captured');
  } catch (error) {
    console.log('⚠️  Markdown failed:', error.message);
  }

  // Capture captureScreenshot response (basic)
  try {
    console.log('📸 Capturing screenshot...');
    const screenshot = await service.captureScreenshot({ 
      url: 'https://example.com',
      screenshot_wait_for: 2
    });
    // Store only structure, not actual base64 data
    responses.screenshot = {
      success: screenshot.success,
      screenshot: screenshot.screenshot ? 'base64-data-here' : null,
    };
    console.log('✅ Screenshot captured');
  } catch (error) {
    console.log('⚠️  Screenshot failed:', error.message);
  }

  // Capture generatePDF response (basic)
  try {
    console.log('📄 Generating PDF...');
    const pdf = await service.generatePDF({ url: 'https://example.com' });
    // Store only structure, not actual base64 data
    responses.pdf = {
      success: pdf.success,
      pdf: pdf.pdf ? 'base64-pdf-data-here' : null,
    };
    console.log('✅ PDF captured');
  } catch (error) {
    console.log('⚠️  PDF failed:', error.message);
  }

  // Capture getHTML response
  try {
    console.log('🌐 Fetching HTML...');
    const html = await service.getHTML({ url: 'https://example.com' });
    responses.html = {
      url: html.url,
      success: html.success,
      html: html.html ? '<html>...</html>' : null, // Simplified
    };
    console.log('✅ HTML captured');
  } catch (error) {
    console.log('⚠️  HTML failed:', error.message);
  }

  // Capture basic crawl response
  try {
    console.log('🕷️  Crawling...');
    const crawl = await service.crawl({
      urls: ['https://example.com'],
      browser_config: { headless: true },
      crawler_config: { cache_mode: 'ENABLED' }
    });
    
    // Simplify the response structure
    if (crawl.results?.[0]) {
      const result = crawl.results[0];
      responses.crawl = {
        success: crawl.success,
        results: [{
          url: result.url,
          success: result.success,
          status_code: result.status_code,
          html: '<html>...</html>',
          cleaned_html: '<html>...</html>',
          fit_html: '<html>...</html>',
          markdown: result.markdown ? {
            raw_markdown: '# Example',
            markdown_with_citations: '# Example [1]',
            references_markdown: '[1]: https://example.com',
            fit_markdown: '# Example',
            fit_html: '<h1>Example</h1>',
          } : null,
          metadata: result.metadata || {},
          links: result.links || { internal: [], external: [] },
          media: result.media || { images: [], videos: [], audios: [] },
          tables: [],
          screenshot: null,
          pdf: null,
          // ... other fields
        }],
        server_processing_time_s: crawl.server_processing_time_s,
        server_memory_delta_mb: crawl.server_memory_delta_mb,
        server_peak_memory_mb: crawl.server_peak_memory_mb,
      };
    }
    console.log('✅ Crawl captured');
  } catch (error) {
    console.log('⚠️  Crawl failed:', error.message);
  }

  // Save responses
  await fs.writeFile(MOCK_FILE, JSON.stringify(responses, null, 2));
  console.log(`\n✅ Mock responses saved to: ${MOCK_FILE}`);
  
  // Generate TypeScript code snippet
  console.log('\n📋 Example mock usage in tests:\n');
  console.log(`import mockResponses from './mock-responses.json';

// In your test:
nock(baseURL)
  .post('/md')
  .reply(200, mockResponses.markdown.default);`);
}

// Run the script
captureRealResponses().catch(console.error);