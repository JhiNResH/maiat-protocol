import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress, verifyMessage, type Hash } from "viem";
import { checkInteraction } from "@/lib/interaction-check";
import { getUserReputation } from "@/lib/reputation";
import { apiLog } from "@/lib/logger";
import { blendTrustScore } from "@/lib/scoring";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";
import { attestReview, EAS_REVIEW_SCHEMA_UID } from "@/lib/eas";

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
  weight: number;
  createdAt: Date;
}
const memReviews: ReviewRecord[] = [];
let nextMemId = 1;

// --- Rate limiter (Upstash Redis, graceful fallback) ---
const rateLimiter = createRateLimiter("review", 30, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client, X-Maiat-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/v1/review?address=0x...
export async function GET(request: NextRequest) {
  const { success: rlOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: CORS_HEADERS });
  }

  const addressParam = request.nextUrl.searchParams.get("address");
  const voterParam = request.nextUrl.searchParams.get("voter");
  if (!addressParam) {
    return NextResponse.json({ error: "address required" }, { status: 400, headers: CORS_HEADERS });
  }

  const db = await getDb();

  // Resolve slug → real EVM address if needed
  let resolvedAddress = addressParam;
  if (!isAddress(addressParam) && db) {
    const project = await db.project.findFirst({ where: { OR: [{ slug: addressParam }, { address: addressParam }] } });
    if (project?.address && isAddress(project.address)) {
      resolvedAddress = project.address;
    } else {
      return NextResponse.json({ reviews: [], count: 0, averageRating: 0 }, { headers: CORS_HEADERS });
    }
  }

  if (!isAddress(resolvedAddress)) {
    return NextResponse.json({ error: "Valid address required" }, { status: 400, headers: CORS_HEADERS });
  }

  const checksummed = getAddress(resolvedAddress);

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
      qualityScore: r.qualityScore != null ? Math.round(r.qualityScore * 10) : null, // 0-10 → 0-100 for display
      interactionTier: r.interactionTier ?? 'none',
      source: r.source ?? r.reviewerType ?? 'human',
      hasEas: r.hasEas,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      interactionProof: false,
      weight: r.weight,
      createdAt: r.createdAt,
    }));
  } else {
    // In-memory fallback
    reviews = memReviews.filter(r => r.address === checksummed);
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const r of reviews) {
    totalWeight += r.weight;
    weightedSum += r.rating * r.weight;
  }

  const avgRating = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10) / 10
    : 0;

  // Look up voter's existing votes if voter param provided
  let voterVotes: Record<string, 'up' | 'down'> = {};
  if (voterParam && isAddress(voterParam) && db) {
    const checksumVoter = getAddress(voterParam);
    const reviewIds = reviews.map(r => r.id);
    if (reviewIds.length > 0) {
      const existingVotes = await db.reviewVote.findMany({
        where: { voter: checksumVoter, reviewId: { in: reviewIds } },
        select: { reviewId: true, vote: true },
      });
      for (const v of existingVotes) {
        voterVotes[v.reviewId] = v.vote as 'up' | 'down';
      }
    }
  }

  return NextResponse.json({
    address: checksummed,
    reviews: reviews.map(r => ({
      ...r,
      timestamp: r.createdAt.toISOString(),
      ...(voterVotes[r.id] ? { myVote: voterVotes[r.id] } : {}),
    })),
    count: reviews.length,
    averageRating: avgRating,
    ...(voterParam ? { voterAddress: voterParam } : {}),
  }, { status: 200, headers: CORS_HEADERS });
}

// ── Agent-friendly txHash verification ──────────────────────────────────────
// Agents often can't do personal_sign. Instead they can supply the txHash of
// their on-chain interaction with the target. We verify:
//   1. tx.from === reviewer (proves wallet ownership)
//   2. tx.to  === target   (proves interaction)
// If both pass, signature is not required and interactionProof is set true.

interface TxVerifyResult {
  valid: boolean;
  interacts: boolean; // reviewer → target
  error?: string;
}

async function verifyTxHash(
  txHash: string,
  reviewer: string,
  target: string
): Promise<TxVerifyResult> {
  const rpcUrl = process.env.ALCHEMY_BASE_RPC;
  if (!rpcUrl) return { valid: false, interacts: false, error: "No RPC configured" };

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

    if (!tx) return { valid: false, interacts: false, error: "Transaction not found" };

    const fromMatch = tx.from?.toLowerCase() === reviewer.toLowerCase();
    const toMatch   = tx.to?.toLowerCase()   === target.toLowerCase();

    return {
      valid: fromMatch,
      interacts: fromMatch && toMatch,
    };
  } catch (e: any) {
    return { valid: false, interacts: false, error: e.message };
  }
}

