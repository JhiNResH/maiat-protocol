# Maiat Guard — Wallet Protection

Wraps every `sendTransaction` with a trust check before it executes.

## Install

```bash
npm install @jhinresh/viem-guard viem
```

## Usage

```ts
import { withMaiatTrust } from '@jhinresh/viem-guard'

const wallet = withMaiatTrust(walletClient, {
  minScore: 60,        // block txs to addresses with score < 60
  antiPoison: true,    // detect address poisoning attacks
})

await wallet.sendTransaction({ to, value })
```

## What Guard Does

1. **Anti-Poisoning** — detects vanity match attacks and dust liveness traps
2. **Trust Check** — queries Maiat before every tx. Low trust → blocks
3. **TrustGateHook** — auto-injects hookData for best fee tier on Uniswap v4 pools
4. **Collective Immunity** — blocked threats reported network-wide instantly
5. **Outcome Recording** — every tx result feeds back to Wadjet ML

## Package

`@jhinresh/viem-guard` (v0.8.0) — [GitHub](https://github.com/JhiNResH/maiat-guard)
