<p align="center">
  <img src="https://raw.githubusercontent.com/JhiNResH/maiat-protocol/master/apps/web/public/maiat-logo.jpg" width="120" alt="Maiat" />
</p>

<h1 align="center">Maiat Protocol</h1>

<p align="center">
  <strong>The trust layer for agentic commerce.</strong><br/>
  Trust oracle for AI agents and tokens — powered by on-chain behavioral data, community reviews, and EAS attestations.
</p>

<p align="center">
  <a href="https://app.maiat.io">Live App</a> ·
  <a href="https://app.maiat.io/docs">API Docs</a> ·
  <a href="https://app.virtuals.io/acp">ACP Agent #18281</a>
</p>

---

## Monorepo Structure

```
maiat-protocol/
├── apps/
│   └── web/                    # Next.js dashboard + API (app.maiat.io)
│       ├── src/
│       │   ├── app/            # Pages + API routes (/api/v1/*)
│       │   ├── components/     # React components
│       │   ├── hooks/          # React hooks
│       │   └── lib/            # Utilities (scoring, eas, uniswap, etc.)
│       ├── public/             # Static assets
│       ├── prisma/             # Database schema + migrations
│       ├── package.json        # Web app dependencies
│       └── tsconfig.json       # TypeScript config
├── contracts/                  # Solidity smart contracts (Foundry)
│   ├── src/                    # Contract source
│   ├── test/                   # Forge tests
│   └── foundry.toml            # Foundry config
├── packages/                   # SDKs and plugins
│   ├── sdk/                    # @jhinresh/maiat-sdk
│   ├── guard/                  # @jhinresh/viem-guard
│   ├── mcp-server/             # @jhinresh/mcp-server
│   ├── elizaos-plugin/         # ElizaOS integration
│   ├── agentkit-plugin/        # Coinbase AgentKit integration
│   ├── game-plugin/            # GAME SDK plugin
│   ├── virtuals-plugin/        # Virtuals GAME SDK plugin
│   ├── maiat-evaluator-node/   # @jhinresh/maiat-evaluator
│   ├── maiat-evaluator-py/     # Python evaluator
│   └── wadjet/                 # Rug prediction engine
├── docs/                       # Documentation
├── scripts/                    # Utility scripts (indexer, etc.)
├── tests/                      # Root-level integration tests
├── package.json                # Workspace config
├── tsconfig.json               # Root TypeScript config
└── LICENSE
```

---

## Quick Start

```bash
git clone https://github.com/JhiNResH/maiat-protocol.git
cd maiat-protocol
npm install

# Run the web app
npm run dev

# Or run from the apps/web directory
cd apps/web
npm run dev
```

---

## Smart Contracts (Base Mainnet)

| Contract                 | Address                                      |
| ------------------------ | -------------------------------------------- |
| **MaiatOracle**          | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` |
| **MaiatReceiptResolver** | `0xda696009655825124bcbfdd5755c0657d6d841c0` |
| **TrustGateHook**        | `0xf980Ad83bCbF2115598f5F555B29752F00b8daFf` |

**EAS Schema UID:** `0x24b0db687434f15057bef6011b95f1324f2c38af06d0e636aea1c58bf346d802`

---

## API Endpoints

| Route | Method | Description |
|---|---|---|
| `/api/v1/agent/:address` | GET | Agent trust score |
| `/api/v1/agent/:address/deep` | GET | Deep analysis |
| `/api/v1/agents` | GET | Browse all 2,292+ agents |
| `/api/v1/token/:address` | GET | Token honeypot check |
| `/api/v1/swap/quote` | POST | Trust-gated Uniswap quote |
| `/api/v1/review` | POST | Submit review (costs 2 Scarab) |
| `/api/v1/wallet/:address/passport` | GET | Trust Passport |
| `/api/v1/scarab` | GET | Scarab balance |
| `/api/v1/markets` | GET | Prediction markets |

---

## Packages

| Package | Description |
|---------|-------------|
| `@jhinresh/maiat-sdk` | Core SDK — trust scores, token safety, swap verification |
| `@jhinresh/viem-guard` | Viem middleware — auto-checks trust before transactions |
| `@jhinresh/mcp-server` | MCP Server for Claude, GPT, and MCP-compatible AIs |
| `@jhinresh/elizaos-plugin` | ElizaOS plugin — trust-gate actions and evaluators |
| `@jhinresh/agentkit-plugin` | Coinbase AgentKit plugin |
| `@jhinresh/game-maiat-plugin` | GAME SDK plugin |
| `@jhinresh/virtuals-plugin` | Virtuals GAME SDK plugin |
| `@jhinresh/maiat-evaluator` | Drop-in ACP evaluator |

---

## Contributing

Pull requests are welcome. For major changes, open an issue first.

We use [Conventional Commits](https://www.conventionalcommits.org/) and squash-merge all PRs.

---

## License

MIT
