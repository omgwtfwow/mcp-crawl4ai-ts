/* eslint-env jest */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface IntegrationTestConfig {
  baseUrl: string;
  apiKey: string;
  llmProvider?: string;
  llmApiToken?: string;
  llmBaseUrl?: string;
}

export function getTestConfig(): IntegrationTestConfig {
  const config: IntegrationTestConfig = {
    baseUrl: process.env.CRAWL4AI_BASE_URL || 'http://localhost:11235',
    apiKey: process.env.CRAWL4AI_API_KEY || '',
    llmProvider: process.env.LLM_PROVIDER,
    llmApiToken: process.env.LLM_API_TOKEN,
    llmBaseUrl: process.env.LLM_BASE_URL,
  };

  if (!config.baseUrl) {
    throw new Error('CRAWL4AI_BASE_URL is required for integration tests');
  }

  return config;
}

export function hasLLMConfig(): boolean {
  const config = getTestConfig();
  return !!(config.llmProvider && config.llmApiToken);
}

export async function createTestClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: 'tsx',
    args: ['src/index.ts'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  const client = new Client(
    {
      name: 'integration-test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    },
  );

  await client.connect(transport);
  return client;
}

export async function cleanupTestClient(client: Client): Promise<void> {
  await client.close();
}

// Test data generators
export function generateSessionId(): string {
  return `test-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function generateTestUrl(type: 'simple' | 'dynamic' | 'infinite-scroll' | 'auth' = 'simple'): string {
  const urls = {
    simple: 'https://example.com',
    dynamic: 'https://github.com',
    'infinite-scroll': 'https://twitter.com',
    auth: 'https://github.com/login',
  };
  return urls[type];
}

// Assertion helpers
export async function expectSuccessfulCrawl(result: any): Promise<void> {
  expect(result).toBeDefined();
  expect(result.content).toBeInstanceOf(Array);
  expect(result.content.length).toBeGreaterThan(0);

  const textContent = result.content.find((c: any) => c.type === 'text');
  expect(textContent).toBeDefined();
  expect(textContent.text).toBeTruthy();
}

export async function expectScreenshot(result: any): Promise<void> {
  const imageContent = result.content.find((c: any) => c.type === 'image');
  expect(imageContent).toBeDefined();
  expect(imageContent.data).toBeTruthy();
  expect(imageContent.mimeType).toBe('image/png');
}

export async function expectExtractedData(result: any, expectedKeys: string[]): Promise<void> {
  const textContent = result.content.find((c: any) => c.type === 'text');
  expect(textContent).toBeDefined();

  // Check if extracted data contains expected keys
  for (const key of expectedKeys) {
    expect(textContent.text).toContain(key);
  }
}

// Delay helper for tests
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Skip test if condition is not met
export function skipIf(condition: boolean, message: string) {
  if (condition) {
    console.log(`⚠️  Skipping test: ${message}`);
    return true;
  }
  return false;
}

// Test timeout helper
export const TEST_TIMEOUTS = {
  short: 30000, // 30 seconds
  medium: 60000, // 1 minute
  long: 120000, // 2 minutes
  extraLong: 180000, // 3 minutes
};
