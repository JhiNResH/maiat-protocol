/**
 * GET /.well-known/jwks.json
 *
 * Public JWKS endpoint exposing Maiat's ES256 attestation public key.
 * Anyone can verify Maiat-signed trust attestations using this endpoint.
 *
 * Compatible with:
 * - ERC-8183 multi-attestation standard
 * - InsumerAPI attestation format
 * - Standard JOSE / JWT verifiers
 *
 * The public key NEVER changes without rotating kid.
 * Cache for 24h — this is stable data.
 */

import { NextResponse } from "next/server";
import { ATTESTATION_KID, ATTESTATION_ALG } from "@/lib/attestation";

/**
 * Maiat attestation public key (P-256 / ES256).
 * Key ID: maiat-trust-v1
 *
 * Generated from the private key stored in MAIAT_ATTESTATION_PRIVATE_KEY env var.
 * This public key is safe to hardcode — it's public by definition.
 */
const MAIAT_PUBLIC_JWK = {
  kty: "EC",
  crv: "P-256",
  x: "Qtzb_MfWXCK8eeKrzdYJ09BEE-pe5gmOaQ0P6jy129Y",
  y: "kxElC8lr4cEOjobuMuKw1DT3mrou8azYNc2DQtpqnDI",
  use: "sig",
  alg: ATTESTATION_ALG,
  kid: ATTESTATION_KID,
};

export const dynamic = "force-static";
export const revalidate = 86400; // 24h cache

export async function GET() {
  const jwks = {
    keys: [MAIAT_PUBLIC_JWK],
  };

  return new NextResponse(JSON.stringify(jwks, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}
