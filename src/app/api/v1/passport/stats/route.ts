import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [passports, queries, agents] = await Promise.all([
      prisma.scarabBalance.count(),
      prisma.queryLog.count(),
      prisma.agentScore.count(),
    ]);

    return NextResponse.json({ passports, queries, agents }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ passports: 0, queries: 0 });
  }
}
