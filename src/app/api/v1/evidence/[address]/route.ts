/**
 * GET /api/v1/evidence/[address]
 *
 * Returns the QueryLog evidence chain for a given target address.
 * Each record includes prevHash → recordHash forming a verifiable hash chain.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
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
        trustScore: true,
        verdict: true,
        outcome: true,
        prevHash: true,
        recordHash: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        address: getAddress(rawAddress),
        totalRecords: records.length,
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
