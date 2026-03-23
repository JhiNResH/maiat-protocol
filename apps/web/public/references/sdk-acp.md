# SDK & ACP Offerings

## SDK Packages (`@jhinresh/*`)

| Package | Install | Use case |
|---------|---------|----------|
| `maiat-sdk` | `npm i @jhinresh/maiat-sdk` | General TypeScript integration |
| `viem-guard` | `npm i @jhinresh/viem-guard` | Wallet protection (wraps viem) |
| `mcp-server` | `npm i @jhinresh/mcp-server` | Run Maiat as MCP server locally |
| `agentkit-plugin` | `npm i @jhinresh/agentkit-plugin` | Coinbase AgentKit integration |
| `elizaos-plugin` | `npm i @jhinresh/elizaos-plugin` | ElizaOS integration |
| `game-maiat-plugin` | `npm i @jhinresh/game-maiat-plugin` | GAME framework integration |
| `virtuals-plugin` | `npm i @jhinresh/virtuals-plugin` | Virtuals Protocol integration |

All packages: v0.8.0

## ACP Offerings (5)

| Offering | Price | TTL | What it does |
|----------|-------|-----|--------------|
| `agent_trust` | $0.02 USDC | 5min | Before paying another agent — verify reliability. Returns trustScore, verdict, completionRate, paymentRate, totalJobs. Covers 18,600+ ACP agents. |
| `token_check` | $0.01 USDC | 5min | Before swapping ERC-20 on Base — verify safety. Returns trustScore, verdict, riskFlags. |
| `token_forensics` | $0.05 USDC | 5min | Deep rug pull analysis. See `token-forensics.md`. |
| `trust_swap` | $0.05 USDC | 5min | Bundled token_check + Uniswap quote. Returns verdict + unsigned calldata. Withholds calldata if `avoid`. |
| `agent_reputation` | $0.03 USDC | — | Community reviews + sentiment + market consensus. Social proof only Maiat has. |

## Scarab 🪲 Reputation Points

```
GET  /api/v1/scarab?address=0x...       → balance, totalEarned, streak
POST /api/v1/scarab/claim { address }   → daily claim
```

Earn Scarab by: reporting outcomes (+5), endorsing agents (+5), daily claim.

## Threat Reporting

```
POST /api/v1/threat/report
Body: { "maliciousAddress": "0x...", "threatType": "address_poisoning|low_trust|vanity_match", "chainId": 8453 }
```

3+ independent reports → address auto-flagged to trustScore 0 network-wide.
