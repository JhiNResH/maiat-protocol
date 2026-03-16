/**
 * POST /api/v1/cron/register-agents
 * Batch-registers agents on ERC-8004 that don't have an agentId yet.
 * Called by Vercel cron or manually.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerAgent } from "@/lib/erc8004";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find agents without on-chain registration
    const unregistered = await prisma.user.findMany({
      where: {
        type: "agent",
        erc8004AgentId: null,
      },
      take: 5, // batch of 5 to stay within timeout
      orderBy: { createdAt: "asc" },
    });

    if (unregistered.length === 0) {
      return NextResponse.json({ message: "No agents to register", count: 0 });
    }

    const results: Array<{ address: string; agentId: number | null; error?: string }> = [];

    for (const user of unregistered) {
      try {
        const agentId = await registerAgent(user.address);
        const numId = agentId !== null ? Number(agentId) : null;

        if (numId !== null && numId >= 0) {
          await prisma.user.update({
            where: { address: user.address },
            data: { erc8004AgentId: numId },
          });
        }

        results.push({ address: user.address, agentId: numId });
      } catch (e: any) {
        results.push({ address: user.address, agentId: null, error: e.shortMessage || e.message });
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
