#!/usr/bin/env node
/**
 * Maiat Trust Score MCP Server v0.3.0 (stdio)
 *
 * Exposes Maiat's trust API as MCP tools so any AI assistant
 * (Claude, GPT, etc.) can check agent trust, token forensics,
 * report outcomes, and query SCARAB balances — in one call.
 *
 * Tools:
 *   - get_agent_trust      — trust score for an ACP agent address
 *   - get_token_forensics  — forensics/safety data for a token
 *   - report_outcome       — report a job outcome back to Maiat
 *   - get_scarab_balance   — get SCARAB token balance for an address
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAIAT_API_URL =
  process.env.MAIAT_API_URL || "https://app.maiat.io";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function maiatGet(path: string) {
  const url = `${MAIAT_API_URL}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

async function maiatPost(path: string, body: Record<string, unknown>) {
  const url = `${MAIAT_API_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body2 = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body2}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "maiat-trust",
  version: "0.3.0",
});

// ---- Tool: get_agent_trust ----
server.tool(
  "get_agent_trust",
  "Get the Maiat trust score for an ACP agent address. Returns trust score (0-100), verdict, and breakdown. Optionally fetch deep analysis.",
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
      const path = deep
        ? `/api/v1/agent/${address}/deep`
        : `/api/v1/agent/${address}`;
      const data = await maiatGet(path);
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
      const data = await maiatGet(
        `/api/v1/token/${address}/forensics?chain=${chain}`
      );
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

- \`GET /api/v1/agent/{address}\` — standard trust score
- \`GET /api/v1/agent/{address}/deep\` — deep analysis
- \`GET /api/v1/token/{address}/forensics?chain=base\` — token forensics
- \`POST /api/v1/outcome\` — report job outcome
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
  console.error("🛡️ Maiat MCP Server v0.3.0 (stdio) — 4 tools active");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
