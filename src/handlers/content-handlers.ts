import { BaseHandler } from './base-handler.js';
import {
  MarkdownEndpointOptions,
  MarkdownEndpointResponse,
  ScreenshotEndpointOptions,
  ScreenshotEndpointResponse,
  PDFEndpointOptions,
  PDFEndpointResponse,
  HTMLEndpointOptions,
  HTMLEndpointResponse,
  FilterType,
} from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ContentHandlers extends BaseHandler {
  async getMarkdown(
    options: Omit<MarkdownEndpointOptions, 'f' | 'q' | 'c'> & { filter?: string; query?: string; cache?: string },
  ) {
    try {
      // Map from schema property names to API parameter names
      const result: MarkdownEndpointResponse = await this.service.getMarkdown({
        url: options.url,
        f: options.filter as FilterType | undefined, // Schema provides 'filter', API expects 'f'
        q: options.query, // Schema provides 'query', API expects 'q'
        c: options.cache, // Schema provides 'cache', API expects 'c'
      });

      // Format the response
      let formattedText = `URL: ${result.url}\nFilter: ${result.filter}`;

      if (result.query) {
        formattedText += `\nQuery: ${result.query}`;
      }

      formattedText += `\nCache: ${result.cache}\n\nMarkdown:\n${result.markdown || 'No content found.'}`;

      return {
        content: [
          {
            type: 'text',
            text: formattedText,
          },
        ],
      };
    } catch (error) {
      throw this.formatError(error, 'get markdown');
    }
  }

  async captureScreenshot(options: ScreenshotEndpointOptions) {
    try {
      const result: ScreenshotEndpointResponse = await this.service.captureScreenshot(options);

      // Response has { success: true, screenshot: "base64string" }
      if (!result.success || !result.screenshot) {
        throw new Error('Screenshot capture failed - no screenshot data in response');
      }

      let savedFilePath: string | undefined;

      // Save to local directory if requested
      if (options.save_to_directory) {
        try {
          // Ensure directory exists
          await fs.mkdir(options.save_to_directory, { recursive: true });

          // Generate filename from URL and timestamp
          const url = new URL(options.url);
          const hostname = url.hostname.replace(/[^a-z0-9]/gi, '-');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `${hostname}-${timestamp}.png`;

          savedFilePath = path.join(options.save_to_directory, filename);

          // Convert base64 to buffer and save
          const buffer = Buffer.from(result.screenshot, 'base64');
          await fs.writeFile(savedFilePath, buffer);
        } catch (saveError) {
          // Log error but don't fail the operation
          console.error('Failed to save screenshot locally:', saveError);
        }
      }

      const textContent = savedFilePath
        ? `Screenshot captured for: ${options.url}\nSaved to: ${savedFilePath}`
        : `Screenshot captured for: ${options.url}`;

      return {
        content: [
          {
            type: 'image',
            data: result.screenshot,
            mimeType: 'image/png',
          },
          {
            type: 'text',
            text: textContent,
          },
        ],
      };
    } catch (error) {
      throw this.formatError(error, 'capture screenshot');
    }
  }

  async generatePDF(options: PDFEndpointOptions) {
    try {
      const result: PDFEndpointResponse = await this.service.generatePDF(options);

      // Response has { success: true, pdf: "base64string" }
      if (!result.success || !result.pdf) {
        throw new Error('PDF generation failed - no PDF data in response');
      }

      return {
        content: [
          {
            type: 'resource',
            resource: {
              uri: `data:application/pdf;name=${encodeURIComponent(new URL(String(options.url)).hostname)}.pdf;base64,${result.pdf}`,
              mimeType: 'application/pdf',
              blob: result.pdf,
            },
          },
          {
            type: 'text',
            text: `PDF generated for: ${options.url}`,
          },
        ],
      };
    } catch (error) {
      throw this.formatError(error, 'generate PDF');
    }
  }

  async getHTML(options: HTMLEndpointOptions) {
    try {
      const result: HTMLEndpointResponse = await this.service.getHTML(options);

      // Response has { html: string, url: string, success: true }
      return {
        content: [
          {
            type: 'text',
            text: result.html || '',
          },
        ],
      };
    } catch (error) {
      throw this.formatError(error, 'get HTML');
    }
  }

  async extractWithLLM(options: { url: string; query: string }) {
    try {
      const result = await this.service.extractWithLLM(options);

      return {
        content: [
          {
            type: 'text',
            text: result.answer,
          },
        ],
      };
    } catch (error) {
      throw this.formatError(error, 'extract with LLM');
    }
  }
}
