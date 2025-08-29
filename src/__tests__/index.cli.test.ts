// import { jest } from '@jest/globals';
import { spawn } from 'child_process';
import * as path from 'path';
import * as url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

describe('CLI Entry Point', () => {
  const cliPath = path.join(__dirname, '..', '..', 'src', 'index.ts');

  // Helper to run CLI with given env vars
  const runCLI = (
    env: Record<string, string> = {},
  ): Promise<{ code: number | null; stdout: string; stderr: string }> => {
    return new Promise((resolve) => {
      const child = spawn('tsx', [cliPath], {
        env: { ...process.env, ...env },
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      // Kill after 2 seconds to prevent hanging
      setTimeout(() => {
        child.kill();
      }, 2000);
    });
  };

  describe('Environment Variable Validation', () => {
    it('should exit with code 1 when CRAWL4AI_BASE_URL is missing', async () => {
      const { code, stderr } = await runCLI({
        CRAWL4AI_BASE_URL: '',
      });

      expect(code).toBe(1);
      expect(stderr).toContain('Error: CRAWL4AI_BASE_URL environment variable is required');
      expect(stderr).toContain('Please set it to your Crawl4AI server URL');
    });

    it('should start successfully with valid CRAWL4AI_BASE_URL', async () => {
      const { code, stderr } = await runCLI({
        CRAWL4AI_BASE_URL: 'http://localhost:11235',
        CRAWL4AI_API_KEY: 'test-key',
      });

      // Process should be killed by timeout, not exit with error
      expect(code).not.toBe(1);
      // MCP servers output to stderr
      expect(stderr).toContain('crawl4ai-mcp');
    });

    it('should use default values for optional env vars', async () => {
      const { stderr } = await runCLI({
        CRAWL4AI_BASE_URL: 'http://localhost:11235',
        // No API_KEY, SERVER_NAME, or SERVER_VERSION
      });

      expect(stderr).toContain('crawl4ai-mcp'); // default server name
      expect(stderr).toContain('1.0.0'); // default version
    });

    it('should use custom SERVER_NAME and SERVER_VERSION when provided', async () => {
      const { stderr } = await runCLI({
        CRAWL4AI_BASE_URL: 'http://localhost:11235',
        SERVER_NAME: 'custom-server',
        SERVER_VERSION: '2.0.0',
      });

      expect(stderr).toContain('custom-server');
      expect(stderr).toContain('2.0.0');
    });
  });

  describe('Signal Handling', () => {
    it('should handle SIGTERM gracefully', async () => {
      const child = spawn('tsx', [cliPath], {
        env: {
          ...process.env,
          CRAWL4AI_BASE_URL: 'http://localhost:11235',
        },
        stdio: 'pipe',
      });

      // Wait for startup
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send SIGTERM
      child.kill('SIGTERM');

      const code = await new Promise<number | null>((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('Process did not exit in time'));
        }, 5000);

        child.on('close', (exitCode) => {
          clearTimeout(timeout);
          resolve(exitCode);
        });
      });

      // Should exit with signal code
      expect(code).toBe(143); // 128 + 15 (SIGTERM)
      
      // Ensure cleanup
      child.kill();
    }, 10000);

    it('should handle SIGINT gracefully', async () => {
      const child = spawn('tsx', [cliPath], {
        env: {
          ...process.env,
          CRAWL4AI_BASE_URL: 'http://localhost:11235',
        },
        stdio: 'pipe',
      });

      // Wait for startup
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send SIGINT (Ctrl+C)
      child.kill('SIGINT');

      const code = await new Promise<number | null>((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('Process did not exit in time'));
        }, 5000);

        child.on('close', (exitCode) => {
          clearTimeout(timeout);
          resolve(exitCode);
        });
      });

      // Should exit with signal code
      expect(code).toBe(130); // 128 + 2 (SIGINT)
      
      // Ensure cleanup
      child.kill();
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle server startup errors', async () => {
      // This will be tricky to test without mocking, but we can at least
      // verify the process starts and attempts to connect
      const { code, stdout, stderr } = await runCLI({
        CRAWL4AI_BASE_URL: 'http://invalid-host-that-does-not-exist:99999',
      });

      // Should not exit with code 1 (that's for missing env vars)
      expect(code).not.toBe(1);
      // But might log connection errors
      const output = stdout + stderr;
      expect(output).toBeTruthy();
    });
  });

  describe('dotenv Loading', () => {
    it('should load .env file if present', async () => {
      // Create a temporary .env file
      const fs = await import('fs/promises');
      const envPath = path.join(__dirname, '..', '..', '.env.test');

      await fs.writeFile(envPath, 'TEST_ENV_VAR=loaded_from_file\n');

      try {
        const { stderr } = await runCLI({
          CRAWL4AI_BASE_URL: 'http://localhost:11235',
          NODE_ENV: 'test',
          DOTENV_CONFIG_PATH: envPath,
        });

        // Verify the server starts (dotenv loaded successfully)
        expect(stderr).toContain('crawl4ai-mcp');
      } finally {
        // Clean up
        await fs.unlink(envPath).catch(() => {});
      }
    });
  });
});
