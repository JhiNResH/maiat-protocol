# Scarab API

Scarab (🪲) is Maiat's off-chain reputation currency. Earned by reviewing, spent on votes/stakes.

| Action | Δ Scarab |
|---|---|
| First-ever claim | +20 |
| Daily claim | +5 (+streak bonus) |
| Submit review | −2 |
| Vote on project | −5 |
| Stake in market | −amount |

---

## `GET /api/v1/scarab?address={address}`

Get Scarab balance for a wallet.

### Query Parameters
| Name | Type | Description |
|---|---|---|
| `address` | `string` | Wallet address |

### Response `200`
```json
{
  "balance": 143,
  "totalEarned": 190,
  "totalSpent": 47,
  "streak": 5
}
```

---

## `POST /api/v1/scarab/claim`

Claim daily Scarab. First-ever claim gives 20; subsequent daily claims give 5 + streak bonus.

### Request Body
```json
{
  "address": "0xYourWalletAddress",
  "boost": false
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | `string` | ✅ | Claimant wallet address |
| `boost` | `boolean` | — | Double reward (first-week promo, default `false`) |

### Response `200`
```json
{
  "success": true,
  "amount": 20,
  "streak": 1,
  "isFirstClaim": true,
  "balance": 20,
  "message": "Welcome! You received 20 Scarab 🪲"
}
```

### Error Responses
| Status | Body |
|---|---|
| `429` | `{ "error": "Already claimed today. Come back tomorrow! 🪲" }` |
| `400` | `{ "error": "address is required" }` |

---

## `GET /api/v1/scarab/status?address={address}`

Check claim eligibility without consuming it.

### Response `200`
```json
{
  "address": "0x...",
  "canClaim": true,
  "nextClaimAt": null,
  "streak": 3,
  "balance": 35
}
```

---

## `GET /api/v1/scarab/nonce?address={address}`

Get a one-time SIWE nonce for signing Scarab operations.  
Used for wallet-signature-verified actions.

### Response `200`
```json
{
  "nonce": "a8f3k2p1",
  "expiresAt": "2026-03-06T01:30:00Z"
}
```
