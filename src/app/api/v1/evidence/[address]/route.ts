/**
 * GET /api/v1/evidence/[address]
 *
 * Returns the QueryLog evidence chain for a given target address.
 * Each record includes prevHash → recordHash forming a verifiable hash chain.
 * Chain integrity is verified before serving.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

const rateLimiter = createRateLimiter("evidence", 30, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export const dynamic = "force-dynamic";

/**
 * Verify hash chain integrity.
 * Returns { valid: true } or { valid: false, brokenAt: index, reason }.
 */
function verifyChain(
  records: Array<{
    id: string;
    type: string;
    target: string;
    trustScore: number | null;
    verdict: string | null;
    prevHash: string | null;
    recordHash: string | null;
    createdAt: Date;
  }>
): { valid: boolean; brokenAt?: number; reason?: string } {
  for (let i = 0; i < records.length; i++) {
    const r = records[i];

    // Verify prevHash linkage
    if (i === 0) {
      if (r.prevHash !== null) {
        return { valid: false, brokenAt: i, reason: "First record must have null prevHash" };
      }
    } else {
      const prev = records[i - 1];
      if (r.prevHash !== prev.recordHash) {
        return { valid: false, brokenAt: i, reason: `prevHash mismatch at record ${i}` };
      }
    }

    // Verify recordHash
    if (r.recordHash) {
      const payload = [
        r.id,
        r.type,
        r.target,
        String(r.trustScore ?? ""),
        r.verdict ?? "",
        r.prevHash ?? "",
        r.createdAt.toISOString(),
      ].join("|");
      const expected = createHash("sha256").update(payload).digest("hex");
      if (expected !== r.recordHash) {
        return { valid: false, brokenAt: i, reason: `recordHash tampered at record ${i}` };
      }
    }
  }
  return { valid: true };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  // Rate limit
  const { success: rlOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rlOk) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  const { address: rawAddress } = await params;

  if (!rawAddress || !isAddress(rawAddress)) {
    return NextResponse.json(
      {
        error: "Invalid address",
        message: "Please provide a valid EVM address (0x...)",
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const target = getAddress(rawAddress).toLowerCase();

  try {
    const records = await prisma.queryLog.findMany({
      where: { target },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        target: true,
        trustScore: true,
        verdict: true,
        outcome: true,
        prevHash: true,
        recordHash: true,
        createdAt: true,
      },
    });

    // Verify chain integrity before serving
    const integrity = verifyChain(records);
    if (!integrity.valid) {
      console.error(`[Evidence API] Chain integrity failure for ${target}:`, integrity);
      return NextResponse.json(
        {
          error: "Chain integrity verification failed",
          detail: integrity.reason,
          brokenAt: integrity.brokenAt,
        },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        address: getAddress(rawAddress),
        totalRecords: records.length,
        chainIntegrity: "verified",
        records: records.map((r) => ({
          id: r.id,
          type: r.type,
          trustScore: r.trustScore,
          verdict: r.verdict,
          outcome: r.outcome,
          prevHash: r.prevHash,
          recordHash: r.recordHash,
          createdAt: r.createdAt.toISOString(),
        })),
      },
      {
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Evidence API] Error:", msg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
