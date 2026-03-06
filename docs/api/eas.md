# EAS (Ethereum Attestation Service) API

Maiat uses EAS on Base to create on-chain trust receipts — immutable, verifiable proofs of every trust interaction.

---

## Schema UIDs (Base Mainnet)

Set in Vercel env vars after one-time registration:

| Env Var | Purpose |
|---|---|
| `EAS_TRUST_SCORE_SCHEMA_UID` | Trust score attestation |
| `EAS_REVIEW_SCHEMA_UID` | Review submission attestation |
| `EAS_ACP_SCHEMA_UID` | ACP interaction attestation |

---

## `POST /api/v1/eas/register`

**One-time setup.** Registers the 3 Maiat EAS schemas on-chain.  
Requires `MAIAT_ADMIN_PRIVATE_KEY` configured in server env.

### Auth
```
Authorization: Bearer <EAS_REGISTER_SECRET>
```

### Response `201`
```json
{
  "success": true,
  "schemas": {
    "EAS_TRUST_SCORE_SCHEMA_UID": "0xabc...111",
    "EAS_REVIEW_SCHEMA_UID": "0xabc...222",
    "EAS_ACP_SCHEMA_UID": "0xabc...333"
  },
  "instruction": "Add these UIDs to your .env file"
}
```

### Error Responses
| Status | Reason |
|---|---|
| `401` | Invalid or missing Bearer token |
| `500` | `MAIAT_ADMIN_PRIVATE_KEY` not configured |

---

## Auto-Attestation (Cron)

EAS attestations are created **automatically** by the daily cron job (`/cron/auto-attest`).  
Every `trust_swap`, `token_check`, `agent_trust`, `agent_deep_check` query within the last 24h gets attested.

See: [cron.md](./cron.md#get-apiv1cronauto-attest)

---

## Viewing Attestations

Attestations are visible on EAS Explorer:  
`https://base.easscan.org/attestation/view/{uid}`

Or query via `GET /wallet/{address}/eas-receipts` to list all receipts for a wallet.
