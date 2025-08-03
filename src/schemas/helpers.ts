import { z } from 'zod';

// Helper to validate JavaScript code
export const validateJavaScriptCode = (code: string): boolean => {
  // Check for common HTML entities that shouldn't be in JS
  if (/&quot;|&amp;|&lt;|&gt;|&#\d+;|&\w+;/.test(code)) {
    return false;
  }

  // Basic check to ensure it's not HTML
  if (/<(!DOCTYPE|html|body|head|script|style)\b/i.test(code)) {
    return false;
  }

  // Check for literal \n, \t, \r outside of strings (common LLM mistake)
  // This is tricky - we'll check if the code has these patterns in a way that suggests
  // they're meant to be actual newlines/tabs rather than escape sequences in strings
  // Look for patterns like: ;\n or }\n or )\n which suggest literal newlines
  if (/[;})]\s*\\n|\\n\s*[{(/]/.test(code)) {
    return false;
  }

  // Check for obvious cases of literal \n between statements
  if (/[;})]\s*\\n\s*\w/.test(code)) {
    return false;
  }

  return true;
};

// Helper to create schema that rejects session_id
export const createStatelessSchema = <T extends z.ZodObject<z.ZodRawShape>>(schema: T, toolName: string) => {
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
      const { session_id, ...rest } = data;
      if (session_id !== undefined) {
        throw new Error(message);
      }
      return rest as z.infer<T>;
    });
};
