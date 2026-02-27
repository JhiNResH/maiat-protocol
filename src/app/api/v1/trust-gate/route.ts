/**
 * GET /api/v1/trust-gate?agent=0x...&threshold=60
 *
 * x402 payment-gated trust oracle endpoint.
 * Uses Coinbase @x402/next package for standard x402 protocol.
 *
 * External AI agents (Coinbase awal, Ethy, etc.) can use this endpoint
 * with standard x402 protocol to pay for trust score queries.
 *
 * Pricing: $0.02 USDC on Base mainnet per check
 * Payment: X-Payment header with x402 payment payload
 */

import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { calculateTrustScore } from "@/lib/trust-score";

// ── x402 Configuration ────────────────────────────────────────────────────────

const NETWORK = "eip155:8453" as const; // Base mainnet
const FACILITATOR_URL = "https://facilitator.x402.org";
const PAY_TO = "0xAf1aE6F344c60c7Fe56CB53d1809f2c0B997a2b9"; // Maiat wallet
const PRICE = "$0.02";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Payment",
};

// ── Initialize x402 server ────────────────────────────────────────────────────

const facilitatorClient = new HTTPFacilitatorClient(FACILITATOR_URL);
const x402Server = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactEvmScheme()
);

const routeConfig = {
  accepts: {
    scheme: "exact" as const,
    network: NETWORK,
    payTo: PAY_TO,
    price: PRICE,
  },
  description: "Trust gate verdict for AI agent/contract address",
};

// ── CORS preflight ────────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ── Handler (wrapped by withX402) ─────────────────────────────────────────────

async function handler(req: NextRequest): Promise<NextResponse> {
  const agent = req.nextUrl.searchParams.get("agent") ?? "";
  const threshold = parseInt(req.nextUrl.searchParams.get("threshold") ?? "60");

  // Validate address format
  if (!agent || !/^0x[a-fA-F0-9]{40}$/i.test(agent)) {
    return NextResponse.json(
      { error: "agent= must be a valid 0x address" },
      { status: 400, headers: CORS }
    );
  }

  const addr = agent.toLowerCase();

  // Fetch trust data (reuse existing trust-score logic)
  const trustData = await calculateTrustScore(addr).catch(() => null);

  // Unknown address → return caution verdict (don't throw, x402 already charged)
  if (!trustData || !trustData.breakdown) {
    return NextResponse.json(
      {
        address: addr,
        score: 0,
        threshold,
        verdict: "caution" as const,
        known: false,
        breakdown: null,
        checked_at: new Date().toISOString(),
        powered_by: "Maiat Protocol",
      },
      { status: 200, headers: CORS }
    );
  }

  const score: number = trustData.score;

  // Verdict logic (same as trust-check)
  let verdict: "proceed" | "caution" | "block";
  if (score >= threshold) {
    verdict = "proceed";
  } else if (score >= threshold * 0.7) {
    verdict = "caution";
  } else {
    verdict = "block";
  }

  return NextResponse.json(
    {
      address: addr,
      score,
      threshold,
      verdict,
      known: true,
      breakdown: trustData.breakdown,
      review_count: trustData.metadata?.totalReviews ?? 0,
      avg_rating: trustData.metadata?.avgRating ?? null,
      checked_at: new Date().toISOString(),
      powered_by: "Maiat Protocol",
    },
    { status: 200, headers: CORS }
  );
}

// ── Export wrapped handler ────────────────────────────────────────────────────

export const GET = withX402(handler, routeConfig, x402Server);
