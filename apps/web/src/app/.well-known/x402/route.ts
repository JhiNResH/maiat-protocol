/**
 * GET /.well-known/x402
 *
 * x402 Service Discovery Endpoint
 *
 * Returns a manifest of all x402-protected API endpoints
 * so that discovery tools (Capminal, Bazaar, etc.) can
 * find and index Maiat's paid services automatically.
 *
 * Spec: https://www.x402.org/
 */

import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600; // 1h cache

const MAIAT_WALLET = "0xB1e504aE1ce359B4C2a6DC5d63aE6199a415f312";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NETWORK = "eip155:8453"; // Base mainnet
const BASE_URL = "https://app.maiat.io";

export async function GET() {
  const manifest = {
    x402Version: 2,
    provider: {
      name: "Maiat Protocol",
      description:
        "Yelp for AI Agents — reputation scores, token safety checks, and trust infrastructure for the agentic economy.",
      url: BASE_URL,
      logo: `${BASE_URL}/maiat-logo.jpg`,
    },
    endpoints: [
      {
        path: "/api/x402/trust",
        method: "GET",
        description: "Trust score lookup for agents and tokens",
        price: {
          amount: "20000", // $0.02 in USDC (6 decimals)
          asset: USDC_BASE,
          network: NETWORK,
        },
        payTo: MAIAT_WALLET,
        input: {
          queryParams: {
            address: {
              type: "string",
              required: true,
              description: "Ethereum address (agent or token)",
            },
          },
        },
        output: {
          mimeType: "application/json",
          example: {
            address: "0x...",
            type: "agent",
            trustScore: 85,
            verdict: "proceed",
            summary: "Reliable ACP agent — 42 jobs, 95% completion",
          },
        },
      },
      {
        path: "/api/x402/token-check",
        method: "GET",
        description: "Token honeypot and safety check",
        price: {
          amount: "10000", // $0.01
          asset: USDC_BASE,
          network: NETWORK,
        },
        payTo: MAIAT_WALLET,
        input: {
          queryParams: {
            address: {
              type: "string",
              required: true,
              description: "ERC-20 token contract address on Base",
            },
          },
        },
        output: {
          mimeType: "application/json",
          example: {
            address: "0x...",
            verdict: "proceed",
            trustScore: 78,
            flags: [],
            summary: "Token appears safe",
          },
        },
      },
      {
        path: "/api/x402/reputation",
        method: "GET",
        description: "Full agent reputation and behavioral trust score",
        price: {
          amount: "30000", // $0.03
          asset: USDC_BASE,
          network: NETWORK,
        },
        payTo: MAIAT_WALLET,
        input: {
          queryParams: {
            address: {
              type: "string",
              required: true,
              description: "Agent wallet address",
            },
          },
        },
        output: {
          mimeType: "application/json",
          example: {
            address: "0x...",
            trustScore: 88,
            verdict: "proceed",
            completionRate: 0.95,
            totalJobs: 42,
            sentiment: { positive: 12, neutral: 3, negative: 1 },
          },
        },
      },
      {
        path: "/api/x402/token-forensics",
        method: "POST",
        description: "Deep AI-powered rug pull and project analysis",
        price: {
          amount: "50000", // $0.05
          asset: USDC_BASE,
          network: NETWORK,
        },
        payTo: MAIAT_WALLET,
        input: {
          body: {
            address: {
              type: "string",
              required: true,
              description: "Token contract address for deep analysis",
            },
          },
        },
        output: {
          mimeType: "application/json",
          example: {
            address: "0x...",
            verdict: "caution",
            riskScore: 65,
            flags: ["low_liquidity", "concentrated_holders"],
            analysis: "ML model flagged potential risks...",
          },
        },
      },
      {
        path: "/api/x402/register-passport",
        method: "POST",
        description: "Register a Maiat Passport with ENS, ERC-8004, and KYA",
        price: {
          amount: "1000000", // $1.00
          asset: USDC_BASE,
          network: NETWORK,
        },
        payTo: MAIAT_WALLET,
        input: {
          body: {
            address: {
              type: "string",
              required: true,
              description: "Agent wallet address to register",
            },
            name: {
              type: "string",
              required: true,
              description: "ENS subdomain name (e.g. 'myagent')",
            },
          },
        },
        output: {
          mimeType: "application/json",
          example: {
            success: true,
            passport: {
              address: "0x...",
              ensName: "myagent.maiat.eth",
              tokenId: "1",
            },
          },
        },
      },
    ],
    links: {
      docs: `${BASE_URL}/docs`,
      leaderboard: `${BASE_URL}/leaderboard`,
      jwks: `${BASE_URL}/.well-known/jwks.json`,
    },
  };

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
