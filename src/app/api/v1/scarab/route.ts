import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/scarab";

export const dynamic = "force-dynamic";

// GET /api/v1/scarab?address=0x...
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });
  try {
    const bal = await getBalance(address);
    return NextResponse.json({ balance: bal.balance, totalEarned: bal.totalEarned, totalSpent: bal.totalSpent, streak: bal.streak });
  } catch (e) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
