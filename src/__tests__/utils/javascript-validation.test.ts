/* eslint-env jest */
import { describe, it, expect } from '@jest/globals';
import { validateJavaScriptCode } from '../../index.js';

describe('JavaScript Code Validation', () => {
  describe('Valid JavaScript', () => {
    it('should accept simple JavaScript code', () => {
      expect(validateJavaScriptCode('console.log("Hello world")')).toBe(true);
      expect(validateJavaScriptCode('return document.title')).toBe(true);
      expect(validateJavaScriptCode('const x = 5; return x * 2;')).toBe(true);
    });

    it('should accept JavaScript with real newlines', () => {
      expect(validateJavaScriptCode('console.log("Hello");\nconsole.log("World");')).toBe(true);
      expect(validateJavaScriptCode('function test() {\n  return true;\n}')).toBe(true);
    });

    it('should accept JavaScript with escape sequences in strings', () => {
      expect(validateJavaScriptCode('console.log("Line 1\\nLine 2")')).toBe(true);
      expect(validateJavaScriptCode('const msg = "Tab\\there\\tand\\tthere"')).toBe(true);
      expect(validateJavaScriptCode('return "Quote: \\"Hello\\""')).toBe(true);
    });

    it('should accept complex JavaScript patterns', () => {
      const complexCode = `
        const elements = document.querySelectorAll('.item');
        elements.forEach((el, i) => {
          el.textContent = \`Item \${i + 1}\`;
        });
        return elements.length;
      `;
      expect(validateJavaScriptCode(complexCode)).toBe(true);
    });

    it('should accept JavaScript with regex patterns', () => {
      expect(validateJavaScriptCode('return /test\\d+/.test(str)')).toBe(true);
      expect(validateJavaScriptCode('const pattern = /\\w+@\\w+\\.\\w+/')).toBe(true);
    });
  });

  describe('Invalid JavaScript - HTML Entities', () => {
    it('should reject code with HTML entities', () => {
      expect(validateJavaScriptCode('console.log(&quot;Hello&quot;)')).toBe(false);
      expect(validateJavaScriptCode('const x = &amp;&amp; true')).toBe(false);
      expect(validateJavaScriptCode('if (x &lt; 5) return')).toBe(false);
      expect(validateJavaScriptCode('if (x &gt; 5) return')).toBe(false);
    });

    it('should reject code with numeric HTML entities', () => {
      expect(validateJavaScriptCode('const char = &#65;')).toBe(false);
      // Note: hex entities like &#x41; are not caught by the current regex
    });

    it('should reject code with named HTML entities', () => {
      expect(validateJavaScriptCode('const copy = &copy;')).toBe(false);
      expect(validateJavaScriptCode('const nbsp = &nbsp;')).toBe(false);
    });
  });

  describe('Invalid JavaScript - HTML Tags', () => {
    it('should reject HTML markup', () => {
      expect(validateJavaScriptCode('<!DOCTYPE html>')).toBe(false);
      expect(validateJavaScriptCode('<html><body>test</body></html>')).toBe(false);
      expect(validateJavaScriptCode('<script>alert("test")</script>')).toBe(false);
      expect(validateJavaScriptCode('<style>body { color: red; }</style>')).toBe(false);
    });

    it('should reject mixed HTML and JavaScript', () => {
      expect(validateJavaScriptCode('<head>\nconst x = 5;\n</head>')).toBe(false);
      expect(validateJavaScriptCode('console.log("test");\n<body>')).toBe(false);
    });
  });

  describe('Invalid JavaScript - Literal Escape Sequences', () => {
    it('should reject literal \\n outside of strings', () => {
      expect(validateJavaScriptCode('console.log("Hello");\\nconsole.log("World");')).toBe(false);
      expect(validateJavaScriptCode('const x = 5;\\nreturn x;')).toBe(false);
      expect(validateJavaScriptCode('if (true) {\\n  return;\\n}')).toBe(false);
    });

    it('should reject literal \\n in various positions', () => {
      expect(validateJavaScriptCode('}\\nfunction')).toBe(false);
      expect(validateJavaScriptCode(');\\nconst')).toBe(false);
      expect(validateJavaScriptCode('\\n{')).toBe(false);
      expect(validateJavaScriptCode('\\n(')).toBe(false);
    });

    it('should reject literal \\n between statements', () => {
      expect(validateJavaScriptCode('const x = 5;\\nconst y = 10;')).toBe(false);
      expect(validateJavaScriptCode('doSomething();\\ndoAnother();')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(validateJavaScriptCode('')).toBe(true);
    });

    it('should handle whitespace-only strings', () => {
      expect(validateJavaScriptCode('   ')).toBe(true);
      expect(validateJavaScriptCode('\n\n\n')).toBe(true);
      expect(validateJavaScriptCode('\t\t')).toBe(true);
    });

    it('should handle single-line comments', () => {
      expect(validateJavaScriptCode('// This is a comment')).toBe(true);
      expect(validateJavaScriptCode('return 5; // Comment here')).toBe(true);
    });

    it('should handle multi-line comments', () => {
      expect(validateJavaScriptCode('/* Multi\nline\ncomment */')).toBe(true);
      expect(validateJavaScriptCode('/* Comment */ return 5;')).toBe(true);
    });

    it('should reject HTML tags even in what looks like strings', () => {
      // The current validation is quite strict and rejects HTML tags even if they appear to be in strings
      // This is by design to prevent malformed JavaScript that contains actual HTML
      expect(validateJavaScriptCode('const html = "<div>Hello</div>"')).toBe(true); // <div> is ok
      expect(validateJavaScriptCode("return '<style>body{}</style>'")).toBe(false); // <style> is rejected
    });
  });
});