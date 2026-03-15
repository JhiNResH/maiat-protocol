/**
 * POST /api/v1/kya/endorse
 * User submits a tweet URL as endorsement proof for an agent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateTweetUrl } from '@/lib/kya';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SCARAB_REWARD = 5;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, endorserAddress, tweetUrl, referrer } = body as {
      code?: string;
      endorserAddress?: string;
      tweetUrl?: string;
      referrer?: string;
    };

    // Validate inputs
    if (!code || !/^MAIAT-[A-Z2-9]{4}$/.test(code)) {
      return NextResponse.json(
        { error: 'Valid KYA code (MAIAT-XXXX) is required' },
        { status: 400, headers: CORS }
      );
    }

    if (!endorserAddress || !/^0x[a-fA-F0-9]{40}$/i.test(endorserAddress)) {
      return NextResponse.json(
        { error: 'Valid endorserAddress (0x...) is required' },
        { status: 400, headers: CORS }
      );
    }

    if (!tweetUrl || !validateTweetUrl(tweetUrl)) {
      return NextResponse.json(
        { error: 'Valid Twitter/X tweet URL is required' },
        { status: 400, headers: CORS }
      );
    }

    const normalizedEndorser = endorserAddress.toLowerCase();

    // Lookup KYA code
    const kyaCode = await prisma.kyaCode.findUnique({ where: { code } });
    if (!kyaCode) {
      return NextResponse.json(
        { error: `Code ${code} not found` },
        { status: 404, headers: CORS }
      );
    }

    // Prevent self-endorsement
    if (kyaCode.agentAddress === normalizedEndorser) {
      return NextResponse.json(
        { error: 'Agents cannot endorse themselves' },
        { status: 400, headers: CORS }
      );
    }

    // Check for duplicate endorsement
    const existing = await prisma.kyaEndorsement.findUnique({
      where: { kyaCodeId_endorserAddress: { kyaCodeId: kyaCode.id, endorserAddress: normalizedEndorser } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'You have already endorsed this agent', endorsement: existing },
        { status: 409, headers: CORS }
      );
    }

    // Run everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create endorsement
      const endorsement = await tx.kyaEndorsement.create({
        data: {
          kyaCodeId: kyaCode.id,
          endorserAddress: normalizedEndorser,
          tweetUrl,
          referrer: referrer ?? null,
          status: 'pending',
          scarabAwarded: false,
        },
      });

      // Increment totalEndorsements + trustBoost on the agent code
      const TRUST_BOOST_PER_ENDORSEMENT = 2;
      await tx.kyaCode.update({
        where: { id: kyaCode.id },
        data: {
          totalEndorsements: { increment: 1 },
          trustBoost: { increment: TRUST_BOOST_PER_ENDORSEMENT },
        },
      });

      // Award Scarab to endorser
      const bal = await tx.scarabBalance.upsert({
        where: { address: normalizedEndorser },
        create: {
          address: normalizedEndorser,
          balance: SCARAB_REWARD,
          totalEarned: SCARAB_REWARD,
        },
        update: {
          balance: { increment: SCARAB_REWARD },
          totalEarned: { increment: SCARAB_REWARD },
        },
      });

      await tx.scarabTransaction.create({
        data: {
          address: normalizedEndorser,
          amount: SCARAB_REWARD,
          type: 'kya_endorsement',
          description: `Endorsed agent ${code} on Twitter`,
          referenceId: endorsement.id,
          balanceAfter: bal.balance,
        },
      });

      // Mark scarabAwarded
      await tx.kyaEndorsement.update({
        where: { id: endorsement.id },
        data: { scarabAwarded: true },
      });

      return { endorsement, scarabBalance: bal.balance };
    });

    return NextResponse.json(
      {
        success: true,
        endorsement: result.endorsement,
        scarabAwarded: SCARAB_REWARD,
        newScarabBalance: result.scarabBalance,
      },
      { status: 201, headers: CORS }
    );
  } catch (err) {
    console.error('[kya/endorse]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}
