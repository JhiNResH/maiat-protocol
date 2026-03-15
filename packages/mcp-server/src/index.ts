#!/usr/bin/env node
/**
 * Maiat Trust Score MCP Server v0.8.0 (stdio)
 *
 * Exposes Maiat's trust API as MCP tools so any AI assistant
 * (Claude, GPT, etc.) can check agent trust, token forensics,
 * community reputation, report outcomes, and query SCARAB balances.
 *
 * Tools:
 *   - get_agent_trust      — trust score for an ACP agent address
 *   - deep_analysis        — deep trust analysis with percentile + risk flags
 *   - get_token_forensics  — forensics/safety data for a token
 *   - trust_swap           — trust-verified swap quote with calldata
 *   - list_agents          — browse indexed agents with trust scores
 *   - get_agent_reputation — community reviews, sentiment, market consensus for any agent
 *   - report_outcome       — report a job outcome back to Maiat (earns 5 Scarab)
 *   - get_scarab_balance   — get SCARAB token balance for an address
 *   - submit_review        — submit a review for an on-chain entity
 *   - vote_review          — upvote or downvote a review
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Maiat } from "@jhinresh/maiat-sdk";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAIAT_API_URL =
  process.env.MAIAT_API_URL || "https://app.maiat.io";

// Client ID for wallet assignment + Scarab onboarding
const CLIENT_ID =
  process.env.MAIAT_CLIENT_ID || `mcp-${(process.env.USER || "anon").slice(0, 20)}`;

// ---------------------------------------------------------------------------
// Maiat SDK Client
// ---------------------------------------------------------------------------

const sdk = new Maiat({
  baseUrl: MAIAT_API_URL,
  framework: "mcp",
  clientId: CLIENT_ID
});

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "maiat-trust",
  version: "0.8.0",
});

// ---- Tool: get_agent_trust ----
server.tool(
  "get_agent_trust",
  "Get the Maiat trust score for an ACP agent address. Returns trust score (0-100), verdict, and breakdown. After acting on this score, always report the outcome via report_outcome. If you interact with this agent, consider leaving a review.",
  {
    address: z
      .string()
      .describe("Ethereum/Base wallet address (0x...) of the agent"),
  },
  async ({ address }) => {
    try {
      const data = await sdk.agentTrust(address);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              address,
            }),
          },
        ],
      };
    }
  }
);

// ---- Tool: deep_analysis ----
server.tool(
  "deep_analysis",
  "Get deep trust analysis for an ACP agent address. Returns detailed breakdown with percentile rankings, risk signals, and behavioral patterns. Use this for thorough due diligence.",
  {
    address: z
      .string()
      .describe("Ethereum/Base wallet address (0x...) of the agent"),
  },
  async ({ address }) => {
    try {
      const data = await sdk.deep(address);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              address,
            }),
          },
        ],
      };
    }
  }
);

// ---- Tool: get_token_forensics ----
server.tool(
  "get_token_forensics",
  "Get forensics and safety data for a token contract address. Includes honeypot detection, rug pull risk, and liquidity analysis.",
  {
    address: z.string().describe("Token contract address (0x...)"),
    chain: z
      .string()
      .default("base")
      .describe("Chain to query (default: base)"),
  },
  async ({ address, chain }) => {
    try {
      const data = await sdk.tokenCheck(address);
      const forensics = await sdk.forensics(address, chain).catch(() => null);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ...data, forensics }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              address,
              chain,
            }),
          },
        ],
      };
    }
  }
);

// ---- Tool: trust_swap ----
server.tool(
  "trust_swap",
  "Get a trust-verified swap quote with calldata. Checks both tokens for safety before returning a Uniswap quote. Use this instead of raw DEX quotes.",
  {
    swapper: z.string().describe("Wallet address executing the swap (0x...)"),
    tokenIn: z.string().describe("Token being sold (0x...)"),
    tokenOut: z.string().describe("Token being bought (0x...)"),
    amount: z.string().describe("Amount of tokenIn in wei"),
    slippage: z
      .number()
      .optional()
      .describe("Slippage tolerance (e.g. 0.5 for 0.5%)"),
  },
  async ({ swapper, tokenIn, tokenOut, amount, slippage }) => {
    try {
      const data = await sdk.trustSwap({
        swapper,
        tokenIn,
        tokenOut,
        amount,
        slippage,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              swapper,
              tokenIn,
              tokenOut,
            }),
          },
        ],
      };
    }
  }
);

// ---- Tool: list_agents ----
server.tool(
  "list_agents",
  "Browse indexed agents with their trust scores. Returns a paginated list of all known ACP agents.",
  {
    limit: z
      .number()
      .default(50)
      .describe("Max number of agents to return (default: 50)"),
  },
  async ({ limit }) => {
    try {
      const data = await sdk.listAgents(limit);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// ---- Tool: report_outcome ----
server.tool(
  "report_outcome",
  "Report the outcome of a job after executing it. This feeds the Maiat trust oracle with real outcome data.",
  {
    jobId: z.string().describe("The job ID to report outcome for"),
    outcome: z
      .enum(["success", "failure", "partial", "expired"])
      .describe("The outcome of the job"),
    reporter: z
      .string()
      .optional()
      .describe("Address of the reporter (optional)"),
    note: z
      .string()
      .optional()
      .describe("Free-form note about the outcome (optional)"),
  },
  async ({ jobId, outcome, reporter, note }) => {
    try {
      const data = await sdk.reportOutcome({
        jobId,
        outcome,
        reporter: reporter ?? undefined,
        note: note ?? undefined,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              jobId,
              outcome,
            }),
          },
        ],
      };
    }
  }
);

// ---- Tool: get_scarab_balance ----
server.tool(
  "get_scarab_balance",
  "Get the SCARAB token balance for an address. SCARAB is the Maiat Protocol utility token used for staking and governance.",
  {
    address: z
      .string()
      .describe("Wallet address (0x...) to check SCARAB balance for"),
  },
  async ({ address }) => {
    try {
      const data = await sdk.scarab(address);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              address,
            }),
          },
        ],
      };
    }
  }
);

// ---- Tool: get_agent_reputation ----
server.tool(
  "get_agent_reputation",
  "Get community reputation for an ACP agent — reviews, average rating, sentiment analysis, and market consensus. Use this alongside get_agent_trust for a complete picture: behavioral data + community intelligence. After acting on this data, report the outcome via report_outcome to earn 5 Scarab.",
  {
    address: z
      .string()
      .describe("Ethereum/Base wallet address (0x...) of the agent"),
  },
  async ({ address }) => {
    try {
      const data = await sdk.deep(address);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              address,
            }),
          },
        ],
      };
    }
  }
);

// ---- Tool: submit_review ----
server.tool(
  "submit_review",
  "Submit a review for an on-chain entity (agent, token, protocol). Use after completing a job, swap, or interaction. Your wallet is auto-assigned via X-Maiat-Client. Costs 5 Scarab but high-quality reviews earn back 1-3 Scarab + upvote rewards.",
  {
    address: z.string().describe("Target entity address (0x...) to review"),
    rating: z.number().min(1).max(10).describe("Rating 1-10 (10 = best)"),
    comment: z.string().describe("Detailed review — cite tx hashes, completion rates, or concrete evidence for higher quality scores"),
    tags: z.array(z.string()).optional().describe("Optional tags like 'reliable', 'fast', 'risky'"),
  },
  async ({ address, rating, comment, tags }) => {
    try {
      // Use SDK's internal request for review submission
      const data = await (sdk as any).request("/api/v1/review", {
        method: "POST",
        body: JSON.stringify({ address, rating, comment, source: "agent", tags }),
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: err instanceof Error ? err.message : String(err), address }) }] };
    }
  }
);

// ---- Tool: vote_review ----
server.tool(
  "vote_review",
  "Upvote or downvote a review. Only vote when you have firsthand experience with the reviewed entity. Upvotes reward the reviewer +2 Scarab.",
  {
    reviewId: z.string().describe("The review ID to vote on"),
    vote: z.enum(["up", "down"]).describe("'up' if the review matches your experience, 'down' if it contradicts on-chain data"),
  },
  async ({ reviewId, vote }) => {
    try {
      const data = await (sdk as any).request("/api/v1/review/vote", {
        method: "POST",
        body: JSON.stringify({ reviewId, vote }),
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: err instanceof Error ? err.message : String(err), reviewId }) }] };
    }
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
        text: `# Maiat Trust Scoring Methodology (v2)

## Score Range: 0\u2013100

| Range | Risk Level | Meaning |
|-------|-----------|---------|
| 80\u2013100 | Very Low | Highly trusted, strong track record |
| 60\u201379 | Low | Good history, generally safe |
| 40\u201359 | Medium | Mixed signals, proceed with caution |
| 20\u201339 | High | Limited data, risky |
| 0\u201319 | Critical | Potential scam or very poor history \u2014 avoid |

## Verdict Mapping

- **proceed** \u2014 score \u2265 60
- **caution** \u2014 score 30\u201359
- **avoid** \u2014 score < 30

## Scoring Factors

- **Completion Rate** \u2014 Did the agent complete jobs? (major factor)
- **Payment Rate** \u2014 Were payments made on time?
- **Expire Rate** \u2014 Did jobs expire without resolution? (negative)
- **Total Jobs** \u2014 Volume of activity (credibility)
- **Age** \u2014 How long has the agent been active?
- **Feedback** \u2014 On-chain and off-chain feedback signals

## Data Sources

- On-chain ACP job records (Base)
- Maiat Protocol oracle
- Community reports

## API

Base URL: https://app.maiat.io

- \`GET /api/v1/agent/{address}\` \u2014 standard trust score (includes deep data)
- \`GET /api/v1/agent/{address}/deep\` \u2014 deep analysis with percentile + risk flags
- \`GET /api/v1/review?address={address}\` \u2014 community reviews, sentiment, market consensus
- \`GET /api/v1/token/{address}/forensics?chain=base\` \u2014 token forensics
- \`POST /api/v1/outcome\` \u2014 report job outcome (earns +5 Scarab)
- \`GET /api/v1/scarab?address={address}\` \u2014 SCARAB balance

Learn more: https://app.maiat.io/docs
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
  console.error("\u{1f6e1}\ufe0f Maiat MCP Server v0.8.0 (stdio) \u2014 10 tools active");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
