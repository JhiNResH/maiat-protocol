#!/usr/bin/env node

// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
var MAIAT_API_BASE = process.env.MAIAT_API_URL || "https://maiat.xyz/api/v1";
var MAIAT_API_KEY = process.env.MAIAT_API_KEY || "";
var ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
var ALCHEMY_BASE_RPC = process.env.ALCHEMY_BASE_RPC || `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
async function maiatFetch(path, body) {
  const url = `${MAIAT_API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...MAIAT_API_KEY ? { "x-api-key": MAIAT_API_KEY } : {}
  };
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers,
    ...body ? { body: JSON.stringify(body) } : {}
  });
  return res.json();
}
async function alchemyCall(method, params) {
  const res = await fetch(ALCHEMY_BASE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  const json = await res.json();
  return json.result;
}
function riskLabel(score) {
  if (score >= 800) return "very_low";
  if (score >= 600) return "low";
  if (score >= 400) return "medium";
  if (score >= 200) return "high";
  return "critical";
}
async function liveScore(address) {
  if (!ALCHEMY_API_KEY) return null;
  try {
    const addr = address.toLowerCase();
    const [balance, txCount, code] = await Promise.all([
      alchemyCall("eth_getBalance", [addr, "latest"]),
      alchemyCall("eth_getTransactionCount", [addr, "latest"]),
      alchemyCall("eth_getCode", [addr, "latest"])
    ]);
    const balanceEth = parseInt(balance, 16) / 1e18;
    const txCountNum = parseInt(txCount, 16);
    const isContract = code && code !== "0x";
    let score = 100;
    score += Math.min(txCountNum / 5, 200);
    score += balanceEth > 0.1 ? 100 : balanceEth > 0 ? 50 : 0;
    score += isContract ? 50 : 0;
    score = Math.min(Math.round(score), 1e3);
    return {
      address: addr,
      score,
      risk: riskLabel(score),
      source: "live_onchain",
      chain: "base",
      breakdown: {
        base: 100,
        txHistory: Math.min(txCountNum / 5, 200),
        balanceSignal: balanceEth > 0.1 ? 100 : balanceEth > 0 ? 50 : 0,
        contractBonus: isContract ? 50 : 0
      },
      raw: {
        balanceEth: Math.round(balanceEth * 1e4) / 1e4,
        txCount: txCountNum,
        isContract
      }
    };
  } catch {
    return null;
  }
}
var server = new McpServer({
  name: "maiat-trust",
  version: "0.1.0"
});
server.tool(
  "trust_score",
  "Get the Maiat trust score for any on-chain address. Returns a score (0-1000), risk level, and breakdown. Works for wallets, tokens, and contracts on Base chain.",
  {
    address: z.string().describe("Ethereum/Base address (0x...) to score"),
    chain: z.enum(["base", "ethereum"]).default("base").describe("Chain to query (default: base)"),
    realtime: z.boolean().default(false).describe("Force live on-chain scoring even if cached data exists")
  },
  async ({ address, chain, realtime }) => {
    if (!realtime) {
      try {
        const data = await maiatFetch("/trust-score", {
          agentAddress: address
        });
        if (data.found) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    address,
                    score: data.trustScore?.overall ?? null,
                    risk: riskLabel(data.trustScore?.overall ?? 0),
                    source: "maiat_db",
                    chain,
                    project: data.project,
                    trustScore: data.trustScore
                  },
                  null,
                  2
                )
              }
            ]
          };
        }
      } catch {
      }
    }
    const live = await liveScore(address);
    if (live) {
      return {
        content: [{ type: "text", text: JSON.stringify(live, null, 2) }]
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            address,
            score: null,
            risk: "unknown",
            message: "Unable to score. Set ALCHEMY_API_KEY for live on-chain scoring."
          })
        }
      ]
    };
  }
);
server.tool(
  "token_safety",
  "Check if a token is safe: honeypot detection, rug pull risk, liquidity analysis. Returns safety flags and risk assessment.",
  {
    address: z.string().describe("Token contract address (0x...)"),
    chain: z.enum(["base", "ethereum"]).default("base")
  },
  async ({ address, chain }) => {
    try {
      const data = await maiatFetch("/trust-check", {
        address,
        type: "token"
      });
      if (data && !data.error) {
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      }
    } catch {
    }
    const live = await liveScore(address);
    if (live) {
      const flags = [];
      if (!live.raw.isContract) flags.push("NOT_A_CONTRACT");
      if (live.raw.txCount < 10) flags.push("LOW_ACTIVITY");
      if (live.score < 200) flags.push("HIGH_RISK");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                address,
                chain,
                type: "token",
                safe: live.score >= 400 && live.raw.isContract,
                score: live.score,
                risk: live.risk,
                flags,
                breakdown: live.breakdown
              },
              null,
              2
            )
          }
        ]
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ address, safe: null, error: "Unable to analyze" })
        }
      ]
    };
  }
);
server.tool(
  "protocol_rating",
  "Get safety rating for a DeFi protocol by name (e.g. 'Uniswap', 'Aave'). Returns trust score, audit status, and TVL data.",
  {
    name: z.string().describe("Protocol name (e.g. 'Uniswap', 'Aave', 'Morpho')")
  },
  async ({ name }) => {
    try {
      const data = await maiatFetch("/trust-score", { projectName: name });
      if (data.found) {
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
        };
      }
    } catch {
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name,
            found: false,
            message: `No trust data for "${name}". Submit it at https://maiat.xyz`
          })
        }
      ]
    };
  }
);
server.tool(
  "batch_score",
  "Score multiple addresses at once. Returns an array of trust scores. Max 10 addresses per call.",
  {
    addresses: z.array(z.string()).max(10).describe("Array of addresses to score (max 10)"),
    chain: z.enum(["base", "ethereum"]).default("base")
  },
  async ({ addresses, chain }) => {
    const results = await Promise.all(
      addresses.map(async (addr) => {
        try {
          const data = await maiatFetch("/trust-score", {
            agentAddress: addr
          });
          if (data.found) {
            return {
              address: addr,
              score: data.trustScore?.overall ?? null,
              risk: riskLabel(data.trustScore?.overall ?? 0),
              source: "maiat_db"
            };
          }
        } catch {
        }
        const live = await liveScore(addr);
        if (live) {
          return {
            address: addr,
            score: live.score,
            risk: live.risk,
            source: "live_onchain"
          };
        }
        return { address: addr, score: null, risk: "unknown" };
      })
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ chain, results }, null, 2)
        }
      ]
    };
  }
);
server.tool(
  "explain_score",
  "Get a human-readable explanation of what a trust score means and what factors contribute to it. Useful for explaining risk to end users.",
  {
    score: z.number().min(0).max(1e3).describe("Trust score to explain"),
    context: z.enum(["swap", "transfer", "interact", "general"]).default("general").describe("Transaction context for tailored advice")
  },
  async ({ score, context }) => {
    const risk = riskLabel(score);
    const explanations = {
      very_low: `Score ${score}/1000 \u2014 Very Low Risk. This address has strong trust signals: high transaction volume, verified source code, audit history, and no blacklist flags. Safe for ${context === "swap" ? "swapping" : context === "transfer" ? "sending funds" : "interaction"}.`,
      low: `Score ${score}/1000 \u2014 Low Risk. Good trust signals with moderate transaction history. Generally safe, but always verify large transactions independently.`,
      medium: `Score ${score}/1000 \u2014 Medium Risk. Mixed signals. Some positive indicators (activity, balance) but missing verification or audit data. Proceed with caution for ${context === "swap" ? "swaps" : "transactions"} over $1,000.`,
      high: `Score ${score}/1000 \u2014 High Risk. Limited trust data. Low transaction count or recent creation. Consider starting with a small test transaction.`,
      critical: `Score ${score}/1000 \u2014 Critical Risk. Very few or negative trust signals. Possible scam indicators. NOT recommended for any transaction. If this is a known legitimate address, please report at https://maiat.xyz.`
    };
    const advice = {
      swap: "For swaps: check liquidity depth and slippage before proceeding.",
      transfer: "For transfers: send a small test amount first.",
      interact: "For contract interaction: verify the source code on the block explorer.",
      general: "Always verify addresses independently for large amounts."
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              score,
              risk,
              explanation: explanations[risk],
              advice: advice[context],
              thresholds: {
                very_low: "800-1000",
                low: "600-799",
                medium: "400-599",
                high: "200-399",
                critical: "0-199"
              }
            },
            null,
            2
          )
        }
      ]
    };
  }
);
server.resource(
  "scoring-methodology",
  "maiat://methodology",
  async () => ({
    contents: [
      {
        uri: "maiat://methodology",
        mimeType: "text/markdown",
        text: `# Maiat Trust Scoring Methodology (v1)

## Score Range: 0\u20131000

| Range | Risk Level | Meaning |
|-------|-----------|---------|
| 800\u20131000 | Very Low | Highly trusted, audited, verified |
| 600\u2013799 | Low | Good history, generally safe |
| 400\u2013599 | Medium | Mixed signals, proceed with caution |
| 200\u2013399 | High | Limited data, risky |
| 0\u2013199 | Critical | Potential scam, avoid |

## Scoring Factors (v1)

- **Wallet Age** \u2014 Older = more trusted (up to +200)
- **Transaction Count** \u2014 More activity = more trusted (up to +200)
- **Source Verification** \u2014 Verified contract code (+100)
- **Audit History** \u2014 Professional audit (+200)
- **Blacklist Check** \u2014 On known scam list (\u2212500)
- **DeFi Interactions** \u2014 Protocol usage (\xD710 multiplier)
- **Liquidity Health** \u2014 TVL and depth (weighted)

## Data Sources

- On-chain data via Alchemy (Base, Ethereum)
- Blacklists: GoPlus, ScamSniffer
- Audit databases: auto-scraped
- Maiat user reports (v2)

## On-Chain Contracts

- TrustScoreOracle (Base Sepolia): \`0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139\`
- TrustGateHook (Uniswap v4): \`0xF6065FB076090af33eE0402f7e902B2583e7721E\`

Learn more: https://maiat.xyz/docs
`
      }
    ]
  })
);
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("\u{1F6E1}\uFE0F Maiat MCP Server running (stdio)");
}
main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
