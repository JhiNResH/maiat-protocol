/**
 * GET /.well-known/x402
 *
 * x402 Service Discovery Endpoint (x402scan compatible)
 *
 * Format spec: https://github.com/Merit-Systems/x402scan/blob/main/docs/DISCOVERY.md
 * x402scan expects: { version: 1, resources: [...urls] }
 */

import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600; // 1h cache

const BASE_URL = "https://app.maiat.io";

export async function GET() {
  const discovery = {
    version: 1,
    resources: [
      `${BASE_URL}/api/x402/trust`,
      `${BASE_URL}/api/x402/token-check`,
      `${BASE_URL}/api/x402/reputation`,
      `${BASE_URL}/api/x402/token-forensics`,
      `${BASE_URL}/api/x402/register-passport`,
    ],
  };

  return new NextResponse(JSON.stringify(discovery, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
