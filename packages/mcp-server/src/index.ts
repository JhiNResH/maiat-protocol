#!/usr/bin/env node

/**
 * Maiat Trust Score MCP Server
 * 
 * Provides trust scoring tools to AI agents via the Model Context Protocol.
 * 
 * Tools:
 *   - maiat_check_trust: Get trust score for any on-chain address
 *   - maiat_check_token: Check if a token contract is safe
 *   - maiat_batch_check: Check multiple addresses at once
 * 
 * Usage with Claude Desktop:
 * ```json
 * {
 *   "mcpServers": {
 *     "maiat": {
 *       "command": "npx",
 *       "args": ["@maiat/mcp-server"],
 *       "env": {
 *         "MAIAT_API_URL": "https://api.maiat.xyz",
 *         "MAIAT_API_KEY": "optional-for-higher-limits"
 *       }
 *     }
 *   }
 * }
 * ```
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.MAIAT_API_URL || "https://maiat-protocol.vercel.app";
const API_KEY = process.env.MAIAT_API_KEY || "";

// ═══════════════════════════════════════════
//  API Client
// ═══════════════════════════════════════════

interface TrustScoreResponse {
  address: string;
  score: number;
  risk: string;
  type: string;
  flags: string[];
  breakdown: {
    onChainHistory: number;
    contractAnalysis: number;
    blacklistCheck: number;
    activityPattern: number;
  };
  details: {
    txCount: number;
    balanceETH: number;
    isContract: boolean;
    walletAge: string | null;
    lastActive: string | null;
  };
  protocol?: {
    name: string;
    category: string;
    auditedBy?: string[];
  };
}

async function fetchTrustScore(address: string, chain: string = "base"): Promise<TrustScoreResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "maiat-mcp-server/0.1.0",
  };
  if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }

  const url = `${API_URL}/api/v1/score/${address}?chain=${chain}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Maiat API error (${res.status}): ${text}`);
  }

  return res.json();
}

// ═══════════════════════════════════════════
//  Risk Formatting
// ═══════════════════════════════════════════

function formatRiskEmoji(risk: string): string {
  switch (risk.toUpperCase()) {
    case "LOW": return "🟢";
    case "MEDIUM": return "🟡";
    case "HIGH": return "🟠";
    case "CRITICAL": return "🔴";
    default: return "⚪";
  }
}

function formatTrustReport(data: TrustScoreResponse): string {
  const emoji = formatRiskEmoji(data.risk);
  const lines = [
    `## ${emoji} Trust Score: ${data.score}/10 — ${data.risk.toUpperCase()} Risk`,
    "",
    `**Address:** \`${data.address}\``,
    `**Type:** ${data.type}${data.protocol ? ` (${data.protocol.name})` : ""}`,
    "",
    "### Score Breakdown",
    `- On-chain History: ${data.breakdown.onChainHistory}/4.0`,
    `- Contract Analysis: ${data.breakdown.contractAnalysis}/3.0`,
    `- Blacklist Check: ${data.breakdown.blacklistCheck}/2.0`,
    `- Activity Pattern: ${data.breakdown.activityPattern}/1.0`,
    "",
    "### Details",
    `- Transactions: ${data.details.txCount === -1 ? "N/A (known protocol)" : data.details.txCount.toLocaleString()}`,
    `- Balance: ${data.details.balanceETH} ETH`,
    `- Is Contract: ${data.details.isContract ? "Yes" : "No"}`,
    data.details.walletAge ? `- Wallet Age: ${data.details.walletAge}` : null,
    data.details.lastActive ? `- Last Active: ${data.details.lastActive}` : null,
    "",
    `### Flags: ${data.flags.length > 0 ? data.flags.join(", ") : "None"}`,
  ];

  if (data.protocol?.auditedBy?.length) {
    lines.push("", `### Audited By: ${data.protocol.auditedBy.join(", ")}`);
  }

  return lines.filter((l) => l !== null).join("\n");
}

// ═══════════════════════════════════════════
//  MCP Server
// ═══════════════════════════════════════════

const server = new McpServer({
  name: "maiat-trust",
  version: "0.1.0",
});

// Tool: Check trust score for a single address
server.tool(
  "maiat_check_trust",
  "Check the trust score of any on-chain address. Returns a 0-10 score with risk level, flags, and detailed breakdown. Use this before interacting with any unknown address.",
  {
    address: z.string().describe("The on-chain address to check (0x...)"),
    chain: z.string().optional().describe("Chain to check on (base, ethereum, bnb). Default: base"),
  },
  async ({ address, chain }) => {
    try {
      const data = await fetchTrustScore(address, chain || "base");
      return {
        content: [
          {
            type: "text" as const,
            text: formatTrustReport(data),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Error checking trust score: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Check if a token is safe
server.tool(
  "maiat_check_token",
  "Check if a token contract is safe to interact with. Returns safety assessment including honeypot detection, rug pull risk, and liquidity analysis.",
  {
    address: z.string().describe("The token contract address (0x...)"),
    chain: z.string().optional().describe("Chain (base, ethereum, bnb). Default: base"),
  },
  async ({ address, chain }) => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "maiat-mcp-server/0.1.0",
      };
      if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

      const url = `${API_URL}/api/v1/token/${address}?chain=${chain || "base"}`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        throw new Error(`API error (${res.status}): ${await res.text()}`);
      }

      const data = await res.json();
      return {
        content: [
          {
            type: "text" as const,
            text: `## Token Safety Check\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Error checking token: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Batch check multiple addresses
server.tool(
  "maiat_batch_check",
  "Check trust scores for multiple addresses at once. Returns a summary table. Useful for evaluating a set of addresses before batch operations.",
  {
    addresses: z.array(z.string()).describe("Array of addresses to check"),
    chain: z.string().optional().describe("Chain (base, ethereum, bnb). Default: base"),
  },
  async ({ addresses, chain }) => {
    const results: string[] = ["| Address | Score | Risk | Type | Flags |", "|---------|-------|------|------|-------|"];

    for (const addr of addresses.slice(0, 10)) {
      try {
        const data = await fetchTrustScore(addr, chain || "base");
        const emoji = formatRiskEmoji(data.risk);
        const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
        results.push(
          `| \`${shortAddr}\` | ${emoji} ${data.score}/10 | ${data.risk} | ${data.type} | ${data.flags.slice(0, 3).join(", ")} |`
        );
      } catch {
        results.push(`| \`${addr.slice(0, 6)}...${addr.slice(-4)}\` | ❌ Error | - | - | - |`);
      }
    }

    if (addresses.length > 10) {
      results.push("", `*Showing 10 of ${addresses.length} addresses. Query remaining separately.*`);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `## Batch Trust Check\n\n${results.join("\n")}`,
        },
      ],
    };
  }
);

// Resource: Maiat API documentation
server.resource(
  "maiat-docs",
  "maiat://docs",
  async () => ({
    contents: [
      {
        uri: "maiat://docs",
        mimeType: "text/markdown",
        text: `# Maiat Trust Score API

## Overview
Maiat provides trust scoring for on-chain addresses. Query any address and get a 0-10 trust score with risk assessment.

## Endpoints
- \`GET /v1/score/{address}\` — Trust score for any address
- \`GET /v1/token/{address}\` — Token safety check

## Score Scale (0-10)
- **8-10**: LOW risk — Safe, established address
- **4-7.9**: MEDIUM risk — Proceed with caution
- **1-3.9**: HIGH risk — Significant concerns
- **0-0.9**: CRITICAL risk — Likely malicious

## Rate Limits
- Free: 1,000 requests/day
- Pro ($49/mo): 50,000 requests/day
- Scale ($199/mo): 500,000 requests/day

## Supported Chains
Base, Ethereum, BNB Chain (more coming)
`,
      },
    ],
  })
);

// ═══════════════════════════════════════════
//  Start
// ═══════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Maiat MCP Server running on stdio");
}

main().catch(console.error);
