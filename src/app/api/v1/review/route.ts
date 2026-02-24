import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress, verifyMessage } from "viem";
import { checkInteraction } from "@/lib/interaction-check";
import { apiLog } from "@/lib/logger";

// --- DB: Prisma (Supabase) with in-memory fallback for local dev ---
let prisma: import("@prisma/client").PrismaClient | null = null;

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!prisma) {
    const { prisma: client } = await import("@/lib/prisma");
    prisma = client;
  }
  return prisma;
}

// In-memory fallback (dev only)
interface ReviewRecord {
  id: string;
  address: string;
  rating: number;
  comment: string;
  tags: string[];
  reviewer: string;
  qualityScore: number | null;
  interactionProof: boolean;
  createdAt: Date;
}
const memReviews: ReviewRecord[] = [];
let nextMemId = 1;

// --- Rate limiter ---
const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/v1/review?address=0x...
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: CORS_HEADERS });
  }

  const address = request.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Valid address required" }, { status: 400, headers: CORS_HEADERS });
  }

  const checksummed = getAddress(address);
  const db = await getDb();

  let reviews: ReviewRecord[];

  if (db) {
    // Supabase via Prisma
    const rows = await db.trustReview.findMany({
      where: { address: checksummed },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    reviews = rows.map(r => ({
      id: r.id,
      address: r.address,
      rating: r.rating,
      comment: r.comment,
      tags: r.tags,
      reviewer: r.reviewer,
      qualityScore: null,
      interactionProof: false,
      createdAt: r.createdAt,
    }));
  } else {
    // In-memory fallback
    reviews = memReviews.filter(r => r.address === checksummed);
  }

  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  return NextResponse.json({
    address: checksummed,
    reviews: reviews.map(r => ({
      ...r,
      timestamp: r.createdAt.toISOString(),
    })),
    count: reviews.length,
    averageRating: avgRating,
  }, { status: 200, headers: CORS_HEADERS });
}

// POST /api/v1/review
//
// Required fields:
//   - address: target contract address (0x...)
//   - rating: 1-10
//   - reviewer: reviewer wallet address (0x...)
//   - signature: EIP-191 personal_sign of the review message
//
// Optional fields:
//   - comment: review text
//   - tags: string[] of tags
//
// Flow:
//   1. Verify EIP-191 signature → proves wallet ownership
//   2. Check wallet-contract interaction → must have ≥1 tx on Base
//   3. Deduct 2 Scarab → prevents spam (costs something to review)
//   4. Gemini quality check → filters gibberish/spam
//   5. Save review → persist to DB
//   6. Reward Scarab based on quality → incentivizes good reviews
//   7. Update reviewer reputation → builds trust passport
//
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json() as {
      address?: string;
      rating?: number;
      comment?: string;
      tags?: string[];
      reviewer?: string;
      signature?: string;
    };

    const { address, rating, comment, tags, reviewer, signature } = body;

    // --- Validation ---
    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!rating || rating < 1 || rating > 10) {
      return NextResponse.json({ error: "Rating must be 1-10" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!reviewer || !isAddress(reviewer)) {
      return NextResponse.json({ error: "Valid reviewer wallet address required" }, { status: 400, headers: CORS_HEADERS });
    }

    const checksumAddress = getAddress(address);
    const checksumReviewer = getAddress(reviewer);

    // --- Step 1: Verify wallet signature (EIP-191 personal_sign) ---
    if (signature) {
      try {
        const message = `Maiat Review: ${checksumAddress} Rating: ${rating} Reviewer: ${checksumReviewer}`;
        const isValid = await verifyMessage({
          address: checksumReviewer as `0x${string}`,
          message,
          signature: signature as `0x${string}`,
        });
        if (!isValid) {
          return NextResponse.json(
            { error: "Invalid signature" },
            { status: 401, headers: CORS_HEADERS }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Signature verification failed" },
          { status: 401, headers: CORS_HEADERS }
        );
      }
    }
    // Note: signature is currently optional to maintain backward compatibility
    // Will be required once all clients are updated

    // --- Step 2: Check wallet-contract interaction ---
    const interaction = await checkInteraction(checksumReviewer, checksumAddress);
    const hasInteraction = interaction.hasInteracted;

    // --- Step 3: Deduct Scarab (if DB available) ---
    const db = await getDb();
    let scarabDeducted = false;

    if (db) {
      try {
        const { spendScarab } = await import("@/lib/scarab");
        await spendScarab(checksumReviewer, "review_spend");
        scarabDeducted = true;
      } catch (scarabError: any) {
        // If insufficient Scarab, return helpful error
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
        // Other Scarab errors — continue without deduction
        console.warn("[review POST] Scarab deduction failed:", scarabError.message);
      }
    }

    // --- Step 4: Gemini quality check ---
    let qualityScore: number | null = null;
    if (comment && comment.trim().length > 0) {
      try {
        const { checkReviewQuality } = await import("@/lib/gemini-review-check");
        const quality = await checkReviewQuality(
          comment,
          checksumAddress, // project name placeholder
          "crypto"        // category placeholder
        );
        qualityScore = quality.score;

        if (quality.status === "rejected") {
          // Refund Scarab if review is rejected
          if (scarabDeducted && db) {
            try {
              const { rewardScarab } = await import("@/lib/scarab");
              await rewardScarab(checksumReviewer, 2, "Review rejected — Scarab refunded");
            } catch { /* best effort refund */ }
          }
          return NextResponse.json(
            {
              error: "Review rejected by quality check",
              reason: quality.reason,
              issues: quality.qualityIssues,
            },
            { status: 422, headers: CORS_HEADERS }
          );
        }
      } catch {
        // Quality check failed — continue (fail open)
        qualityScore = 60;
      }
    }

    // --- Step 5: Save review ---
    let saved: ReviewRecord;

    if (db) {
      // Persist to Supabase
      const row = await db.trustReview.create({
        data: {
          address: checksumAddress,
          rating,
          comment: comment ?? "",
          tags: tags ?? [],
          reviewer: checksumReviewer,
        },
      });
      saved = {
        id: row.id,
        address: row.address,
        rating: row.rating,
        comment: row.comment,
        tags: row.tags,
        reviewer: row.reviewer,
        qualityScore,
        interactionProof: hasInteraction,
        createdAt: row.createdAt,
      };
    } else {
      // In-memory fallback
      saved = {
        id: `rev_${nextMemId++}`,
        address: checksumAddress,
        rating,
        comment: comment ?? "",
        tags: tags ?? [],
        reviewer: checksumReviewer,
        qualityScore,
        interactionProof: hasInteraction,
        createdAt: new Date(),
      };
      memReviews.push(saved);
    }

    // --- Step 6: Reward Scarab based on quality ---
    let scarabReward = 0;
    if (db && qualityScore !== null) {
      try {
        const { rewardScarab } = await import("@/lib/scarab");
        // Reward: 3-10 Scarab based on quality score (0-100)
        // qualityScore 70+ → 3 Scarab (minimum reward for approved)
        // qualityScore 80+ → 5 Scarab
        // qualityScore 90+ → 8 Scarab
        // qualityScore 95+ → 10 Scarab (exceptional)
        if (qualityScore >= 95) scarabReward = 10;
        else if (qualityScore >= 90) scarabReward = 8;
        else if (qualityScore >= 80) scarabReward = 5;
        else if (qualityScore >= 70) scarabReward = 3;

        if (scarabReward > 0) {
          await rewardScarab(
            checksumReviewer,
            scarabReward,
            `Review reward: ${scarabReward} Scarab 🪲 (quality: ${qualityScore}/100)`
          );
        }
      } catch {
        // Best effort reward
      }
    }

    // --- Step 7: Update reviewer reputation ---
    if (db) {
      try {
        // Increment user review count and reputation
        await db.user.upsert({
          where: { address: checksumReviewer.toLowerCase() },
          create: {
            address: checksumReviewer.toLowerCase(),
            reputationScore: 1,
            totalReviews: 1,
          },
          update: {
            totalReviews: { increment: 1 },
            reputationScore: { increment: 1 },
          },
        });
      } catch {
        // Best effort reputation update
      }
    }

    return NextResponse.json({
      success: true,
      review: {
        ...saved,
        timestamp: saved.createdAt.toISOString(),
      },
      meta: {
        persisted: !!db,
        interactionVerified: hasInteraction,
        qualityScore,
        scarabDeducted,
        scarabReward,
        signatureVerified: !!signature,
      },
    }, { status: 201, headers: CORS_HEADERS });
  } catch (err) {
    apiLog.error("review", err, {});
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: CORS_HEADERS });
  }
}
