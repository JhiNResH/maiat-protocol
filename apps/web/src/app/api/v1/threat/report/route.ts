/**
 * POST /api/v1/threat/report
 *
 * Receives threat reports from maiat-guard when it intercepts malicious activity.
 * Called by Guard v0.2.0+ reportThreat() whenever it blocks an address_poisoning,
 * vanity_match, dust_liveness, or low_trust threat.
 *
 * Flow:
 * 1. Validate + rate-limit (30 req/min per IP)
 * 2. Store ThreatReport in DB (IP hashed with SHA-256)
 * 3. Fire-and-forget → Wadjet /feedback/threat (best-effort)
 * 4. Auto-flag AgentScore if same address gets 3+ reports
 * 5. Return { received: true, reportId }
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { isAddress } from "viem";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const rateLimiter = createRateLimiter("threat:report", 30, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Key",
};

const VALID_THREAT_TYPES = [
  "address_poisoning",
  "low_trust",
  "vanity_match",
  "dust_liveness",
] as const;

type ThreatType = (typeof VALID_THREAT_TYPES)[number];

interface ThreatReportBody {
  maliciousAddress?: string;
  threatType?: string;
  evidence?: Record<string, unknown>;
  guardVersion?: string;
  chainId?: number;
  timestamp?: number;
}

const AUTO_FLAG_THRESHOLD = 3;
const WADJET_URL = process.env.WADJET_URL ?? "https://wadjet-production.up.railway.app";

/** SHA-256 hash an IP for privacy-safe dedup */
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/** Fire-and-forget push to Wadjet /feedback/threat */
async function pushThreatToWadjet(
  address: string,
  threatType: ThreatType,
  evidence: Record<string, unknown>
): Promise<void> {
  try {
    const res = await fetch(`${WADJET_URL}/feedback/threat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, threatType, evidence }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      console.warn(
        `[threat/report] Wadjet /feedback/threat returned ${res.status} — will retry in future batch`
      );
    }
  } catch (err) {
    // Wadjet endpoint may not exist yet — log only, do not fail
    console.warn("[threat/report] Wadjet push skipped:", (err as Error).message);
  }
}

/**
 * If the same maliciousAddress accumulates AUTO_FLAG_THRESHOLD or more reports,
 * set its AgentScore trustScore to 0 and mark dataSource as THREAT_FLAGGED.
 */
async function maybeAutoFlag(maliciousAddress: string): Promise<boolean> {
  const count = await prisma.threatReport.count({
    where: { maliciousAddress: maliciousAddress.toLowerCase() },
  });

  if (count >= AUTO_FLAG_THRESHOLD) {
    await prisma.agentScore.upsert({
      where: { walletAddress: maliciousAddress.toLowerCase() },
      update: {
        trustScore: 0,
        dataSource: "THREAT_FLAGGED",
        lastUpdated: new Date(),
      },
      create: {
        walletAddress: maliciousAddress.toLowerCase(),
        trustScore: 0,
        completionRate: 0,
        paymentRate: 0,
        expireRate: 0,
        totalJobs: 0,
        dataSource: "THREAT_FLAGGED",
        rawMetrics: {},
      },
    });
    console.log(
      `[threat/report] Auto-flagged ${maliciousAddress} after ${count} reports`
    );
    return true;
  }

  return false;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const { success: rlOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rlOk) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    const body = (await request.json()) as ThreatReportBody;
    const { maliciousAddress, threatType, evidence, guardVersion, chainId, timestamp } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!maliciousAddress || !isAddress(maliciousAddress)) {
      return NextResponse.json(
        { error: "maliciousAddress must be a valid EVM address" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!threatType || !(VALID_THREAT_TYPES as readonly string[]).includes(threatType)) {
      return NextResponse.json(
        { error: `threatType must be one of: ${VALID_THREAT_TYPES.join(", ")}` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
      return NextResponse.json(
        { error: "evidence must be an object" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ── Privacy: hash IP, never store raw ──────────────────────────────────
    const rawIp = (
      request.headers.get("x-forwarded-for")?.split(",")[0] ??
      request.headers.get("x-real-ip") ??
      "unknown"
    ).trim();
    const hashedIp = hashIp(rawIp);

    const reportTimestamp = timestamp ? new Date(timestamp * 1000) : new Date();
    const normalizedAddress = maliciousAddress.toLowerCase();

    // ── Store in DB ─────────────────────────────────────────────────────────
    const report = await prisma.threatReport.create({
      data: {
        maliciousAddress: normalizedAddress,
        threatType,
        evidence,
        guardVersion: guardVersion ?? null,
        chainId: chainId ?? null,
        reporterIp: hashedIp,
        timestamp: reportTimestamp,
      },
    });

    // ── Fire-and-forget: Wadjet feedback ───────────────────────────────────
    pushThreatToWadjet(normalizedAddress, threatType as ThreatType, evidence).catch(() => {});

    // ── Auto-flag if threshold exceeded ────────────────────────────────────
    const wasFlagged = await maybeAutoFlag(normalizedAddress);

    console.log(
      `[threat/report] Stored report ${report.id} for ${normalizedAddress} type=${threatType}${
        wasFlagged ? " → AUTO_FLAGGED" : ""
      }`
    );

    return NextResponse.json(
      {
        received: true,
        reportId: report.id,
        ...(wasFlagged && { autoFlagged: true }),
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[threat/report]", err);
    return NextResponse.json(
      { error: "Failed to store threat report" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
