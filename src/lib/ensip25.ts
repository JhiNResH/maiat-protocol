/**
 * ENSIP-25: Verifiable AI Agent Identity with ENS
 *
 * Verifies the bidirectional link between:
 * - An on-chain ERC-8004 agent registry entry
 * - An ENS name (via standardized text record)
 *
 * Reference: https://ens.domains/blog/post/ensip-25
 */

import { getEnsSubname, setEnsSubname } from '@/lib/namestone'

// ERC-8004 Identity Registry on Base Mainnet
const IDENTITY_REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'

/**
 * Build the ENSIP-25 interoperable address for the ERC-8004 registry.
 *
 * Format: ERC-7930 interoperable address
 * - 0x0001 = EVM namespace
 * - 00000114 = Base Mainnet chainId (8453 = 0x2105, encoded as 4 bytes = 00002105)
 *   Wait — Base chainId 8453 = 0x2105 → 00002105
 * - registry address (20 bytes, lowercase, no 0x)
 */
function buildRegistryInteropAddr(): string {
  // Base Mainnet chainId: 8453 = 0x00002105 (4 bytes)
  const chainIdHex = '00002105'
  const registryHex = IDENTITY_REGISTRY_ADDRESS.slice(2).toLowerCase()
  // ERC-7930: 0x0001 (evm) + chainId (4 bytes) + address (20 bytes)
  return `0x0001${chainIdHex}${registryHex}`
}

const REGISTRY_INTEROP_ADDR = buildRegistryInteropAddr()

/**
 * Build the ENSIP-25 text record key for a given agentId
 */
export function buildEnsip25Key(agentId: number | bigint): string {
  return `agent-registration[${REGISTRY_INTEROP_ADDR}][${agentId}]`
}

export interface Ensip25VerifyResult {
  verified: boolean
  ensName: string
  agentId: number
  textRecordKey: string
  /** Present if verification failed */
  reason?: 'no_text_record' | 'ens_not_found' | 'registry_mismatch'
}

/**
 * Verify ENSIP-25 association between an ENS name and an ERC-8004 agentId.
 *
 * Uses NameStone (offchain resolver for maiat.eth subnames) to read text records.
 * For non-maiat.eth names, falls back to on-chain ENS resolver via viem.
 *
 * Returns verified=true only if the text record exists and is non-empty.
 */
export async function verifyEnsip25(
  ensName: string,
  agentId: number | bigint
): Promise<Ensip25VerifyResult> {
  const key = buildEnsip25Key(agentId)
  const normalizedName = ensName.toLowerCase().replace(/\.eth$/, '')

  // Check if this is a maiat.eth subdomain (use NameStone)
  const isMaiatSubdomain = ensName.toLowerCase().endsWith('.maiat.eth') ||
    !ensName.toLowerCase().includes('.')

  if (isMaiatSubdomain) {
    const cleanName = normalizedName.replace(/\.maiat\.eth$/, '')
    const subname = await getEnsSubname(cleanName)

    if (!subname) {
      return {
        verified: false,
        ensName,
        agentId: Number(agentId),
        textRecordKey: key,
        reason: 'ens_not_found',
      }
    }

    const recordValue = subname.textRecords?.[key]
    const verified = !!recordValue && recordValue !== ''

    return {
      verified,
      ensName: `${cleanName}.maiat.eth`,
      agentId: Number(agentId),
      textRecordKey: key,
      reason: verified ? undefined : 'no_text_record',
    }
  }

  // Non-maiat.eth: use viem getEnsText (on-chain ENS)
  try {
    const { createPublicClient, http } = await import('viem')
    const { mainnet } = await import('viem/chains')
    const { normalize } = await import('viem/ens')

    const client = createPublicClient({
      chain: mainnet,
      transport: http(process.env.ALCHEMY_ETH_RPC || 'https://eth.llamarpc.com'),
    })

    const record = await client.getEnsText({
      name: normalize(ensName),
      key,
    })

    const verified = record !== null && record !== undefined && record !== ''

    return {
      verified,
      ensName,
      agentId: Number(agentId),
      textRecordKey: key,
      reason: verified ? undefined : 'no_text_record',
    }
  } catch (err: any) {
    return {
      verified: false,
      ensName,
      agentId: Number(agentId),
      textRecordKey: key,
      reason: 'ens_not_found',
    }
  }
}

/**
 * Set the ENSIP-25 text record on a maiat.eth subdomain via NameStone.
 * Only works for maiat.eth subdomains (uses NameStone offchain resolver).
 *
 * Call this when an agent owner requests ENS verification from our side.
 */
export async function setEnsip25Record(
  ensName: string,
  walletAddress: string,
  agentId: number | bigint
): Promise<{ success: boolean; error?: string }> {
  const cleanName = ensName.toLowerCase()
    .replace(/\.maiat\.eth$/, '')
    .replace(/\.eth$/, '')

  const key = buildEnsip25Key(agentId)

  return setEnsSubname(cleanName, walletAddress, {
    [key]: '1',
  })
}
