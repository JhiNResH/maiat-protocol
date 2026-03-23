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
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client, X-Maiat-Key",
};

const UPVOTE_REWARD = 2; // Scarab reward for receiving an upvote

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    let { reviewId, voter, vote } = (await req.json()) as {
      reviewId?: string;
      voter?: string;
      vote?: string;
    };

    if (!reviewId || typeof reviewId !== "string") {
      return NextResponse.json({ error: "reviewId required" }, { status: 400, headers: CORS_HEADERS });
    }

    // Auto-resolve voter from X-Maiat-Client header
    const clientId = req.headers.get("x-maiat-client");
    if (!voter && clientId) {
      try {
        const { getCallerWallet } = await import("@/lib/caller-wallet");
        const walletAddr = await getCallerWallet(clientId);
        if (walletAddr) voter = walletAddr;
      } catch { /* fall through */ }
    }

    if (!voter || !isAddress(voter)) {
      return NextResponse.json({ error: "Valid voter address required. Send X-Maiat-Client header for auto-assignment." }, { status: 400, headers: CORS_HEADERS });
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

    // --- Deduct 1 Scarab per vote (anti-spam) ---
    let scarabDeducted = false;
    try {
      const { spendScarab } = await import("@/lib/scarab");
      await spendScarab(checksumVoter, "vote_spend");
      scarabDeducted = true;
    } catch (scarabErr: any) {
      if (scarabErr.message?.includes("Insufficient")) {
        return NextResponse.json(
          {
            error: "Insufficient Scarab points",
            detail: "Voting costs 1 🪲 Scarab. Claim daily at /api/v1/scarab/claim.",
          },
          { status: 402, headers: CORS_HEADERS }
        );
      }
      // Other errors — continue without deduction
    }

    // --- Voter interaction verification (soft gate) ---
    // Votes from verified interactors count more
    let voteWeight = 1;
    try {
      // Check ACP job with target entity
      const targetAddress = review.address;
      const acpRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM acp_jobs
         WHERE status = 'completed'
           AND ((LOWER(buyer_wallet) = LOWER($1) AND LOWER(seller_wallet) = LOWER($2))
             OR (LOWER(seller_wallet) = LOWER($1) AND LOWER(buyer_wallet) = LOWER($2)))
         LIMIT 1`,
        checksumVoter,
        targetAddress
      );
      if (acpRows.length > 0) {
        voteWeight = 3; // ACP verified voter → 3x vote weight
      } else {
        // Check on-chain interaction
        const { checkInteraction } = await import("@/lib/interaction-check");
        const interaction = await checkInteraction(checksumVoter, targetAddress);
        if (interaction.hasInteracted) {
          voteWeight = 2; // On-chain interaction → 2x vote weight
        }
        // else voteWeight stays 1 (unverified voter)
      }
    } catch {
      // Non-critical — default weight 1
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
        // Flip vote — undo old weight, apply new weight
        const oldWeight = existing.weight ?? 1;
        await prisma.$transaction([
          prisma.reviewVote.update({
            where: { id: existing.id },
            data: { vote, weight: voteWeight },
          }),
          prisma.trustReview.update({
            where: { id: reviewId },
            data: {
              upvotes: { increment: vote === "up" ? voteWeight : -oldWeight },
              downvotes: { increment: vote === "down" ? voteWeight : -oldWeight },
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
          data: { reviewId, voter: checksumVoter, vote, weight: voteWeight },
        }),
        prisma.trustReview.update({
          where: { id: reviewId },
          data: vote === "up" ? { upvotes: { increment: voteWeight } } : { downvotes: { increment: voteWeight } },
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
        voteWeight,
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
