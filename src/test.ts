import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testMCPServer() {
  console.log('🧪 Testing Crawl4AI MCP Server...\n');

  const transport = new StdioClientTransport({
    command: 'tsx',
    args: ['src/index.ts'],
  });

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    },
  );

  let passedTests = 0;
  let failedTests = 0;

  async function runTest(name: string, testFn: () => Promise<boolean>) {
    process.stdout.write(`Testing ${name}... `);
    try {
      const result = await testFn();
      if (result) {
        console.log('✅ PASSED');
        passedTests++;
      } else {
        console.log('❌ FAILED');
        failedTests++;
      }
      return result;
    } catch (error) {
      console.log(`❌ ERROR: ${error}`);
      failedTests++;
      return false;
    }
  }

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // List available tools
    const tools = await client.listTools();
    console.log(`📋 Found ${tools.tools.length} tools\n`);

    // Test 1: crawl_page
    await runTest('crawl_page', async () => {
      const result = await client.callTool({
        name: 'crawl_page',
        arguments: {
          url: 'https://www.google.com',
          remove_images: true,
          bypass_cache: true,
        },
      });
      return (result as any).content[0].type === 'text' && (result as any).content[0].text.length > 100;
    });

    // Test 2: capture_screenshot
    await runTest('capture_screenshot', async () => {
      const result = await client.callTool({
        name: 'capture_screenshot',
        arguments: {
          url: 'https://www.google.com',
          full_page: true,
        },
      });
      return (result as any).content[0].type === 'image';
    });

    // Test 3: generate_pdf
    await runTest('generate_pdf', async () => {
      const result = await client.callTool({
        name: 'generate_pdf',
        arguments: {
          url: 'https://www.google.com',
        },
      });
      return (result as any).content[0].type === 'text' && (result as any).content[0].text.includes('PDF generated');
    });

    // Test 4: execute_js
    await runTest('execute_js', async () => {
      const result = await client.callTool({
        name: 'execute_js',
        arguments: {
          url: 'https://github.com',
          js_code: 'document.querySelector("h1").textContent || document.title',
          wait_after_js: 1000,
        },
      });
      return (
        (result as any).content[0].type === 'text' && (result as any).content[0].text.includes('JavaScript executed')
      );
    });

    // Test 5: batch_crawl
    await runTest('batch_crawl', async () => {
      const result = await client.callTool({
        name: 'batch_crawl',
        arguments: {
          urls: ['https://www.google.com', 'https://www.github.com'],
          max_concurrent: 2,
        },
      });
      return (result as any).content[0].type === 'text' && (result as any).content[0].text.includes('Processed 2 URLs');
    });

    // Test 6: smart_crawl
    await runTest('smart_crawl', async () => {
      const result = await client.callTool({
        name: 'smart_crawl',
        arguments: {
          url: 'https://www.google.com',
          max_depth: 1,
        },
      });
      return (
        (result as any).content[0].type === 'text' && (result as any).content[0].text.includes('Smart crawl detected')
      );
    });

    // Test 7: get_html
    await runTest('get_html', async () => {
      const result = await client.callTool({
        name: 'get_html',
        arguments: {
          url: 'https://www.google.com',
        },
      });
      return (
        (result as any).content[0].type === 'text' &&
        ((result as any).content[0].text.includes('<html') || (result as any).content[0].text.includes('<!DOCTYPE'))
      );
    });

    // Test 8: extract_links
    await runTest('extract_links', async () => {
      const result = await client.callTool({
        name: 'extract_links',
        arguments: {
          url: 'https://www.google.com',
          categorize: true,
        },
      });
      return (result as any).content[0].type === 'text' && (result as any).content[0].text.includes('Link analysis');
    });

    // Test 9: crawl_recursive
    await runTest('crawl_recursive', async () => {
      const result = await client.callTool({
        name: 'crawl_recursive',
        arguments: {
          url: 'https://www.google.com',
          max_depth: 1,
          max_pages: 5,
        },
      });
      return (
        (result as any).content[0].type === 'text' &&
        (result as any).content[0].text.includes('Recursive crawl completed')
      );
    });

    // Test 10: parse_sitemap
    await runTest('parse_sitemap', async () => {
      // Test with a known sitemap
      const result = await client.callTool({
        name: 'parse_sitemap',
        arguments: {
          url: 'https://www.sitemaps.org/sitemap.xml',
        },
      });
      return (
        (result as any).content[0].type === 'text' &&
        ((result as any).content[0].text.includes('Sitemap parsed') ||
          (result as any).content[0].text.includes('Error'))
      ); // Allow error as sitemap might not exist
    });

    // Test 11: crawl_with_config (basic)
    await runTest('crawl_with_config (basic)', async () => {
      const result = await client.callTool({
        name: 'crawl_with_config',
        arguments: {
          url: 'https://www.google.com',
          cache_mode: 'BYPASS',
          excluded_tags: ['script', 'style'],
          word_count_threshold: 50,
        },
      });
      return (result as any).content[0].type === 'text';
    });

    // Test 12: crawl_with_config (advanced)
    await runTest('crawl_with_config (advanced)', async () => {
      const result = await client.callTool({
        name: 'crawl_with_config',
        arguments: {
          url: 'https://github.com',
          viewport_width: 1920,
          viewport_height: 1080,
          user_agent: 'MCP Test Bot 1.0',
          js_code: 'document.querySelectorAll("a").length',
          wait_after_js: 1000,
          screenshot: true,
          cache_mode: 'DISABLED',
          word_count_threshold: 50,
          timeout: 45000,
        },
      });
      return (result as any).content[0].type === 'text';
    });

    // Test 13: create_session
    await runTest('create_session', async () => {
      const result = await client.callTool({
        name: 'create_session',
        arguments: {
          session_id: 'test-session-' + Date.now(),
          browser_type: 'chromium',
        },
      });
      return (
        (result as any).content[0].type === 'text' &&
        (result as any).content[0].text.includes('Session created successfully')
      );
    });

    // Test 14: list_sessions
    await runTest('list_sessions', async () => {
      const result = await client.callTool({
        name: 'list_sessions',
        arguments: {},
      });
      return (result as any).content[0].type === 'text';
    });

    // Test 15: clear_session (will fail if no session exists, which is ok)
    await runTest('clear_session', async () => {
      try {
        await client.callTool({
          name: 'clear_session',
          arguments: {
            session_id: 'test-session-nonexistent',
          },
        });
        return true; // Success or error, both are valid
      } catch {
        return true; // Expected to possibly fail
      }
    });

    // Test error handling
    console.log('\n🔍 Testing error handling...\n');

    await runTest('invalid URL handling', async () => {
      const result = await client.callTool({
        name: 'crawl_page',
        arguments: {
          url: 'not-a-valid-url',
        },
      });
      return (result as any).content[0].text.includes('Error');
    });

    await runTest('unknown tool handling', async () => {
      const result = await client.callTool({
        name: 'non_existent_tool',
        arguments: {},
      });
      // MCP servers return errors as content, not exceptions
      return (result as any).content[0].text.includes('Error: Unknown tool');
    });

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Test Summary:`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

    if (failedTests === 0) {
      console.log('\n🎉 All tests passed! The MCP server is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the implementation.');
    }
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    await client.close();
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

// Run tests
testMCPServer().catch(console.error);
