# Threat Report API

## `POST /api/v1/threat/report`

Called by **maiat-guard v0.8.0+** when it intercepts and blocks a malicious address.
Stores the report in the protocol DB and auto-flags addresses with 3+ reports.

### Authentication

None required. Rate limited to **30 requests/minute per IP**.

### Request Body

```json
{
  "maliciousAddress": "0xdeadbeef...",
  "threatType": "address_poisoning",
  "evidence": {
    "matchedPrefix": "0xdead",
    "matchedSuffix": "beef",
    "accountAge": 3600,
    "dustOnly": true
  },
  "guardVersion": "0.8.0",
  "chainId": 8453,
  "timestamp": 1710000000
}
```

| Field              | Type     | Required | Description                                                                      |
| ------------------ | -------- | -------- | -------------------------------------------------------------------------------- |
| `maliciousAddress` | `string` | ✅        | EVM address that was blocked. Must be a valid checksum or lowercase address.     |
| `threatType`       | `string` | ✅        | One of: `address_poisoning`, `low_trust`, `vanity_match`, `dust_liveness`       |
| `evidence`         | `object` | ✅        | Arbitrary key/value evidence collected by Guard. Stored as JSON.                |
| `guardVersion`     | `string` | ❌        | Guard SDK version string (for debugging).                                        |
| `chainId`          | `number` | ❌        | EVM chain ID where the threat was detected (e.g. 8453 = Base).                  |
| `timestamp`        | `number` | ❌        | Unix epoch (seconds) of the detection. Defaults to server receive time if omitted. |

### Response

**200 OK**

```json
{
  "received": true,
  "reportId": "clxxxxxxxx",
  "autoFlagged": true
}
```

| Field         | Type      | Description                                                                       |
| ------------- | --------- | --------------------------------------------------------------------------------- |
| `received`    | `boolean` | Always `true` on success.                                                         |
| `reportId`    | `string`  | CUID of the stored `ThreatReport` record.                                         |
| `autoFlagged` | `boolean` | Present and `true` when this report pushed the address to ≥3 reports → trustScore set to 0. |

### Error Responses

| Status | Body                                   | Cause                                     |
| ------ | -------------------------------------- | ----------------------------------------- |
| 400    | `{ "error": "maliciousAddress must be a valid EVM address" }` | Bad address format          |
| 400    | `{ "error": "threatType must be one of: ..." }`               | Unknown threat type         |
| 429    | `{ "error": "Too many requests" }`     | Rate limit exceeded (30 req/min per IP)   |
| 500    | `{ "error": "Failed to store threat report" }` | DB write failure             |

### Auto-Flagging Logic

When the same `maliciousAddress` accumulates **3 or more** reports, the protocol automatically:

1. Upserts an `AgentScore` row with `trustScore = 0` and `dataSource = "THREAT_FLAGGED"`
2. Returns `autoFlagged: true` in the response

This ensures the address is immediately blacklisted in trust score lookups and will be pushed to the on-chain oracle on the next cron run.

### Privacy

Reporter IP addresses are **never stored in plaintext**. They are one-way hashed with SHA-256 before storage and used only for deduplication.

### Side Effects

- Fires a best-effort `POST /feedback/threat` to Wadjet (non-blocking — failure is logged, not returned).
- If Wadjet's `/feedback/threat` endpoint is not yet live, the call is silently skipped.

---

## Related

- [Oracle Sync Cron](./cron.md) — Pushes auto-flagged scores on-chain every 6h
- [Outcome API](./swap.md) — Records swap outcomes for trust score recomputation
