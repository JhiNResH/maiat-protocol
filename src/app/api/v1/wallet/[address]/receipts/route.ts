import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { getReceiptsForWallet, MAIAT_RECEIPT_SCHEMA_UID } from "@/lib/eas";
import { apiLog } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Ethereum address" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const checksummed = getAddress(address);

  try {
    const receipts = await getReceiptsForWallet(checksummed);

    // Mock mode: if the schema UID is just zeros (the default in our env),
    // and there are no receipts, we can return a "mock" receipt just to show the UI proof of concept.
    const isMock = MAIAT_RECEIPT_SCHEMA_UID === "0x0000000000000000000000000000000000000000000000000000000000000000";
    
    let returnedReceipts = receipts;
    
    if (isMock && receipts.length === 0) {
      returnedReceipts = [
          {
            id: "0xMockEASReceipt1234567890abcdef...",
            attester: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC token dummy
            recipient: checksummed,
            timeCreated: Date.now() / 1000 - 86400, // 1 day ago
            txid: "0x123abc456def7890...",
            decodedDataJson: '[{"name":"serviceProvider","type":"string","value":"Maiat Sample AI Agent"},{"name":"serviceType","type":"string","value":"Code Review Generation"},{"name":"valuePaid","type":"string","value":"50 USDC"}]'
          }
      ];
    }

    return NextResponse.json(
      {
        wallet: checksummed,
        receipts: returnedReceipts,
        count: returnedReceipts.length,
        isMockEnv: isMock
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    apiLog.error("wallet-receipts", error, { address: checksummed });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
