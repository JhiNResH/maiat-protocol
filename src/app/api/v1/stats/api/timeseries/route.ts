import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/stats/api/timeseries
 *
 * Returns daily query counts for the last 30 days.
 */
export async function GET() {
  try {
    const rows = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM query_logs
      WHERE "createdAt" > NOW() - INTERVAL '30 days'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    let cumulative = 0;
    const data = rows.map((row) => {
      const daily = Number(row.count);
      cumulative += daily;
      return {
        date: row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date),
        count: daily,
        cumulative,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[timeseries] error:", err);
    return NextResponse.json({ data: [] }, { status: 500 });
  }
}
