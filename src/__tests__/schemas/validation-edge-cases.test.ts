// import { jest } from '@jest/globals';
import { validateJavaScriptCode } from '../../schemas/helpers.js';
import { JsCodeSchema, CrawlSchema } from '../../schemas/validation-schemas.js';

describe('JavaScript Validation Edge Cases', () => {
  describe('validateJavaScriptCode', () => {
    describe('Valid JavaScript that might look suspicious', () => {
      it('should accept strings containing HTML-like syntax in string literals', () => {
        const validCases = [
          `const html = '<div class="test">Hello</div>';`,
          `const template = \`<button onclick="alert('test')">Click</button>\`;`,
          `const regex = /<div[^>]*>/g;`,
          `const arrow = () => { return '<span>Arrow</span>'; }`,
          `const className = 'container';`,
        ];

        validCases.forEach((code) => {
          expect(validateJavaScriptCode(code)).toBe(true);
        });
      });

      it('should accept legitimate escape sequences', () => {
        const validCases = [
          `const str = "Line 1\\nLine 2";`, // Real newline escape
          `const tab = "Col1\\tCol2";`,
          `const quote = "He said \\"Hello\\"";`,
          `const unicode = "\\u0048\\u0065\\u006C\\u006C\\u006F";`,
          `const template = \`Multi
line
string\`;`, // Real newlines in template literals
        ];

        validCases.forEach((code) => {
          expect(validateJavaScriptCode(code)).toBe(true);
        });
      });

      it('should accept complex but valid JavaScript patterns', () => {
        const validCases = [
          // Nested template literals
          `const nested = \`Outer \${inner ? \`Inner: \${value}\` : 'None'}\`;`,
          // Regular expressions that might look like HTML
          `const htmlTag = /<([a-z]+)([^>]*)>/gi;`,
          // JSON strings without HTML entities
          `const json = '{"name": "Test", "value": "Some data"}';`,
          // Function with HTML in comments
          `function render() {
            // This creates div content
            return document.createElement('div');
          }`,
          // Complex string concatenation
          `const result = '<div' + ' class="' + className + '">' + content + '</div>';`,
        ];

        validCases.forEach((code) => {
          expect(validateJavaScriptCode(code)).toBe(true);
        });
      });

      it('should accept Unicode and special characters', () => {
        const validCases = [
          `const emoji = "Hello 👋 World 🌍";`,
          `const chinese = "你好世界";`,
          `const arabic = "مرحبا بالعالم";`,
          `const special = "©2024 Company™";`,
          `const math = "∑(n=1 to ∞) = π²/6";`,
        ];

        validCases.forEach((code) => {
          expect(validateJavaScriptCode(code)).toBe(true);
        });
      });
    });

    describe('Invalid JavaScript that should be rejected', () => {
      it('should reject HTML entities outside string literals', () => {
        const invalidCases = [
          `const value = &quot;test&quot;;`, // HTML entities as code
          `const text = &amp;&amp; true;`,
          `if (a &lt; b) { }`,
          `const escaped = &nbsp;`,
          `return &apos;hello&apos;;`,
        ];

        invalidCases.forEach((code) => {
          expect(validateJavaScriptCode(code)).toBe(false);
        });
      });

      it('should reject literal backslash-n outside strings', () => {
        const invalidCases = [
          `const text = "Hello";\\nconst world = "World";`, // Literal \n between statements
          `console.log("test");\\nconsole.log("more");`,
          `return value;\\nreturn other;`,
        ];

        invalidCases.forEach((code) => {
          expect(validateJavaScriptCode(code)).toBe(false);
        });
      });

      it('should reject HTML tags outside string literals', () => {
        const invalidCases = [
          `<script>alert('test')</script>`,
          `<!DOCTYPE html>`,
          `<html><body>test</body></html>`,
          `<style>body { color: red; }</style>`,
        ];

        invalidCases.forEach((code) => {
          expect(validateJavaScriptCode(code)).toBe(false);
        });
      });
    });

    describe('Edge cases and boundaries', () => {
      it('should handle empty and whitespace-only input', () => {
        expect(validateJavaScriptCode('')).toBe(true);
        expect(validateJavaScriptCode('   ')).toBe(true);
        expect(validateJavaScriptCode('\n\n\n')).toBe(true);
        expect(validateJavaScriptCode('\t')).toBe(true);
      });

      it('should handle very long valid strings', () => {
        const longString = 'const x = "' + 'a'.repeat(10000) + '";';
        expect(validateJavaScriptCode(longString)).toBe(true);
      });

      it('should handle nested quotes correctly', () => {
        const validCases = [
          `const x = "She said \\"Hello\\" to me";`,
          `const y = 'It\\'s a nice day';`,
          `const z = \`Template with "quotes" and 'apostrophes'\`;`,
        ];

        validCases.forEach((code) => {
          expect(validateJavaScriptCode(code)).toBe(true);
        });
      });

      it('should handle multiline strings correctly', () => {
        const multiline = `
const longText = \`
  This is a multiline
  template literal with
  multiple lines
\`;`;
        expect(validateJavaScriptCode(multiline)).toBe(true);
      });
    });
  });

  describe('Schema Validation Edge Cases', () => {
    describe('JsCodeSchema', () => {
      it('should accept both string and array of strings', () => {
        expect(() => JsCodeSchema.parse('return 1;')).not.toThrow();
        expect(() => JsCodeSchema.parse(['return 1;', 'return 2;'])).not.toThrow();
      });

      it('should reject invalid JavaScript in arrays', () => {
        expect(() => JsCodeSchema.parse(['valid();', '&quot;invalid&quot;'])).toThrow();
      });

      it('should handle empty arrays', () => {
        expect(() => JsCodeSchema.parse([])).not.toThrow();
      });
    });

    describe('CrawlSchema edge cases', () => {
      it('should handle all optional parameters', () => {
        const minimal = { url: 'https://example.com' };
        expect(() => CrawlSchema.parse(minimal)).not.toThrow();
      });

      it('should validate js_only requires session_id', () => {
        const invalid = {
          url: 'https://example.com',
          js_only: true,
          // Missing session_id
        };
        expect(() => CrawlSchema.parse(invalid)).toThrow();
      });

      it('should reject empty js_code array', () => {
        const invalid = {
          url: 'https://example.com',
          js_code: [],
        };
        expect(() => CrawlSchema.parse(invalid)).toThrow();
      });

      it('should accept all valid cache modes', () => {
        const validModes = ['ENABLED', 'BYPASS', 'DISABLED'];
        validModes.forEach((mode) => {
          const config = { url: 'https://example.com', cache_mode: mode };
          expect(() => CrawlSchema.parse(config)).not.toThrow();
        });
      });

      it('should validate viewport dimensions', () => {
        const validViewport = {
          url: 'https://example.com',
          viewport_width: 1920,
          viewport_height: 1080,
        };
        expect(() => CrawlSchema.parse(validViewport)).not.toThrow();
      });

      it('should validate complex configurations', () => {
        const complex = {
          url: 'https://example.com',
          browser_type: 'chromium',
          viewport_width: 1280,
          viewport_height: 720,
          user_agent: 'Custom User Agent',
          headers: { 'X-Custom': 'value' },
          cookies: [{ name: 'session', value: '123', domain: '.example.com' }],
          js_code: ['document.querySelector("button").click()'],
          wait_for: '#loaded',
          screenshot: true,
          pdf: true,
          session_id: 'test-session',
          cache_mode: 'BYPASS',
        };
        expect(() => CrawlSchema.parse(complex)).not.toThrow();
      });
    });
  });

  describe('Property-based testing for regex patterns', () => {
    // Generate random valid JavaScript-like strings
    const generateValidJS = () => {
      const templates = [
        () => `const x = ${Math.random()};`,
        () => `function test() { return "${Math.random()}"; }`,
        () => `if (${Math.random() > 0.5}) { console.log("test"); }`,
        () => `const arr = [${Math.random()}, ${Math.random()}];`,
        () => `// Comment with ${Math.random()}`,
      ];
      return templates[Math.floor(Math.random() * templates.length)]();
    };

    it('should consistently validate generated valid JavaScript', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateValidJS();
        expect(validateJavaScriptCode(code)).toBe(true);
      }
    });

    // Test boundary conditions with special characters
    const specialChars = ['<', '>', '&', '"', "'", '\\', '\n', '\r', '\t'];

    it('should handle special characters in string contexts correctly', () => {
      specialChars.forEach((char) => {
        const inString = `const x = "${char}";`;
        const inTemplate = `const y = \`${char}\`;`;

        // These should be valid (special chars inside strings)
        expect(validateJavaScriptCode(inString)).toBe(true);
        expect(validateJavaScriptCode(inTemplate)).toBe(true);
      });
    });
  });
});
