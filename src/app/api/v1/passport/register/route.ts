/**
 * POST /api/v1/passport/register
 *
 * Register a new Maiat Passport. Idempotent — returns existing if found.
 * Creates ENS subdomain under maiat.eth via NameStone.
 *
 * Headers:
 *   X-Maiat-Client (required) — SDK client identifier
 *
 * Body:
 *   name?: string          — display name
 *   description?: string   — agent description
 *   walletAddress?: string — agent wallet
 *   ensName?: string       — desired ENS subdomain (optional)
 *   type?: "agent" | "human"
 *   referralCode?: string  — referrer's code
 *
 * Response:
 *   { passport, created }
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";
import {
  sanitizeEnsName,
  generateEnsName,
  setSubdomain,
  isNameAvailable,
  buildPassportTextRecords,
} from "@/lib/namestone";

export async function POST(req: NextRequest) {
  try {
    const clientId = req.headers.get("x-maiat-client");
    if (!clientId) {
      return NextResponse.json(
        { error: "X-Maiat-Client header required" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      name,
      description,
      walletAddress,
      ensName: requestedEnsName,
      type = "agent",
      referralCode,
    } = body;

    // Validate wallet if provided
    const wallet = walletAddress && isAddress(walletAddress)
      ? getAddress(walletAddress)
      : undefined;

    // Check for existing passport by clientId or wallet
    const existing = await prisma.passport.findFirst({
      where: {
        OR: [
          { clientId },
          ...(wallet ? [{ walletAddress: wallet }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json({
        passport: formatPassport(existing),
        created: false,
      });
    }

    // Determine ENS name
    let ensName: string | null = null;

    if (requestedEnsName) {
      ensName = sanitizeEnsName(requestedEnsName);
      if (!ensName) {
        return NextResponse.json(
          { error: "Invalid ENS name. Use 3+ chars: a-z, 0-9, hyphen." },
          { status: 400 }
        );
      }
    }

    if (!ensName) {
      ensName = generateEnsName(name, wallet);
    }

    // Check availability, append suffix if taken
    let finalEnsName = ensName;
    let available = await isNameAvailable(finalEnsName);
    if (!available) {
      // Try with random suffix
      for (let i = 0; i < 5; i++) {
        const suffix = Math.random().toString(36).slice(2, 6);
        finalEnsName = `${ensName}-${suffix}`;
        available = await isNameAvailable(finalEnsName);
        if (available) break;
      }
      if (!available) {
        // Last resort: use wallet or timestamp
        finalEnsName = wallet
          ? `0x${wallet.slice(2, 10).toLowerCase()}`
          : `agent-${Date.now().toString(36)}`;
      }
    }

    // Handle referral
    let referredBy: string | undefined;
    if (referralCode) {
      const referrer = await prisma.passport.findUnique({
        where: { referralCode },
      });
      if (referrer) {
        referredBy = referrer.id;
        // Award referrer 25 scarab
        await prisma.passport.update({
          where: { id: referrer.id },
          data: { scarabBalance: { increment: 25 } },
        });
      }
    }

    // Create passport
    const passport = await prisma.passport.create({
      data: {
        clientId,
        walletAddress: wallet,
        ensName: finalEnsName,
        name: name || null,
        description: description || null,
        type,
        status: "active",
        scarabBalance: 10, // welcome gift
        referredBy,
      },
    });

    // Create ENS subdomain (non-blocking — don't fail registration if ENS fails)
    const address = wallet || "0x0000000000000000000000000000000000000000";
    const textRecords = buildPassportTextRecords(passport);

    setSubdomain({
      name: finalEnsName,
      address,
      textRecords,
    }).catch((err) => {
      console.error(`[passport/register] ENS subdomain creation failed:`, err);
    });

    return NextResponse.json(
      {
        passport: formatPassport(passport),
        created: true,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[passport/register] Error:", err.message);
    return NextResponse.json(
      { error: err.message || "Registration failed" },
      { status: 500 }
    );
  }
}

/** GET /api/v1/passport/register?clientId=X or ?wallet=0x... or ?ensName=X */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") || req.headers.get("x-maiat-client");
  const wallet = searchParams.get("wallet");
  const ensName = searchParams.get("ensName");

  if (!clientId && !wallet && !ensName) {
    return NextResponse.json(
      { error: "Provide clientId, wallet, or ensName" },
      { status: 400 }
    );
  }

  const where: any = { OR: [] };
  if (clientId) where.OR.push({ clientId });
  if (wallet) where.OR.push({ walletAddress: getAddress(wallet) });
  if (ensName) where.OR.push({ ensName: sanitizeEnsName(ensName) || ensName });

  const passport = await prisma.passport.findFirst({ where });

  if (!passport) {
    return NextResponse.json({ error: "Passport not found" }, { status: 404 });
  }

  return NextResponse.json({ passport: formatPassport(passport) });
}

function formatPassport(p: any) {
  return {
    id: p.id,
    ensName: p.ensName,
    ensFullName: p.ensName ? `${p.ensName}.maiat.eth` : null,
    clientId: p.clientId,
    walletAddress: p.walletAddress,
    ownerAddress: p.ownerAddress,
    acpAgentId: p.acpAgentId,
    erc8004Id: p.erc8004Id,
    name: p.name,
    description: p.description,
    type: p.type,
    status: p.status,
    trustScore: p.trustScore,
    verdict: scoreToVerdict(p.trustScore),
    scarabBalance: p.scarabBalance,
    totalQueries: p.totalQueries,
    totalOutcomes: p.totalOutcomes,
    streakDays: p.streakDays,
    referralCode: p.referralCode,
    passportUrl: `https://app.maiat.io/passport/${p.ensName || p.id}`,
    claimUrl: `https://app.maiat.io/claim/${p.referralCode}`,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function scoreToVerdict(score: number): string {
  if (score >= 80) return "trusted";
  if (score >= 60) return "proceed";
  if (score >= 40) return "caution";
  return "avoid";
}
