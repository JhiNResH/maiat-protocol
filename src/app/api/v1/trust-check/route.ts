/**
 * GET /api/v1/trust-check?agent=0x...&threshold=60
 *
 * Agent-native trust oracle. Three access tiers:
 *
 * 1. FREE tier (SDK / dApp use):
 *    - No payment header, no key → rate-limited (10 req/min per IP)
 *    - Use `X-Maiat-Key` for paid unlimited tier
 *
 * 2. PAID tier (developer key):
 *    - Header: X-Maiat-Key: mk_...
 *    - No rate limit
 *
 * 3. x402 tier (agent-to-agent, proves payment on-chain):
 *    - Header: X-Payment: <txHash>
 *    - $0.001 USDC on Base per check
 *
 * Internal bypass: X-Internal-Token (maiat-agent only, skips all gates)
 *
 * Returns agent-only fields not available on the public website:
 *   - verdict: "proceed" | "caution" | "block"
 *   - x402_checks: how many times this agent has been checked
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
  "Access-Control-Allow-Headers": "Content-Type, X-Payment, X-Maiat-Key",
};

// ── Free tier rate limiter (in-memory, per IP) ────────────────────────────────
// 10 requests/min per IP — resets every minute
const FREE_RATE_LIMIT = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, remaining: FREE_RATE_LIMIT - 1 };
  }

  if (entry.count >= FREE_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: FREE_RATE_LIMIT - entry.count };
}

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
  const maiatKey  = req.headers.get("x-maiat-key");

  if (!agent || !/^0x[a-fA-F0-9]{40}$/i.test(agent)) {
    return NextResponse.json(
      { error: "agent= must be a valid 0x address" },
      { status: 400, headers: CORS }
    );
  }

  // ── Step 1: Access tier resolution ────────────────────────────────────────
  // Priority: internal token > x402 payment > paid key > free tier (rate-limited)

  // Internal bypass: maiat-agent calls (ACP seller, no x402 circular payment)
  const internalToken = req.headers.get("x-internal-token");
  const validInternalToken =
    process.env.MAIAT_INTERNAL_TOKEN &&
    internalToken === process.env.MAIAT_INTERNAL_TOKEN;

  // Paid developer key (TODO: validate against DB when key system is built)
  const isPaidKey = !!maiatKey && maiatKey.startsWith("mk_");

  // x402 payment path (agent-to-agent, proves on-chain payment)
  const isX402 = !!payment;

  // Free tier: rate-limited by IP
  let isFree = false;
  if (!validInternalToken && !isPaidKey && !isX402) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const rateCheck = checkRateLimit(ip);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          detail: "Free tier: 10 requests/min per IP. Use X-Maiat-Key for unlimited access.",
          upgrade: "https://maiat-protocol.vercel.app/api-keys",
          x402: {
            scheme: "exact",
            network: "base",
            amount: PAYMENT_AMOUNT_USDC,
            asset: "usdc",
            asset_address: USDC_BASE,
            pay_to: PAYMENT_ADDRESS,
          },
        },
        {
          status: 429,
          headers: {
            ...CORS,
            "X-RateLimit-Limit": String(FREE_RATE_LIMIT),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
    isFree = true;
  }

  // ── Step 2: Verify x402 payment tx ────────────────────────────────────────
  const isDev = !process.env.MAIAT_PAYMENT_ADDRESS ||
                process.env.NODE_ENV === "development";

  let checkerAddress: string | undefined;
  if (!validInternalToken && !isFree && !isPaidKey && payment) {
    const result = await verifyPayment(payment, PAYMENT_ADDRESS);
    checkerAddress = result.from;
    if (!result.valid && !isDev) {
      return NextResponse.json(
        { error: "Payment verification failed", detail: result.error },
        { status: 402, headers: CORS }
      );
    }
  }

  // ── Step 3: Fetch trust data ───────────────────────────────────────────────
  const addr = agent.toLowerCase();

  const [trustData, checkCount, outcomeStats] = await Promise.all([
    calculateTrustScore(addr).catch(() => null),
    prisma.agentCheckLog.count({ where: { checkedAddress: addr } }),
    getOutcomeStats(addr),
  ]);

  // Address not in DB (on-the-fly generated or failed) → return 404
  // Guard/SDK uses 404 as fail-open signal
  if (!trustData || !trustData.breakdown) {
    return NextResponse.json(
      {
        error: "Address not found",
        address: addr,
        known: false,
        detail: "This address has no Maiat community data. Submit a review to add it.",
      },
      { status: 404, headers: CORS }
    );
  }

  const score: number = trustData.score;

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
      tier: validInternalToken ? "internal" : isPaidKey ? "paid" : isX402 ? "x402" : "free",
    },
    { status: 200, headers: CORS }
  );
}
