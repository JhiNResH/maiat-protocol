/**
 * GET /api/v1/kya/[code]
 * Returns agent info + recent endorsements + tweet template.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || !/^MAIAT-[A-Z2-9]{4}$/.test(code)) {
    return NextResponse.json(
      { error: 'Invalid KYA code format' },
      { status: 400, headers: CORS }
    );
  }

  const kyaCode = await prisma.kyaCode.findUnique({
    where: { code },
    include: {
      endorsements: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          endorserAddress: true,
          tweetUrl: true,
          referrer: true,
          status: true,
          scarabAwarded: true,
          createdAt: true,
        },
      },
    },
  });

  if (!kyaCode) {
    return NextResponse.json(
      { error: `Agent with code ${code} not found` },
      { status: 404, headers: CORS }
    );
  }

  const agentName = kyaCode.agentName ?? kyaCode.agentAddress.slice(0, 8);
  const tweetTemplate = `I trust @${agentName} 🛡️ #MaiatVerified ${code}\npassport.maiat.io/verify/${code}?ref={yourENS}`;

  return NextResponse.json(
    {
      agent: {
        address: kyaCode.agentAddress,
        name: kyaCode.agentName,
        twitterHandle: kyaCode.twitterHandle,
        totalEndorsements: kyaCode.totalEndorsements,
        trustBoost: kyaCode.trustBoost,
        code: kyaCode.code,
        createdAt: kyaCode.createdAt,
      },
      endorsements: kyaCode.endorsements,
      tweetTemplate,
    },
    { status: 200, headers: CORS }
  );
}
