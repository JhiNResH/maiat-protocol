/**
 * GET /api/v1/passport/lookup?q=<ensName|wallet|clientId>
 *
 * Universal passport lookup — find by any identifier.
 * Public endpoint, no auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json(
      { error: "Provide ?q=<ensName|wallet|clientId>" },
      { status: 400 }
    );
  }

  // Build OR conditions based on input format
  const conditions: any[] = [];

  // Check if it's a wallet address
  if (q.startsWith("0x") && isAddress(q)) {
    const checksummed = getAddress(q);
    conditions.push({ walletAddress: checksummed });
    conditions.push({ ownerAddress: checksummed });
  }

  // Check if it's an ENS name (strip .maiat.eth if present)
  const ensName = q.toLowerCase().replace(/\.maiat\.eth$/, "");
  if (ensName.length >= 3) {
    conditions.push({ ensName });
  }

  // Try as clientId
  conditions.push({ clientId: q });

  // Try as ACP agent ID
  if (/^\d+$/.test(q)) {
    conditions.push({ acpAgentId: q });
  }

  if (conditions.length === 0) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const passport = await prisma.passport.findFirst({
    where: { OR: conditions },
  });

  if (!passport) {
    return NextResponse.json(
      {
        error: "Passport not found",
        available: true,
        suggestion: `Register at POST /api/v1/passport/register`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    passport: {
      ensName: passport.ensName,
      ensFullName: passport.ensName ? `${passport.ensName}.maiat.eth` : null,
      walletAddress: passport.walletAddress,
      name: passport.name,
      description: passport.description,
      type: passport.type,
      status: passport.status,
      trustScore: passport.trustScore,
      verdict: scoreToVerdict(passport.trustScore),
      scarabBalance: passport.scarabBalance,
      totalQueries: passport.totalQueries,
      totalOutcomes: passport.totalOutcomes,
      streakDays: passport.streakDays,
      erc8004Id: passport.erc8004Id,
      acpAgentId: passport.acpAgentId,
      passportUrl: `https://app.maiat.io/passport/${passport.ensName || passport.id}`,
      createdAt: passport.createdAt,
    },
  });
}

function scoreToVerdict(score: number): string {
  if (score >= 80) return "trusted";
  if (score >= 60) return "proceed";
  if (score >= 40) return "caution";
  return "avoid";
}
