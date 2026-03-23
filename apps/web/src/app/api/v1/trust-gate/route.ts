/**
 * DEPRECATED: /api/v1/trust-gate
 *
 * This endpoint is deprecated. Use GET /api/v1/agent/{address} instead.
 */

import { NextRequest, NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Payment",
};

const DEPRECATION_RESPONSE = {
  deprecated: true,
  message: "This endpoint is deprecated. Use GET /api/v1/agent/{address}",
  canonical: "/api/v1/agent/{address}",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get("agent");

  // If valid address provided, redirect to canonical endpoint
  if (agent && /^0x[a-fA-F0-9]{40}$/i.test(agent)) {
    return NextResponse.redirect(
      new URL(`/api/v1/agent/${agent}`, req.url),
      301
    );
  }

  // Otherwise return 410 Gone
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410, headers: CORS });
}
