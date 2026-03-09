# Changelog

All notable changes to maiat-protocol.

## [Unreleased] — 2026-03-09

### Fixed (Critical)
- **oracle-updater**: Was pushing trust scores to Base Sepolia testnet instead of Base mainnet. Now defaults to `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` (MaiatOracle on Base mainnet). Set `ORACLE_USE_TESTNET=true` to opt back into testnet.
- **plugins**: All packages were calling deprecated `/api/v1/score` endpoint (returned 301/410). Migrated to `/api/v1/agent/{address}`.
- **virtuals-plugin / agentkit-plugin**: `/api/v1/defi/{query}` endpoint does not exist. Now routes to `/api/v1/token/{address}` for addresses or `/api/v1/explore?search=` for slugs.
- **agent-token-mapper**: HTTP → HTTPS for Virtuals ACP API (`acpx.virtuals.io`).

### Fixed (Security)
- **agents/route.ts**: SQL `ORDER BY` column name was string-interpolated from user input. Replaced with explicit allowlisted query branches (no injection possible).

### Improved
- **prisma.ts**: Exported `dbAvailable` flag. API routes now fall back to live Virtuals ACP data when `DATABASE_URL` is not configured, instead of returning 500.
- **agent/[address]/route.ts**: Stale-while-revalidate — serves cached data immediately, triggers background Virtuals refresh when cache is >1 hour old.
- **agents/route.ts**: Added `fetchAgentsFromVirtuals()` live fallback when DB is unavailable.
- **vercel.json**: `index-agents` and `oracle-sync` crons now run every 6h (was once daily). Keeps trust scores fresher.
- **fetch timeouts**: Added `AbortSignal.timeout(15_000)` to all bare `fetch()` calls in `token-analysis.ts`, `agent-token-mapper.ts`, and all plugin packages.

### Packages bumped
- `@jhinresh/agentkit-plugin`: 0.2.1 → 0.2.2
- `@jhinresh/elizaos-plugin`: 0.2.1 → 0.2.2
- `@jhinresh/game-maiat-plugin`: 0.1.1 → 0.1.2
- `@jhinresh/virtuals-plugin`: 0.2.1 → 0.2.2

---

## Known Issues (not yet fixed)
- ERC-8004 reputation data is fetched but not factored into blended trust score calculation.
- `lastSyncTime` in oracle-updater is in-memory only — resets on serverless cold starts.
- `runAcpIndexer()` upserts agents one-by-one (N+1 pattern). Should batch.
- Missing index on `QueryLog.outcome` column causes full table scan in blended score queries.
