import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Alias for /api/v1/explore/recent — same endpoint, different path
export async function GET() {
  try {
    const reviews = await prisma.trustReview.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        reviewer: true,
        address: true,
        rating: true,
        comment: true,
        createdAt: true,
      }
    });

    const formatted = reviews.map(r => {
      const hoursAgo = Math.max(1, Math.round((Date.now() - r.createdAt.getTime()) / (1000 * 60 * 60)));
      return {
        reviewer: `${r.reviewer.slice(0, 5)}...${r.reviewer.slice(-4)}`,
        target: `${r.address.slice(0, 6)}...${r.address.slice(-4)}`,
        rating: r.rating,
        snippet: r.comment.slice(0, 60) + (r.comment.length > 60 ? '...' : ''),
        hoursAgo
      };
    });

    return NextResponse.json({ recent: formatted });
  } catch (error) {
    console.error("[GET /api/v1/reviews/recent]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
