# Changelog

## Version 2.1.2 (2025-08-03)

### Documentation
- Updated Node.js requirement from 16+ to 18+ to reflect actual testing and support
  - Node.js 16 reached End-of-Life in September 2023
  - CI only tests on Node.js 18.x and 20.x
  - Added `engines` field to package.json to enforce Node.js 18+ requirement

## Version 2.1.1 (2025-08-03)

### Bug Fixes
- Fixed GitHub homepage README display issue by renaming .github/README.md to CI.md
  - GitHub was showing the CI documentation instead of the main project README

## Version 2.1.0 (2025-08-03)

### Bug Fixes
- Fixed `smart_crawl` bug where markdown object was incorrectly printed as `[object Object]`
  - Now correctly accesses `result.markdown.raw_markdown` for content display
- Fixed integration test timeout issues:
  - Replaced example.com with httpbin.org/html in tests to avoid "domcontentloaded" timeout issues
  - Fixed httpbin.org URLs by adding proper path suffixes (e.g., /links/5/0)
  - Limited Jest parallelization for integration tests to prevent server overload
- Fixed parameter mapping in `get_markdown` tool - now correctly maps schema properties (`filter`, `query`, `cache`) to API parameters (`f`, `q`, `c`)
- Fixed `smart_crawl` schema to use `follow_links` parameter instead of `remove_images`
- Fixed `extract_links` schema mismatch - corrected schema to use `categorize` parameter as defined in tool
- Fixed `extract_links` implementation to properly handle link objects returned by API
- Fixed `crawl_recursive` schema mismatch - corrected schema to use `include_pattern` and `exclude_pattern` instead of `filter_pattern` and `bypass_cache`
- Fixed `crawl_recursive` implementation to use `/crawl` endpoint instead of `/md` for proper link extraction
- Fixed `crawl_recursive` type issues and improved link handling for recursive crawling
- Fixed `parse_sitemap` implementation to fetch sitemaps directly instead of through Crawl4AI server API
- Fixed `create_session` schema to make `session_id` optional as documented
- Enhanced `create_session` response to include all session parameters for programmatic access
- Implemented proper handling for non-functional server parameters:
  - `batch_crawl`: `remove_images` now uses `exclude_tags` in crawler_config to actually remove images
  - `smart_crawl`: `follow_links` now crawls URLs found in sitemaps/RSS feeds (max 10 URLs)
- Fixed `crawl` and `generate_pdf` tools PDF response to use proper MCP SDK embedded resource format with blob field

### Improvements
- Added comprehensive integration tests for `batch_crawl` tool (7 tests)
- Added comprehensive integration tests for `smart_crawl` tool (8 tests)
- Fixed all ESLint formatting issues across the codebase
- Enhanced error handling for empty URL arrays in batch_crawl
- Improved test reliability by replacing problematic test URLs
- Updated tool descriptions to accurately reflect actual behavior
- Added proper TypeScript types for getMarkdown function
- Enhanced test coverage for batch_crawl parameter handling
- Added comprehensive unit and integration tests for `extract_links` tool
- Improved JSON endpoint detection in `extract_links` tool
- Better error handling for `extract_links` with graceful error messages
- Added comprehensive integration tests for `crawl_recursive` tool
- Improved `crawl_recursive` output format to clearly show depth levels and internal link counts
- Enhanced error handling in `crawl_recursive` to continue crawling even if individual pages fail
- Added comprehensive integration tests for `parse_sitemap` tool with various test cases
- Added comprehensive integration tests for session management tools (`create_session`, `clear_session`, `list_sessions`)
- Enhanced integration tests for `extract_with_llm` tool to handle non-deterministic LLM responses
- Installed nock library for future HTTP mocking in unit tests
- Fixed TypeScript lint warnings by replacing `any` types with proper types:
  - Changed error handling to use proper type assertions
  - Updated `unknown[]` for JavaScript execution results
  - Used `Record<string, unknown>` for generic objects
  - Created `LinkItem` interface for better type safety
  - Fixed all production code `any` types
  - Removed unused legacy `CrawlResult` interface
- Consolidated unit tests to use nock for HTTP mocking:
  - Removed redundant Jest mock test file
  - Removed unused mocks directory
  - Renamed test file for clarity
  - Improved unit test performance from 92s to ~1s by removing timeout tests
  - Cleaned up test organization and removed test README
- Added GitHub Actions CI workflow:
  - Automatic testing on push to main and pull requests
  - Tests run on Node.js 18.x and 20.x
  - Includes linting, formatting checks, and build verification
- Added mock helper scripts:
  - `npm run generate-mocks`: Generate nock mock code from real API
  - `npm run view-mocks`: View and save API responses for reference
  - Both scripts help maintain accurate test mocks

## Version 2.0.1 (2025-08-02)
Update README

## Version 2.0.0 (2025-08-02)

### Breaking Changes
- Renamed `crawl_with_config` tool to `crawl`

### New Features
- Added comprehensive response types for all endpoints (PDF, screenshot, HTML, markdown)
- Enhanced parameter validation with clearer error messages
- Improved documentation for JavaScript execution patterns
- Added selector strategy guidance for form interaction
- Better distinction between `wait_for` and `wait_until` usage

### Bug Fixes
- Fixed server 500 errors by always including `crawler_config` in requests
- Updated media and links types to match actual server responses
- Corrected validation for `js_only` parameter usage

### Documentation
- Added troubleshooting section with common issues and solutions
- Included practical examples for form filling and multi-step navigation
- Enhanced tool descriptions with clear warnings and recommendations
- Added selector strategy guide for working with dynamic content

### Technical Improvements
- Updated all TypeScript types based on actual server responses
- Improved error handling and user-friendly messages
- Enhanced Zod validation schemas with helpful refinements
- Added comprehensive integration tests for new features

### Known Issues
- `js_only: true` causes server serialization errors - use `screenshot: true` as workaround
- Using `wait_for` with elements that already exist can cause timeouts - use `wait_until` instead

## Version 1.0.2
- Initial stable release with full MCP implementation
- Support for all Crawl4AI endpoints
- Basic session management
- Integration with MCP clients