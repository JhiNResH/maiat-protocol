#!/usr/bin/env node
/**
 * Maiat Trust Score MCP Server
 *
 * Exposes Maiat's trust scoring API as MCP tools so any
 * AI assistant (Claude, GPT, etc.) can check if an on-chain
 * address, token, or protocol is trustworthy — in one call.
 *
 * Tools:
 *   - trust_score        — get trust score for an address
 *   - token_safety       — token-specific safety check (honeypot, rug, liquidity)
 *   - protocol_rating    — protocol safety rating by name
 *   - batch_score        — score multiple addresses at once
 *   - explain_score      — human-readable explanation of a score breakdown
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAIAT_API_BASE =
  process.env.MAIAT_API_URL || "https://maiat.xyz/api/v1";
const MAIAT_API_KEY = process.env.MAIAT_API_KEY || "";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const ALCHEMY_BASE_RPC =
  process.env.ALCHEMY_BASE_RPC ||
  `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function maiatFetch(path: string, body?: Record<string, unknown>) {
  const url = `${MAIAT_API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(MAIAT_API_KEY ? { "x-api-key": MAIAT_API_KEY } : {}),
  };

  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  return res.json();
}

async function alchemyCall(method: string, params: unknown[]) {
  const res = await fetch(ALCHEMY_BASE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  return json.result;
}

function riskLabel(score: number): string {
  if (score >= 800) return "very_low";
  if (score >= 600) return "low";
  if (score >= 400) return "medium";
  if (score >= 200) return "high";
  return "critical";
}

/** Compute a live trust score from on-chain data when Maiat DB has no record */
async function liveScore(address: string) {
  if (!ALCHEMY_API_KEY) return null;

  try {
    const addr = address.toLowerCase();

    // Parallel RPC calls
    const [balance, txCount, code] = await Promise.all([
      alchemyCall("eth_getBalance", [addr, "latest"]),
      alchemyCall("eth_getTransactionCount", [addr, "latest"]),
      alchemyCall("eth_getCode", [addr, "latest"]),
    ]);

    const balanceEth = parseInt(balance, 16) / 1e18;
    const txCountNum = parseInt(txCount, 16);
    const isContract = code && code !== "0x";

    // Simple scoring algorithm (matches PRODUCT_VISION v1)
    let score = 100; // base
    score += Math.min(txCountNum / 5, 200); // tx history, cap 200
    score += balanceEth > 0.1 ? 100 : balanceEth > 0 ? 50 : 0;
    score += isContract ? 50 : 0;
    // Capped at 550 without audit/verification data
    score = Math.min(Math.round(score), 1000);

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
        contractBonus: isContract ? 50 : 0,
      },
      raw: {
        balanceEth: Math.round(balanceEth * 10000) / 10000,
        txCount: txCountNum,
        isContract,
      },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "maiat-trust",
  version: "0.1.0",
});

// ---- Tool: trust_score ----
server.tool(
  "trust_score",
  "Get the Maiat trust score for any on-chain address. Returns a score (0-1000), risk level, and breakdown. Works for wallets, tokens, and contracts on Base chain.",
  {
    address: z
      .string()
      .describe("Ethereum/Base address (0x...) to score"),
    chain: z
      .enum(["base", "ethereum"])
      .default("base")
      .describe("Chain to query (default: base)"),
    realtime: z
      .boolean()
      .default(false)
      .describe("Force live on-chain scoring even if cached data exists"),
  },
  async ({ address, chain, realtime }) => {
    // Try Maiat API first (has richer data from DB)
    if (!realtime) {
      try {
        const data = await maiatFetch("/trust-score", {
          agentAddress: address,
        });
        if (data.found) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    address,
                    score: data.trustScore?.overall ?? null,
                    risk: riskLabel(data.trustScore?.overall ?? 0),
                    source: "maiat_db",
                    chain,
                    project: data.project,
                    trustScore: data.trustScore,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      } catch {
        // Fall through to live scoring
      }
    }

    // Live on-chain scoring
    const live = await liveScore(address);
    if (live) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify(live, null, 2) }],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            address,
            score: null,
            risk: "unknown",
            message:
              "Unable to score. Set ALCHEMY_API_KEY for live on-chain scoring.",
          }),
        },
      ],
    };
  }
);

// ---- Tool: token_safety ----
server.tool(
  "token_safety",
  "Check if a token is safe: honeypot detection, rug pull risk, liquidity analysis. Returns safety flags and risk assessment.",
  {
    address: z.string().describe("Token contract address (0x...)"),
    chain: z.enum(["base", "ethereum"]).default("base"),
  },
  async ({ address, chain }) => {
    // Try Maiat API
    try {
      const data = await maiatFetch("/trust-check", {
        address,
        type: "token",
      });
      if (data && !data.error) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      }
    } catch {
      // fall through
    }

    // Live analysis
    const live = await liveScore(address);
    if (live) {
      const flags: string[] = [];
      if (!live.raw.isContract) flags.push("NOT_A_CONTRACT");
      if (live.raw.txCount < 10) flags.push("LOW_ACTIVITY");
      if (live.score < 200) flags.push("HIGH_RISK");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                address,
                chain,
                type: "token",
                safe: live.score >= 400 && live.raw.isContract,
                score: live.score,
                risk: live.risk,
                flags,
                breakdown: live.breakdown,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ address, safe: null, error: "Unable to analyze" }),
        },
      ],
    };
  }
);

