/**
 * Base Verify Integration — Anti-Sybil for Maiat Reviews
 *
 * Base Verify lets users prove they own verified social accounts (X, Instagram,
 * TikTok, Coinbase) without sharing credentials. Each verified account produces
 * a deterministic token — one real person = one token = one identity.
 *
 * Integration: https://github.com/base/base-verify-demo
 * Blog: https://blog.base.dev/base-verify
 */

const BASE_VERIFY_API = "https://api.base.org/verify";
const BASE_VERIFY_APP_ID = process.env.BASE_VERIFY_APP_ID ?? "";
const BASE_VERIFY_SECRET = process.env.BASE_VERIFY_SECRET ?? "";

export interface VerificationResult {
  verified: boolean;
  provider?: "x" | "coinbase" | "instagram" | "tiktok";
  /** Deterministic token — same person always gets the same token */
  deterministicToken?: string;
  /** Whether the account is verified (e.g., X Blue) */
  accountVerified?: boolean;
  /** Follower count if available */
  followers?: number;
  error?: string;
}

/**
 * Verify a Base Verify token submitted by a user.
 * Returns verification result with provider info and sybil-resistance token.
 */
export async function verifyBaseToken(
  verifyToken: string,
  walletAddress: string
): Promise<VerificationResult> {
  if (!BASE_VERIFY_APP_ID || !BASE_VERIFY_SECRET) {
    // Graceful degradation: Base Verify not configured
    return { verified: false, error: "Base Verify not configured" };
  }

  try {
    const res = await fetch(`${BASE_VERIFY_API}/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BASE_VERIFY_SECRET}`,
      },
      body: JSON.stringify({
        appId: BASE_VERIFY_APP_ID,
        token: verifyToken,
        walletAddress,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { verified: false, error: `Base Verify returned ${res.status}` };
    }

    const data = (await res.json()) as {
      verified: boolean;
      provider?: string;
      deterministicToken?: string;
      traits?: {
        verified?: boolean;
        followerCount?: number;
      };
    };

    return {
      verified: data.verified,
      provider: data.provider as VerificationResult["provider"],
      deterministicToken: data.deterministicToken,
      accountVerified: data.traits?.verified,
      followers: data.traits?.followerCount,
    };
  } catch (err) {
    return {
      verified: false,
      error: `Base Verify error: ${(err as Error).message}`,
    };
  }
}

/**
 * Calculate review weight multiplier based on verification status.
 *
 * Weight hierarchy:
 *   - EAS on-chain attestation: 5x
 *   - On-chain interaction proof: 3x
 *   - Base Verify (verified social): 2x
 *   - No verification: 1x
 */
export function calculateReviewWeight(opts: {
  hasEAS?: boolean;
  hasInteractionProof?: boolean;
  hasBaseVerify?: boolean;
}): number {
  if (opts.hasEAS) return 5;
  if (opts.hasInteractionProof) return 3;
  if (opts.hasBaseVerify) return 2;
  return 1;
}

/**
 * Check if a deterministic token has already been used for a review on this agent.
 * Prevents the same verified person from reviewing twice with different wallets.
 */
export async function isDuplicateReview(
  deterministicToken: string,
  agentAddress: string,
  prisma: { review: { findFirst: (args: unknown) => Promise<unknown> } }
): Promise<boolean> {
  try {
    const existing = await prisma.review.findFirst({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: {
        address: agentAddress.toLowerCase(),
        verifyToken: deterministicToken,
      } as any,
    });
    return !!existing;
  } catch {
    return false; // graceful: if check fails, allow the review
  }
}
