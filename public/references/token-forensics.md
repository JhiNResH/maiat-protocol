# Token Forensics — Deep Rug Pull Analysis

Powered by Wadjet ML engine (XGBoost trained on 9,500+ agents).

## Endpoint

```
POST /api/v1/token-forensics
Body: { "tokenAddress": "0x..." }
Cost: $0.05 USDC
```

## Response

```json
{
  "rugScore": 73,           // 0-100, higher = riskier
  "riskLevel": "medium",    // low / medium / high / critical
  "breakdown": {
    "contract": {
      "ownershipRenounced": false,
      "isProxy": true,
      "verified": true
    },
    "holders": {
      "top10Concentration": 0.62,
      "whaleCount": 3
    },
    "liquidity": {
      "depth": 45000,
      "locked": false,
      "lockExpiry": null
    },
    "trading": {
      "honeypot": false,
      "buyTax": 0.05,
      "sellTax": 0.10,
      "abnormalPattern": false
    }
  },
  "wadjet": {
    "mlScore": 68,
    "confidence": 0.81,
    "heuristicScore": 80
  },
  "feedback": { "queryId": "q_abc123" }
}
```

## Score Blend

`rugScore = (mlScore × 0.6) + (heuristicScore × 0.4)`

## When to Use

Use `token-forensics` for deep analysis. For quick checks before swapping, use `GET /api/v1/token/{address}` instead.
