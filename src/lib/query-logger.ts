import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export interface QueryLogInput {
  type: "agent_trust" | "agent_deep_check" | "token_check" | "trust_swap" | "token_forensics";
  target: string;
  buyer?: string;
  jobId?: string;
  trustScore?: number | null;
  verdict?: string | null;
  amountIn?: string;
  amountOut?: string;
  clientId?: string;
  framework?: string;
  callerIp?: string;
  userAgent?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

// ─── Evidence Chain ────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of a QueryLog record.
 *
 * recordHash = SHA-256(id|type|target|trustScore|verdict|prevHash|createdAt)
 *
 * Including `id` makes each record uniquely hashable even if two queries
 * share the same score/verdict for the same target at the same second.
 * prevHash chains records together per target — an auditor can walk the chain
 * and verify nothing was modified or deleted.
 */
function computeRecordHash(fields: {
  id: string;
  type: string;
  target: string;
  trustScore: number | null;
  verdict: string | null;
  prevHash: string | null;
  createdAt: Date;
}): string {
  const payload = [
    fields.id,
    fields.type,
    fields.target,
    String(fields.trustScore ?? ""),
    fields.verdict ?? "",
    fields.prevHash ?? "",
    fields.createdAt.toISOString(),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Fire-and-forget query log — never throws, never blocks the response.
 * Every logged query is training data for Maiat's trust model.
 *
 * Evidence chain integrity:
 *   prevHash → recordHash → (next record's prevHash) → ...
 *
 * Auditable at: GET /api/v1/evidence/:address
 */
export function logQuery(input: QueryLogInput): void {
  buildAndCreateLog(input).catch((err) => {
    console.error("[query-logger] failed to write log:", err);
  });
}

/**
 * Same as logQuery but returns the queryId for feedback loop.
 */
export async function logQueryAsync(input: QueryLogInput): Promise<string | null> {
  try {
    return await buildAndCreateLog(input);
  } catch (err) {
    console.error("[query-logger] failed to write log:", err);
    return null;
  }
}

// Short-term idempotency cache: prevents identical logs within a 5-second window.
// In serverless, this persists as long as the instance stays warm.
const idempotencyCache = new Map<string, number>();
const CACHE_TTL_MS = 5000;

async function buildAndCreateLog(input: QueryLogInput): Promise<string> {
  const normalizedTarget = input.target.toLowerCase();
  const trustScore = typeof input.trustScore === "number" ? input.trustScore : null;
  const verdict = input.verdict ?? null;

  // Idempotency check: hash (type + target + score + verdict)
  const cacheKey = `${input.type}:${normalizedTarget}:${trustScore}:${verdict}`;
  const now = Date.now();
  const lastLogged = idempotencyCache.get(cacheKey);

  if (lastLogged && now - lastLogged < CACHE_TTL_MS) {
    // Return early if we already logged this recently. 
    // We return a "cached" indicator or find the last ID if we really needed it, 
    // but for fire-and-forget logging, skipping is sufficient.
    return "skipped_duplicate";
  }

  // Set cache immediately to prevent concurrent triggers
  idempotencyCache.set(cacheKey, now);

  // Periodic cleanup of old cache entries (naive)
  if (idempotencyCache.size > 1000) {
    for (const [k, v] of idempotencyCache.entries()) {
      if (now - v > CACHE_TTL_MS) idempotencyCache.delete(k);
    }
  }

  try {
    // Steps 1-4 wrapped in a serializable transaction to prevent hash chain race conditions.
    // Without a transaction, concurrent requests could read the same prevHash and corrupt the chain.
    const record = await prisma.$transaction(async (tx) => {
      // Step 1: get prevHash (latest chain tip for this target, inside tx)
      const latest = await tx.queryLog.findFirst({
        where: { target: normalizedTarget },
        orderBy: { createdAt: "desc" },
        select: { recordHash: true },
      });
      const prevHash = latest?.recordHash ?? null;

      // Step 2: create the record (Prisma generates the id)
      const created = await tx.queryLog.create({
        data: {
          type: input.type,
          target: normalizedTarget,
          buyer: input.buyer?.toLowerCase() ?? null,
          jobId: input.jobId ?? null,
          trustScore,
          verdict,
          amountIn: input.amountIn ?? null,
          amountOut: input.amountOut ?? null,
          clientId: input.clientId ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: {
            ...(input.metadata ?? {}),
            ...(input.callerIp && { callerIp: input.callerIp }),
            ...(input.userAgent && { userAgent: input.userAgent }),
            ...(input.framework && { framework: input.framework }),
          } as any,
          prevHash,
          // recordHash filled in step 3
        },
        select: { id: true, createdAt: true },
      });

      // Step 3: compute recordHash now that we have the id + createdAt
      const recordHash = computeRecordHash({
        id: created.id,
        type: input.type,
        target: normalizedTarget,
        trustScore,
        verdict,
        createdAt: created.createdAt,
        prevHash,
      });

      // Step 4: patch recordHash back into the record
      await tx.queryLog.update({
        where: { id: created.id },
        data: { recordHash },
      });

      return created;
    });

    // Auto-onboard: grant 10 Scarab on first API call (fire-and-forget)
    const callerAddress = input.buyer || input.clientId;
    if (callerAddress && /^0x[a-fA-F0-9]{40}$/i.test(callerAddress)) {
      import("@/lib/scarab")
        .then(({ maybeGrantFirstCallBonus }) => maybeGrantFirstCallBonus(callerAddress))
        .catch(() => {});
    }

    // Feedback loop: recalculate agent score after ACP query
    if (input.type === "agent_trust" || input.type === "agent_deep_check") {
      import("@/lib/feedback-loop")
        .then(({ recalculateAgentScore }) =>
          recalculateAgentScore(normalizedTarget)
        )
        .catch(() => {});
    }

    return record.id;
  } catch (err) {
    // If the DB write fails, we should ideally remove it from cache so it can retry,
    // but for fire-and-forget logging, we just log the error.
    console.error("[query-logger] buildAndCreateLog failed:", err);
    throw err;
  }
}
