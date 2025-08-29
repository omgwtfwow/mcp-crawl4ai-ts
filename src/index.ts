#!/usr/bin/env node

import { Crawl4AIServer } from './server.js';

// Try to load dotenv only in development
// In production (via npx), env vars come from the MCP client
try {
  // Only try to load dotenv if CRAWL4AI_BASE_URL is not set
  if (!process.env.CRAWL4AI_BASE_URL) {
    const dotenv = await import('dotenv');
    dotenv.config();
  }
} catch {
  // dotenv is not available in production, which is expected
}

const CRAWL4AI_BASE_URL = process.env.CRAWL4AI_BASE_URL;
const CRAWL4AI_API_KEY = process.env.CRAWL4AI_API_KEY || '';
const SERVER_NAME = process.env.SERVER_NAME || 'crawl4ai-mcp';
const SERVER_VERSION = process.env.SERVER_VERSION || '1.0.0';

if (!CRAWL4AI_BASE_URL) {
  console.error('Error: CRAWL4AI_BASE_URL environment variable is required');
  console.error('Please set it to your Crawl4AI server URL (e.g., http://localhost:8080)');
  process.exit(1);
}

// Always start the server when this script is executed
// This script is meant to be run as an MCP server
const server = new Crawl4AIServer(CRAWL4AI_BASE_URL, CRAWL4AI_API_KEY, SERVER_NAME, SERVER_VERSION);
server.start().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
