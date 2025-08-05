// Load dotenv for integration tests
const dotenv = require('dotenv');
const path = require('path');

// The npm script sets an env var to identify integration tests
const isIntegrationTest = process.env.JEST_TEST_TYPE === 'integration';

if (isIntegrationTest) {
  // For integration tests, load from .env file
  dotenv.config({ path: path.resolve(__dirname, '.env') });
  
  // For integration tests, we MUST have proper environment variables
  // No fallback to localhost - tests should fail if not configured
} else {
  // For unit tests, always use localhost
  process.env.CRAWL4AI_BASE_URL = 'http://localhost:11235';
  process.env.CRAWL4AI_API_KEY = 'test-api-key';
}