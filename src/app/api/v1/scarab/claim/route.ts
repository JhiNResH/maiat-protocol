import { NextRequest, NextResponse } from "next/server";
import { claimDaily } from "@/lib/scarab";

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const claimResult: any = await claimDaily(address, false);
    
    // Return 200 even if already claimed to reduce log noise, 
    // the client will handle the alreadyClaimed flag.
    return NextResponse.json(claimResult, { status: 200 });
  } catch (error: any) {
    console.error("[POST /api/v1/scarab/claim]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
