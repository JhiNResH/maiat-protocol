/**
 * POST /api/v1/oracle/sentinel-webhook
 *
 * Wadjet Sentinel → Protocol Oracle instant push.
 * When Sentinel detects a rug alert, it POSTs here.
 * Protocol immediately pushes a low trust score to the on-chain Oracle,
 * so TrustGateHook blocks swaps of that token within seconds.
 *
 * Auth: X-Cron-Api-Key (shared with Wadjet)
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { pushSingleScore } from "@/lib/oracle-updater";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Cron-Api-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface SentinelAlert {
  token_address: string;
  alert_type: string;      // "rug_detected" | "honeypot" | "lp_drain" | "whale_dump"
  severity: string;        // "critical" | "high" | "medium" | "low"
  rug_probability?: number; // 0-1 from Wadjet ML
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * Map alert severity to trust score.
 * Critical alerts → score 0 (immediate block)
 * High alerts → score 15 (likely blocked by threshold=30)
 * Medium → score 40 (passes with caution)
 */
function severityToScore(severity: string, rugProb?: number): number {
  // If we have ML rug probability, use it directly (inverted)
  if (typeof rugProb === "number") {
    return Math.max(0, Math.min(100, Math.round((1 - rugProb) * 100)));
  }

  // Fallback to severity mapping
  switch (severity) {
    case "critical": return 0;
    case "high": return 15;
    case "medium": return 40;
    case "low": return 60;
    default: return 50;
  }
}

export async function POST(request: NextRequest) {
  const cronKey = request.headers.get("x-cron-api-key");
  const expectedKey = process.env.WADJET_CRON_KEY || process.env.CRON_SECRET;

  if (!expectedKey || cronKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();

    // Support single alert or batch
    const alerts: SentinelAlert[] = Array.isArray(body.alerts)
      ? body.alerts
      : body.token_address
        ? [body as SentinelAlert]
        : [];

    if (alerts.length === 0) {
      return NextResponse.json(
        { error: "No alerts provided. Send {token_address, alert_type, severity}" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const results: Array<{
      token: string;
      alert_type: string;
      score: number;
      result: unknown;
    }> = [];

    for (const alert of alerts) {
      if (!alert.token_address || !isAddress(alert.token_address)) {
        results.push({
          token: alert.token_address,
          alert_type: alert.alert_type,
          score: 0,
          result: { error: "Invalid token address" },
        });
        continue;
      }

      const score = severityToScore(alert.severity, alert.rug_probability);

      console.log(
        `[sentinel-webhook] Alert: ${alert.alert_type} severity=${alert.severity} ` +
        `token=${alert.token_address} → pushing score=${score}`
      );

      const result = await pushSingleScore(
        alert.token_address,
        score,
        0,   // reviewCount
        0,   // avgRating
        "API",
      );

      results.push({
        token: alert.token_address,
        alert_type: alert.alert_type,
        score,
        result,
      });
    }

    const pushed = results.filter((r) => "txHash" in (r.result as Record<string, unknown>));

    return NextResponse.json(
      {
        processed: results.length,
        pushed: pushed.length,
        results,
        message: `${pushed.length} token scores pushed to oracle immediately`,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[sentinel-webhook]", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
