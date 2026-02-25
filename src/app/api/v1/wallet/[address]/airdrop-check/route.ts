import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { discoverInteractions } from "@/lib/interaction-check";
import { getKnownProtocolsMap } from "@/lib/slug-resolver";
import { createOffchainReceipt } from "@/lib/eas";
import { prisma } from "@/lib/prisma";
import { apiLog } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function POST(
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
    const knownProtocols = getKnownProtocolsMap();
    const interactions = await discoverInteractions(checksummed, knownProtocols);

    const newAirdrops = [];

    for (const interaction of interactions) {
      if (!interaction.isKnown) continue;

      // Check if we already airdropped/store a receipt for this user and this protocol
      const existing = await prisma.eASReceipt.findFirst({
        where: {
          recipient: checksummed,
          serviceProtocol: interaction.name || "Unknown Contract",
          isOffchain: true,
        }
      });

      if (!existing) {
        // Airdrop a new receipt
        // In a real scenario, we might use the actual txHash from the transfer event.
        // discoverInteractions currently just counts them, so we'll use a placeholder or the lastTxDate as a reference.
        const mockTxHash = `0xAirdroppedTxRef_${Buffer.from(interaction.address).toString('hex').slice(0, 10)}`;
        
        const attestation = await createOffchainReceipt(
          checksummed, 
          interaction.name || interaction.address,
          mockTxHash
        );

        if (attestation) {
          const receiptDb = await prisma.eASReceipt.create({
            data: {
              recipient: checksummed,
              attester: process.env.MAIAT_ADMIN_PUBLIC_KEY || "Maiat Oracle", // Informational
              serviceProtocol: interaction.name || interaction.address,
              txHash: mockTxHash,
              receiptJson: JSON.stringify(attestation, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
              ),
              isOffchain: true,
            }
          });
          newAirdrops.push(receiptDb);
        }
      }
    }

    return NextResponse.json(
      {
        wallet: checksummed,
        airdroppedCount: newAirdrops.length,
        success: true
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    apiLog.error("airdrop-check", error, { address: checksummed });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
