# Copilot Instructions: `mcp-crawl4ai-ts`

Concise, project-specific guidance for AI coding agents. Optimize for correctness, safety, and existing test expectations.

## Architecture & Flow
- Entrypoint `src/index.ts`: loads dotenv only if `CRAWL4AI_BASE_URL` unset; fails fast if missing. Passes env + version into `Crawl4AIServer`.
- `src/server.ts`: registers MCP tools, keeps a `Map<string, SessionInfo>` for persistent browser sessions, and uses `validateAndExecute` (Zod parse + invariant error message format). Do NOT alter error text pattern: `Invalid parameters for <tool>: ...` (tests & LLM reliability depend on it).
- Service layer `src/crawl4ai-service.ts`: pure HTTP wrapper around Crawl4AI endpoints; centralizes axios timeout & error translation (preserve wording like `Request timed out`, `Request failed with status <code>:` — tests rely on these substrings).
- Handlers (`src/handlers/*.ts`): orchestration & response shaping (text content arrays). No direct business logic inside server class beyond wiring.
- Validation schemas (`src/schemas/validation-schemas.ts` + helpers): all tool inputs defined here. Use `createStatelessSchema` for stateless tools; session/persistent tools have discriminated unions.

## Tool Model
- Stateless tools (e.g. `get_markdown`, `capture_screenshot`, `execute_js`) spin up a fresh browser each call.
- Session-based operations use `manage_session` (create/list/clear) + `crawl` for persistent state, allowing chained JS + screenshot/pdf in ONE call. Never try to chain separate stateless calls to reflect JS mutations.
- Output always returned as base64/text blocks; do not add file system side-effects unless explicitly using a save path param already supported (screenshots: optional local save dir).

## JS & Input Validation Nuances
- JS code schema rejects: HTML entities (&quot;), literal `\n` tokens outside strings, embedded HTML tags. Reuse `JsCodeSchema`—do not duplicate logic.
- For `get_markdown`: if filter is `bm25` or `llm`, `query` becomes required (enforced via `.refine`). Keep this logic centralized.

## Sessions
- `SessionInfo` tracks `created_at` & `last_used`. Update `last_used` whenever a session-based action runs. Don't leak sessions: `clear` must delete map entry.

## Error Handling Pattern
- Handlers wrap service calls; on failure use `this.formatError(error, '<operation>')` (see `BaseHandler`). Preserve format: `Failed to <operation>: <detail>`.
- Zod validation errors: keep exact join pattern of `path: message` segments.

## Adding / Modifying a Tool (Checklist)
1. Define or extend schema in `validation-schemas.ts` (prefer composing existing small schemas; wrap with `createStatelessSchema` if ephemeral).
2. Add service method if it maps to a new Crawl4AI endpoint (pure HTTP + validation of URL / JS content; reuse existing validators).
3. Implement handler method (assemble request body, post-process response to `content: [{ type: 'text', text }]`).
4. Register in `setupHandlers()` list (tool description should mirror README style & clarify stateless vs session).
5. Write tests: unit (schema + handler success/failure), integration (happy path with mocked or real endpoint). Place under matching folder in `src/__tests__/`.
6. Update README tool table if user-facing, and CHANGELOG + version bump.

## Commands & Workflows
- Install: `npm install`
- Build: `npm run build` (tsconfig.build.json)
- Dev (watch): `npm run dev`
- Tests: `npm run test` | unit only: `npm run test:unit` | integration: `npm run test:integration` | coverage: `npm run test:coverage`
- Lint/Format: `npm run lint`, `npm run lint:fix`, `npm run format:check`
- Pre-flight composite: `npm run check`

### Testing Invariants
- NEVER invoke `jest` directly for integration tests; rely on `npm run test:integration` (injects `NODE_OPTIONS=--experimental-vm-modules` + `JEST_TEST_TYPE=integration`).
- Unit tests auto-set `CRAWL4AI_BASE_URL` in `jest.setup.cjs`; integration tests require real env vars (`CRAWL4AI_BASE_URL`, optional `CRAWL4AI_API_KEY`, LLM vars) via `.env` or exported.
- To run a single integration file: `npm run test:integration -- path/to/file.test.ts`.
- Jest pinned at 29.x with `ts-jest@29`; do not upgrade one without the other.
- Symptom mapping: import syntax error or hang at first test => you bypassed the npm script.

## Conventions & Invariants
- No `any`; prefer `unknown` + narrowing.
- Keep responses minimal & textual; do not introduce new top-level fields in tool results without updating all tests.
- Timeout remains 120s in axios clients—changing requires test updates.
- Commit style: conventional commits; no emojis, AI signoffs, or verbose bodies.

## References
- README (tools & examples), CLAUDE.md (contrib rules), CHANGELOG (release notes), coverage report for quality gates.

If something is ambiguous, inspect existing handlers first and mirror the closest established pattern before inventing a new one.
