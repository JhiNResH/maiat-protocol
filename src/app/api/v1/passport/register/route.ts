import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserReputation } from "@/lib/reputation";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";
import { registerAgent, getAgentId } from "@/lib/erc8004";
import { generateKyaCode } from "@/lib/kya";
import { setEnsSubname } from "@/lib/namestone";

const rateLimiter = createRateLimiter("passport:register", 10, 60);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Maiat-Client",
};

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidEnsName(name: string): boolean {
  return /^[a-z0-9-]{3,}$/.test(name);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  // Rate limit
  const { success: rateLimitOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Too many requests. Retry after 1 minute." },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const { ensName, walletAddress, type, referredBy } = body;

    // Validate
    if (!ensName || !isValidEnsName(ensName.replace(/\.maiat\.eth$/, ""))) {
      return NextResponse.json(
        { error: "Invalid ENS name. Must be 3+ characters, lowercase letters, numbers, or hyphens." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!walletAddress || !isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const cleanEnsName = ensName.replace(/\.maiat\.eth$/, "");
    const fullEnsName = `${cleanEnsName}.maiat.eth`;

    // Check if address already registered
    const existingUser = await prisma.user.findUnique({
      where: { address: normalizedAddress },
    });

    if (existingUser) {
      // Already registered - update displayName if empty
      if (!existingUser.displayName && cleanEnsName) {
        const nameTaken = await prisma.user.findFirst({
          where: { displayName: { equals: cleanEnsName, mode: "insensitive" } },
        });
        if (!nameTaken) {
          await prisma.user.update({
            where: { address: normalizedAddress },
            data: { displayName: cleanEnsName },
          });
        }
      }

      const reputation = await getUserReputation(normalizedAddress);
      const scarab = await prisma.scarabBalance.findUnique({
        where: { address: normalizedAddress },
      });

      // Fetch ERC-8004 data (non-blocking)
      let erc8004AgentId: number | null = null;
      let kyaCode: string | null = null;
      try {
        erc8004AgentId = await getAgentId(normalizedAddress);
      } catch (e: any) {
        console.warn("[passport/register] ERC-8004 lookup failed (existing user):", e.message);
      }

      // Look up existing KYA code from DB
      try {
        const existingKya = await prisma.kyaCode.findFirst({
          where: { agentAddress: normalizedAddress },
        });
        if (existingKya) kyaCode = existingKya.code;
      } catch (e: any) {
        console.warn("[passport/register] KYA lookup failed (existing user):", e.message);
      }

      const existingKyaShareUrl = kyaCode ? `https://passport.maiat.io/verify/${kyaCode}` : null;

      return NextResponse.json({
        passport: {
          ensName: cleanEnsName,
          ensFullName: fullEnsName,
          walletAddress: normalizedAddress,
          type: existingUser.type ?? 'human',
          trustScore: reputation.reputationScore,
          verdict: getVerdict(reputation.reputationScore),
          totalQueries: reputation.totalReviews,
          scarabBalance: scarab?.balance ?? 0,
          isNew: false,
          erc8004AgentId,
          kyaCode,
        },
        ...(kyaCode ? {
          kya: {
            code: kyaCode,
            shareUrl: existingKyaShareUrl,
            tweetTemplate: `I trust ${cleanEnsName}.maiat.eth 🛡️ #MaiatVerified ${kyaCode}\n${existingKyaShareUrl}`,
            instruction: "Ask your users to visit the shareUrl and tweet the template to endorse you. Each endorsement gives +5 trust and rewards the endorser with 5 Scarab.",
          },
        } : {}),
      }, { status: 200, headers: CORS_HEADERS });
    }

    // Check if displayName (ENS) already taken
    const existingName = await prisma.user.findFirst({
      where: { displayName: { equals: cleanEnsName, mode: "insensitive" } },
    });

    if (existingName) {
      return NextResponse.json(
        { error: "This name is already taken." },
        { status: 409, headers: CORS_HEADERS }
      );
    }

    // Create user
    const userType = (type === 'agent') ? 'agent' : 'human';
    const user = await prisma.user.create({
      data: {
        address: normalizedAddress,
        displayName: cleanEnsName,
        type: userType,
      },
    });

    // Create Scarab balance with 10 bonus
    const scarab = await prisma.scarabBalance.upsert({
      where: { address: normalizedAddress },
      update: { balance: { increment: 10 }, totalEarned: { increment: 10 } },
      create: {
        address: normalizedAddress,
        balance: 10,
        totalEarned: 10,
      },
    });

    // Log the registration bonus
    await prisma.scarabTransaction.create({
      data: {
        address: normalizedAddress,
        amount: 10,
        type: "registration_bonus",
        description: `Registration bonus for ${fullEnsName}`,
        balanceAfter: scarab.balance,
      },
    });

    // --- Referral bonus (non-blocking) ---
    let referralApplied = false;
    if (referredBy && typeof referredBy === 'string') {
      try {
        const cleanRef = referredBy.trim().toLowerCase().replace(/\.maiat\.eth$/, "");
        const referrer = await prisma.user.findFirst({
          where: { displayName: { equals: cleanRef, mode: "insensitive" } },
        });
        if (referrer && referrer.address !== normalizedAddress) {
          // +5 🪲 to referrer
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
          // +5 🪲 to new user
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
      } catch (e: any) {
        console.warn("[passport/register] Referral bonus failed (non-blocking):", e.message);
      }
    }

    const reputation = await getUserReputation(normalizedAddress);

    // --- ENS Subname via NameStone (non-blocking) ---
    let ensRegistered = false;
    try {
      const ensResult = await setEnsSubname(cleanEnsName, normalizedAddress, {
        description: `Maiat Passport — ${userType}`,
        url: `https://app.maiat.io/passport/${normalizedAddress}`,
      });
      ensRegistered = ensResult.success;
    } catch (e: any) {
      console.warn("[passport/register] NameStone ENS registration failed (non-blocking):", e.message);
    }

    // --- On-chain identity (type-specific) ---
    let erc8004AgentId: number | null = null;
    let kyaCode: string | null = null;
    if (userType === 'agent') {
      // Agent only → ERC-8004 registration + KYA code
      try {
        const registeredId = await registerAgent(normalizedAddress);
        if (registeredId !== null && registeredId !== BigInt(-1)) {
          erc8004AgentId = Number(registeredId);
        } else if (registeredId === BigInt(-1)) {
          // tx sent but not yet confirmed — mark as pending
          erc8004AgentId = -1; // -1 = pending on-chain confirmation
        }
      } catch (e: any) {
        console.warn("[passport/register] ERC-8004 registerAgent failed (non-blocking):", e.message);
      }

      // KYA code — DB-backed, so verify page works
      try {
        const existingKya = await prisma.kyaCode.findFirst({
          where: { agentAddress: normalizedAddress },
        });
        if (existingKya) {
          kyaCode = existingKya.code;
        } else {
          // Generate unique code
          for (let attempt = 0; attempt < 10; attempt++) {
            const candidate = generateKyaCode();
            const collision = await prisma.kyaCode.findUnique({ where: { code: candidate } });
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
        }
      } catch (e: any) {
        console.warn("[passport/register] KYA code generation failed (non-blocking):", e.message);
      }
    }
    // Human → no on-chain mint needed (ENS + DB only, zero gas)

    // Build KYA share info for agents
    const kyaShareUrl = kyaCode ? `https://passport.maiat.io/verify/${kyaCode}` : null;
    const kyaTweetTemplate = kyaCode
      ? `I trust ${cleanEnsName}.maiat.eth 🛡️ #MaiatVerified ${kyaCode}\n${kyaShareUrl}`
      : null;

    return NextResponse.json({
      passport: {
        ensName: cleanEnsName,
        ensFullName: fullEnsName,
        walletAddress: normalizedAddress,
        type: userType,
        trustScore: reputation.reputationScore,
        verdict: getVerdict(reputation.reputationScore),
        totalQueries: 0,
        scarabBalance: referralApplied ? 15 : 10,
        isNew: true,
        referralApplied,
        erc8004AgentId,
        kyaCode,
        ensRegistered,
      },
      ...(userType === 'agent' && kyaCode ? {
        kya: {
          code: kyaCode,
          shareUrl: kyaShareUrl,
          tweetTemplate: kyaTweetTemplate,
          instruction: "Ask your users to visit the shareUrl and tweet the template to endorse you. Each endorsement gives +5 trust and rewards the endorser with 5 Scarab.",
        },
      } : {}),
    }, { status: 201, headers: CORS_HEADERS });

  } catch (err) {
    console.error("Passport register error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

function getVerdict(score: number): string {
  if (score >= 80) return "Trusted";
  if (score >= 60) return "Proceed";
  if (score >= 40) return "Caution";
  return "Avoid";
}
