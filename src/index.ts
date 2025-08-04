#!/usr/bin/env node

import dotenv from 'dotenv';
import { Crawl4AIServer } from './server.js';

// Load environment variables
dotenv.config();

const CRAWL4AI_BASE_URL = process.env.CRAWL4AI_BASE_URL;
const CRAWL4AI_API_KEY = process.env.CRAWL4AI_API_KEY || '';
const SERVER_NAME = process.env.SERVER_NAME || 'crawl4ai-mcp';
const SERVER_VERSION = process.env.SERVER_VERSION || '1.0.0';

if (!CRAWL4AI_BASE_URL) {
  console.error('Error: CRAWL4AI_BASE_URL environment variable is required');
  console.error('Please set it to your Crawl4AI server URL (e.g., http://localhost:8080)');
  process.exit(1);
}

/* istanbul ignore next */
// Start the server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new Crawl4AIServer(CRAWL4AI_BASE_URL, CRAWL4AI_API_KEY, SERVER_NAME, SERVER_VERSION);
  server.start().catch(console.error);
}
