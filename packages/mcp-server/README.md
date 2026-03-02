# @maiat/mcp-server

> The trust layer for AI agents — as an MCP server.

Query Maiat trust scores from Claude, GPT, or any MCP-compatible AI assistant. One tool call = one trust check.

## Quick Start

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maiat": {
      "command": "npx",
      "args": ["@maiat/mcp-server"],
      "env": {
        "ALCHEMY_API_KEY": "your-alchemy-key",
        "MAIAT_API_KEY": "optional-for-higher-rate-limits"
      }
    }
  }
}
```

### From source

```bash
cd packages/mcp-server
npm install
npm run build
npm start
```

## Tools

| Tool | Description |
|------|-------------|
| `trust_score` | Get trust score (0-1000) for any address |
| `token_safety` | Token-specific safety check (honeypot, rug, liquidity) |
| `protocol_rating` | Protocol safety rating by name |
| `batch_score` | Score up to 10 addresses at once |
| `explain_score` | Human-readable score explanation |

## Example Usage (in Claude)

> "Check if 0x1234...abcd is safe to interact with"

The AI will call `trust_score` and return something like:

```json
{
  "address": "0x1234...abcd",
  "score": 720,
  "risk": "low",
  "source": "live_onchain",
  "breakdown": {
    "base": 100,
    "txHistory": 200,
    "balanceSignal": 100,
    "contractBonus": 50
  }
}
```

## Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Scoring Methodology | `maiat://methodology` | How scores are calculated |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ALCHEMY_API_KEY` | Recommended | Enables live on-chain scoring |
| `MAIAT_API_KEY` | Optional | Higher rate limits on Maiat API |
| `MAIAT_API_URL` | Optional | Custom API endpoint (default: https://maiat.xyz/api/v1) |

## How It Works

1. **Maiat DB first** — checks indexed scores from Maiat's database
2. **Live fallback** — if no DB record, queries on-chain data via Alchemy
3. **Scoring algorithm** — transaction count, balance, contract status → 0-1000 score

## License

MIT
