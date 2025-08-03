import { Crawl4AIService } from '../crawl4ai-service.js';
import { AxiosInstance } from 'axios';

// Error handling types
export interface ErrorWithResponse {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
}

export interface SessionInfo {
  id: string;
  created_at: Date;
  last_used: Date;
  initial_url?: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseHandler {
  protected service: Crawl4AIService;
  protected axiosClient: AxiosInstance;
  protected sessions: Map<string, SessionInfo>;

  constructor(service: Crawl4AIService, axiosClient: AxiosInstance, sessions: Map<string, SessionInfo>) {
    this.service = service;
    this.axiosClient = axiosClient;
    this.sessions = sessions;
  }

  protected formatError(error: unknown, operation: string): Error {
    const errorWithResponse = error as ErrorWithResponse;
    return new Error(
      `Failed to ${operation}: ${errorWithResponse.response?.data?.detail || (error instanceof Error ? error.message : String(error))}`,
    );
  }
}
