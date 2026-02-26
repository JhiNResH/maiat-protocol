import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAddress, getAddress } from "viem";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MIN_STAKE = 50;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/v1/markets/[id]/position — stake Scarab on a project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await params;
    const body = await request.json();

    const { projectId, amount, reviewer } = body as {
      projectId?: string;
      amount?: number;
      reviewer?: string; // wallet address
    };

    // Validate required fields
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!amount || typeof amount !== "number") {
      return NextResponse.json(
        { error: "amount is required and must be a number" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (amount < MIN_STAKE) {
      return NextResponse.json(
        { error: `Minimum stake is ${MIN_STAKE} Scarab` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!reviewer || !isAddress(reviewer)) {
      return NextResponse.json(
        { error: "Valid reviewer wallet address required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const checksumReviewer = getAddress(reviewer).toLowerCase();

    // Check market exists and is open
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      return NextResponse.json(
        { error: "Market not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (market.status !== "open") {
      return NextResponse.json(
        { error: "Market is not open for betting", detail: `Market status: ${market.status}` },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Check market hasn't closed yet
    if (new Date() > market.closesAt) {
      return NextResponse.json(
        { error: "Market has closed", detail: `Market closed at ${market.closesAt.toISOString()}` },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, slug: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found", detail: `Project ID: ${projectId}` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Deduct Scarab from user balance
    const { spendScarabAmount } = await import("@/lib/scarab-markets");

    try {
      await spendScarabAmount(checksumReviewer, amount, "market_stake", marketId);
    } catch (scarabError: any) {
      if (scarabError.message?.includes("Insufficient")) {
        return NextResponse.json(
          {
            error: "Insufficient Scarab points",
            detail: scarabError.message,
            hint: "Claim daily Scarab at /api/v1/scarab/claim or purchase at /api/v1/scarab/purchase",
          },
          { status: 402, headers: CORS_HEADERS }
        );
      }
      throw scarabError;
    }

    // Create position and update market total
    const [position] = await prisma.$transaction([
      prisma.marketPosition.create({
        data: {
          marketId,
          projectId,
          voterId: checksumReviewer,
          amount,
        },
      }),
      prisma.market.update({
        where: { id: marketId },
        data: {
          totalPool: { increment: amount },
        },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        position: {
          id: position.id,
          marketId: position.marketId,
          projectId: position.projectId,
          projectName: project.name,
          voterId: position.voterId,
          amount: position.amount,
          createdAt: position.createdAt.toISOString(),
        },
        market: {
          id: market.id,
          title: market.title,
          newTotalPool: market.totalPool + amount,
        },
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[markets/[id]/position POST] Error:", err);
    return NextResponse.json(
      { error: "Failed to create position" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
