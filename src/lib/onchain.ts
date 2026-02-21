/**
 * On-chain integration for Maat ReviewRegistry on Base Sepolia
 * Bridges off-chain reviews to on-chain proofs
 */

import { createPublicClient, createWalletClient, http, keccak256, toBytes, encodeFunctionData, type Hex, toHex, concat } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// ReviewRegistry ABI (minimal - only what we need)
export const REVIEW_REGISTRY_ABI = [
  {
    name: 'submitReview',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'category', type: 'string' },
      { name: 'projectId', type: 'string' },
      { name: 'contentHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'reviewId', type: 'bytes32' }],
  },
  {
    name: 'verifyReview',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'reviewId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getReview',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'reviewId', type: 'bytes32' }],
    outputs: [
      { name: 'reviewer', type: 'address' },
      { name: 'category', type: 'string' },
      { name: 'projectId', type: 'string' },
      { name: 'contentHash', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
    ],
  },
  {
    name: 'getTotalReviews',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getReviewsByReviewer',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'reviewer', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32[]' }],
  },
  {
    name: 'ReviewSubmitted',
    type: 'event',
    inputs: [
      { name: 'reviewId', type: 'bytes32', indexed: true },
      { name: 'reviewer', type: 'address', indexed: true },
      { name: 'category', type: 'string', indexed: false },
      { name: 'projectId', type: 'string', indexed: false },
      { name: 'contentHash', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const

// Contract address on Base Sepolia (will be set after deployment)
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_REVIEW_REGISTRY_ADDRESS as `0x${string}` | undefined

// Base Sepolia public client
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
})

/**
 * Hash review content for on-chain submission
 */
export function hashReviewContent(content: string, rating: number, reviewerId: string): Hex {
  const payload = `${content}|${rating}|${reviewerId}`
  return keccak256(toBytes(payload))
}

/**
 * Check if on-chain verification is available
 */
export function isOnChainEnabled(): boolean {
  return !!CONTRACT_ADDRESS
}

/**
 * Get total on-chain reviews count
 */
export async function getOnChainReviewCount(): Promise<bigint> {
  if (!CONTRACT_ADDRESS) return 0n

  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: REVIEW_REGISTRY_ABI,
    functionName: 'getTotalReviews',
  })
}

/**
 * Verify a review exists on-chain
 */
export async function verifyOnChain(onChainReviewId: Hex): Promise<boolean> {
  if (!CONTRACT_ADDRESS) return false

  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: REVIEW_REGISTRY_ABI,
    functionName: 'verifyReview',
    args: [onChainReviewId],
  })
}

/**
 * Get on-chain review details
 */
export async function getOnChainReview(onChainReviewId: Hex) {
  if (!CONTRACT_ADDRESS) return null

  try {
    const [reviewer, category, projectId, contentHash, timestamp] = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: REVIEW_REGISTRY_ABI,
      functionName: 'getReview',
      args: [onChainReviewId],
    })

    return { reviewer, category, projectId, contentHash, timestamp }
  } catch {
    return null
  }
}

/**
 * Submit review on-chain using server-side relayer
 * This is a "meta-transaction" pattern — the server pays gas on behalf of the user
 */
export async function submitReviewOnChain(
  category: string,
  projectId: string,
  contentHash: Hex
): Promise<{ txHash: Hex; reviewId: Hex } | null> {
  if (!CONTRACT_ADDRESS) return null

  const privateKey = process.env.BASE_RELAYER_PRIVATE_KEY as `0x${string}` | undefined
  if (!privateKey) {
    console.warn('BASE_RELAYER_PRIVATE_KEY not set, skipping on-chain submission')
    return null
  }

  const account = privateKeyToAccount(privateKey)
  // ERC-8021 Builder Code — tracks all Maiat agent transactions on Base
  // Builder code from base.dev: bc_cozhkj23
  const BUILDER_CODE = 'bc_cozhkj23'
  const ERC8021_MARKER = '0x80218021802180218021802180218021' as Hex
  const builderCodeHex = toHex(BUILDER_CODE)
  const dataSuffix = concat([builderCodeHex, ERC8021_MARKER])

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
    dataSuffix,
  })

  try {
    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: REVIEW_REGISTRY_ABI,
      functionName: 'submitReview',
      args: [category, projectId, contentHash],
    })

    // Wait for receipt to get the reviewId from event logs
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    // Extract reviewId from ReviewSubmitted event
    let reviewId: Hex = '0x0' as Hex
    for (const log of receipt.logs) {
      if (log.topics[0] && log.topics[1]) {
        // First indexed topic after event sig is reviewId
        reviewId = log.topics[1] as Hex
        break
      }
    }

    return { txHash, reviewId }
  } catch (error) {
    console.error('On-chain submission failed:', error)
    return null
  }
}

/**
 * Get Base Sepolia explorer URL for a transaction
 */
export function getExplorerUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`
}

/**
 * Encode submitReview calldata (for client-side wallet signing)
 */
export function encodeSubmitReview(category: string, projectId: string, contentHash: Hex): Hex {
  return encodeFunctionData({
    abi: REVIEW_REGISTRY_ABI,
    functionName: 'submitReview',
    args: [category, projectId, contentHash],
  })
}
