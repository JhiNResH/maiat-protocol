/**
 * GET /api/v1/agent/[address]
 *
 * Returns ACP behavioral trust score for a given agent wallet address.
 * Data is sourced from Virtuals ACP on-chain job history (indexed via acp-indexer.ts).
 *
 * Response format:
 * {
 *   "address": "0x...",
 *   "trustScore": 72,
 *   "dataSource": "ACP_BEHAVIORAL",
 *   "breakdown": {
 *     "completionRate": 0.95,
 *     "paymentRate": 0.98,
 *     "expireRate": 0.02,
 *     "totalJobs": 47,
 *     "ageWeeks": 12
 *   },
 *   "verdict": "proceed",
 *   "lastUpdated": "2026-02-28T..."
 * }
 *
 * verdict:
 *   >= 80 → "proceed"
 *   60–79 → "caution"
 *   < 60  → "avoid"
 *   null  → "unknown" (not indexed yet)
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Map trust score to a human-readable verdict */
function scoreToVerdict(score: number): "proceed" | "caution" | "avoid" {
  if (score >= 80) return "proceed";
  if (score >= 60) return "caution";
  return "avoid";
}

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    // ── Validate address ─────────────────────────────────────────────────────
    const rawAddress = params.address;

    if (!rawAddress || !isAddress(rawAddress)) {
      return NextResponse.json(
        {
          error:   "Invalid address",
          message: "Please provide a valid EVM wallet address (0x...)",
        },
        { status: 400 }
      );
    }

    // Normalize to checksum address
    const checksumAddress = getAddress(rawAddress);

    // ── Query Supabase ────────────────────────────────────────────────────────
    const record = await prisma.agentScore.findUnique({
      where: { walletAddress: checksumAddress },
    });

    // ── Not indexed yet ───────────────────────────────────────────────────────
    if (!record) {
      // Also try lowercase (in case indexer stored it lowercase)
      const recordLower = await prisma.agentScore.findFirst({
        where: {
          walletAddress: {
            equals: rawAddress.toLowerCase(),
            mode:   "insensitive",
          },
        },
      });

      if (!recordLower) {
        return NextResponse.json(
          {
            address:     checksumAddress,
            trustScore:  null,
            dataSource:  "ACP_BEHAVIORAL",
            breakdown:   null,
            verdict:     "unknown",
            message:
              "This address has no indexed ACP job history. " +
              "They may not have participated in Virtuals ACP yet, or the indexer hasn't run.",
            lastUpdated: null,
          },
          {
            status:  404,
            headers: { "Cache-Control": "public, s-maxage=60" },
          }
        );
      }

      // Use the case-insensitive match
      return buildResponse(checksumAddress, recordLower);
    }

    return buildResponse(checksumAddress, record);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Agent Trust API] Error:", msg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Response Builder ─────────────────────────────────────────────────────────

interface AgentScoreRecord {
  walletAddress:  string;
  trustScore:     number;
  completionRate: number;
  paymentRate:    number;
  expireRate:     number;
  totalJobs:      number;
  dataSource:     string;
  lastUpdated:    Date;
  rawMetrics:     unknown;
}

function buildResponse(
  checksumAddress: string,
  record: AgentScoreRecord
): NextResponse {
  // Calculate ageWeeks from rawMetrics if available
  let ageWeeks: number | null = null;
  try {
    const raw = record.rawMetrics as {
      firstJobTimestamp?: number | null;
    } | null;
    if (raw?.firstJobTimestamp) {
      const nowSec = Math.floor(Date.now() / 1000);
      const ageSec = nowSec - raw.firstJobTimestamp;
      ageWeeks = Math.floor(ageSec / (7 * 86_400));
    }
  } catch {
    // rawMetrics may not have expected shape; that's fine
  }

  const verdict = scoreToVerdict(record.trustScore);

  return NextResponse.json(
    {
      address:    checksumAddress,
      trustScore: record.trustScore,
      dataSource: record.dataSource,
      breakdown: {
        completionRate: record.completionRate,
        paymentRate:    record.paymentRate,
        expireRate:     record.expireRate,
        totalJobs:      record.totalJobs,
        ageWeeks,
      },
      verdict,
      lastUpdated: record.lastUpdated.toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
