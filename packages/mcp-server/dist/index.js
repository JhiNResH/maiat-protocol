#!/usr/bin/env node

// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
var MAIAT_API_URL = process.env.MAIAT_API_URL || "https://app.maiat.io";
async function maiatGet(path) {
  const url = `${MAIAT_API_URL}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
}
async function maiatPost(path, body) {
  const url = `${MAIAT_API_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const body2 = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body2}`);
  }
  return res.json();
}
var server = new McpServer({
  name: "maiat-trust",
  version: "0.3.0"
});
server.tool(
  "get_agent_trust",
  "Get the Maiat trust score for an ACP agent address. Returns trust score (0-100), verdict, and breakdown. Optionally fetch deep analysis.",
  {
    address: z.string().describe("Ethereum/Base wallet address (0x...) of the agent"),
    deep: z.boolean().default(false).describe("If true, fetch deep analysis instead of the standard trust score")
  },
  async ({ address, deep }) => {
    try {
      const path = deep ? `/api/v1/agent/${address}/deep` : `/api/v1/agent/${address}`;
      const data = await maiatGet(path);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              address
            })
          }
        ]
      };
    }
  }
);
server.tool(
  "get_token_forensics",
  "Get forensics and safety data for a token contract address. Includes honeypot detection, rug pull risk, and liquidity analysis.",
  {
    address: z.string().describe("Token contract address (0x...)"),
    chain: z.string().default("base").describe("Chain to query (default: base)")
  },
  async ({ address, chain }) => {
    try {
      const data = await maiatGet(
        `/api/v1/token/${address}/forensics?chain=${chain}`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              address,
              chain
            })
          }
        ]
      };
    }
  }
);
server.tool(
  "report_outcome",
  "Report the outcome of a job after executing it. This feeds the Maiat trust oracle with real outcome data.",
  {
    jobId: z.string().describe("The job ID to report outcome for"),
    outcome: z.enum(["success", "failure", "partial", "expired"]).describe("The outcome of the job"),
    reporter: z.string().optional().describe("Address of the reporter (optional)"),
    note: z.string().optional().describe("Free-form note about the outcome (optional)")
  },
  async ({ jobId, outcome, reporter, note }) => {
    try {
      const body = { jobId, outcome };
      if (reporter) body.reporter = reporter;
      if (note) body.note = note;
      const data = await maiatPost("/api/v1/outcome", body);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              jobId,
              outcome
            })
          }
        ]
      };
    }
  }
);
server.tool(
  "get_scarab_balance",
  "Get the SCARAB token balance for an address. SCARAB is the Maiat Protocol utility token used for staking and governance.",
  {
    address: z.string().describe("Wallet address (0x...) to check SCARAB balance for")
  },
  async ({ address }) => {
    try {
      const data = await maiatGet(`/api/v1/scarab?address=${address}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
              address
            })
          }
        ]
      };
    }
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

- \`GET /api/v1/agent/{address}\` \u2014 standard trust score
- \`GET /api/v1/agent/{address}/deep\` \u2014 deep analysis
- \`GET /api/v1/token/{address}/forensics?chain=base\` \u2014 token forensics
- \`POST /api/v1/outcome\` \u2014 report job outcome
- \`GET /api/v1/scarab?address={address}\` \u2014 SCARAB balance

Learn more: https://app.maiat.io/docs
`
      }
    ]
  })
);
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("\u{1F6E1}\uFE0F Maiat MCP Server v0.3.0 (stdio) \u2014 4 tools active");
}
main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
