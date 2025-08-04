// Load dotenv for integration tests
const dotenv = require('dotenv');
const path = require('path');

// Check if this is an integration test by looking at the test path
const isIntegrationTest = process.argv.some(arg => 
  arg.includes('integration') || arg.includes('test:integration')
);

if (isIntegrationTest) {
  // Load from .env file for integration tests
  dotenv.config({ path: path.resolve(__dirname, '.env') });
  
  // Only set defaults if not already in environment
  if (!process.env.CRAWL4AI_BASE_URL) {
    process.env.CRAWL4AI_BASE_URL = 'http://localhost:11235';
  }
  if (!process.env.CRAWL4AI_API_KEY) {
    process.env.CRAWL4AI_API_KEY = 'test-api-key';
  }
} else {
  // For unit tests, always use localhost
  process.env.CRAWL4AI_BASE_URL = 'http://localhost:11235';
  process.env.CRAWL4AI_API_KEY = 'test-api-key';
}