/**
 * POST /api/v1/attest
 * GET  /api/v1/attest?address=0x...
 *
 * Returns a cryptographically signed trust attestation for an agent address.
 * Signature verifiable via /.well-known/jwks.json (ES256 / P-256, kid: maiat-trust-v1)
 *
 * Compatible with ERC-8183 multi-attestation standard.
 *
 * Response shape:
 * {
 *   "agent": "0x...",
 *   "token": "<compact JWS>",     // header.payload.signature (base64url)
 *   "kid": "maiat-trust-v1",
 *   "expiresAt": 1234567890,       // Unix timestamp (30 min TTL)
 *   "payload": { ... }             // decoded claims for convenience
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";
import {
  signAttestation,
  buildAttestationPayload,
} from "@/lib/attestation";

export const dynamic = "force-dynamic";

// 10 attestation requests / minute per IP — attestations are short-lived but signing is cheap
const rateLimiter = createRateLimiter("attest:v1", 10, 60);

function resolveAddress(req: NextRequest): string | null {
  // GET: ?address=0x...
  const fromQuery = req.nextUrl.searchParams.get("address");
  if (fromQuery) return fromQuery;
  return null;
}

export async function GET(request: NextRequest) {
  return handler(request, resolveAddress(request));
}

export async function POST(request: NextRequest) {
  let address: string | null = null;
  try {
    const body = await request.json();
    address = body?.address ?? null;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Expected { \"address\": \"0x...\" }" },
      { status: 400 }
    );
  }
  return handler(request, address);
}

async function handler(request: NextRequest, address: string | null) {
  // Rate limit
  const { success: ok } = await checkIpRateLimit(request, rateLimiter);
  if (!ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 10 requests/minute per IP." },
      { status: 429 }
    );
  }

  // Validate address
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      {
        error: "Missing or invalid address.",
        hint: "GET /api/v1/attest?address=0x... or POST { address: '0x...' }",
      },
      { status: 400 }
    );
  }

  const checksumAddress = getAddress(address);

  // Fetch agent score from DB
  const agent = await prisma.agentScore.findFirst({
    where: {
      walletAddress: { equals: checksumAddress, mode: "insensitive" },
    },
    select: {
      walletAddress: true,
      trustScore: true,
      completionRate: true,
      totalJobs: true,
      rawMetrics: true,
    },
  });

  if (!agent) {
    return NextResponse.json(
      {
        error: "Agent not found.",
        hint: "This address has no ACP job history indexed by Maiat.",
        address: checksumAddress,
      },
      { status: 404 }
    );
  }

  // Extract sybil flags from rawMetrics (goplusFlags + any risk signals)
  const raw = agent.rawMetrics as Record<string, unknown> | null;
  const sybilFlags: string[] = [];
  if (raw) {
    const goplusFlags = raw.goplusFlags;
    if (Array.isArray(goplusFlags)) {
      sybilFlags.push(...goplusFlags.filter((f): f is string => typeof f === "string"));
    }
    // Surface any hardcoded risk codes stored in rawMetrics
    const riskFlags = raw.riskFlags;
    if (Array.isArray(riskFlags)) {
      sybilFlags.push(...riskFlags.filter((f): f is string => typeof f === "string"));
    }
  }

  // Build and sign the attestation
  const payload = buildAttestationPayload({
    agent: checksumAddress,
    score: agent.trustScore,
    completionRate: agent.completionRate,
    jobCount: agent.totalJobs,
    sybilFlags,
  });

  let signed;
  try {
    signed = await signAttestation(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown signing error";
    // Don't leak private key details — just surface config error
    if (msg.includes("MAIAT_ATTESTATION_PRIVATE_KEY")) {
      return NextResponse.json(
        { error: "Attestation signing not configured. Contact Maiat operators." },
        { status: 503 }
      );
    }
    throw err;
  }

  return NextResponse.json(
    {
      agent: checksumAddress,
      token: signed.token,
      kid: signed.kid,
      expiresAt: signed.expiresAt,
      // Decoded payload — convenience for callers that don't want to decode JWT
      payload,
      // JWKS reference for verifiers
      jwks: "https://app.maiat.io/.well-known/jwks.json",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store", // attestations are time-sensitive, never cache
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
      },
    }
  );
}
