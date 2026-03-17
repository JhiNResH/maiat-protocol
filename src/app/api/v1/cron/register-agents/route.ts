/**
 * POST /api/v1/cron/register-agents
 * Batch-registers agents on ERC-8004 that don't have an agentId yet.
 * Called by Vercel cron or manually.
 *
 * Guards against duplicate registration:
 * 1. Marks agents as -2 (processing) before attempting register
 * 2. Checks on-chain first — if already registered, just updates DB
 * 3. Only calls register() if no on-chain registration found
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerAgent, lookupAgentId } from "@/lib/erc8004";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find agents needing registration (null = never tried, -1 = failed/pending)
    // Exclude -2 (currently being processed by another cron run)
    const unregistered = await prisma.user.findMany({
      where: {
        type: "agent",
        OR: [
          { erc8004AgentId: null },
          { erc8004AgentId: -1 },
        ],
        privyWalletId: { not: null },
      },
      take: 3, // smaller batch — each needs polling time
      orderBy: { createdAt: "asc" },
    });

    if (unregistered.length === 0) {
      return NextResponse.json({ message: "No agents to register", count: 0 });
    }

    // Mark all as -2 (processing) to prevent duplicate cron runs
    await prisma.user.updateMany({
      where: {
        address: { in: unregistered.map(u => u.address) },
      },
      data: { erc8004AgentId: -2 },
    });

    const results: Array<{ address: string; displayName: string; agentId: number | null; error?: string }> = [];

    for (const user of unregistered) {
      try {
        // Step 1: Check if already registered on-chain (prevents duplicate mints)
        const existingId = await lookupAgentId(user.address);
        if (existingId !== null) {
          const numId = Number(existingId);
          await prisma.user.update({
            where: { address: user.address },
            data: { erc8004AgentId: numId },
          });
          console.log(`[cron/register] ${user.displayName} already on-chain: agentId ${numId}`);
          results.push({ address: user.address, displayName: user.displayName ?? '', agentId: numId });
          continue;
        }

        // Step 2: Register on-chain via Privy sponsored tx
        const agentId = await registerAgent(user.address, user.privyWalletId ?? undefined);
        const numId = agentId !== null ? Number(agentId) : null;

        if (numId !== null && numId >= 0) {
          await prisma.user.update({
            where: { address: user.address },
            data: { erc8004AgentId: numId },
          });
          console.log(`[cron/register] ${user.displayName} registered: agentId ${numId}`);
        } else {
          // Failed — set back to -1 for next retry
          await prisma.user.update({
            where: { address: user.address },
            data: { erc8004AgentId: -1 },
          });
          console.warn(`[cron/register] ${user.displayName} failed, will retry`);
        }

        results.push({ address: user.address, displayName: user.displayName ?? '', agentId: numId });
      } catch (e: any) {
        // Error — set back to -1 for retry
        await prisma.user.update({
          where: { address: user.address },
          data: { erc8004AgentId: -1 },
        }).catch(() => {});
        results.push({ address: user.address, displayName: user.displayName ?? '', agentId: null, error: e.shortMessage || e.message });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} agents`,
      results,
    });
  } catch (err: any) {
    console.error("[cron/register-agents]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Also support GET for Vercel cron
export async function GET(request: NextRequest) {
  return POST(request);
}
