# @maiat/agentkit-plugin

> Trust-gated transactions for Coinbase AgentKit agents

Automatically check trust scores before every transaction. Block interactions with untrusted addresses. One line to integrate.

## Install

```bash
npm install @maiat/agentkit-plugin
```

## Quick Start

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { maiatTrustPlugin } from "@maiat/agentkit-plugin";

const agent = new AgentKit({
  // your config
});

// Add Maiat trust gating
agent.use(maiatTrustPlugin({
  minScore: 3.0,  // Block addresses below 3.0/10
  chain: "base",
  onBlocked: (addr, score, risk) => {
    console.log(`🔴 Blocked ${addr}: ${score}/10 (${risk})`);
  },
}));
```

## How It Works

1. Agent wants to interact with address `0x1234...`
2. Plugin queries Maiat API: `GET /v1/score/0x1234...`
3. Score ≥ minScore → ✅ transaction proceeds
4. Score < minScore → ❌ `MaiatTrustError` thrown, transaction blocked

## Actions

### `maiat_check_trust`
Check trust score for any address.

```typescript
const result = await agent.run("Check if 0x4752... is trustworthy");
// → { score: 8.5, risk: "LOW", safe: true, ... }
```

### `maiat_gate_transaction`
Pre-flight check before executing a transaction.

```typescript
// Automatically called before transactions when plugin is active
// Throws MaiatTrustError if target is untrusted
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `minScore` | `3.0` | Minimum trust score (0-10) |
| `apiUrl` | `https://app.maiat.io` | API endpoint |
| `apiKey` | (none) | API key for higher limits |
| `chain` | `base` | Default chain |
| `warnOnly` | `false` | Log warnings instead of blocking |
| `onBlocked` | (none) | Callback when transaction blocked |
| `onCheck` | (none) | Callback for every check |

## Standalone Client

```typescript
import { MaiatClient } from "@maiat/agentkit-plugin";

const maiat = new MaiatClient({ chain: "base" });

const result = await maiat.checkTrust("0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24");
console.log(result.score, result.risk); // 8.5 "LOW"

// Batch check
const results = await maiat.batchCheck(["0x1234...", "0x5678..."]);
```

## x402 Integration

Works seamlessly with Coinbase's x402 protocol for agent-to-agent payments:

```typescript
import { maiatTrustPlugin } from "@maiat/agentkit-plugin";

// Agent automatically checks trust before paying via x402
const plugin = maiatTrustPlugin({
  minScore: 5.0,  // Higher threshold for payments
  onBlocked: (addr, score) => {
    console.log(`Payment to ${addr} blocked — trust score ${score}/10`);
  },
});
```

## License

MIT
