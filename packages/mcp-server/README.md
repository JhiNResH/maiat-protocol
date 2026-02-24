# @maiat/mcp-server

> Trust scoring for AI agents via Model Context Protocol

Maiat MCP Server gives any MCP-compatible AI agent (Claude, GPT, etc.) the ability to check trust scores for on-chain addresses before interacting with them.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maiat": {
      "command": "npx",
      "args": ["@maiat/mcp-server"],
      "env": {
        "MAIAT_API_URL": "https://maiat-protocol.vercel.app"
      }
    }
  }
}
```

Then ask Claude: *"Check if 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24 is trustworthy"*

### OpenClaw / Other MCP Hosts

```bash
npx @maiat/mcp-server
```

## Tools

| Tool | Description |
|------|-------------|
| `maiat_check_trust` | Trust score for any address (0-10 scale) |
| `maiat_check_token` | Token safety check (honeypot, rug pull, liquidity) |
| `maiat_batch_check` | Check up to 10 addresses at once |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAIAT_API_URL` | `https://maiat-protocol.vercel.app` | Maiat API base URL |
| `MAIAT_API_KEY` | (none) | API key for higher rate limits |

## Example Output

```
## 🟢 Trust Score: 8.5/10 — LOW Risk

**Address:** `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`
**Type:** PROTOCOL (Uniswap V3 Router)

### Score Breakdown
- On-chain History: 3.4/4.0
- Contract Analysis: 2.6/3.0
- Blacklist Check: 1.7/2.0
- Activity Pattern: 0.9/1.0

### Flags: KNOWN_PROTOCOL, AUDITED, VERIFIED
### Audited By: Trail of Bits, ABDK
```

## License

MIT
