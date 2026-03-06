# Cron Jobs (Internal)

Vercel scheduled jobs. All protected by `Authorization: Bearer <CRON_SECRET>`.

> These endpoints are **not for public use**. They run automatically via Vercel Cron.

---

## `GET /api/v1/cron/index-agents`

**Schedule:** Daily at 02:00 UTC  
Fetches all agents from Virtuals ACP (`acpx.virtuals.io/api/agents`) and upserts trust scores into DB.

### Auth
```
Authorization: Bearer <CRON_SECRET>
```

### Response `200`
```json
{
  "success": true,
  "indexed": 1823,
  "updated": 47,
  "failed": 2,
  "stats": { "avgScore": 68.4, "newAgents": 12 },
  "timestamp": "2026-03-06T02:00:01Z"
}
```

### Required Env Vars
| Var | Purpose |
|---|---|
| `CRON_SECRET` | Auth token for this endpoint |

---

## `GET /api/v1/cron/auto-attest`

**Schedule:** Daily at 03:00 UTC  
Queries the last 24h of `query_logs` (type: `trust_swap`, `token_check`, `agent_trust`, `agent_deep_check`) and fires EAS attestations for each unique buyer–target pair.

Silently skips if `EAS_TRUST_SCORE_SCHEMA_UID` or `MAIAT_ADMIN_PRIVATE_KEY` is not set.

### Response `200`
```json
{
  "success": true,
  "attested": 34,
  "skipped": 3,
  "timestamp": "2026-03-06T03:00:02Z"
}
```

### Required Env Vars
| Var | Purpose |
|---|---|
| `CRON_SECRET` | Auth token |
| `EAS_TRUST_SCORE_SCHEMA_UID` | Schema UID (from `/eas/register`) |
| `MAIAT_ADMIN_PRIVATE_KEY` | Relayer wallet private key |

---

## `GET /api/v1/cron/oracle-sync`

**Schedule:** Every 6 hours  
Syncs trust scores from Maiat DB → on-chain `TrustScoreOracle` contract on Base.

### Response `200`
```json
{
  "synced": 128,
  "txHashes": ["0xabc...", "0xdef..."],
  "errors": []
}
```

### Required Env Vars
| Var | Purpose |
|---|---|
| `CRON_SECRET` | Auth token |
| `MAIAT_ADMIN_PRIVATE_KEY` | Oracle updater wallet |
| `TRUST_SCORE_ORACLE_ADDRESS` | Deployed oracle contract address |

---

## vercel.json Cron Config

```json
{
  "crons": [
    { "path": "/api/v1/cron/index-agents",  "schedule": "0 2 * * *" },
    { "path": "/api/v1/cron/auto-attest",   "schedule": "0 3 * * *" },
    { "path": "/api/v1/cron/oracle-sync",   "schedule": "0 */6 * * *" }
  ]
}
```
