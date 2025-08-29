import { spawn } from 'child_process';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs/promises';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

describe('NPX Execution Tests', () => {
  // These tests ensure the package works when installed and run via npx
  // This prevents issues like the one in v2.6.11 where the server wouldn't start

  describe('Simulated NPX execution', () => {
    it('should start server when run from dist/index.js directly', async () => {
      // This simulates how npx runs the built package
      const distIndexPath = path.join(__dirname, '..', '..', 'dist', 'index.js');

      // Check if dist/index.js exists (it should after build)
      try {
        await fs.access(distIndexPath);
      } catch {
        console.warn('Skipping test - dist/index.js not found. Run "npm run build" first.');
        return;
      }

      const child = spawn('node', [distIndexPath], {
        env: {
          ...process.env,
          CRAWL4AI_BASE_URL: 'http://localhost:11235',
          CRAWL4AI_API_KEY: 'test-key',
          // Don't load .env file to simulate production
          NODE_ENV: 'production',
        },
        stdio: 'pipe',
      });

      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Wait for server to start
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          child.kill();
          resolve();
        }, 2000);

        child.stderr.on('data', (data) => {
          const output = data.toString();
          if (output.includes('started')) {
            clearTimeout(timeout);
            child.kill();
            resolve();
          }
        });
      });

      // Server should have started successfully
      expect(stderr).toContain('crawl4ai-mcp');
      expect(stderr).toContain('started');
    });

    it('should start server without dotenv when env vars are provided', async () => {
      // This tests that we don't require dotenv in production
      const distIndexPath = path.join(__dirname, '..', '..', 'dist', 'index.js');

      try {
        await fs.access(distIndexPath);
      } catch {
        console.warn('Skipping test - dist/index.js not found.');
        return;
      }

      // Temporarily rename node_modules/dotenv to simulate it not being available
      const dotenvPath = path.join(__dirname, '..', '..', 'node_modules', 'dotenv');
      const dotenvBackupPath = path.join(__dirname, '..', '..', 'node_modules', 'dotenv.backup');

      let dotenvRenamed = false;
      try {
        // Only rename if dotenv exists
        try {
          await fs.access(dotenvPath);
          await fs.rename(dotenvPath, dotenvBackupPath);
          dotenvRenamed = true;
        } catch {
          // dotenv doesn't exist, which is fine for this test
        }

        const child = spawn('node', [distIndexPath], {
          env: {
            CRAWL4AI_BASE_URL: 'http://localhost:11235',
            CRAWL4AI_API_KEY: 'test-key',
            PATH: process.env.PATH,
          },
          stdio: 'pipe',
        });

        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        // Wait for server to start
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            child.kill();
            resolve();
          }, 2000);
        });

        // Server should still start even without dotenv
        expect(stderr).toContain('crawl4ai-mcp');
        expect(stderr).toContain('started');
      } finally {
        // Restore dotenv if we renamed it
        if (dotenvRenamed) {
          await fs.rename(dotenvBackupPath, dotenvPath);
        }
      }
    });

    it('should handle MCP protocol initialization', async () => {
      // This simulates the full MCP handshake that Claude Desktop does
      const distIndexPath = path.join(__dirname, '..', '..', 'dist', 'index.js');

      try {
        await fs.access(distIndexPath);
      } catch {
        console.warn('Skipping test - dist/index.js not found.');
        return;
      }

      const child = spawn('node', [distIndexPath], {
        env: {
          ...process.env,
          CRAWL4AI_BASE_URL: 'http://localhost:11235',
          CRAWL4AI_API_KEY: 'test-key',
        },
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

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send MCP initialization request (like Claude Desktop does)
      const initRequest =
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0',
            },
          },
          id: 1,
        }) + '\n';

      child.stdin.write(initRequest);

      // Wait for response
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Parse the response
      const response = stdout.trim().split('\n').pop();
      let parsed;
      try {
        parsed = JSON.parse(response || '{}');
      } catch {
        // Response might not be valid JSON yet
        parsed = {};
      }

      child.kill();

      // Should have received an initialization response
      expect(stderr).toContain('started');
      expect(parsed.id).toBe(1);
      expect(parsed.result).toBeDefined();
    });

    it('should fail gracefully when CRAWL4AI_BASE_URL is missing', async () => {
      const distIndexPath = path.join(__dirname, '..', '..', 'dist', 'index.js');

      try {
        await fs.access(distIndexPath);
      } catch {
        console.warn('Skipping test - dist/index.js not found.');
        return;
      }

      const child = spawn('node', [distIndexPath], {
        env: {
          // Explicitly set to empty string to prevent dotenv from loading
          CRAWL4AI_BASE_URL: '',
          PATH: process.env.PATH,
        },
        stdio: 'pipe',
      });

      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise<number | null>((resolve, reject) => {
        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error('Process timeout'));
        }, 10000); // 10 second timeout

        child.on('exit', (code) => {
          clearTimeout(timeout);
          resolve(code);
        });

        child.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Should exit with error code
      expect(exitCode).toBe(1);
      expect(stderr).toContain('CRAWL4AI_BASE_URL environment variable is required');
      
      // Ensure cleanup
      child.kill();
    }, 15000); // 15 second test timeout
  });

  describe('NPX-specific edge cases', () => {
    it('should work with different Node.js execution paths', async () => {
      // NPX might use different paths for node execution
      const distIndexPath = path.join(__dirname, '..', '..', 'dist', 'index.js');

      try {
        await fs.access(distIndexPath);
      } catch {
        console.warn('Skipping test - dist/index.js not found.');
        return;
      }

      // Test with different argv[1] values that npx might use
      const testPaths = [
        distIndexPath,
        '/tmp/npx-12345/node_modules/.bin/mcp-crawl4ai-ts',
        path.join(process.env.HOME || '', '.npm/_npx/12345/node_modules/mcp-crawl4ai-ts/dist/index.js'),
      ];

      for (const testPath of testPaths) {
        const child = spawn('node', [distIndexPath], {
          env: {
            ...process.env,
            CRAWL4AI_BASE_URL: 'http://localhost:11235',
            // Simulate different execution contexts
            npm_execpath: testPath,
          },
          stdio: 'pipe',
        });

        let started = false;
        child.stderr.on('data', (data) => {
          if (data.toString().includes('started')) {
            started = true;
          }
        });

        // Give it time to start
        await new Promise((resolve) => setTimeout(resolve, 500));
        child.kill();

        expect(started).toBe(true);
      }
    });
  });
});
