#!/usr/bin/env tsx
/**
 * Generate nock mock code from real API responses
 * Usage: CRAWL4AI_API_KEY=your-key npm run generate-mocks
 */

/// <reference types="node" />

import { Crawl4AIService } from '../src/crawl4ai-service.js';

async function generateMockCode() {
  const baseURL = process.env.CRAWL4AI_BASE_URL || 'https://crawl.in8.io:8443';
  const apiKey = process.env.CRAWL4AI_API_KEY || '';

  if (!apiKey) {
    console.error('❌ CRAWL4AI_API_KEY environment variable is required');
    console.log('Usage: CRAWL4AI_API_KEY=your-key npm run generate-mocks');
    process.exit(1);
  }

  console.log('🔄 Generating mock code from real API...\n');

  const service = new Crawl4AIService(baseURL, apiKey);
  let mockCode = '';

  // Test getMarkdown
  try {
    const response = await service.getMarkdown({ url: 'https://example.com' });
    mockCode += `// Mock for getMarkdown\n`;
    mockCode += `nock(baseURL)\n`;
    mockCode += `  .post('/md', {\n`;
    mockCode += `    url: 'https://example.com',\n`;
    mockCode += `    f: 'fit',\n`;
    mockCode += `    q: undefined,\n`;
    mockCode += `    c: undefined,\n`;
    mockCode += `  })\n`;
    mockCode += `  .matchHeader('x-api-key', apiKey)\n`;
    mockCode += `  .reply(200, ${JSON.stringify(response, null, 2).replace(/^/gm, '  ')});\n\n`;
  } catch (error) {
    console.log('⚠️  Skipping getMarkdown:', error.message);
  }

  // Test captureScreenshot
  try {
    const response = await service.captureScreenshot({ 
      url: 'https://example.com',
      screenshot_wait_for: 2
    });
    
    // Replace actual base64 with placeholder
    const mockResponse = {
      ...response,
      screenshot: response.screenshot ? 'base64-encoded-screenshot-data' : null
    };
    
    mockCode += `// Mock for captureScreenshot\n`;
    mockCode += `nock(baseURL)\n`;
    mockCode += `  .post('/screenshot', {\n`;
    mockCode += `    url: 'https://example.com',\n`;
    mockCode += `    screenshot_wait_for: 2,\n`;
    mockCode += `  })\n`;
    mockCode += `  .matchHeader('x-api-key', apiKey)\n`;
    mockCode += `  .reply(200, ${JSON.stringify(mockResponse, null, 2).replace(/^/gm, '  ')});\n\n`;
  } catch (error) {
    console.log('⚠️  Skipping captureScreenshot:', error.message);
  }

  console.log('📋 Generated mock code:\n');
  console.log('```typescript');
  console.log(mockCode);
  console.log('```\n');
  console.log('Copy and paste the above code into your test file!');
}

generateMockCode().catch(console.error);