/* eslint-env jest */
import type { AxiosResponse } from 'axios';

/**
 * Mock axios instance for testing HTTP client behavior
 */
export interface MockAxiosInstance {
  post: jest.Mock<Promise<AxiosResponse>>;
  get: jest.Mock<Promise<AxiosResponse>>;
  head: jest.Mock<Promise<AxiosResponse>>;
  put?: jest.Mock<Promise<AxiosResponse>>;
  delete?: jest.Mock<Promise<AxiosResponse>>;
  patch?: jest.Mock<Promise<AxiosResponse>>;
}

/**
 * Mock function type that returns a promise with content array
 */
type MockFunction = jest.Mock<Promise<{ content: TestContent }>>;

/**
 * Mock server interface for MCP server testing
 */
export interface MockMCPServer {
  listTools: MockFunction;
  callTool: MockFunction;
  listResources?: MockFunction;
  readResource?: MockFunction;
  listPrompts?: MockFunction;
  getPrompt?: MockFunction;
}

/**
 * Type for test content arrays used in MCP responses
 */
export type TestContent = Array<{
  type: string;
  text?: string;
  resource?: {
    uri: string;
    mimeType: string;
    blob?: string;
  };
}>;

/**
 * Generic test response type
 */
export interface TestResponse<T = unknown> {
  content: TestContent;
  data?: T;
  error?: string;
}
