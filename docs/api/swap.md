# Swap API

Trust-gated Uniswap swaps on Base mainnet. Checks Maiat trust score before executing.

---

## `GET /api/v1/swap/quote`

Get a trust-gated Uniswap quote. Does **not** execute.

### Query Parameters
| Name | Type | Default | Description |
|---|---|---|---|
| `tokenIn` | `string` | `0x0000...0000` (ETH) | Input token address |
| `tokenOut` | `string` | USDC on Base | Output token address |
| `amount` | `string` | `1000000000000000000` | Amount in wei |
| `chainId` | `number` | `8453` | Chain ID (Base mainnet) |
| `swapper` | `string` | zero address | Wallet executing the swap |

### Response `200` — allowed
```json
{
  "allowed": true,
  "trustScore": 72,
  "tokenName": "DEGEN",
  "tokenReviews": 14,
  "tokenRating": 3.8,
  "riskLevel": "medium",
  "warning": "⚠️ DEGEN has moderate trust (72/100). 14 community reviews.",
  "quote": {
    "quoteId": "q_abc123",
    "tokenIn": "0x0000...0000",
    "tokenOut": "0x4ed4...efed",
    "amountIn": "1000000000000000000",
    "amountOut": "850000000000000000",
    "routeString": "ETH → DEGEN",
    "gasFeeUSD": "0.12"
  },
  "fees": {
    "baseFee": "0.5%",
    "effectiveFee": "0.35%",
    "discount": "30% off (Silver tier)",
    "saved": "0.15% saved"
  }
}
```

### Response `403` — blocked (trust score < 30)
```json
{
  "allowed": false,
  "trustScore": 18,
  "tokenName": "RUGPULL",
  "riskLevel": "high",
  "warning": "🚫 RUGPULL trust score is 18/100. Swap blocked.",
  "error": "Trust score too low"
}
```

---

## `POST /api/v1/swap`

Execute a trust-gated swap. Takes a valid quote response and broadcasts the transaction.

> **Rate limit:** 10 requests/minute per IP.

### Request Body

Pass the full quote response body from `GET /swap/quote`:

```json
{
  "quoteId": "q_abc123",
  "tokenIn": "0x0000000000000000000000000000000000000000",
  "tokenOut": "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
  "amountIn": "1000000000000000000",
  "swapper": "0xYourWalletAddress",
  "chainId": 8453
}
```

| Field | Required |
|---|---|
| `quoteId` | ✅ |
| `tokenIn` | ✅ |
| `tokenOut` | ✅ |
| `amountIn` | ✅ |
| `swapper` | ✅ |
| `chainId` | ✅ |

### Response `200`
```json
{
  "success": true,
  "txHash": "0xabc...def",
  "chainId": 8453,
  "explorer": "https://basescan.org/tx/0xabc...def"
}
```

### Error Responses
| Status | Reason |
|---|---|
| `400` | Invalid quote body (missing required fields) |
| `429` | Rate limit exceeded |
| `500` | Transaction broadcast failed |

---

## Supported Tokens (Base Mainnet)

| Symbol | Address |
|---|---|
| ETH | `0x0000000000000000000000000000000000000000` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| DAI | `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` |
| cbBTC | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| DEGEN | `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed` |
| USDT | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` |
