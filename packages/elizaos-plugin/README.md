# @jhinresh/elizaos-plugin

> Maiat Trust Score plugin for ElizaOS — verify trust before your agent swaps or transacts.

Adds trust-checking actions and evaluators to any ElizaOS agent so it can **refuse to interact with low-trust addresses** before executing swaps, transfers, or on-chain actions.

Powered by [Maiat Protocol](https://maiat-protocol.vercel.app) — on-chain verified trust scores for tokens, DeFi protocols, and AI agents on Base.

## Install

```bash
npm install @jhinresh/elizaos-plugin
```

## Usage

```typescript
import { maiatPlugin } from "@jhinresh/elizaos-plugin";

const agent = new ElizaAgent({
  plugins: [
    maiatPlugin({
      minScore: 3.0,   // reject addresses with score < 3.0/10
      chain: "base",
    }),
  ],
});
```

## What it does

| Component | Type | Behaviour |
|-----------|------|-----------|
| `CHECK_TRUST` | Action | Agent can ask "is 0x... safe?" and get a trust score |
| `TRUST_GATE` | Evaluator | Runs before any swap/transfer — rejects low-trust addresses |
| `TRUST_DATA` | Provider | Injects trust context into agent's world state |

## Trust Score Scale

| Score | Risk | Action |
|-------|------|--------|
| 7–10 | 🟢 Low | Allow |
| 4–6.9 | 🟡 Medium | Warn |
| 0–3.9 | 🔴 High | **Block** |

## Config

```typescript
maiatPlugin({
  apiUrl: "https://maiat-protocol.vercel.app",  // default
  apiKey: "your-key",   // optional — free tier: 100 req/day
  minScore: 3.0,        // 0–10 scale
  chain: "base",        // base | bnb | solana
})
```

## Links

- 🌐 [Live app](https://maiat-protocol.vercel.app)
- 📖 [API docs](https://maiat-protocol.vercel.app/docs)
- 🔗 [GitHub](https://github.com/JhiNResH/maiat-protocol)
- 📦 [npm](https://www.npmjs.com/package/@jhinresh/elizaos-plugin)

## License

MIT
