import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // We aggregate OutcomeReport to find pairs of agents who worked together
    // Since OutcomeReport has buyerAddress and sellerAddress
    const interactions = await prisma.outcomeReport.groupBy({
      by: ['buyerAddress', 'sellerAddress'],
      _count: {
        id: true
      },
      where: {
        result: 'success'
      }
    });

    // Format into a link list for D3
    const links = interactions.map(i => ({
      source: i.buyerAddress.toLowerCase(),
      target: i.sellerAddress.toLowerCase(),
      value: i._count.id // Frequency of work
    }));

    return NextResponse.json({ links });
  } catch (error) {
    console.error('[Interactions API] Error:', error);
    return NextResponse.json({ links: [] }, { status: 500 });
  }
}
