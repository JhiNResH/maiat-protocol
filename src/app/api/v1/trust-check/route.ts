/**
 * GET /api/v1/trust-check?agent=0x...&threshold=60
 *
 * Agent-native trust oracle. Paid via x402 ($0.001 USDC on Base).
 *
 * x402 flow:
 *   1. Agent calls this endpoint (no header)
 *   2. Maiat returns 402 + X-Payment-Required details
 *   3. Agent pays $0.001 USDC → gets txHash
 *   4. Agent retries with X-Payment: <txHash>
 *   5. Maiat verifies payment → returns trust verdict
 *
 * Returns agent-only fields not available on the public website:
 *   - verdict: "proceed" | "caution" | "block"
 *   - x402_checks: how many times this agent has been checked via x402
 *   - outcome_score: computed from buyer outcome reports (0-100)
 *   - dispute_rate: % of outcomes that were disputes
 *   - bond_amount: USDC bonded (null until bond contract live)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateTrustScore } from "@/lib/trust-score";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Payment",
};

// Maiat's USDC receiving address on Base (set in Vercel env)
const PAYMENT_ADDRESS =
  process.env.MAIAT_PAYMENT_ADDRESS ?? "0x0000000000000000000000000000000000000000";
const PAYMENT_AMOUNT_USDC = "0.001";
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ── x402 payment verification ─────────────────────────────────────────────────
async function verifyPayment(
  txHash: string,
  expectedTo: string
): Promise<{ valid: boolean; from?: string; error?: string }> {
  const rpcUrl = process.env.ALCHEMY_BASE_RPC;
  if (!rpcUrl) return { valid: false, error: "No RPC configured" };

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionByHash",
        params: [txHash],
      }),
      signal: AbortSignal.timeout(5_000),
    });

    const data = await res.json();
    const tx = data?.result;
    if (!tx) return { valid: false, error: "Transaction not found" };

    const toMatch = tx.to?.toLowerCase() === expectedTo.toLowerCase() ||
                    tx.to?.toLowerCase() === USDC_BASE.toLowerCase();

    return { valid: toMatch, from: tx.from ?? undefined };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

// ── Compute outcome score from OutcomeReport records ─────────────────────────
async function getOutcomeStats(address: string) {
  const outcomes = await prisma.outcomeReport.findMany({
    where: { sellerAddress: address.toLowerCase() },
    select: { result: true },
  });

  if (outcomes.length === 0) {
    return { outcome_score: null, dispute_rate: null, outcome_count: 0 };
  }

  const success = outcomes.filter((o) => o.result === "success").length;
  const failed  = outcomes.filter((o) => o.result === "failed").length;
  const dispute = outcomes.filter((o) => o.result === "dispute").length;
  const total   = outcomes.length;

  // outcome_score: weighted (success=100, failed=0, dispute=-20 penalty)
  const raw = (success * 100 + failed * 0 + dispute * -20) / total;
  const outcome_score = Math.max(0, Math.min(100, Math.round(raw)));
  const dispute_rate  = Math.round((dispute / total) * 1000) / 10; // e.g. 2.5%

  return { outcome_score, dispute_rate, outcome_count: total };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const agent     = req.nextUrl.searchParams.get("agent") ?? "";
  const threshold = parseInt(req.nextUrl.searchParams.get("threshold") ?? "60");
  const payment   = req.headers.get("x-payment");

  if (!agent || !/^0x[a-fA-F0-9]{40}$/i.test(agent)) {
    return NextResponse.json(
      { error: "agent= must be a valid 0x address" },
      { status: 400, headers: CORS }
    );
  }

  // ── Step 1: x402 gate ──────────────────────────────────────────────────────
  // No payment header → return 402 with instructions
  if (!payment) {
    return NextResponse.json(
      {
        error: "Payment required",
        x402: {
          scheme: "exact",
          network: "base",
          amount: PAYMENT_AMOUNT_USDC,
          asset: "usdc",
          asset_address: USDC_BASE,
          pay_to: PAYMENT_ADDRESS,
          memo: `maiat-trust-check:${agent}`,
        },
        instructions:
          "Pay $0.001 USDC on Base to the address above, then retry with header: X-Payment: <txHash>",
      },
      {
        status: 402,
        headers: {
          ...CORS,
          "X-Payment-Required": JSON.stringify({
            scheme: "exact",
            network: "base",
            amount: PAYMENT_AMOUNT_USDC,
            asset: "usdc",
            payTo: PAYMENT_ADDRESS,
          }),
        },
      }
    );
  }

  // ── Step 2: Verify payment tx ──────────────────────────────────────────────
  const { valid, from: checkerAddress, error: payErr } = await verifyPayment(
    payment,
    PAYMENT_ADDRESS
  );

  // Allow bypass in dev / if payment address not configured
  const isDev = !process.env.MAIAT_PAYMENT_ADDRESS ||
                process.env.NODE_ENV === "development";

  if (!valid && !isDev) {
    return NextResponse.json(
      { error: "Payment verification failed", detail: payErr },
      { status: 402, headers: CORS }
    );
  }

  // ── Step 3: Fetch trust data ───────────────────────────────────────────────
  const addr = agent.toLowerCase();

  const [trustData, checkCount, outcomeStats] = await Promise.all([
    calculateTrustScore(addr).catch(() => null),
    prisma.agentCheckLog.count({ where: { checkedAddress: addr } }),
    getOutcomeStats(addr),
  ]);

  const score: number = trustData?.score ?? 0;

  // Verdict logic
  let verdict: "proceed" | "caution" | "block";
  if (score >= threshold) {
    verdict = "proceed";
  } else if (score >= threshold * 0.7) {
    verdict = "caution";
  } else {
    verdict = "block";
  }

  // ── Step 4: Log this check ─────────────────────────────────────────────────
  await prisma.agentCheckLog.create({
    data: {
      checkedAddress: addr,
      checkerAddress: checkerAddress?.toLowerCase() ?? null,
      paymentTxHash: isDev ? null : payment,
      score,
      verdict,
    },
  }).catch(() => {/* non-fatal */});

  // ── Step 5: Return agent-native response ───────────────────────────────────
  return NextResponse.json(
    {
      // ── Core (same as website) ──
      address: addr,
      score,
      threshold,

      // ── Agent-only fields ──
      verdict,                                    // "proceed" | "caution" | "block"
      x402_checks: checkCount + 1,               // total times this addr was checked
      outcome_score: outcomeStats.outcome_score,  // null if no outcome reports yet
      dispute_rate: outcomeStats.dispute_rate,    // null if no outcomes
      outcome_count: outcomeStats.outcome_count,
      bond_amount: null,                          // coming in Bond Contract (Layer 2)

      // ── Breakdown ──
      breakdown: trustData?.breakdown ?? null,
      review_count: trustData?.metadata?.totalReviews ?? 0,
      avg_rating: trustData?.metadata?.avgRating ?? null,

      // ── Meta ──
      checked_at: new Date().toISOString(),
      powered_by: "Maiat Protocol",
    },
    { status: 200, headers: CORS }
  );
}
