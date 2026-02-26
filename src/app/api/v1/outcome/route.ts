/**
 * POST /api/v1/outcome
 *
 * Buyer agents report job outcomes after delivery.
 * Closes the data flywheel: payment → delivery → outcome → trust score update.
 *
 * Anti-fraud: reporterAddress must match a real tx.to === sellerAddress on-chain
 * (buyer paid seller → proves the job happened → outcome report is legit)
 *
 * Score impact (applied to Project or AgentCheckLog aggregate):
 *   success → outcomeReport stored, positive signal
 *   failed  → outcomeReport stored, negative signal
 *   dispute → outcomeReport stored, heavy negative signal
 *
 * Trust score recalculation happens at query time (outcome_score in trust-check).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ── Verify buyer actually paid seller (anti-fraud) ────────────────────────────
async function verifyBuyerPaidSeller(
  txHash: string,
  buyer: string,
  seller: string
): Promise<{ valid: boolean; error?: string }> {
  const rpcUrl = process.env.ALCHEMY_BASE_RPC;
  if (!rpcUrl) return { valid: false, error: "No RPC" };

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

    const fromMatch = tx.from?.toLowerCase() === buyer.toLowerCase();
    const toMatch   = tx.to?.toLowerCase()   === seller.toLowerCase();

    // Also accept USDC transfers (to = USDC contract, with transfer event)
    // For now: direct tx match is sufficient
    return { valid: fromMatch && toMatch };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sellerAddress?: string;
      buyerAddress?: string;
      jobId?: string;
      result?: string;
      paymentTxHash?: string;
      notes?: string;
    };

    const { sellerAddress, buyerAddress, jobId, result, paymentTxHash, notes } = body;

    // ── Validation ─────────────────────────────────────────────────────────
    if (!sellerAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sellerAddress)) {
      return NextResponse.json(
        { error: "sellerAddress must be a valid 0x address" },
        { status: 400, headers: CORS }
      );
    }
    if (!buyerAddress || !/^0x[a-fA-F0-9]{40}$/i.test(buyerAddress)) {
      return NextResponse.json(
        { error: "buyerAddress must be a valid 0x address" },
        { status: 400, headers: CORS }
      );
    }
    if (!result || !["success", "failed", "dispute"].includes(result)) {
      return NextResponse.json(
        { error: "result must be: success | failed | dispute" },
        { status: 400, headers: CORS }
      );
    }

    const seller = sellerAddress.toLowerCase();
    const buyer  = buyerAddress.toLowerCase();

    // ── Anti-fraud: verify buyer paid seller ────────────────────────────────
    if (paymentTxHash) {
      const { valid, error } = await verifyBuyerPaidSeller(paymentTxHash, buyer, seller);
      if (!valid) {
        return NextResponse.json(
          {
            error: "Payment verification failed",
            detail: error ?? "tx.from !== buyerAddress or tx.to !== sellerAddress",
            hint: "Provide the txHash of a transaction where buyer paid seller.",
          },
          { status: 403, headers: CORS }
        );
      }
    }
    // Note: paymentTxHash is recommended but not mandatory.
    // Reports without txHash are stored with lower weight in outcome_score.

    // ── Duplicate check (same jobId from same buyer) ────────────────────────
    if (jobId) {
      const exists = await prisma.outcomeReport.findFirst({
        where: { jobId, buyerAddress: buyer },
      });
      if (exists) {
        return NextResponse.json(
          { error: "Outcome already reported for this jobId + buyer" },
          { status: 409, headers: CORS }
        );
      }
    }

    // ── Save outcome report ─────────────────────────────────────────────────
    const report = await prisma.outcomeReport.create({
      data: {
        sellerAddress: seller,
        buyerAddress:  buyer,
        jobId:         jobId ?? null,
        result,
        paymentTxHash: paymentTxHash ?? null,
        notes:         notes ?? null,
      },
    });

    // ── Compute updated outcome stats (return live) ─────────────────────────
    const allOutcomes = await prisma.outcomeReport.findMany({
      where: { sellerAddress: seller },
      select: { result: true },
    });

    const total   = allOutcomes.length;
    const success = allOutcomes.filter((o) => o.result === "success").length;
    const dispute = allOutcomes.filter((o) => o.result === "dispute").length;
    const raw     = (success * 100 + dispute * -20) / total;
    const outcomeScore  = Math.max(0, Math.min(100, Math.round(raw)));
    const disputeRate   = Math.round((dispute / total) * 1000) / 10;

    return NextResponse.json(
      {
        success: true,
        report_id: report.id,
        seller: seller,
        result,
        verified: !!paymentTxHash,
        updated_stats: {
          outcome_score: outcomeScore,
          dispute_rate: disputeRate,
          total_outcomes: total,
        },
      },
      { status: 201, headers: CORS }
    );
  } catch (err) {
    console.error("[/api/v1/outcome] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS }
    );
  }
}
