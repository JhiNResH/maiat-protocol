/**
 * Weekly Wadjet Retrain Trigger
 * Calls Wadjet's /cron/run-daily endpoint to trigger model retraining
 * with accumulated outcome + review feedback data.
 *
 * Schedule: Weekly (triggered by Vercel cron or OpenClaw cron)
 */

import { NextRequest, NextResponse } from "next/server";
import { triggerDailyCron } from "@/lib/wadjet-client";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await triggerDailyCron();

    return NextResponse.json({
      triggered: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (err) {
    console.error("[wadjet-retrain]", err);
    return NextResponse.json(
      { error: "Failed to trigger Wadjet retrain", details: String(err) },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron
export async function GET(request: NextRequest) {
  return POST(request);
}
