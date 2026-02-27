/**
 * POST /api/v1/project/queue
 *
 * Called by maiat-agent when a buyer queries an unknown project.
 * Queues it for manual or automated indexing.
 * Lightweight — never blocks the agent response.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

// Protect against DoS writes — 20 queue requests/min per IP
const rateLimiter = createRateLimiter("project:queue", 20, 60);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const { success: rlOk } = await checkIpRateLimit(req, rateLimiter);
  if (!rlOk) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429, headers: CORS });
  }

  try {
    const body = await req.json() as {
      query: string;       // raw query (project name or address)
      address?: string;    // 0x address if known
      source?: string;     // "trust_score_query" | "deep_insight" etc.
    };

    const { query, address, source } = body;
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
    }

    const normalizedQuery = query.trim().toLowerCase();
    const isAddress = /^0x[a-fA-F0-9]{40}$/i.test(normalizedQuery);

    // Check if already exists — skip silently if it does
    const existing = await prisma.project.findFirst({
      where: isAddress
        ? { address: normalizedQuery }
        : { OR: [{ slug: normalizedQuery }, { name: { contains: query.trim(), mode: "insensitive" } }] },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ ok: true, status: "exists" }, { headers: CORS });
    }

    // Log to ScarabTransaction as a lightweight audit trail
    // (reuse existing table, avoid schema migration for a simple queue)
    await prisma.scarabTransaction.create({
      data: {
        address: "0x0000000000000000000000000000000000000000",
        amount: 0,
        type: "project_queue",
        description: JSON.stringify({
          query: query.trim().substring(0, 100),
          address: address ?? null,
          source: source ?? "unknown",
          timestamp: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json(
      { ok: true, status: "queued", query: query.trim() },
      { status: 201, headers: CORS }
    );
  } catch (err) {
    // Never fail loudly — this is fire-and-forget
    console.error("[project/queue]", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: CORS });
  }
}
