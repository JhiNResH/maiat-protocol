import { NextRequest, NextResponse } from "next/server";
import { claimDaily } from "@/lib/scarab";
import { verifyMessage, getAddress } from "viem";

export async function POST(req: NextRequest) {
  try {
    const { address, signature } = await req.json();
    if (!address || !signature) {
      return NextResponse.json(
        { error: "Missing address or signature" },
        { status: 400 }
      );
    }

    // Verify EIP-191 signature
    const checksumAddress = getAddress(address);
    const message = `Claim daily Scarab for ${checksumAddress}`;

    let isValid = false;
    try {
      isValid = await verifyMessage({
        address: checksumAddress,
        message,
        signature,
      });
    } catch {
      isValid = false;
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const claimResult: any = await claimDaily(checksumAddress, false);
    
    // Return 200 even if already claimed to reduce log noise, 
    // the client will handle the alreadyClaimed flag.
    return NextResponse.json(claimResult, { status: 200 });
  } catch (error: any) {
    console.error("[POST /api/v1/scarab/claim]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
