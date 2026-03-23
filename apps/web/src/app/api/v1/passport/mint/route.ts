/**
 * POST /api/v1/passport/mint
 *
 * Auto-mint a MaiatPassport SBT for a connected wallet.
 * Idempotent: if wallet already has a passport, returns existing data.
 * Requires MAIAT_ADMIN_PRIVATE_KEY and PASSPORT_CONTRACT_ADDRESS env vars.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress, createPublicClient, createWalletClient, http, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { prisma } from "@/lib/prisma";

const PASSPORT_ABI = [
  {
    name: "hasPassport",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const contractAddress = process.env.PASSPORT_CONTRACT_ADDRESS;
    const adminKey = process.env.MAIAT_ADMIN_PRIVATE_KEY;

    if (!contractAddress || !adminKey) {
      // Gracefully handle: just ensure DB user exists, skip on-chain mint
      await ensureUser(address);
      return NextResponse.json({
        minted: false,
        reason: "On-chain passport not configured yet",
        address: getAddress(address),
      });
    }

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    // Check if already has passport on-chain
    const already = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: PASSPORT_ABI,
      functionName: "hasPassport",
      args: [getAddress(address)],
    });

    await ensureUser(address);

    if (already) {
      return NextResponse.json({
        minted: false,
        reason: "Already has passport",
        address: getAddress(address),
      });
    }

    // Mint on-chain
    const account = privateKeyToAccount(adminKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    });

    const txHash = await walletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: PASSPORT_ABI,
      functionName: "mint",
      args: [getAddress(address)],
    });

    return NextResponse.json({
      minted: true,
      txHash,
      address: getAddress(address),
    });
  } catch (err: any) {
    console.error("[passport/mint] Error:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to mint passport" },
      { status: 500 }
    );
  }
}

async function ensureUser(address: string) {
  const checksummed = getAddress(address);
  await prisma.user.upsert({
    where: { address: checksummed.toLowerCase() },
    create: { address: checksummed.toLowerCase() },
    update: {},
  });
}
