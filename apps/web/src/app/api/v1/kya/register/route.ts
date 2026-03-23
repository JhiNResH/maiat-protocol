/**
 * POST /api/v1/kya/register
 * Agent registers for a KYA code. Returns existing code if already registered.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateKyaCode, kyaCorsHeaders } from '@/lib/kya';

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  const CORS = kyaCorsHeaders(req.headers.get('origin'));
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const CORS = kyaCorsHeaders(req.headers.get('origin'));
  try {
    const body = await req.json();
    const { agentAddress, agentName, twitterHandle } = body as {
      agentAddress?: string;
      agentName?: string;
      twitterHandle?: string;
    };

    if (!agentAddress || !/^0x[a-fA-F0-9]{40}$/i.test(agentAddress)) {
      return NextResponse.json(
        { error: 'Valid agentAddress (0x...) is required' },
        { status: 400, headers: CORS }
      );
    }

    const normalized = agentAddress.toLowerCase();

    // Check if agent already has a code
    const existing = await prisma.kyaCode.findFirst({
      where: { agentAddress: normalized },
    });

    if (existing) {
      return NextResponse.json(
        {
          code: existing.code,
          verifyUrl: `passport.maiat.io/verify/${existing.code}`,
          alreadyRegistered: true,
        },
        { status: 200, headers: CORS }
      );
    }

    // Generate a unique code (retry on collision)
    let code = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateKyaCode();
      const collision = await prisma.kyaCode.findUnique({ where: { code: candidate } });
      if (!collision) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Failed to generate unique code, please retry' },
        { status: 500, headers: CORS }
      );
    }

    const kyaCode = await prisma.kyaCode.create({
      data: {
        code,
        agentAddress: normalized,
        agentName: agentName ?? null,
        twitterHandle: twitterHandle ?? null,
      },
    });

    return NextResponse.json(
      {
        code: kyaCode.code,
        verifyUrl: `passport.maiat.io/verify/${kyaCode.code}`,
        alreadyRegistered: false,
      },
      { status: 201, headers: CORS }
    );
  } catch (err) {
    console.error('[kya/register]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}
