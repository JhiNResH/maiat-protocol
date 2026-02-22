/**
 * On-chain Usage Proof Verification
 * 
 * Verifies that a wallet has interacted with a project's contract
 * before allowing reviews. Supports multiple chains.
 */

const EXPLORERS: Record<string, { api: string; key?: string }> = {
  // Ethereum mainnet
  ethereum: {
    api: 'https://api.etherscan.io/api',
    key: process.env.ETHERSCAN_API_KEY || '', // works without key (rate limited)
  },
  // Base
  base: {
    api: 'https://api.basescan.org/api',
    key: process.env.BASESCAN_API_KEY || '',
  },
  // BNB Chain
  bsc: {
    api: 'https://api.bscscan.com/api',
    key: process.env.BSCSCAN_API_KEY || '',
  },
}

// Map project categories to likely chains
function getChainsForCategory(category: string): string[] {
  switch (category) {
    case 'm/ai-agents':
      return ['base', 'ethereum'] // Virtuals agents are mostly on Base
    case 'm/defi':
      return ['ethereum', 'base', 'bsc']
    default:
      return ['ethereum', 'base', 'bsc']
  }
}

interface UsageProof {
  verified: boolean
  chain: string | null
  txHash: string | null
  timestamp: number | null
  interactionCount: number
  details: string
}

/**
 * Check if a wallet has interacted with a contract on any supported chain
 */
export async function verifyUsage(
  walletAddress: string,
  contractAddress: string,
  category: string = 'm/defi'
): Promise<UsageProof> {
  const chains = getChainsForCategory(category)
  
  for (const chain of chains) {
    const explorer = EXPLORERS[chain]
    if (!explorer) continue

    try {
      const proof = await checkChain(walletAddress, contractAddress, explorer, chain)
      if (proof.verified) return proof
    } catch (err) {
      console.error(`[usage-proof] ${chain} check failed:`, err)
      continue
    }
  }

  // Also check token transfers (ERC20) — user might have received/sent project tokens
  for (const chain of chains) {
    const explorer = EXPLORERS[chain]
    if (!explorer) continue

    try {
      const proof = await checkTokenTransfers(walletAddress, contractAddress, explorer, chain)
      if (proof.verified) return proof
    } catch (err) {
      continue
    }
  }

  return {
    verified: false,
    chain: null,
    txHash: null,
    timestamp: null,
    interactionCount: 0,
    details: 'No on-chain interaction found with this project',
  }
}

/**
 * Check normal transactions between wallet and contract
 */
async function checkChain(
  wallet: string,
  contract: string,
  explorer: { api: string; key?: string },
  chain: string
): Promise<UsageProof> {
  const params = new URLSearchParams({
    module: 'account',
    action: 'txlist',
    address: wallet.toLowerCase(),
    startblock: '0',
    endblock: '99999999',
    sort: 'desc',
  })
  if (explorer.key) params.set('apikey', explorer.key)

  const res = await fetch(`${explorer.api}?${params}`, {
    signal: AbortSignal.timeout(10000),
  })
  const data = await res.json()

  if (data.status !== '1' || !Array.isArray(data.result)) {
    return { verified: false, chain, txHash: null, timestamp: null, interactionCount: 0, details: 'API error or no transactions' }
  }

  // Find transactions to/from the contract
  const contractLower = contract.toLowerCase()
  const interactions = data.result.filter(
    (tx: any) => tx.to?.toLowerCase() === contractLower || tx.from?.toLowerCase() === contractLower
  )

  if (interactions.length > 0) {
    const latest = interactions[0]
    return {
      verified: true,
      chain,
      txHash: latest.hash,
      timestamp: parseInt(latest.timeStamp) * 1000,
      interactionCount: interactions.length,
      details: `Found ${interactions.length} interaction(s) on ${chain}`,
    }
  }

  return { verified: false, chain, txHash: null, timestamp: null, interactionCount: 0, details: `No interactions on ${chain}` }
}

/**
 * Check ERC20 token transfers (user holds or transferred project tokens)
 */
async function checkTokenTransfers(
  wallet: string,
  contractAddress: string,
  explorer: { api: string; key?: string },
  chain: string
): Promise<UsageProof> {
  const params = new URLSearchParams({
    module: 'account',
    action: 'tokentx',
    address: wallet.toLowerCase(),
    contractaddress: contractAddress.toLowerCase(),
    startblock: '0',
    endblock: '99999999',
    sort: 'desc',
  })
  if (explorer.key) params.set('apikey', explorer.key)

  const res = await fetch(`${explorer.api}?${params}`, {
    signal: AbortSignal.timeout(10000),
  })
  const data = await res.json()

  if (data.status !== '1' || !Array.isArray(data.result) || data.result.length === 0) {
    return { verified: false, chain, txHash: null, timestamp: null, interactionCount: 0, details: 'No token transfers' }
  }

  const latest = data.result[0]
  return {
    verified: true,
    chain,
    txHash: latest.hash,
    timestamp: parseInt(latest.timeStamp) * 1000,
    interactionCount: data.result.length,
    details: `Found ${data.result.length} token transfer(s) on ${chain}`,
  }
}

/**
 * Get all projects a wallet has interacted with
 * Used for "you've used these projects, review them!" flow
 */
export async function getUsedProjects(
  walletAddress: string,
  projectContracts: { slug: string; address: string; category: string }[]
): Promise<{ slug: string; proof: UsageProof }[]> {
  const results: { slug: string; proof: UsageProof }[] = []

  // Run in parallel with concurrency limit
  const batchSize = 3
  for (let i = 0; i < projectContracts.length; i += batchSize) {
    const batch = projectContracts.slice(i, i + batchSize)
    const proofs = await Promise.all(
      batch.map(async (p) => ({
        slug: p.slug,
        proof: await verifyUsage(walletAddress, p.address, p.category),
      }))
    )
    results.push(...proofs.filter((r) => r.proof.verified))
  }

  return results
}