// POST /api/v1/review
//
// Required fields:
//   - address: target contract address (0x...)
//   - rating: 1-10
//   - reviewer: reviewer wallet address (0x...)
//   - signature: EIP-191 personal_sign of the review message
//     (OR txHash for agent-friendly auth — see below)
//
// Optional fields:
//   - comment: review text
//   - tags: string[] of tags
//   - txHash: on-chain tx proving reviewer → target interaction
//            (agent-friendly alternative to signature)
//
// Flow:
//   1. Verify EIP-191 signature OR txHash → proves wallet ownership
//   2. GATE: must have interacted with contract (txHash / EAS / Alchemy)
//   3. Deduct 2 Scarab → prevents spam (costs something to review)
//   4. Gemini quality check → filters gibberish/spam
//   5. Save review → persist to DB
//   6. Reward Scarab based on quality → incentivizes good reviews
//   7. Update reviewer reputation → builds trust passport
//
export async function POST(request: NextRequest) {
  const { success: rlOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: CORS_HEADERS });
  }

  const db = await getDb();

  try {
    const body = await request.json() as {
      address?: string;
      rating?: number;
      comment?: string;
      tags?: string[];
      reviewer?: string;
      signature?: string;
      easReceiptId?: string;
      txHash?: string; // agent-friendly: on-chain proof (replaces signature)
      source?: string; // "human" or "agent"
    };

    let { address, rating, comment, tags, reviewer, signature, easReceiptId, txHash } = body;
    let source: string = body.source === 'agent' ? 'agent' : 'human';

    // --- Auto-resolve reviewer from X-Maiat-Client header ---
    const clientId = request.headers.get("x-maiat-client");
    let clientIdAuth = false; // true if authenticated via X-Maiat-Client

    if (clientId) {
      if (!reviewer) {
        // No reviewer provided → auto-assign from CallerWallet
        try {
          const { getCallerWallet, signMessage } = await import("@/lib/caller-wallet");
          const walletAddr = await getCallerWallet(clientId);
          if (walletAddr) {
            reviewer = walletAddr;
            source = 'agent';
            clientIdAuth = true;

            // Auto-sign for SIWE verification
            if (!signature && !txHash && address && rating) {
              const msg = `Maiat Review: ${getAddress(address)} Rating: ${rating} Reviewer: ${getAddress(walletAddr)}`;
              const sig = await signMessage(clientId, msg);
              if (sig) signature = sig;
            }
          }
        } catch { /* non-critical */ }
      } else {
        // Reviewer provided + X-Maiat-Client → trust the header as auth
        // Agent has its own wallet but can't sign (e.g., Privy embedded wallet)
        source = body.source === 'agent' ? 'agent' : 'agent'; // force agent source
        clientIdAuth = true;
      }
    }

    // --- Validation ---
    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!rating || rating < 1 || rating > 10) {
      return NextResponse.json({ error: "Rating must be 1-10" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!reviewer || !isAddress(reviewer)) {
      return NextResponse.json({ error: "Valid reviewer wallet address required. Send X-Maiat-Client header for auto-assignment." }, { status: 400, headers: CORS_HEADERS });
    }

    const checksumAddress = getAddress(address);
    const checksumReviewer = getAddress(reviewer);

    // --- Step 0.5: Verify target is a known agent (not random EOA) ---
    if (db) {
      const knownAgent = await db.agentScore.findFirst({
        where: { walletAddress: { equals: checksumAddress, mode: 'insensitive' } },
      });
      const knownProject = !knownAgent ? await db.project.findFirst({
        where: { address: checksumAddress },
      }) : null;
      if (!knownAgent && !knownProject) {
        return NextResponse.json(
          { error: "Target address is not a known agent or project" },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    // --- Step 1: Verify wallet ownership (signature OR txHash OR X-Maiat-Client) ---
    let txHashVerified = false;
    let txHashInteracts = false;

    if (clientIdAuth) {
      // Authenticated via X-Maiat-Client header — skip signature/txHash verification
      // The agent identified itself via a stable client ID. This is sufficient for
      // agent-submitted reviews (weighted 0.5x anyway).
    } else if (txHash) {
      const txResult = await verifyTxHash(txHash, checksumReviewer, checksumAddress);
      if (!txResult.valid) {
        return NextResponse.json(
          { error: "txHash verification failed", detail: txResult.error ?? "tx.from does not match reviewer" },
          { status: 401, headers: CORS_HEADERS }
        );
      }
      txHashVerified  = true;
      txHashInteracts = txResult.interacts;
    } else if (signature) {
      // Traditional EIP-191 signature path (human wallet)
      try {
        let message = `Maiat Review: ${checksumAddress} Rating: ${rating} Reviewer: ${checksumReviewer}`;
        if (easReceiptId) {
          message += ` Receipt: ${easReceiptId}`;
        }

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
    // Note: both signature and txHash are optional for backward compat.
    // Will enforce one of them once all clients are updated.

    // --- Step 2: GATE — Interaction proof required (no passport bypass) ---
    // Passport level ONLY affects review weight — not the interaction gate.
    // Even guardian users must prove they've used the contract.
    //
    // Gate passes when ANY of:
    //   A. txHash verified → tx.from===reviewer AND tx.to===target (strongest proof)
    //   B. EAS receipt provided → cryptographic service receipt (DB-verified at Step 4.5)
    //   C. Alchemy confirms ≥1 tx → baseline on-chain interaction check
    //   None → 403

    // Fetch passport reputation — used for weight only (Step 4.5), not for gate bypass
    let passportLevel: 'new' | 'trusted' | 'verified' | 'guardian' = 'new';
    try {
      const reputation = await getUserReputation(checksumReviewer);
      passportLevel = reputation.trustLevel;
    } catch { /* DB unavailable — treat as new user */ }

    // --- Interaction verification: 3-tier soft gate ---
    // "acp"     → completed ACP job with target (1.0x)
    // "onchain" → on-chain tx between reviewer↔target (0.7x)
    // "none"    → no verifiable interaction (0.3x)
    type InteractionTier = "acp" | "onchain" | "none";
    let interactionTier: InteractionTier = "none";
    let hasInteraction = false;

    // Tier 1: Check ACP job completion (strongest proof)
    // Uses raw SQL since acp_jobs table may not exist in Prisma schema yet
    if (db) {
      try {
        const acpRows = await db.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM acp_jobs
           WHERE status = 'completed'
             AND ((LOWER(buyer_wallet) = LOWER($1) AND LOWER(seller_wallet) = LOWER($2))
               OR (LOWER(seller_wallet) = LOWER($1) AND LOWER(buyer_wallet) = LOWER($2)))
           LIMIT 1`,
          checksumReviewer,
          checksumAddress
        );
        if (acpRows.length > 0) {
          interactionTier = "acp";
          hasInteraction = true;
        }
      } catch {
        // acp_jobs table doesn't exist yet — fall through to on-chain check
      }
    }

    // Tier 2: On-chain interaction (txHash or Alchemy check)
    if (interactionTier === "none") {
      if (txHashInteracts) {
        interactionTier = "onchain";
        hasInteraction = true;
      } else if (easReceiptId) {
        // EAS receipt → at least on-chain level (EAS boost applied separately at Step 4.5)
        interactionTier = "onchain";
        hasInteraction = true;
      } else {
        const interaction = await checkInteraction(checksumReviewer, checksumAddress);
        if (interaction.hasInteracted) {
          interactionTier = "onchain";
          hasInteraction = true;
        }
      }
    }

    // Tier 3: "none" — no proof. Review allowed but weight heavily discounted (0.3x).

    // --- Step 3: Deduct Scarab (if DB available) ---
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

    // --- Step 4.5: Compute review weight (Passport + EAS) ---
    // Weight ladder (Trust Passport direction):
    //
    //   Proof type:
    //     1  = Alchemy baseline (or passport trusted bypass)
    //     2  = txHash on-chain proof  OR  verified passport level
    //     3  = txHash + verified passport  OR  guardian passport
    //     5  = EAS Receipt (always wins — cryptographic service proof)
    //
    //   Passport multipliers:
    //     new      → ×1
    //     trusted  → ×1  (skip Alchemy, but no weight boost yet)
    //     verified → ×2  (Base Verify identity proven)
    //     guardian → ×3  (community champion)

    // Base weight: interaction proof → 3×, no proof → 1×
    let weight = hasInteraction ? 3 : 1;

    let verifiedReceiptId: string | undefined = undefined;

    if (db && easReceiptId) {
      const receiptMatch = await db.eASReceipt.findFirst({
         where: {
            id: easReceiptId,
            recipient: checksumReviewer,
         }
      });

      // Safety: receipt must belong to this reviewer.
      // EAS always wins — service proof is the strongest signal.
      if (receiptMatch) {
         weight = 5;
         verifiedReceiptId = receiptMatch.id;
      }
    }

    // --- Step 5: Save review ---
    let saved: ReviewRecord;

    if (db) {
      // Persist to Supabase
      // AI quality scoring (3 dimensions)
      let aiQuality: { relevance: number; evidence: number; helpfulness: number; qualityScore: number } | null = null;
      try {
        const { scoreReviewQuality, getEffectiveWeight } = await import("@/lib/review-quality");
        aiQuality = await scoreReviewQuality({ address: checksumAddress, rating, comment: comment ?? "" });
        // Override weight with quality-based effective weight
        const hasEasAttestation = !!verifiedReceiptId;
        const effectiveWeight = getEffectiveWeight({
          qualityScore: aiQuality.qualityScore,
          reviewerType: (source === "agent" ? "agent" : "human") as "human" | "agent",
          hasEas: hasEasAttestation,
          interactionTier,
        });
        weight = Math.max(1, Math.round(effectiveWeight * 10)); // scale to int
      } catch {
        // Non-critical
      }

      const row = await db.trustReview.create({
        data: {
          address: checksumAddress,
          rating,
          comment: comment ?? "",
          tags: tags ?? [],
          reviewer: checksumReviewer,
          easReceiptId: verifiedReceiptId,
          weight,
          source,
          qualityScore: aiQuality?.qualityScore ?? null,
          relevance: aiQuality?.relevance ?? null,
          evidence: aiQuality?.evidence ?? null,
          helpfulness: aiQuality?.helpfulness ?? null,
          reviewerType: source === "agent" ? "agent" : "human",
          hasEas: !!verifiedReceiptId,
          interactionTier: interactionTier ?? "none",
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
        weight: row.weight,
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
        weight: 1,
        createdAt: new Date(),
      };
      memReviews.push(saved);
    }

    // --- Step 6: Reward Scarab based on quality ---
    // Quality reward tiers (qualityScore is 0-100):
    //   >= 80 (0.8): 3 Scarab (high quality)
    //   >= 60 (0.6): 1 Scarab (good quality)
    //   < 60:        0 Scarab (no reward, just the -2 spend)
    let scarabReward = 0;
    if (db && qualityScore !== null) {
      try {
        const { rewardScarab } = await import("@/lib/scarab");

        if (qualityScore >= 80) {
          scarabReward = 3;
        } else if (qualityScore >= 60) {
          scarabReward = 1;
        }

        if (scarabReward > 0) {
          await rewardScarab(
            checksumReviewer,
            scarabReward,
            `Review quality reward: ${scarabReward} Scarab 🪲 (quality: ${qualityScore}/100)`
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

    // --- Step 7.5: Feedback loop — recalculate agent trust score ---
    try {
      const { recalculateAgentScore } = await import("@/lib/feedback-loop");
      recalculateAgentScore(checksumAddress).catch((err) => {
        console.warn("[review] feedback-loop failed (non-blocking):", err.message);
      });
    } catch { /* best effort */ }

    // --- Step 7.6: EAS Attestation (fire-and-forget) ---
    if (EAS_REVIEW_SCHEMA_UID) {
      attestReview(
        checksumAddress,
        checksumReviewer,
        rating,
        comment ?? "",
        txHash
      ).catch((err) => {
        console.warn("[review] EAS attestReview failed (non-blocking):", err.message);
      });
    }

    // --- Step 8: Update Project stats (best-effort) ---
    if (db) {
      try {
        const allReviews = await db.trustReview.findMany({
          where: { address: { equals: checksumAddress, mode: 'insensitive' } },
          select: { rating: true, weight: true },
        });
        const totalWeight = allReviews.reduce((s, r) => s + r.weight, 0);
        const weightedSum = allReviews.reduce((s, r) => s + r.rating * r.weight, 0);
        const newAvgRating = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;

        const project = await db.project.findFirst({ where: { address: { equals: checksumAddress, mode: 'insensitive' } } });
        if (project && project.trustScore != null) {
          const onChainScore = project.trustScore / 10;
          const { blended } = blendTrustScore(onChainScore, newAvgRating, allReviews.length);
          await db.project.update({
            where: { id: project.id },
            data: {
              reviewCount: allReviews.length,
              avgRating: newAvgRating,
              trustScore: Math.round(blended * 10),
            },
          });
        }
      } catch (e) {
        console.error('[review] failed to update project stats:', e);
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
        interactionTier,        // "acp" | "onchain" | "none" — soft gate tier
        qualityScore,
        scarabDeducted,
        scarabReward,
        signatureVerified: !!signature,
        txHashVerified,
        txHashInteracts,
        passportLevel,
        easWeight: weight,
      },
    }, { status: 201, headers: CORS_HEADERS });
  } catch (err) {
    apiLog.error("review", err, {});
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: CORS_HEADERS });
  }
}
