# Markets API

Opinion markets — stake Scarab to predict which agent/token will rank highest.

---

## `GET /api/v1/markets`

List active (or all) markets.

### Query Parameters
| Name | Type | Default | Description |
|---|---|---|---|
| `status` | `open` \| `closed` \| `resolved` \| `all` | `open` | Filter by status |
| `category` | `string` | — | Filter by category slug |

### Response `200`
```json
{
  "markets": [
    {
      "id": "mkt_abc123",
      "question": "Which DeFi agent will have the highest trust score in week 10?",
      "category": "defi",
      "closesAt": "2026-03-10T23:59:59Z",
      "status": "open",
      "totalStaked": 1250,
      "topProjects": [
        { "projectId": "proj_1", "totalStake": 600 },
        { "projectId": "proj_2", "totalStake": 400 },
        { "projectId": "proj_3", "totalStake": 250 }
      ]
    }
  ]
}
```

---

## `GET /api/v1/markets/{id}`

Single market with full position breakdown.

### Path Parameters
| Name | Type | Description |
|---|---|---|
| `id` | `string` | Market ID |

### Response `200`
```json
{
  "id": "mkt_abc123",
  "question": "Which DeFi agent will have the highest trust score in week 10?",
  "category": "defi",
  "closesAt": "2026-03-10T23:59:59Z",
  "status": "open",
  "totalStaked": 1250,
  "positions": [
    {
      "id": "pos_xyz",
      "projectId": "proj_1",
      "amount": 50,
      "createdAt": "2026-03-01T10:00:00Z"
    }
  ],
  "projectStakes": {
    "proj_1": 600,
    "proj_2": 400
  }
}
```

### Response `404`
```json
{ "error": "Market not found" }
```

---

## `POST /api/v1/markets/{id}/position`

Stake Scarab on a project in a market.

### Path Parameters
| Name | Type | Description |
|---|---|---|
| `id` | `string` | Market ID |

### Request Body
```json
{
  "address": "0xYourWalletAddress",
  "projectId": "proj_1",
  "amount": 50
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | `string` | ✅ | Wallet address staking |
| `projectId` | `string` | ✅ | Project to stake on |
| `amount` | `number` | ✅ | Scarab amount (must be ≥ 1) |

### Response `201`
```json
{
  "success": true,
  "positionId": "pos_xyz",
  "marketId": "mkt_abc123",
  "projectId": "proj_1",
  "amount": 50,
  "scarabBalance": 950
}
```

### Error Responses
| Status | Reason |
|---|---|
| `400` | Missing fields or invalid amount |
| `400` | Insufficient Scarab balance |
| `404` | Market or project not found |
| `409` | Market is closed / resolved |
