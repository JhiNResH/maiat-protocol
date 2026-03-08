/**
 * POST /api/v1/review/vote
 *
 * Upvote or downvote a review. One vote per review per wallet.
 * Upvote → reviewer gets +2 Scarab
 * Downvote → no penalty (just lowers visibility)
 * Changing vote is allowed (flip up↔down)
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client",
};

const UPVOTE_REWARD = 2; // Scarab reward for receiving an upvote

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const { reviewId, voter, vote } = (await req.json()) as {
      reviewId?: string;
      voter?: string;
      vote?: string;
    };

    if (!reviewId || typeof reviewId !== "string") {
      return NextResponse.json({ error: "reviewId required" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!voter || !isAddress(voter)) {
      return NextResponse.json({ error: "Valid voter address required" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!vote || !["up", "down"].includes(vote)) {
      return NextResponse.json({ error: 'vote must be "up" or "down"' }, { status: 400, headers: CORS_HEADERS });
    }

    const checksumVoter = getAddress(voter);
    const { prisma } = await import("@/lib/prisma");

    // Check review exists
    const review = await prisma.trustReview.findUnique({ where: { id: reviewId } });
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404, headers: CORS_HEADERS });
    }

    // Can't vote on your own review
    if (review.reviewer.toLowerCase() === checksumVoter.toLowerCase()) {
      return NextResponse.json({ error: "Can't vote on your own review" }, { status: 400, headers: CORS_HEADERS });
    }

    // Check existing vote
    const existing = await prisma.reviewVote.findUnique({
      where: { reviewId_voter: { reviewId, voter: checksumVoter } },
    });

    let action: "created" | "changed" | "unchanged";
    let scarabAwarded = 0;

    if (existing) {
      if (existing.vote === vote) {
        action = "unchanged";
      } else {
        // Flip vote
        await prisma.$transaction([
          prisma.reviewVote.update({
            where: { id: existing.id },
            data: { vote },
          }),
          prisma.trustReview.update({
            where: { id: reviewId },
            data: {
              upvotes: { increment: vote === "up" ? 1 : -1 },
              downvotes: { increment: vote === "down" ? 1 : -1 },
            },
          }),
        ]);
        action = "changed";

        // If flipped to upvote, reward reviewer
        if (vote === "up") {
          try {
            const { rewardOutcome } = await import("@/lib/scarab-rewards");
            // Reuse reward function — small +2 reward
            await prisma.scarabBalance.upsert({
              where: { address: review.reviewer.toLowerCase() },
              create: { address: review.reviewer.toLowerCase(), balance: UPVOTE_REWARD, totalEarned: UPVOTE_REWARD },
              update: { balance: { increment: UPVOTE_REWARD }, totalEarned: { increment: UPVOTE_REWARD } },
            });
            scarabAwarded = UPVOTE_REWARD;
          } catch { /* non-critical */ }
        }
      }
    } else {
      // New vote
      await prisma.$transaction([
        prisma.reviewVote.create({
          data: { reviewId, voter: checksumVoter, vote },
        }),
        prisma.trustReview.update({
          where: { id: reviewId },
          data: vote === "up" ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
        }),
      ]);
      action = "created";

      // Upvote → reward reviewer
      if (vote === "up") {
        try {
          await prisma.scarabBalance.upsert({
            where: { address: review.reviewer.toLowerCase() },
            create: { address: review.reviewer.toLowerCase(), balance: UPVOTE_REWARD, totalEarned: UPVOTE_REWARD },
            update: { balance: { increment: UPVOTE_REWARD }, totalEarned: { increment: UPVOTE_REWARD } },
          });
          scarabAwarded = UPVOTE_REWARD;
        } catch { /* non-critical */ }
      }
    }

    return NextResponse.json(
      {
        success: true,
        action,
        vote,
        reviewId,
        ...(scarabAwarded > 0 && {
          scarab: { reviewerEarned: scarabAwarded, message: `Reviewer earned +${scarabAwarded} 🪲` },
        }),
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[review-vote]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS });
  }
}
