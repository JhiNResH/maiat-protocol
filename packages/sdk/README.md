# maiat-sdk

Trust scores, token safety & swap verification for AI agents.

## Install

```bash
npm install maiat-sdk
```

## Quick Start

```typescript
import { Maiat } from "maiat-sdk";

const maiat = new Maiat();

// Check if an agent is trustworthy
const trusted = await maiat.isTrusted("0x...");

// Token safety check
const safe = await maiat.isTokenSafe(
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
);

// Full trust score
const score = await maiat.agentTrust(
  "0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D",
);
console.log(score.trustScore, score.verdict); // 69, "caution"

// Trust-verified swap quote
const swap = await maiat.trustSwap({
  swapper: "0x...",
  tokenIn: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // ETH
  tokenOut: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  amount: "10000000000000000", // 0.01 ETH in wei
});
console.log(swap.trust.tokenOut?.score); // 100
console.log(swap.calldata); // ready-to-sign tx calldata
```

## API

### `new Maiat(config?)`

| Option    | Default                             | Description                             |
| --------- | ----------------------------------- | --------------------------------------- |
| `baseUrl` | `https://app.maiat.io` | API base URL                            |
| `apiKey`  | —                                   | Optional API key for higher rate limits |
| `timeout` | `15000`                             | Request timeout (ms)                    |

### Methods

| Method                           | Returns             | Description                        |
| -------------------------------- | ------------------- | ---------------------------------- |
| `agentTrust(address)`            | `AgentTrustResult`  | Full trust score + breakdown       |
| `tokenCheck(address)`            | `TokenCheckResult`  | Token safety analysis              |
| `trustSwap(params)`              | `TrustSwapResult`   | Swap quote with trust verification |
| `listAgents(limit?)`             | `{ agents, total }` | Browse indexed agents              |
| `isTrusted(address, threshold?)` | `boolean`           | Quick trust check (default ≥60)    |
| `isTokenSafe(address)`           | `boolean`           | Quick token safety check           |

## Outcome Reporting (Training Data)

The most valuable data for improving trust accuracy:

```typescript
const maiat = new Maiat({ clientId: "my-trading-bot" });

// 1. Check trust
const score = await maiat.agentTrust("0xCounterparty");

// 2. Take action based on trust
if (score.trustScore >= 60) {
  // ... execute swap ...
}

// 3. Report what happened
await maiat.reportOutcome({
  target: "0xCounterparty",
  action: "swap",
  result: "success", // or "failure", "scam"
  txHash: "0x...", // on-chain proof
  maiatVerdict: score.verdict,
  maiatScore: score.trustScore,
});
```

This closes the feedback loop: check → act → report → oracle gets smarter.

## Links

- Protocol: [app.maiat.io](https://app.maiat.io)
- GitHub: [JhiNResH/maiat-protocol](https://github.com/JhiNResH/maiat-protocol)
- ACP: [Agent #3723 on Virtuals](https://app.virtuals.io/acp)
