/**
 * Shared Passport (SBT) utilities
 *
 * Extracted from /api/v1/passport/mint to be reusable across routes.
 */

import {
  isAddress,
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  fallback,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, base } from 'viem/chains'

// Use env-configured chain; default to Base Sepolia for safety
const PASSPORT_CHAIN = process.env.PASSPORT_CHAIN === 'mainnet' ? base : baseSepolia

// Match erc8004.ts RPC priority order — override via PASSPORT_RPC_URL env var
const PASSPORT_RPC_URLS: string[] = process.env.PASSPORT_RPC_URL
  ? [process.env.PASSPORT_RPC_URL]
  : ['https://base.gateway.tenderly.co', 'https://mainnet.base.org', 'https://sepolia.base.org']

const PASSPORT_ABI = [
  {
    name: 'hasPassport',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const

export interface MintPassportResult {
  minted: boolean
  txHash: string | null
  reason?: string
  skipped?: boolean
}

/**
 * Attempt to mint a MaiatPassport SBT for a wallet.
 * - If PASSPORT_CONTRACT_ADDRESS is not set, skips gracefully.
 * - If the wallet already has a passport, returns { minted: false, skipped: true }.
 * - On success, returns { minted: true, txHash }.
 * - On error, throws (caller should catch and decide whether to block).
 */
export async function mintPassportSBT(
  walletAddress: string
): Promise<MintPassportResult> {
  if (!isAddress(walletAddress)) {
    throw new Error('Invalid wallet address')
  }

  const contractAddress = process.env.PASSPORT_CONTRACT_ADDRESS
  const adminKey = process.env.MAIAT_ADMIN_PRIVATE_KEY

  if (!contractAddress || !adminKey) {
    return {
      minted: false,
      txHash: null,
      reason: 'PASSPORT_CONTRACT_ADDRESS or MAIAT_ADMIN_PRIVATE_KEY not configured',
      skipped: true,
    }
  }

  const checksummed = getAddress(walletAddress)

  const publicClient = createPublicClient({
    chain: PASSPORT_CHAIN,
    transport: fallback(PASSPORT_RPC_URLS.map((url) => http(url))),
  })

  // Check if already has passport on-chain
  let already = false
  try {
    already = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: PASSPORT_ABI,
      functionName: 'hasPassport',
      args: [checksummed],
    })
  } catch (err: any) {
    console.warn('[passport] hasPassport check failed:', err.message)
    // If the contract doesn't respond, skip gracefully
    return {
      minted: false,
      txHash: null,
      reason: `Contract read failed: ${err.message}`,
      skipped: true,
    }
  }

  if (already) {
    return {
      minted: false,
      txHash: null,
      reason: 'Already has passport',
      skipped: true,
    }
  }

  // Mint on-chain
  const account = privateKeyToAccount(adminKey as `0x${string}`)
  const walletClient = createWalletClient({
    account,
    chain: PASSPORT_CHAIN,
    transport: http(PASSPORT_RPC_URLS[0]),
  })

  const txHash = await walletClient.writeContract({
    address: contractAddress as `0x${string}`,
    abi: PASSPORT_ABI,
    functionName: 'mint',
    args: [checksummed],
  })

  return {
    minted: true,
    txHash,
    skipped: false,
  }
}
