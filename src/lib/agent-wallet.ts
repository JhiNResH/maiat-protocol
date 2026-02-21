/**
 * Privy Server Wallet for AI Agent Reviews
 * 
 * Creates and manages a server-controlled wallet that AI agents
 * use to sign reviews and pay x402 KITE verification fees.
 * 
 * The agent wallet is owned by an authorization key (our backend),
 * not by a user — so agents can autonomously submit reviews.
 */

import { PrivyClient } from '@privy-io/server-auth'

// Initialize Privy server client
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
)

// Cache the agent wallet address
let cachedAgentWallet: { id: string; address: string } | null = null

/**
 * Get or create the Maiat AI Agent wallet
 * This wallet is used by all AI agent reviewers
 */
export async function getAgentWallet(): Promise<{ id: string; address: string }> {
  if (cachedAgentWallet) return cachedAgentWallet

  // Check if we already have an agent wallet stored
  const existingWalletId = process.env.AGENT_WALLET_ID
  
  if (existingWalletId) {
    try {
      const wallet = await privy.walletApi.getWallet({ id: existingWalletId })
      cachedAgentWallet = { id: wallet.id, address: wallet.address }
      console.log(`[AgentWallet] Loaded existing wallet: ${wallet.address}`)
      return cachedAgentWallet
    } catch (e) {
      console.warn('[AgentWallet] Stored wallet not found, creating new one')
    }
  }

  // Create a new server wallet for the agent
  const wallet = await privy.walletApi.create({
    chainType: 'ethereum',
  })

  cachedAgentWallet = { id: wallet.id, address: wallet.address }
  console.log(`[AgentWallet] Created new wallet: ${wallet.address}`)
  console.log(`[AgentWallet] Save this AGENT_WALLET_ID to .env: ${wallet.id}`)
  
  return cachedAgentWallet
}

/**
 * Sign a message with the agent wallet
 * Used for signing review content hashes
 */
export async function agentSign(message: string): Promise<string> {
  const wallet = await getAgentWallet()
  
  const { signature } = await privy.walletApi.ethereum.signMessage({
    walletId: wallet.id,
    message,
  })
  
  return signature
}

/**
 * Submit an agent review via the agent wallet
 * The agent analyzes a project and submits a data-driven review
 */
export async function submitAgentReview(params: {
  projectAddress: string
  rating: number
  content: string
  analysisSource: 'gemini' | '0g-compute' | 'manual'
}) {
  const wallet = await getAgentWallet()
  
  return {
    reviewerAddress: wallet.address,
    reviewerType: 'agent' as const,
    ...params,
    signature: await agentSign(`${params.projectAddress}:${params.rating}:${params.content}`),
    timestamp: Date.now(),
  }
}
