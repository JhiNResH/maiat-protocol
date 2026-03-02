/**
 * POST /api/v1/outcome
 *
 * Receives outcome reports from SDK users — the most valuable training data.
 * Records what happened AFTER a Maiat trust check was used to make a decision.
 *
 * Flow: check trust → take action → report outcome
 * This closes the feedback loop for oracle accuracy.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

const rateLimiter = createRateLimiter("outcome", 30, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Key, X-Maiat-Client",
};

const VALID_ACTIONS = ["swap", "delegate", "hire", "skip", "block", "other"];
const VALID_RESULTS = ["success", "failure", "scam", "partial", "pending"];

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const { success: rlOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rlOk) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await request.json();

    // Validate required fields
    const { target, action, result, txHash, maiatVerdict, maiatScore, notes } = body as {
      target?: string;
      action?: string;
      result?: string;
      txHash?: string;
      maiatVerdict?: string;
      maiatScore?: number;
      notes?: string;
    };

    if (!target || !isAddress(target)) {
      return NextResponse.json(
        { error: "Valid target address required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!result || !VALID_RESULTS.includes(result)) {
      return NextResponse.json(
        { error: `result must be one of: ${VALID_RESULTS.join(", ")}` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Extract client identifier
    const clientId = request.headers.get("x-maiat-client") ?? undefined;

    const outcome = await prisma.outcome.create({
      data: {
        target: target.toLowerCase(),
        action,
        result,
        txHash: txHash ?? null,
        maiatVerdict: maiatVerdict ?? null,
        maiatScore: typeof maiatScore === "number" ? maiatScore : null,
        clientId: clientId ?? null,
        notes: notes ?? null,
      },
    });

    return NextResponse.json(
      { logged: true, id: outcome.id },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[outcome]", err);
    return NextResponse.json(
      { error: "Failed to log outcome" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
