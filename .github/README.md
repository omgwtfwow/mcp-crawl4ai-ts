# GitHub Actions CI/CD

This project uses GitHub Actions for continuous integration.

## Workflows

### CI (`ci.yml`)
Runs on every push to main and on pull requests:
- Linting (ESLint)
- Code formatting check (Prettier)
- Build (TypeScript compilation)
- Unit tests (with nock mocks)
- Test coverage report

Tests run on Node.js 18.x and 20.x.

## Mock Maintenance

The unit tests use [nock](https://github.com/nock/nock) for HTTP mocking. This provides:
- Fast test execution (~1 second)
- Predictable test results
- No external dependencies during CI

**How to update mocks:**

Option 1 - Generate mock code from real API:
```bash
# This will call the real API and generate nock mock code
CRAWL4AI_API_KEY=your-key npm run generate-mocks
```

Option 2 - Capture mock responses as JSON:
```bash
# This will save responses to mock-responses.json
CRAWL4AI_API_KEY=your-key npm run update-mocks
```

Option 3 - Manual update:
1. Run integration tests to see current API behavior: `npm run test:integration`
2. Update the mock responses in `src/__tests__/crawl4ai-service.test.ts`
3. Ensure unit tests pass: `npm run test:unit`

The mocks are intentionally simple and focus on testing our code's behavior, not the API's exact responses.

## Running Tests Locally

```bash
# Run all tests
npm test

# Run only unit tests (fast, with mocks)
npm run test:unit

# Run only integration tests (slow, real API)
npm run test:integration

# Run with coverage
npm run test:coverage
```