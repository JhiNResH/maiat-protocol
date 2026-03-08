/**
 * POST /api/v1/scarab/agent-claim
 *
 * Agent-friendly claim endpoint — no SIWE signature needed.
 * Uses X-Maiat-Client header to identify the agent,
 * looks up their Privy server wallet, and claims on their behalf.
 *
 * Flow:
 *   Agent sends POST with X-Maiat-Client header
 *   → We look up their CallerWallet (Privy server wallet)
 *   → Sign the claim message server-side with agentSign()
 *   → Credit Scarab to their wallet address
 */

import { NextRequest, NextResponse } from "next/server";
import { claimDaily } from "@/lib/scarab";
import { getCallerWallet } from "@/lib/caller-wallet";
import type { Address } from "viem";
import { getAddress } from "viem";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const clientId = req.headers.get("x-maiat-client");

    if (!clientId || clientId.length < 3) {
      return NextResponse.json(
        { error: "X-Maiat-Client header required (your agent identifier)" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Get or create Privy wallet for this agent
    const walletAddress = await getCallerWallet(clientId);

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Could not assign wallet. Ensure Privy is configured." },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    let checksumAddress: Address;
    try {
      checksumAddress = getAddress(walletAddress);
    } catch {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // Claim directly — no SIWE needed, server already verified via X-Maiat-Client + Privy wallet
    const claimResult = await claimDaily(checksumAddress, false) as Record<string, unknown>;

    return NextResponse.json(
      {
        ...claimResult,
        wallet: checksumAddress,
        clientId,
        note: "Claimed via agent-claim (server-signed, no SIWE needed)",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);

    // Handle "already claimed today" gracefully
    if (msg.includes("already claimed") || msg.includes("cooldown")) {
      return NextResponse.json(
        { error: msg, canClaim: false },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    console.error("[agent-claim]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
