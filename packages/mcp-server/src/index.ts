#!/usr/bin/env node
/**
 * Maiat Trust Score MCP Server v0.5.0 (stdio)
 *
 * Exposes Maiat's trust API as MCP tools so any AI assistant
 * (Claude, GPT, etc.) can check agent trust, token forensics,
 * community reputation, report outcomes, and query SCARAB balances.
 *
 * Tools:
 *   - get_agent_trust      — trust score for an ACP agent address (includes deep analysis)
 *   - get_token_forensics  — forensics/safety data for a token
 *   - get_agent_reputation — community reviews, sentiment, market consensus for any agent
 *   - report_outcome       — report a job outcome back to Maiat (earns 5 🪲 Scarab)
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
  version: "0.5.0",
});

// ---- Tool: get_agent_trust ----
server.tool(
  "get_agent_trust",
  "Get the Maiat trust score for an ACP agent address. Returns trust score (0-100), verdict, and breakdown. Optionally fetch deep analysis. After acting on this score, always report the outcome via report_outcome. If you interact with this agent, consider leaving a review.",
  {
    address: z
      .string()
      .describe("Ethereum/Base wallet address (0x...) of the agent"),
    deep: z
      .boolean()
      .default(false)
      .describe("If true, fetch deep analysis instead of the standard trust score"),
  },
  async ({ address, deep }) => {
    try {
      const data = await sdk.agentTrust(address, { deep });
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
      const data = await sdk.tokenCheck(address, { chain });
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
              chain,
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
      const body: Record<string, unknown> = { jobId, outcome };
      if (reporter) body.reporter = reporter;
      if (note) body.note = note;

      const data = await maiatPost("/api/v1/outcome", body);
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
      const data = await maiatGet(`/api/v1/scarab?address=${address}`);
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
      const data = await maiatGet(`/api/v1/review?address=${address}`);
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
      const body: Record<string, unknown> = { address, rating, comment, source: "agent" };
      if (tags) body.tags = tags;
      const data = await maiatPost("/api/v1/review", body);
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
      const data = await maiatPost("/api/v1/review/vote", { reviewId, vote });
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

## Score Range: 0–100

| Range | Risk Level | Meaning |
|-------|-----------|---------|
| 80–100 | Very Low | Highly trusted, strong track record |
| 60–79 | Low | Good history, generally safe |
| 40–59 | Medium | Mixed signals, proceed with caution |
| 20–39 | High | Limited data, risky |
| 0–19 | Critical | Potential scam or very poor history — avoid |

## Verdict Mapping

- **proceed** — score ≥ 60
- **caution** — score 30–59
- **avoid** — score < 30

## Scoring Factors

- **Completion Rate** — Did the agent complete jobs? (major factor)
- **Payment Rate** — Were payments made on time?
- **Expire Rate** — Did jobs expire without resolution? (negative)
- **Total Jobs** — Volume of activity (credibility)
- **Age** — How long has the agent been active?
- **Feedback** — On-chain and off-chain feedback signals

## Data Sources

- On-chain ACP job records (Base)
- Maiat Protocol oracle
- Community reports

## API

Base URL: https://app.maiat.io

- \`GET /api/v1/agent/{address}\` — standard trust score (includes deep data)
- \`GET /api/v1/agent/{address}/deep\` — deep analysis with percentile + risk flags
- \`GET /api/v1/review?address={address}\` — community reviews, sentiment, market consensus
- \`GET /api/v1/token/{address}/forensics?chain=base\` — token forensics
- \`POST /api/v1/outcome\` — report job outcome (earns +5 Scarab)
- \`GET /api/v1/scarab?address={address}\` — SCARAB balance

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
  console.error("🛡️ Maiat MCP Server v0.5.0 (stdio) — 7 tools active");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
