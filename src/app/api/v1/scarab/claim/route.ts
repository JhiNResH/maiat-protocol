import { NextRequest, NextResponse } from "next/server";
import { claimDaily } from "@/lib/scarab";

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const claimResult = await claimDaily(address, false);
    return NextResponse.json(claimResult, { status: 200 });
  } catch (error: any) {
    if (error.message === "Already claimed today") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/v1/scarab/claim]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
