import { jest } from '@jest/globals';
import { z } from 'zod';

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');

describe('MCP Server Validation', () => {
  describe('Stateless tool validation', () => {
    // Test the createStatelessSchema helper
    const createStatelessSchema = <T extends z.ZodTypeAny>(schema: T, toolName: string) => {
      // Tool-specific guidance for common scenarios
      const toolGuidance: Record<string, string> = {
        capture_screenshot: 'To capture screenshots with sessions, use crawl(session_id, screenshot: true)',
        generate_pdf: 'To generate PDFs with sessions, use crawl(session_id, pdf: true)',
        execute_js: 'To run JavaScript with sessions, use crawl(session_id, js_code: [...])',
        get_html: 'To get HTML with sessions, use crawl(session_id)',
        extract_with_llm: 'To extract data with sessions, first use crawl(session_id) then extract from the response',
      };

      const message = `${toolName} does not support session_id. This tool is stateless - each call creates a new browser. ${
        toolGuidance[toolName] || 'For persistent operations, use crawl with session_id.'
      }`;

      return z
        .object({
          session_id: z.never({ message }).optional(),
        })
        .passthrough()
        .and(schema)
        .transform((data) => {
          const { session_id, ...rest } = data as Record<string, unknown> & { session_id?: unknown };
          if (session_id !== undefined) {
            throw new Error(message);
          }
          return rest;
        });
    };

    it('should reject session_id for stateless tools', () => {
      const ExecuteJsSchema = createStatelessSchema(
        z.object({
          url: z.string().url(),
          js_code: z.union([z.string(), z.array(z.string())]),
        }),
        'execute_js',
      );

      // Should reject with session_id
      expect(() => {
        ExecuteJsSchema.parse({
          url: 'https://example.com',
          js_code: 'return document.title',
          session_id: 'test-session',
        });
      }).toThrow('execute_js does not support session_id');
    });

    it('should accept valid parameters without session_id', () => {
      const ExecuteJsSchema = createStatelessSchema(
        z.object({
          url: z.string().url(),
          js_code: z.union([z.string(), z.array(z.string())]),
        }),
        'execute_js',
      );

      const result = ExecuteJsSchema.parse({
        url: 'https://example.com',
        js_code: 'return document.title',
      });

      expect(result).toEqual({
        url: 'https://example.com',
        js_code: 'return document.title',
      });
    });

    it('should provide helpful error message when session_id is used', () => {
      const GetMarkdownSchema = createStatelessSchema(
        z.object({
          url: z.string().url(),
        }),
        'get_markdown',
      );

      try {
        GetMarkdownSchema.parse({
          url: 'https://example.com',
          session_id: 'my-session',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toContain('get_markdown does not support session_id');
        expect(zodError.errors[0].message).toContain('For persistent operations, use crawl');
      }
    });

    it('should provide tool-specific guidance for common tools', () => {
      // Test capture_screenshot guidance
      const CaptureScreenshotSchema = createStatelessSchema(z.object({ url: z.string().url() }), 'capture_screenshot');

      try {
        CaptureScreenshotSchema.parse({ url: 'https://example.com', session_id: 'test' });
      } catch (error) {
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toContain('use crawl(session_id, screenshot: true)');
      }

      // Test generate_pdf guidance
      const GeneratePdfSchema = createStatelessSchema(z.object({ url: z.string().url() }), 'generate_pdf');

      try {
        GeneratePdfSchema.parse({ url: 'https://example.com', session_id: 'test' });
      } catch (error) {
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toContain('use crawl(session_id, pdf: true)');
      }

      // Test execute_js guidance
      const ExecuteJsSchema = createStatelessSchema(z.object({ url: z.string().url() }), 'execute_js');

      try {
        ExecuteJsSchema.parse({ url: 'https://example.com', session_id: 'test' });
      } catch (error) {
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toContain('use crawl(session_id, js_code: [...])');
      }
    });

    it('should validate all stateless tools', () => {
      const statelessTools = [
        'get_markdown',
        'capture_screenshot',
        'generate_pdf',
        'execute_js',
        'batch_crawl',
        'smart_crawl',
        'get_html',
        'extract_links',
        'crawl_recursive',
        'parse_sitemap',
        'extract_with_llm',
      ];

      statelessTools.forEach((toolName) => {
        const schema = createStatelessSchema(
          z.object({
            url: z.string().url(),
          }),
          toolName,
        );

        // Should reject session_id
        expect(() => {
          schema.parse({
            url: 'https://example.com',
            session_id: 'test',
          });
        }).toThrow(`${toolName} does not support session_id`);

        // Should accept without session_id
        const result = schema.parse({
          url: 'https://example.com',
        });
        expect(result).toEqual({
          url: 'https://example.com',
        });
      });
    });
  });

  describe('Extract links tool', () => {
    it('should validate extract_links parameters', () => {
      const ExtractLinksSchema = z.object({
        url: z.string().url(),
        categorize: z.boolean().optional().default(true),
      });

      // Valid input with categorize true
      const result1 = ExtractLinksSchema.parse({
        url: 'https://example.com',
        categorize: true,
      });
      expect(result1.categorize).toBe(true);

      // Valid input with categorize false
      const result2 = ExtractLinksSchema.parse({
        url: 'https://example.com',
        categorize: false,
      });
      expect(result2.categorize).toBe(false);

      // Default categorize should be true
      const result3 = ExtractLinksSchema.parse({
        url: 'https://example.com',
      });
      expect(result3.categorize).toBe(true);
    });
  });

  describe('Session management tools', () => {
    it('should validate create_session parameters', () => {
      const CreateSessionSchema = z.object({
        session_id: z.string(),
        initial_url: z.string().optional(),
        browser_type: z.string().optional(),
      });

      // Valid input
      const result = CreateSessionSchema.parse({
        session_id: 'my-session',
        initial_url: 'https://example.com',
      });
      expect(result.session_id).toBe('my-session');

      // Missing required session_id
      expect(() => {
        CreateSessionSchema.parse({
          initial_url: 'https://example.com',
        });
      }).toThrow();
    });

    it('should validate clear_session parameters', () => {
      const ClearSessionSchema = z.object({
        session_id: z.string(),
      });

      // Valid input
      const result = ClearSessionSchema.parse({
        session_id: 'my-session',
      });
      expect(result.session_id).toBe('my-session');

      // Missing required session_id
      expect(() => {
        ClearSessionSchema.parse({});
      }).toThrow();
    });
  });

  describe('crawl validation', () => {
    it('should accept session_id for crawl', () => {
      const CrawlWithConfigSchema = z.object({
        url: z.string().url(),
        session_id: z.string().optional(),
        js_code: z.union([z.string(), z.array(z.string())]).optional(),
      });

      const result = CrawlWithConfigSchema.parse({
        url: 'https://example.com',
        session_id: 'my-session',
        js_code: 'document.querySelector("button").click()',
      });

      expect(result.session_id).toBe('my-session');
    });

    it('should work without session_id', () => {
      const CrawlWithConfigSchema = z.object({
        url: z.string().url(),
        session_id: z.string().optional(),
      });

      const result = CrawlWithConfigSchema.parse({
        url: 'https://example.com',
      });

      expect(result.session_id).toBeUndefined();
    });

    it('should require js_only when using js_code with session_id WITHOUT output options', () => {
      // Create a schema that mirrors the real one's refinement
      const CrawlWithConfigSchema = z
        .object({
          url: z.string().url(),
          session_id: z.string().optional(),
          js_code: z.union([z.string(), z.array(z.string())]).optional(),
          js_only: z.boolean().optional(),
          screenshot: z.boolean().optional(),
          pdf: z.boolean().optional(),
        })
        .refine(
          (data) => {
            // Only require js_only when using js_code + session_id WITHOUT any output options
            if (data.js_code && data.session_id && !data.js_only && !data.screenshot && !data.pdf) {
              return false;
            }
            return true;
          },
          {
            message:
              'When using js_code with session_id WITHOUT screenshot or pdf, you MUST set js_only: true to prevent server errors. If you want screenshots/PDFs, you can omit js_only. Correct usage: crawl({url, session_id, js_code: [...], js_only: true})',
          },
        );

      // Should fail without js_only when no output options
      expect(() => {
        CrawlWithConfigSchema.parse({
          url: 'https://example.com',
          session_id: 'test-session',
          js_code: ['document.querySelector("button").click()'],
        });
      }).toThrow('When using js_code with session_id WITHOUT screenshot or pdf');

      // Should pass with js_only: true
      const result = CrawlWithConfigSchema.parse({
        url: 'https://example.com',
        session_id: 'test-session',
        js_code: ['document.querySelector("button").click()'],
        js_only: true,
      });
      expect(result.js_only).toBe(true);

      // Should pass with screenshot (no js_only required)
      const result2 = CrawlWithConfigSchema.parse({
        url: 'https://example.com',
        session_id: 'test-session',
        js_code: ['document.querySelector("button").click()'],
        screenshot: true,
      });
      expect(result2.screenshot).toBe(true);
      expect(result2.js_only).toBeUndefined();

      // Should pass with pdf (no js_only required)
      const result3 = CrawlWithConfigSchema.parse({
        url: 'https://example.com',
        session_id: 'test-session',
        js_code: ['document.querySelector("button").click()'],
        pdf: true,
      });
      expect(result3.pdf).toBe(true);
      expect(result3.js_only).toBeUndefined();

      // Should pass without js_code
      const result4 = CrawlWithConfigSchema.parse({
        url: 'https://example.com',
        session_id: 'test-session',
      });
      expect(result4.session_id).toBe('test-session');

      // Should pass without session_id
      const result5 = CrawlWithConfigSchema.parse({
        url: 'https://example.com',
        js_code: ['document.querySelector("button").click()'],
      });
      expect(result5.js_code).toBeDefined();
    });
  });

  describe('JavaScript code validation', () => {
    const validateJavaScriptCode = (code: string): boolean => {
      if (/&quot;|&amp;|&lt;|&gt;|&#\d+;|&\w+;/.test(code)) {
        return false;
      }
      if (/<(!DOCTYPE|html|body|head|script|style)\b/i.test(code)) {
        return false;
      }
      if (/[;})]\s*\\n|\\n\s*[{(/]/.test(code)) {
        return false;
      }
      if (/[;})]\s*\\n\s*\w/.test(code)) {
        return false;
      }
      return true;
    };

    const JsCodeSchema = z.union([
      z.string().refine(validateJavaScriptCode, {
        message:
          'Invalid JavaScript: Contains HTML entities (&quot;), literal \\n outside strings, or HTML tags. Use proper JS syntax with real quotes and newlines.',
      }),
      z.array(
        z.string().refine(validateJavaScriptCode, {
          message:
            'Invalid JavaScript: Contains HTML entities (&quot;), literal \\n outside strings, or HTML tags. Use proper JS syntax with real quotes and newlines.',
        }),
      ),
    ]);

    it('should reject JavaScript with HTML entities', () => {
      expect(() => {
        JsCodeSchema.parse('document.querySelector(&quot;button&quot;).click()');
      }).toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should reject JavaScript with literal \\n between statements', () => {
      expect(() => {
        JsCodeSchema.parse('console.log("line1");\\nconsole.log("line2")');
      }).toThrow('Invalid JavaScript: Contains HTML entities');
    });

    it('should accept valid JavaScript with \\n inside strings', () => {
      const result = JsCodeSchema.parse('console.log("line1\\nline2")');
      expect(result).toBe('console.log("line1\\nline2")');
    });

    it('should accept valid multiline JavaScript', () => {
      const code = `// Comment
document.querySelector('button').click();
return true;`;
      const result = JsCodeSchema.parse(code);
      expect(result).toBe(code);
    });

    it('should validate arrays of JavaScript code', () => {
      // Invalid array
      expect(() => {
        JsCodeSchema.parse(['document.querySelector(&quot;input&quot;).value = &quot;test&quot;', 'form.submit()']);
      }).toThrow('Invalid JavaScript: Contains HTML entities');

      // Valid array
      const validArray = ['document.querySelector("input").value = "test"', 'form.submit()'];
      const result = JsCodeSchema.parse(validArray);
      expect(result).toEqual(validArray);
    });
  });
});
