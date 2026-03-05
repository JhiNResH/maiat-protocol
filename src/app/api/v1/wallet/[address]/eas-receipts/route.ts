import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAddress } from "viem";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/v1/wallet/:address/eas-receipts
 *
 * Returns a list of EAS receipts (attestations) found in our DB for this wallet.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const receipts = await prisma.eASReceipt.findMany({
      where: {
        recipient: {
          equals: address.toLowerCase(),
          mode: "insensitive"
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ receipts }, { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch receipts", details: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}
