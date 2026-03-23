/**
 * DEPRECATED: /api/v1/trust-score
 *
 * This endpoint is deprecated. Use GET /api/v1/agent/{address} instead.
 */

import { NextRequest, NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

const DEPRECATION_RESPONSE = {
  deprecated: true,
  message: "This endpoint is deprecated. Use GET /api/v1/agent/{address}",
  canonical: "/api/v1/agent/{address}",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410, headers: CORS });
}

export async function POST() {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410, headers: CORS });
}
