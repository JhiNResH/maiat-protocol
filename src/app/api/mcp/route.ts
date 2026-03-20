/**
 * Maiat Protocol — MCP Server (Streamable HTTP Transport)
 *
 * Hosted MCP endpoint: https://app.maiat.io/api/mcp
 *
 * Compatible with Claude Desktop, Cursor, and any MCP-capable agent.
 * No CLI or local install needed — just point to this URL.
 *
 * Tools exposed:
 *   get_agent_trust      — Behavioral trust score for an ACP agent wallet
 *   get_token_forensics  — Rug risk analysis for a token contract
 *   report_outcome       — Close the feedback loop after using an agent
 *   get_scarab_balance   — Check Scarab reputation points for a wallet
 */

import { NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { isAddress } from "viem";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Vercel Pro plan

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.maiat.io";

// ─── Build MCP Server ─────────────────────────────────────────────────────────

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: "maiat-protocol",
    version: "1.0.0",
  });

  // ── Tool: get_agent_trust ─────────────────────────────────────────────────

  server.tool(
    "get_agent_trust",
    "Get the behavioral trust score for an AI agent wallet address. Returns a 0-100 score, verdict (proceed/caution/avoid), and breakdown based on Virtuals ACP job history. Use this before transacting with or delegating to any ACP agent.",
    {
      address: z
        .string()
        .describe("The EVM wallet address of the agent (0x...)"),
      deep: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include deep analysis (percentile, tier, risk flags). Costs more credits."),
    },
    async ({ address, deep }) => {
      if (!isAddress(address)) {
        return {
          content: [{ type: "text", text: `Error: "${address}" is not a valid EVM address.` }],
          isError: true,
        };
      }

      try {
        const endpoint = deep
          ? `${BASE_URL}/api/v1/agent/${address}/deep`
          : `${BASE_URL}/api/v1/agent/${address}`;

        const res = await fetch(endpoint, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });

        const data = await res.json();

        if (!res.ok) {
          return {
            content: [{ type: "text", text: `API error ${res.status}: ${data.error || "Unknown error"}` }],
            isError: true,
          };
        }

        const verdict = data.verdict ?? "unknown";
        const score = data.trustScore ?? null;
        const emoji = verdict === "proceed" ? "🟢" : verdict === "caution" ? "🟡" : verdict === "avoid" ? "🔴" : "⚪";

        let summary = `${emoji} **${verdict.toUpperCase()}** — Trust Score: ${score ?? "N/A"}/100\n\n`;
        summary += `Address: ${data.address}\n`;
        summary += `Data Source: ${data.dataSource}\n`;

        if (data.breakdown) {
          const b = data.breakdown;
          summary += `\nBreakdown:\n`;
          summary += `  • Completion Rate: ${((b.completionRate ?? 0) * 100).toFixed(1)}%\n`;
          summary += `  • Payment Rate:    ${((b.paymentRate ?? 0) * 100).toFixed(1)}%\n`;
          summary += `  • Total Jobs:      ${b.totalJobs ?? 0}\n`;
          if (b.outcomeCount) summary += `  • Outcomes Logged: ${b.outcomeCount}\n`;
        }

        if (deep && data.deep) {
          const d = data.deep;
          summary += `\nDeep Analysis:\n`;
          summary += `  • Tier: ${d.tier} (${d.percentile}th percentile)\n`;
          if (d.riskFlags?.length) summary += `  • Risk Flags: ${d.riskFlags.join(", ")}\n`;
          summary += `  • Recommendation: ${d.recommendation}\n`;
        }

        if (data.feedback?.queryId) {
          summary += `\nFeedback Query ID: ${data.feedback.queryId}\n`;
          summary += `(Use report_outcome tool with this ID to improve oracle accuracy)\n`;
        }

        return { content: [{ type: "text", text: summary }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Request failed: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // ── Tool: get_token_forensics ─────────────────────────────────────────────

  server.tool(
    "get_token_forensics",
    "Analyze a token contract for rug pull risk and safety signals. Returns honeypot detection, liquidity lock status, ownership concentration, and a risk verdict. Use before swapping into any unfamiliar token.",
    {
      address: z
        .string()
        .describe("The token contract address (0x...)"),
      chain: z
        .enum(["base", "ethereum", "bsc"])
        .optional()
        .default("base")
        .describe("Which chain to analyze (default: base)"),
    },
    async ({ address, chain }) => {
      if (!isAddress(address)) {
        return {
          content: [{ type: "text", text: `Error: "${address}" is not a valid contract address.` }],
          isError: true,
        };
      }

      try {
        const res = await fetch(
          `${BASE_URL}/api/v1/token/${address}/forensics?chain=${chain}`,
          {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(30_000),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          return {
            content: [{ type: "text", text: `API error ${res.status}: ${data.error || "Unknown error"}` }],
            isError: true,
          };
        }

        const risk = data.riskLevel ?? "unknown";
        const emoji = risk === "LOW" ? "🟢" : risk === "MEDIUM" ? "🟡" : risk === "HIGH" ? "🔴" : risk === "CRITICAL" ? "⛔" : "⚪";

        let summary = `${emoji} **${risk} RISK** — ${data.verdict ?? "unknown"}\n\n`;
        summary += `Token: ${data.name ?? "?"} (${data.symbol ?? "?"})\n`;
        summary += `Address: ${address}\n`;
        summary += `Chain: ${chain}\n`;

        if (data.signals) {
          const s = data.signals;
          summary += `\nSafety Signals:\n`;
          if (s.isHoneypot !== undefined) summary += `  • Honeypot: ${s.isHoneypot ? "⚠️ YES" : "✅ No"}\n`;
          if (s.liquidityLocked !== undefined) summary += `  • Liquidity Locked: ${s.liquidityLocked ? "✅ Yes" : "⚠️ No"}\n`;
          if (s.ownershipRenounced !== undefined) summary += `  • Ownership Renounced: ${s.ownershipRenounced ? "✅ Yes" : "⚠️ No"}\n`;
          if (s.top10HoldersPct !== undefined) summary += `  • Top 10 Holders: ${s.top10HoldersPct.toFixed(1)}% of supply\n`;
          if (s.buyTax !== undefined) summary += `  • Buy/Sell Tax: ${s.buyTax}% / ${s.sellTax}%\n`;
        }

        if (data.riskFlags?.length) {
          summary += `\nRisk Flags:\n`;
          for (const flag of data.riskFlags) {
            summary += `  ⚠️ ${flag}\n`;
          }
        }

        if (data.recommendation) {
          summary += `\nRecommendation: ${data.recommendation}\n`;
        }

        return { content: [{ type: "text", text: summary }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Request failed: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // ── Tool: report_outcome ──────────────────────────────────────────────────

  server.tool(
    "report_outcome",
    "Report the outcome of an interaction with an agent after using their service. This feeds the Maiat oracle feedback loop — making trust scores more accurate over time. Use the queryId from a previous get_agent_trust call.",
    {
      queryId: z
        .string()
        .describe("The queryId returned from get_agent_trust (feedback.queryId field)"),
      outcome: z
        .enum(["success", "failure", "partial", "expired"])
        .describe("What actually happened: success=delivered as promised, failure=failed to deliver, partial=incomplete, expired=timed out"),
      reporter: z
        .string()
        .optional()
        .describe("Your wallet address (optional, for attribution and Scarab rewards)"),
      note: z
        .string()
        .optional()
        .describe("Brief description of what happened (optional, helps train the model)"),
    },
    async ({ queryId, outcome, reporter, note }) => {
      try {
        const body: Record<string, unknown> = { jobId: queryId, outcome };
        if (reporter) body.reporter = reporter;
        if (note) body.note = note;

        const res = await fetch(`${BASE_URL}/api/v1/outcome`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        });

        const data = await res.json();

        if (!res.ok) {
          return {
            content: [{ type: "text", text: `API error ${res.status}: ${data.error || "Unknown error"}` }],
            isError: true,
          };
        }

        let summary = `✅ Outcome recorded: **${outcome}**\n\n`;
        if (data.newTrustScore !== undefined) {
          summary += `Updated Trust Score: ${data.newTrustScore}/100\n`;
        }
        if (data.scarabAwarded) {
          summary += `🪲 Scarab Awarded: +${data.scarabAwarded} (for contributing outcome data)\n`;
        }
        if (data.message) {
          summary += `\n${data.message}\n`;
        }

        return { content: [{ type: "text", text: summary }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Request failed: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // ── Tool: get_scarab_balance ──────────────────────────────────────────────

  server.tool(
    "get_scarab_balance",
    "Check the Scarab reputation points balance for a wallet address. Scarab is Maiat's off-chain reputation token — earned by reviewing agents, reporting outcomes, and contributing to the trust graph. Higher Scarab balance = lower swap fees.",
    {
      address: z
        .string()
        .describe("The wallet address to check (0x...)"),
    },
    async ({ address }) => {
      if (!isAddress(address)) {
        return {
          content: [{ type: "text", text: `Error: "${address}" is not a valid EVM address.` }],
          isError: true,
        };
      }

      try {
        const res = await fetch(`${BASE_URL}/api/v1/scarab?address=${address}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        });

        const data = await res.json();

        if (!res.ok) {
          return {
            content: [{ type: "text", text: `API error ${res.status}: ${data.error || "Unknown error"}` }],
            isError: true,
          };
        }

        const balance = data.balance ?? 0;
        const streak = data.streak ?? 0;
        const tier = data.tier ?? "standard";

        let summary = `🪲 **Scarab Balance: ${balance}**\n\n`;
        summary += `Address: ${address}\n`;
        summary += `Tier: ${tier}\n`;
        summary += `Streak: ${streak} days\n`;

        if (data.feeTier) {
          summary += `\nSwap Fee Tier: ${data.feeTier}\n`;
        }

        if (balance === 0) {
          summary += `\nTo earn Scarab:\n`;
          summary += `  • Write a review: POST /api/v1/review\n`;
          summary += `  • Report outcomes: use report_outcome tool\n`;
          summary += `  • Claim first-time bonus at app.maiat.io\n`;
        }

        return { content: [{ type: "text", text: summary }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Request failed: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

export async function GET() {
  // MCP discovery endpoint
  return NextResponse.json({
    name: "maiat-protocol",
    version: "1.0.0",
    description: "Trust infrastructure for the agent economy. Query trust scores, analyze tokens, and contribute to the trust graph.",
    transport: "streamable-http",
    endpoint: `${BASE_URL}/api/mcp`,
    tools: [
      "get_agent_trust",
      "get_token_forensics",
      "report_outcome",
      "get_scarab_balance",
    ],
    docs: "https://github.com/JhiNResH/maiat-protocol/tree/master/docs/api",
  });
}

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const server = buildMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}
