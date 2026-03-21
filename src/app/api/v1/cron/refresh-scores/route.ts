/**
 * GET /api/v1/cron/refresh-scores
 * Vercel Cron Job — runs daily at 06:00 UTC
 * Protected by CRON_SECRET header
 *
 * Refreshes stale AgentScore records (updatedAt > 24h ago).
 * Fetches fresh data from Virtuals API and recomputes trust scores.
 * Preserves existing priceData and healthSignals (Wadjet data).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAgentsPage, computeTrustScore, AcpAgent } from "@/lib/acp-indexer";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min timeout for Vercel Pro

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const BATCH_SIZE = 200;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const TIMEOUT_MS = 4.5 * 60 * 1000; // 4.5 minutes — stop before Vercel kills us

// Fetch a single agent by walletAddress via pagination search
// Virtuals API doesn't have a single-agent-by-wallet endpoint,
// so we use the list endpoint and filter by walletAddress
async function fetchSingleAgent(walletAddress: string): Promise<AcpAgent | null> {
  // Try to find via direct list search — the API paginates by id,
  // so we use the v5 search endpoint with the wallet address as query
  const SEARCH_URL = "https://acpx.virtuals.io/api/agents/v5/search";
  try {
    const url = `${SEARCH_URL}?query=${encodeURIComponent(walletAddress)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    type V5SearchResult = {
      data: Array<{
        id: number;
        name: string;
        walletAddress: string;
        category?: string | null;
        description?: string | null;
        twitterHandle?: string | null;
        profilePic?: string | null;
        tokenAddress?: string | null;
        cluster?: string | null;
        metrics?: {
          successfulJobCount?: number;
          successRate?: number;
          uniqueBuyerCount?: number;
        };
        jobs?: Array<{ name: string; price: number }>;
      }> | null;
    };

    const json = (await res.json()) as V5SearchResult;
    const agents = json.data ?? [];

    // Find exact match (case-insensitive)
    const match = agents.find(
      (a) => a.walletAddress?.toLowerCase() === walletAddress.toLowerCase()
    );
    if (!match) return null;

    return {
      id: match.id,
      name: match.name,
      walletAddress: match.walletAddress,
      category: match.category,
      description: match.description,
      successfulJobCount: match.metrics?.successfulJobCount ?? null,
      successRate: match.metrics?.successRate ?? null,
      uniqueBuyerCount: match.metrics?.uniqueBuyerCount ?? null,
      profilePic: match.profilePic,
      twitterHandle: match.twitterHandle,
      cluster: match.cluster,
      offerings: match.jobs?.map((j) => ({ name: j.name, price: j.price })) ?? null,
      tokenAddress: match.tokenAddress,
    };
  } catch {
    return null;
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  // Verify cron secret (mandatory)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const startedAt = Date.now();

  try {
    // 1. Find stale records: updatedAt > 24h ago, oldest first
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

    const staleRecords = await prisma.agentScore.findMany({
      where: {
        updatedAt: { lt: staleThreshold },
      },
      orderBy: { updatedAt: "asc" },
      take: BATCH_SIZE,
      select: {
        walletAddress: true,
        rawMetrics: true,
        updatedAt: true,
      },
    });

    if (staleRecords.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "No stale records found",
          processed: 0,
          updated: 0,
          failed: 0,
          skipped: 0,
          timestamp: new Date().toISOString(),
        },
        { headers: CORS_HEADERS }
      );
    }

    console.log(`[refresh-scores] Found ${staleRecords.length} stale records to refresh`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const record of staleRecords) {
      // Graceful timeout: stop if we're approaching 4.5 minutes
      if (Date.now() - startedAt > TIMEOUT_MS) {
        console.log(
          `[refresh-scores] Approaching timeout — stopping early. Processed ${updated + failed + skipped}/${staleRecords.length}`
        );
        break;
      }

      const existingRaw = record.rawMetrics as Record<string, unknown> | null;

      try {
        // 2. Fetch fresh agent data from Virtuals API
        const freshAgent = await fetchSingleAgent(record.walletAddress);

        if (!freshAgent) {
          // Agent not found in API — still recompute from existing rawMetrics
          // so updatedAt gets bumped (preventing repeated refresh attempts)
          const syntheticAgent: AcpAgent = {
            id: (existingRaw?.agentId as number) ?? 0,
            name: (existingRaw?.name as string) ?? record.walletAddress,
            walletAddress: record.walletAddress,
            category: existingRaw?.category as string | null,
            description: existingRaw?.description as string | null,
            successfulJobCount: existingRaw?.successfulJobCount as number | null,
            successRate: existingRaw?.successRate as number | null,
            uniqueBuyerCount: existingRaw?.uniqueBuyerCount as number | null,
            profilePic: existingRaw?.profilePic as string | null,
            twitterHandle: existingRaw?.twitterHandle as string | null,
            cluster: existingRaw?.cluster as string | null,
            offerings: existingRaw?.offerings as Array<{ name: string; price: number }> | null,
            grossAgenticAmount: existingRaw?.grossAgenticAmount as number | null,
            revenue: existingRaw?.revenue as number | null,
            transactionCount: existingRaw?.transactionCount as number | null,
            rating: existingRaw?.rating as number | null,
            tokenAddress: existingRaw?.tokenAddress as string | null,
          };

          const score = computeTrustScore(syntheticAgent, existingRaw ?? undefined);
          const mergedRaw = {
            ...existingRaw,
            ...(score.rawMetrics as object),
            // Preserve Wadjet data
            priceData: existingRaw?.priceData,
            healthSignals: existingRaw?.healthSignals,
          };

          await prisma.agentScore.update({
            where: { walletAddress: record.walletAddress },
            data: {
              trustScore: score.trustScore,
              completionRate: score.completionRate,
              paymentRate: score.paymentRate,
              expireRate: score.expireRate,
              totalJobs: score.totalJobs,
              rawMetrics: mergedRaw,
            },
          });

          skipped++;
          continue;
        }

        // 3. Recompute trust score with fresh data + preserved Wadjet signals
        const score = computeTrustScore(freshAgent, existingRaw ?? undefined);

        // 4. Merge: fresh ACP data overwrites, but preserve Wadjet fields
        const mergedRaw = {
          ...existingRaw,           // keep Wadjet priceData, healthSignals, etc.
          ...(score.rawMetrics as object), // overwrite with fresh ACP data
          // Explicitly re-apply Wadjet fields that computeTrustScore doesn't produce
          priceData: existingRaw?.priceData,
          healthSignals: existingRaw?.healthSignals,
        };

        const tokenAddr = (score.rawMetrics as Record<string, unknown>)?.tokenAddress as string | null | undefined;

        // 5. Upsert back to DB
        await prisma.agentScore.upsert({
          where: { walletAddress: record.walletAddress },
          update: {
            trustScore: score.trustScore,
            completionRate: score.completionRate,
            paymentRate: score.paymentRate,
            expireRate: score.expireRate,
            totalJobs: score.totalJobs,
            dataSource: "ACP_BEHAVIORAL",
            rawMetrics: mergedRaw,
            ...(tokenAddr ? { tokenAddress: tokenAddr } : {}),
          },
          create: {
            walletAddress: record.walletAddress,
            trustScore: score.trustScore,
            completionRate: score.completionRate,
            paymentRate: score.paymentRate,
            expireRate: score.expireRate,
            totalJobs: score.totalJobs,
            dataSource: "ACP_BEHAVIORAL",
            rawMetrics: mergedRaw,
            ...(tokenAddr ? { tokenAddress: tokenAddr } : {}),
          },
        });

        updated++;
      } catch (e) {
        console.error(`[refresh-scores] Failed ${record.walletAddress}:`, e);
        failed++;
      }

      // Small delay to avoid hammering the API
      await new Promise((r) => setTimeout(r, 100));
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[refresh-scores] Done — updated: ${updated}, skipped: ${skipped}, failed: ${failed}, elapsed: ${elapsedMs}ms`
    );

    return NextResponse.json(
      {
        success: true,
        staleFound: staleRecords.length,
        processed: updated + skipped + failed,
        updated,
        skipped,
        failed,
        elapsedMs,
        timestamp: new Date().toISOString(),
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[cron/refresh-scores]", err);
    return NextResponse.json(
      { error: "Score refresh failed", details: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
