/**
 * Maiat Attestation Signing Utility
 *
 * ES256 (P-256) signed attestations for agent trust scores.
 * Public key verifiable via /.well-known/jwks.json
 * Key ID: maiat-trust-v1
 *
 * SECURITY: Private key is loaded from MAIAT_ATTESTATION_PRIVATE_KEY env var.
 * NEVER commit the private key to git.
 */

import { SignJWT, importJWK, type JWK } from "jose";

export const ATTESTATION_KID = "maiat-trust-v1";
export const ATTESTATION_ALG = "ES256";

/** Tiers matching ERC-8183 / multi-attestation standard */
export type TrustTier = "unverified" | "low" | "medium" | "high" | "elite";

export interface AttestationPayload {
  /** Agent wallet address (checksummed) */
  agent: string;
  /** 0–100 composite trust score */
  score: number;
  /** 0.0–1.0 job completion rate */
  completionRate: number;
  /** Sybil / risk flag codes */
  sybilFlags: string[];
  /** Total ACP jobs processed */
  jobCount: number;
  /** Human-readable trust tier */
  tier: TrustTier;
  /** ISO-8601 timestamp */
  attestedAt: string;
}

export interface SignedAttestation {
  /** The attested agent */
  agent: string;
  /** Compact JWS (header.payload.signature) */
  token: string;
  /** Key ID used to sign — for JWKS lookup */
  kid: string;
  /** Expiry as Unix timestamp */
  expiresAt: number;
}

function getTier(score: number): TrustTier {
  if (score >= 90) return "elite";
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  if (score >= 30) return "low";
  return "unverified";
}

/**
 * Load the private JWK from environment.
 * Throws if MAIAT_ATTESTATION_PRIVATE_KEY is not set.
 */
async function loadPrivateKey() {
  const raw = process.env.MAIAT_ATTESTATION_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      "MAIAT_ATTESTATION_PRIVATE_KEY env var is not set. " +
        "Set it in Vercel environment variables (never commit to git)."
    );
  }

  let jwk: JWK;
  try {
    jwk = JSON.parse(raw) as JWK;
  } catch {
    throw new Error(
      "MAIAT_ATTESTATION_PRIVATE_KEY must be a valid JSON JWK string."
    );
  }

  return importJWK(jwk, ATTESTATION_ALG);
}

/**
 * Sign an attestation payload with the Maiat private key.
 * Returns a compact JWS token + metadata.
 *
 * TTL: 30 minutes (attestations are short-lived by design)
 */
export async function signAttestation(
  payload: AttestationPayload
): Promise<SignedAttestation> {
  const privateKey = await loadPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 30 * 60; // 30 min TTL

  const token = await new SignJWT({
    // Standard JWT claims
    sub: payload.agent,
    iss: "https://app.maiat.io",
    aud: "erc8183",
    iat: now,
    exp,
    // Maiat-specific claims
    ...payload,
  })
    .setProtectedHeader({ alg: ATTESTATION_ALG, kid: ATTESTATION_KID })
    .sign(privateKey);

  return {
    agent: payload.agent,
    token,
    kid: ATTESTATION_KID,
    expiresAt: exp,
  };
}

/**
 * Build an AttestationPayload from raw agent score data.
 * Convenience wrapper — call signAttestation() on the result.
 */
export function buildAttestationPayload(opts: {
  agent: string;
  score: number;
  completionRate: number;
  jobCount: number;
  sybilFlags?: string[];
}): AttestationPayload {
  return {
    agent: opts.agent,
    score: Math.round(opts.score),
    completionRate: parseFloat(opts.completionRate.toFixed(4)),
    sybilFlags: opts.sybilFlags ?? [],
    jobCount: opts.jobCount,
    tier: getTier(opts.score),
    attestedAt: new Date().toISOString(),
  };
}
