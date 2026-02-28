# @maiat/x402-plugin

> Trust-gated x402 payments for AI agents. Never pay untrusted counterparties.

Wraps [Coinbase's x402 protocol](https://www.x402.org/) with [Maiat](https://maiat.xyz) trust verification. Every payment is trust-checked before the agent's wallet signs anything.

## Why?

x402 lets agents pay for API calls with USDC. But agents can't tell if a payment recipient is trustworthy. An agent might pay a malicious endpoint that drains funds or returns garbage data.

**Maiat x402 plugin adds a trust layer:**

```
Agent → x402 endpoint returns 402
     → Maiat checks recipient trust score
     → Score ≥ threshold → sign & pay
     → Score < threshold → block payment ❌
```

## Quick Start

```typescript
import { createTrustGatedClient } from "@maiat/x402-plugin";

const client = createTrustGatedClient({
  minScore: 3.0,        // Block payments to addresses scoring below 3/10
  maxPriceUsd: 1.0,     // Safety cap per request
  warnOnly: false,      // true = log warnings, false = hard block
});

// Automatically trust-checks before paying
const result = await client.fetch("https://api.example.com/paid-endpoint");
console.log(result.paid);         // true if payment was made
console.log(result.trustScore);   // Maiat trust score of recipient
```

## With Coinbase AgentKit

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { maiatTrustPlugin } from "@maiat/agentkit-plugin";
import { x402TrustPlugin } from "@maiat/x402-plugin";

const agent = new AgentKit({ /* ... */ });

// Trust-check all transactions
agent.use(maiatTrustPlugin({ minScore: 3.0 }));

// Trust-check all x402 payments
agent.use(x402TrustPlugin({ minScore: 3.0, walletClient }));
```

### Available Actions

| Action | Description |
|--------|-------------|
| `x402_trust_pay` | Make a trust-gated x402 payment |
| `x402_precheck` | Pre-check a recipient's trust score |
| `x402_price_check` | Probe endpoint price + recipient trust |

## Pre-check Before Paying

```typescript
const check = await client.precheck("0x1234...abcd");
// {
//   trusted: true,
//   score: 8.5,
//   risk: "LOW",
//   recommendation: "✅ Recipient is trusted (8.5/10). Safe to pay."
// }
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `minScore` | `3.0` | Minimum trust score (0-10) to allow payment |
| `maxPriceUsd` | `1.0` | Maximum price per request (safety cap) |
| `warnOnly` | `false` | Log warnings instead of blocking |
| `apiUrl` | `https://maiat-protocol.vercel.app` | Maiat API endpoint |
| `apiKey` | — | API key for higher rate limits |
| `cacheTtlMs` | `300000` | Trust score cache duration (5 min) |
| `onBlocked` | — | Callback when payment is blocked |
| `onPayment` | — | Callback on successful payment |

## How It Works

1. Agent calls `client.fetch(url)`
2. If endpoint returns HTTP 402, parse payment requirements
3. Check price against safety cap (`maxPriceUsd`)
4. Query Maiat API for recipient's trust score
5. If score ≥ `minScore` → sign payment → retry with `X-Payment` header
6. If score < `minScore` → throw `X402TrustError` (or warn)

## Error Handling

```typescript
import { X402TrustError, X402PriceError } from "@maiat/x402-plugin";

try {
  await client.fetch("https://sketchy-api.com/endpoint");
} catch (err) {
  if (err instanceof X402TrustError) {
    console.log(`Blocked: ${err.payTo} scored ${err.score}/10`);
  }
  if (err instanceof X402PriceError) {
    console.log(`Too expensive: $${err.price} > $${err.maxPrice}`);
  }
}
```

## License

MIT
