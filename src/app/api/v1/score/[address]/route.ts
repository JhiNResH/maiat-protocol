/**
 * DEPRECATED: /api/v1/score/[address]
 *
 * This endpoint is deprecated. Use GET /api/v1/agent/{address} instead.
 */

import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEPRECATION_RESPONSE = {
  deprecated: true,
  message: "This endpoint is deprecated. Use GET /api/v1/agent/{address}",
  canonical: "/api/v1/agent/{address}",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  // If valid address provided, redirect to canonical endpoint
  if (address && /^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.redirect(
      new URL(`/api/v1/agent/${address}`, request.url),
      301
    );
  }

  // Otherwise return 410 Gone
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410, headers: CORS_HEADERS });
}
