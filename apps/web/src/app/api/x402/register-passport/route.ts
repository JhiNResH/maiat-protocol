/**
 * POST /api/x402/register-passport
 *
 * x402 Payment-Protected Passport Registration
 * Price: $1.00 per registration
 *
 * Registers an agent or human on the Maiat passport system.
 * Creates ENS subname, ERC-8004 identity (agents), KYA code, and Scarab balance.
 * Payment via x402 replaces rate limiting — each registration costs $1 USDC.
 *
 * Body: { ensName: string, walletAddress?: string, type?: "agent" | "human", referredBy?: string }
 * - walletAddress optional: if omitted, Privy creates a server wallet
 * - type defaults to "agent"
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserReputation } from "@/lib/reputation";
import { getAgentId } from "@/lib/erc8004";
import { generateKyaCode } from "@/lib/kya";
import { setEnsSubname } from "@/lib/namestone";
import { buildEnsip25Key } from "@/lib/ensip25";
import { PrivyClient } from "@privy-io/node";
import { logQuery } from "@/lib/query-logger";
// CORS headers — payment gate is handled by middleware.ts
const X402_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Payment, X-Payment-Response, Payment-Signature, Payment-Required",
  "x-powered-by": "maiat-x402",
  "x-payment-protocol": "x402",
} as const;

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidEnsName(name: string): boolean {
  return /^[a-z0-9-]{3,}$/.test(name);
}

function getVerdict(score: number): string {
  if (score >= 80) return "Trusted";
  if (score >= 60) return "Proceed";
  if (score >= 40) return "Caution";
  return "Avoid";
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: X402_CORS_HEADERS });
}

// Core handler
async function registerPassportHandler(
  request: NextRequest
): Promise<NextResponse<unknown>> {
  try {
    const body = await request.json();
    const { ensName, walletAddress, type, referredBy } = body;

    // Validate ENS name
    if (!ensName || !isValidEnsName(ensName.replace(/\.maiat\.eth$/, ""))) {
      return NextResponse.json(
        {
          error:
            "Invalid ENS name. Must be 3+ characters, lowercase letters, numbers, or hyphens.",
        },
        { status: 400, headers: X402_CORS_HEADERS }
      );
    }

    const cleanEnsName = ensName.replace(/\.maiat\.eth$/, "");

    // Resolve wallet — create Privy server wallet if not provided
    let resolvedWallet = walletAddress;
    let privyWalletCreated = false;
    let privyWalletId: string | undefined;

    if (!resolvedWallet) {
      try {
        const privy = new PrivyClient({
          appId: process.env.PRIVY_APP_ID!,
          appSecret: process.env.PRIVY_APP_SECRET!,
        });
        const wallet = await privy.wallets().create({
          chain_type: "ethereum",
        } as any);
        resolvedWallet = wallet.address;
        privyWalletId = wallet.id;
        privyWalletCreated = true;
      } catch (e: any) {
        return NextResponse.json(
          {
            error: "Failed to create wallet. Please provide a walletAddress.",
            detail: e.message,
          },
          { status: 500, headers: X402_CORS_HEADERS }
        );
      }
    } else if (!isValidAddress(resolvedWallet)) {
      return NextResponse.json(
        { error: "Invalid wallet address." },
        { status: 400, headers: X402_CORS_HEADERS }
      );
    }

    const normalizedAddress = resolvedWallet.toLowerCase();
    const fullEnsName = `${cleanEnsName}.maiat.eth`;
    const userType = type === "human" ? "human" : "agent";

    // Check if already registered
    const existingUser = await prisma.user.findUnique({
      where: { address: normalizedAddress },
    });

    if (existingUser) {
      const reputation = await getUserReputation(normalizedAddress);
      const scarab = await prisma.scarabBalance.findUnique({
        where: { address: normalizedAddress },
      });

      let kyaCode: string | null = null;
      try {
        const kya = await prisma.kyaCode.findFirst({
          where: { agentAddress: normalizedAddress },
        });
        if (kya) kyaCode = kya.code;
      } catch {}

      return NextResponse.json(
        {
          passport: {
            ensName: existingUser.displayName || cleanEnsName,
            ensFullName: fullEnsName,
            walletAddress: normalizedAddress,
            type: existingUser.type ?? "human",
            trustScore: reputation.reputationScore,
            verdict: getVerdict(reputation.reputationScore),
            scarabBalance: scarab?.balance ?? 0,
            isNew: false,
            kyaCode,
          },
          message: "Already registered. No new charge applied — x402 payment was processed but passport already exists.",
        },
        { status: 200, headers: X402_CORS_HEADERS }
      );
    }

    // Check if ENS name taken
    const existingName = await prisma.user.findFirst({
      where: { displayName: { equals: cleanEnsName, mode: "insensitive" } },
    });

    if (existingName) {
      return NextResponse.json(
        { error: "This name is already taken." },
        { status: 409, headers: X402_CORS_HEADERS }
      );
    }

    // Create user
    await prisma.user.create({
      data: {
        address: normalizedAddress,
        displayName: cleanEnsName,
        type: userType,
        ...(privyWalletId ? { privyWalletId } : {}),
      },
    });

    // Create Scarab balance with 10 bonus
    const scarab = await prisma.scarabBalance.upsert({
      where: { address: normalizedAddress },
      update: { balance: { increment: 10 }, totalEarned: { increment: 10 } },
      create: { address: normalizedAddress, balance: 10, totalEarned: 10 },
    });

    await prisma.scarabTransaction.create({
      data: {
        address: normalizedAddress,
        amount: 10,
        type: "registration_bonus",
        description: `Registration bonus for ${fullEnsName}`,
        balanceAfter: scarab.balance,
      },
    });

    // Referral bonus
    let referralApplied = false;
    if (referredBy && typeof referredBy === "string") {
      try {
        const cleanRef = referredBy.trim().toLowerCase().replace(/\.maiat\.eth$/, "");
        const referrer = await prisma.user.findFirst({
          where: { displayName: { equals: cleanRef, mode: "insensitive" } },
        });
        if (referrer && referrer.address !== normalizedAddress) {
          const referrerBalance = await prisma.scarabBalance.upsert({
            where: { address: referrer.address },
            update: { balance: { increment: 5 }, totalEarned: { increment: 5 } },
            create: { address: referrer.address, balance: 5, totalEarned: 5 },
          });
          await prisma.scarabTransaction.create({
            data: {
              address: referrer.address,
              amount: 5,
              type: "referral_bonus",
              description: `Referral bonus: ${cleanEnsName} signed up via your link`,
              balanceAfter: referrerBalance.balance,
            },
          });
          await prisma.scarabBalance.update({
            where: { address: normalizedAddress },
            data: { balance: { increment: 5 }, totalEarned: { increment: 5 } },
          });
          await prisma.scarabTransaction.create({
            data: {
              address: normalizedAddress,
              amount: 5,
              type: "referral_bonus",
              description: `Referral bonus: signed up via ${cleanRef}'s link`,
              balanceAfter: scarab.balance + 5,
            },
          });
          referralApplied = true;
        }
      } catch {}
    }

    const reputation = await getUserReputation(normalizedAddress);

    // ERC-8004 (agent only, async via cron)
    let erc8004AgentId: number | null = null;
    let erc8004Status: "registered" | "pending" | "skipped" = "skipped";
    let kyaCode: string | null = null;

    if (userType === "agent") {
      if (privyWalletId) {
        erc8004Status = "pending";
      }

      // Generate KYA code
      try {
        for (let attempt = 0; attempt < 10; attempt++) {
          const candidate = generateKyaCode();
          const collision = await prisma.kyaCode.findUnique({
            where: { code: candidate },
          });
          if (!collision) {
            kyaCode = candidate;
            break;
          }
        }
        if (kyaCode) {
          await prisma.kyaCode.create({
            data: {
              code: kyaCode,
              agentAddress: normalizedAddress,
              agentName: cleanEnsName,
            },
          });
        }
      } catch {}

      try {
        erc8004AgentId = await getAgentId(normalizedAddress);
      } catch {}
    }

    // ENS subname via NameStone
    let ensRegistered = false;
    try {
      const ensip25Record: Record<string, string> = {};
      if (userType === "agent" && erc8004AgentId) {
        ensip25Record[buildEnsip25Key(erc8004AgentId)] = "1";
      }
      const ensResult = await setEnsSubname(cleanEnsName, normalizedAddress, {
        description: `Maiat Passport — ${userType}`,
        url: `https://app.maiat.io/passport/${normalizedAddress}`,
        ...ensip25Record,
      });
      ensRegistered = ensResult.success;
    } catch {}

    // Log query
    try {
      await logQuery({
        type: "passport_register_x402",
        target: normalizedAddress,
        trustScore: reputation.reputationScore,
        verdict: getVerdict(reputation.reputationScore),
        metadata: {
          ensName: cleanEnsName,
          userType,
          referralApplied,
          privyWalletCreated,
          erc8004Status,
          ensRegistered,
          paymentProtocol: "x402",
        },
      });
    } catch {}

    const kyaShareUrl = kyaCode
      ? `https://passport.maiat.io/verify/${kyaCode}`
      : null;

    return NextResponse.json(
      {
        passport: {
          ensName: cleanEnsName,
          ensFullName: fullEnsName,
          walletAddress: normalizedAddress,
          type: userType,
          trustScore: reputation.reputationScore,
          verdict: getVerdict(reputation.reputationScore),
          scarabBalance: referralApplied ? 15 : 10,
          isNew: true,
          referralApplied,
          privyWalletCreated,
          erc8004AgentId,
          erc8004Status,
          kyaCode,
          ensRegistered,
        },
        ...(userType === "agent" && kyaCode
          ? {
              kya: {
                code: kyaCode,
                shareUrl: kyaShareUrl,
                tweetTemplate: `I trust ${cleanEnsName}.maiat.eth 🛡️ #MaiatVerified ${kyaCode}\n${kyaShareUrl}`,
                instruction:
                  "Ask your users to visit the shareUrl and tweet the template to endorse you.",
              },
            }
          : {}),
      },
      { status: 201, headers: X402_CORS_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[x402/register-passport] Error:", msg);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500, headers: X402_CORS_HEADERS }
    );
  }
}

import { withPaymentGate } from "@/lib/x402-gate";

// Wrap with manual x402 payment gate
// Payment gate handled by middleware.ts — export handler directly
export const POST = withPaymentGate(registerPassportHandler, "$1.00", "Register a Maiat Passport with ENS, ERC-8004, and KYA", "passport_register", {
  output: {
    example: { success: true, passportId: "maiat-agent-001.maiat.eth", attestationTx: "0x..." },
    schema: { properties: { success: { type: "boolean" }, passportId: { type: "string" } }, required: ["success"] },
  },
}, "/api/x402/register-passport");
