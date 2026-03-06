# Explore API

Trending agents, tokens, and recently indexed entities.

---

## `GET /api/v1/explore`

Trending agents and tokens across all categories.

### Query Parameters
| Name | Type | Default | Description |
|---|---|---|---|
| `category` | `string` | — | Filter by category (e.g. `defi`, `ai-agents`) |
| `limit` | `number` | `20` | Number of results |

### Response `200`
```json
{
  "trending": [
    {
      "address": "0x...",
      "name": "AlphaSwap Agent",
      "category": "defi",
      "trustScore": 91,
      "verdict": "proceed",
      "totalJobs": 203,
      "reviewCount": 7
    }
  ],
  "updatedAt": "2026-03-06T00:00:00Z"
}
```

---

## `GET /api/v1/explore/recent`

Recently indexed or updated agents/tokens (last 24h).

### Response `200`
```json
{
  "recent": [
    {
      "address": "0x...",
      "name": "NewBot v2",
      "trustScore": 55,
      "verdict": "caution",
      "indexedAt": "2026-03-05T22:00:00Z"
    }
  ],
  "count": 12
}
```
