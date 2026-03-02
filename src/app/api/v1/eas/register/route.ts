import { NextRequest, NextResponse } from "next/server";
import { registerMaiatSchemas } from "@/lib/eas";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/v1/eas/register
 * One-time schema registration. Requires MAIAT_ADMIN_PRIVATE_KEY.
 * Returns the 3 schema UIDs to store in env vars.
 */
export async function POST(request: NextRequest) {
  // Simple auth: require admin key header
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.EAS_REGISTER_SECRET || process.env.MAIAT_ADMIN_PRIVATE_KEY;

  if (!adminKey) {
    return NextResponse.json(
      { error: "Server not configured for schema registration" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // Bearer token check (use a separate secret, not the private key itself)
  if (process.env.EAS_REGISTER_SECRET && authHeader !== `Bearer ${process.env.EAS_REGISTER_SECRET}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    const result = await registerMaiatSchemas();

    return NextResponse.json({
      success: true,
      schemas: {
        EAS_TRUST_SCORE_SCHEMA_UID: result.trustScoreUID,
        EAS_REVIEW_SCHEMA_UID: result.reviewUID,
        EAS_ACP_SCHEMA_UID: result.acpInteractionUID,
      },
      instruction: "Add these UIDs to your .env file",
    }, { status: 201, headers: CORS_HEADERS });
  } catch (error: any) {
    console.error("[EAS Register] Failed:", error);
    return NextResponse.json(
      { error: "Schema registration failed", detail: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
