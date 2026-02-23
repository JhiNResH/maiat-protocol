# Maiat Protocol — Tests & Audit Probes

## Running Tests

```bash
# Unit tests (no DB or network required)
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests (hits live production API)
RUN_E2E=true npm run test:e2e

# Security audit probes (standalone script)
npm run audit:probe
```

## Test Files

| File | Description |
|------|-------------|
| `tests/unit/trust-score.test.ts` | Unit tests for `computeAgentTrustScore`, `getSimpleTrustScore`, and `getConfidence` — pure functions, no mocks needed |
| `tests/unit/agents-route.test.ts` | Unit tests for `GET /api/v1/agents` — mocks Prisma, tests sorting/filtering/pagination |
| `tests/unit/trust-route.test.ts` | Unit tests for `GET /api/v1/trust/:address` — mocks Prisma and trust-score, tests lookup and chain matching |
| `tests/e2e/live-api.test.ts` | End-to-end tests against the live production API (skipped by default, requires `RUN_E2E=true`) |
| `scripts/audit-probe.ts` | Standalone security audit probe script that checks for all HIGH severity findings |

## Known Vulnerabilities Documented in Tests

Tests marked with `// KNOWN VULN` or `// BUG` intentionally assert current broken behavior. They serve as **regression markers** — when the underlying vulnerability is fixed, these tests will fail, signaling that the assertions should be updated to match the patched behavior.

| ID | Severity | Description | Test File |
|----|----------|-------------|-----------|
| **H1** | High | Name Impersonation — `getAIBaselineScore()` keys on `project.name` (mutable), not address. Any agent named "uniswap" gets baseline score 90. | `trust-score.test.ts` |
| **H2** | High | Chain Oracle — Chain mismatch 404 leaks `actual_chain` field, enabling cross-chain enumeration of agent deployments. | `trust-route.test.ts`, `live-api.test.ts` |
| **H3/M3** | Medium | Negative Offset — `offset=-1` is passed directly to Prisma `skip`, causing a 500 error. Should be clamped to >= 0. | `agents-route.test.ts`, `live-api.test.ts` |
| **H3a** | High | Rate Limiting — No rate limiting detected on `/agents` endpoint, allowing full DB enumeration. | `live-api.test.ts`, `audit-probe.ts` |
