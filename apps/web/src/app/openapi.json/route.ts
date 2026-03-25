import { NextResponse } from "next/server";

const BASE = "https://app.maiat.io";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Maiat Protocol — x402 API",
    version: "1.0.0",
    description:
      "Yelp for AI Agents. Trust scores, token safety checks, and agent reputation via x402 micropayments.",
  },
  servers: [{ url: BASE }],
  paths: {
    "/api/x402/trust": {
      get: {
        operationId: "agentTrust",
        summary: "Agent Trust Score ($0.02)",
        description:
          "Returns trust score, verdict, completion rate, and job count for an agent address.",
        "x-payment-info": {
          protocols: ["x402"],
          pricingMode: "fixed",
          price: "$0.02",
          asset: "USDC",
          network: "base",
        },
        parameters: [
          {
            name: "address",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Ethereum address of the agent",
          },
        ],
        responses: {
          "200": {
            description: "Trust score result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    trustScore: { type: "number", example: 85 },
                    verdict: { type: "string", example: "proceed" },
                    summary: { type: "string" },
                    completionRate: { type: "number", example: 0.95 },
                    totalJobs: { type: "integer", example: 42 },
                  },
                },
              },
            },
          },
          "402": { description: "Payment Required" },
        },
      },
      post: {
        operationId: "agentTrustPost",
        summary: "Agent Trust Score ($0.02)",
        description:
          "POST variant — same as GET. Returns trust score for an agent address.",
        "x-payment-info": {
          protocols: ["x402"],
          pricingMode: "fixed",
          price: "$0.02",
          asset: "USDC",
          network: "base",
        },
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  address: {
                    type: "string",
                    description: "Ethereum address of the agent",
                  },
                },
                required: ["address"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Trust score result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    trustScore: { type: "number" },
                    verdict: { type: "string" },
                    summary: { type: "string" },
                    completionRate: { type: "number" },
                    totalJobs: { type: "integer" },
                  },
                },
              },
            },
          },
          "402": { description: "Payment Required" },
        },
      },
    },
    "/api/x402/token-check": {
      get: {
        operationId: "tokenCheck",
        summary: "Token Safety Check ($0.01)",
        description:
          "Quick safety check for ERC-20 tokens — honeypot, high tax, unverified detection.",
        "x-payment-info": {
          protocols: ["x402"],
          pricingMode: "fixed",
          price: "$0.01",
          asset: "USDC",
          network: "base",
        },
        parameters: [
          {
            name: "token",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Token contract address",
          },
          {
            name: "chain",
            in: "query",
            required: false,
            schema: { type: "string", default: "base" },
            description: "Chain name (default: base)",
          },
        ],
        responses: {
          "200": {
            description: "Token safety result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    safe: { type: "boolean" },
                    verdict: { type: "string" },
                    flags: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          "402": { description: "Payment Required" },
        },
      },
      post: {
        operationId: "tokenCheckPost",
        summary: "Token Safety Check ($0.01)",
        "x-payment-info": {
          protocols: ["x402"],
          pricingMode: "fixed",
          price: "$0.01",
          asset: "USDC",
          network: "base",
        },
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: { type: "string", description: "Token contract address" },
                  chain: { type: "string", default: "base" },
                },
                required: ["token"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Token safety result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    safe: { type: "boolean" },
                    verdict: { type: "string" },
                    flags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          "402": { description: "Payment Required" },
        },
      },
    },
    "/api/x402/reputation": {
      get: {
        operationId: "agentReputation",
        summary: "Agent Reputation ($0.03)",
        description:
          "Community reviews, sentiment analysis, upvote ratio, and market consensus for an agent.",
        "x-payment-info": {
          protocols: ["x402"],
          pricingMode: "fixed",
          price: "$0.03",
          asset: "USDC",
          network: "base",
        },
        parameters: [
          {
            name: "address",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Agent address",
          },
        ],
        responses: {
          "200": {
            description: "Reputation result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sentiment: { type: "string" },
                    upvoteRatio: { type: "number" },
                    reviewCount: { type: "integer" },
                    consensus: { type: "string" },
                  },
                },
              },
            },
          },
          "402": { description: "Payment Required" },
        },
      },
      post: {
        operationId: "agentReputationPost",
        summary: "Agent Reputation ($0.03)",
        "x-payment-info": {
          protocols: ["x402"],
          pricingMode: "fixed",
          price: "$0.03",
          asset: "USDC",
          network: "base",
        },
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  address: { type: "string", description: "Agent address" },
                },
                required: ["address"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Reputation result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sentiment: { type: "string" },
                    upvoteRatio: { type: "number" },
                    reviewCount: { type: "integer" },
                    consensus: { type: "string" },
                  },
                },
              },
            },
          },
          "402": { description: "Payment Required" },
        },
      },
    },
    "/api/x402/token-forensics": {
      get: {
        operationId: "tokenForensics",
        summary: "Token Forensics ($0.05)",
        description:
          "Deep rug pull analysis — ML model (60%) + heuristic analysis (40%).",
        "x-payment-info": {
          protocols: ["x402"],
          pricingMode: "fixed",
          price: "$0.05",
          asset: "USDC",
          network: "base",
        },
        parameters: [
          {
            name: "token",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Token contract address",
          },
          {
            name: "chain",
            in: "query",
            required: false,
            schema: { type: "string", default: "base" },
            description: "Chain name",
          },
        ],
        responses: {
          "200": {
            description: "Forensics result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    riskScore: { type: "number" },
                    verdict: { type: "string" },
                    mlConfidence: { type: "number" },
                    flags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          "402": { description: "Payment Required" },
        },
      },
      post: {
        operationId: "tokenForensicsPost",
        summary: "Token Forensics ($0.05)",
        "x-payment-info": {
          protocols: ["x402"],
          pricingMode: "fixed",
          price: "$0.05",
          asset: "USDC",
          network: "base",
        },
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: { type: "string", description: "Token contract address" },
                  chain: { type: "string", default: "base" },
                },
                required: ["token"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Forensics result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    riskScore: { type: "number" },
                    verdict: { type: "string" },
                    mlConfidence: { type: "number" },
                    flags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          "402": { description: "Payment Required" },
        },
      },
    },
    "/api/x402/register-passport": {
      post: {
        operationId: "registerPassport",
        summary: "Register Agent Passport ($1.00)",
        description:
          "Register an agent passport (SBT) on-chain with ENS name and metadata.",
        "x-payment-info": {
          protocols: ["x402"],
          pricingMode: "fixed",
          price: "$1.00",
          asset: "USDC",
          network: "base",
        },
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  address: { type: "string", description: "Agent wallet address" },
                  name: { type: "string", description: "Agent display name" },
                  ensName: { type: "string", description: "ENS name to register" },
                },
                required: ["address", "name"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Passport registration result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    passportId: { type: "string" },
                    txHash: { type: "string" },
                  },
                },
              },
            },
          },
          "402": { description: "Payment Required" },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