// ---- Tool: protocol_rating ----
server.tool(
  "protocol_rating",
  "Get safety rating for a DeFi protocol by name (e.g. 'Uniswap', 'Aave'). Returns trust score, audit status, and TVL data.",
  {
    name: z.string().describe("Protocol name (e.g. 'Uniswap', 'Aave', 'Morpho')"),
  },
  async ({ name }) => {
    try {
      const data = await maiatFetch("/trust-score", { projectName: name });
      if (data.found) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      }
    } catch {
      // fall through
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            name,
            found: false,
            message: `No trust data for "${name}". Submit it at https://maiat.xyz`,
          }),
        },
      ],
    };
  }
);

// ---- Tool: batch_score ----
server.tool(
  "batch_score",
  "Score multiple addresses at once. Returns an array of trust scores. Max 10 addresses per call.",
  {
    addresses: z
      .array(z.string())
      .max(10)
      .describe("Array of addresses to score (max 10)"),
    chain: z.enum(["base", "ethereum"]).default("base"),
  },
  async ({ addresses, chain }) => {
    const results = await Promise.all(
      addresses.map(async (addr) => {
        try {
          const data = await maiatFetch("/trust-score", {
            agentAddress: addr,
          });
          if (data.found) {
            return {
              address: addr,
              score: data.trustScore?.overall ?? null,
              risk: riskLabel(data.trustScore?.overall ?? 0),
              source: "maiat_db",
            };
          }
        } catch {
          // fall through
        }

        const live = await liveScore(addr);
        if (live) {
          return {
            address: addr,
            score: live.score,
            risk: live.risk,
            source: "live_onchain",
          };
        }

        return { address: addr, score: null, risk: "unknown" };
      })
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ chain, results }, null, 2),
        },
      ],
    };
  }
);

// ---- Tool: explain_score ----
server.tool(
  "explain_score",
  "Get a human-readable explanation of what a trust score means and what factors contribute to it. Useful for explaining risk to end users.",
  {
    score: z.number().min(0).max(1000).describe("Trust score to explain"),
    context: z
      .enum(["swap", "transfer", "interact", "general"])
      .default("general")
      .describe("Transaction context for tailored advice"),
  },
  async ({ score, context }) => {
    const risk = riskLabel(score);

    const explanations: Record<string, string> = {
      very_low: `Score ${score}/1000 — Very Low Risk. This address has strong trust signals: high transaction volume, verified source code, audit history, and no blacklist flags. Safe for ${context === "swap" ? "swapping" : context === "transfer" ? "sending funds" : "interaction"}.`,
      low: `Score ${score}/1000 — Low Risk. Good trust signals with moderate transaction history. Generally safe, but always verify large transactions independently.`,
      medium: `Score ${score}/1000 — Medium Risk. Mixed signals. Some positive indicators (activity, balance) but missing verification or audit data. Proceed with caution for ${context === "swap" ? "swaps" : "transactions"} over $1,000.`,
      high: `Score ${score}/1000 — High Risk. Limited trust data. Low transaction count or recent creation. Consider starting with a small test transaction.`,
      critical: `Score ${score}/1000 — Critical Risk. Very few or negative trust signals. Possible scam indicators. NOT recommended for any transaction. If this is a known legitimate address, please report at https://maiat.xyz.`,
    };

    const advice: Record<string, string> = {
      swap: "For swaps: check liquidity depth and slippage before proceeding.",
      transfer: "For transfers: send a small test amount first.",
      interact: "For contract interaction: verify the source code on the block explorer.",
      general: "Always verify addresses independently for large amounts.",
    };

    return {
      content: [
        {
          type: "text" as const,
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
                critical: "0-199",
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---- Resource: scoring methodology ----
server.resource(
  "scoring-methodology",
  "maiat://methodology",
  async () => ({
    contents: [
      {
        uri: "maiat://methodology",
        mimeType: "text/markdown",
        text: `# Maiat Trust Scoring Methodology (v1)

## Score Range: 0–1000

| Range | Risk Level | Meaning |
|-------|-----------|---------|
| 800–1000 | Very Low | Highly trusted, audited, verified |
| 600–799 | Low | Good history, generally safe |
| 400–599 | Medium | Mixed signals, proceed with caution |
| 200–399 | High | Limited data, risky |
| 0–199 | Critical | Potential scam, avoid |

## Scoring Factors (v1)

- **Wallet Age** — Older = more trusted (up to +200)
- **Transaction Count** — More activity = more trusted (up to +200)
- **Source Verification** — Verified contract code (+100)
- **Audit History** — Professional audit (+200)
- **Blacklist Check** — On known scam list (−500)
- **DeFi Interactions** — Protocol usage (×10 multiplier)
- **Liquidity Health** — TVL and depth (weighted)

## Data Sources

- On-chain data via Alchemy (Base, Ethereum)
- Blacklists: GoPlus, ScamSniffer
- Audit databases: auto-scraped
- Maiat user reports (v2)

## On-Chain Contracts

- TrustScoreOracle (Base Sepolia): \`0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139\`
- TrustGateHook (Uniswap v4): \`0xF6065FB076090af33eE0402f7e902B2583e7721E\`

Learn more: https://maiat.xyz/docs
`,
      },
    ],
  })
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🛡️ Maiat MCP Server running (stdio)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
