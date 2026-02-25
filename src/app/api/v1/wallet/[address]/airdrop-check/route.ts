import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import bs58 from "bs58";
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

  let isValidAddress = false;
  let normalizedAddress = address;

  // 1. Check EVM
  if (isAddress(address) || (address.startsWith("0x") && isAddress(address.toLowerCase()))) {
    isValidAddress = true;
    normalizedAddress = getAddress(address.toLowerCase());
  } else {
    // 2. Check Solana
    try {
      const decoded = bs58.decode(address);
      if (decoded.length === 32) {
        isValidAddress = true;
        normalizedAddress = address;
      }
    } catch (e) {
      isValidAddress = false;
    }
  }

  if (!isValidAddress) {
    return NextResponse.json(
      { error: "Invalid wallet address (EVM or Solana required)" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const knownProtocols = getKnownProtocolsMap();
    const interactions = await discoverInteractions(normalizedAddress, knownProtocols);

    const newAirdrops = [];

    for (const interaction of interactions) {
      if (!interaction.isKnown) continue;

      // Check if we already airdropped/store a receipt for this user and this protocol
      const existing = await prisma.eASReceipt.findFirst({
        where: {
          recipient: normalizedAddress,
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
          normalizedAddress, 
          interaction.name || interaction.address,
          mockTxHash
        );

        if (attestation) {
          const receiptDb = await prisma.eASReceipt.create({
            data: {
              recipient: normalizedAddress,
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
        wallet: normalizedAddress,
        airdroppedCount: newAirdrops.length,
        success: true
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    apiLog.error("airdrop-check", error, { address: normalizedAddress });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
