/**
 * Slug Resolver — bidirectional slug ↔ address resolution
 *
 * Supports:
 * - Known protocol slugs: "usdc" → 0x833589...
 * - Known agent slugs: "aixbt" → 0x4f9fd6...
 * - Raw addresses: 0x833589... → { slug: "usdc", type: "defi" }
 * - Database Project table lookup as fallback
 */

import { isAddress, getAddress } from "viem";

// --- Types ---

export type EntityType = "defi" | "agent" | "memecoin" | "stablecoin" | "nft" | "infrastructure" | "unknown";
export type ChainId = 8453 | 1 | 56 | 1399811149; // Base = 8453, ETH = 1, BNB = 56, SOL = 1399811149 (fake chain id for solana RPCs, just marking it out)

export interface ResolvedEntity {
  address: string;
  slug: string;
  name: string;
  type: EntityType;
  category: string;
  chainId: ChainId; // To identify which Alchemy RPC to query
  auditedBy?: string[];
}

// --- Known DeFi Protocols (Base Mainnet) ---

const DEFI_SLUGS: Record<string, Omit<ResolvedEntity, "slug" | "type">> = {
  // --- BASE MAINNET DEFI & TOKENS ---
  usdc: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", name: "USDC (Base)", category: "STABLECOIN", chainId: 8453 },
  uniswap: { address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", name: "Uniswap V3 (Base)", category: "DEX", chainId: 8453 },
  aerodrome: { address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", name: "Aerodrome Router", category: "DEX", chainId: 8453 },
  aave: { address: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", name: "Aave V3 (Base)", category: "LENDING", chainId: 8453 },
  compound: { address: "0xb125E6687d4313864e53df431d5425969c15Eb2F", name: "Compound V3 (Base)", category: "LENDING", chainId: 8453 },
  
  // --- ETHEREUM MAINNET DEFI & TOKENS ---
  "usdt-eth": { address: "0xdac17f958d2ee523a2206206994597c13d831ec7", name: "USDT", category: "STABLECOIN", chainId: 1 },
  "aave-eth": { address: "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2", name: "Aave V3 Pool (ETH)", category: "LENDING", chainId: 1 },
  lido: { address: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84", name: "Lido stETH", category: "LIQUID_STAKING", chainId: 1 },
  "uniswap-eth": { address: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", name: "Uniswap V3 Router 2", category: "DEX", chainId: 1 },
  pepe: { address: "0x6982508145454ce325ddbe47a25d4ec3d2311933", name: "PEPE", category: "MEMECOIN", chainId: 1 },

  // --- SOLANA SYSTEM DEFI & TOKENS ---
  "usdc-sol": { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", name: "USDC (Solana)", category: "STABLECOIN", chainId: 1399811149 },
  raydium: { address: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", name: "Raydium Liquidity Pool V4", category: "DEX", chainId: 1399811149 },
  jito: { address: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", name: "Jito Staked SOL (JitoSOL)", category: "LIQUID_STAKING", chainId: 1399811149 },
  wif: { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYtM2wYSzUj", name: "dogwifhat (WIF)", category: "MEMECOIN", chainId: 1399811149 },
  bonk: { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", name: "Bonk", category: "MEMECOIN", chainId: 1399811149 },

  // --- BNB CHAIN DEFI & TOKENS ---
  "usdt-bnb": { address: "0x55d398326f99059ff775485246999027b3197955", name: "USDT (BNB)", category: "STABLECOIN", chainId: 56 },
  pancakeswap: { address: "0x10ED43C718714eb63d5aA57B78B54704E256024E", name: "PancakeSwap V2 Router", category: "DEX", chainId: 56 },
  venus: { address: "0xfD36E2c2a6789Db23113CeCb403C495012ACFE52", name: "Venus vBNB", category: "LENDING", chainId: 56 },
  "binance-peg-eth": { address: "0x2170ed0880ac9a755fd29b2688956bd959f933f8", name: "Binance-Peg Ethereum Token", category: "INFRASTRUCTURE", chainId: 56 },
  cake: { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", name: "PancakeSwap Token (CAKE)", category: "INFRASTRUCTURE", chainId: 56 },
};

// --- Known AI Agents (Base Mainnet) ---

const AGENT_SLUGS: Record<string, Omit<ResolvedEntity, "slug" | "type">> = {
  // --- BASE MAINNET AGENTS ---
  virtuals: { address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", name: "Virtuals Protocol", category: "AGENT_PLATFORM", chainId: 8453 },
  aixbt: { address: "0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825", name: "AIXBT", category: "AGENT", chainId: 8453 },
  luna: { address: "0x55cd6469f597452b5a7536e2cd98fde4c1247ee4", name: "Luna by Virtuals", category: "AGENT", chainId: 8453 },
  vaderai: { address: "0x731814e491571a2e9ee3c5b1f7f3b962ee8f4870", name: "VaderAI", category: "AGENT", chainId: 8453 },
  freysa: { address: "0x3e466dad6695879fd783e2bfcb98e16ce15a3caf", name: "Freysa AI", category: "AGENT", chainId: 8453 },
};

// --- Build reverse lookup (address → slug) ---

const ADDRESS_TO_DEFI = new Map<string, { slug: string } & typeof DEFI_SLUGS[string]>();
const ADDRESS_TO_AGENT = new Map<string, { slug: string } & typeof AGENT_SLUGS[string]>();

// Populate reverse lookups (use the first slug for each address)
const seenDefiAddrs = new Set<string>();
for (const [slug, info] of Object.entries(DEFI_SLUGS)) {
  const addrLower = info.address.toLowerCase();
  if (!seenDefiAddrs.has(addrLower)) {
    ADDRESS_TO_DEFI.set(addrLower, { slug, ...info });
    seenDefiAddrs.add(addrLower);
  }
}

const seenAgentAddrs = new Set<string>();
for (const [slug, info] of Object.entries(AGENT_SLUGS)) {
  const addrLower = info.address.toLowerCase();
  if (!seenAgentAddrs.has(addrLower)) {
    ADDRESS_TO_AGENT.set(addrLower, { slug, ...info });
    seenAgentAddrs.add(addrLower);
  }
}

// --- Public API ---

/**
 * Resolve a slug or address to a full entity.
 *
 * @param input - Slug (e.g. "usdc") or address (e.g. "0x833589...")
 * @param typeHint - Optional hint: "defi" or "agent" to narrow search
 * @returns ResolvedEntity or null if not found
 */
export function resolveSlug(
  input: string,
  typeHint?: EntityType
): ResolvedEntity | null {
  const normalized = input.toLowerCase().trim();

  // Try as address first (handle both checksummed and non-checksummed)
  const isAddr = isAddress(input) || (input.startsWith("0x") && isAddress(normalized));
  if (isAddr) {
    const checksummed = getAddress(normalized);
    const addrLower = checksummed.toLowerCase();

    // Check DeFi
    if (!typeHint || !["agent"].includes(typeHint)) {
      const defi = ADDRESS_TO_DEFI.get(addrLower);
      if (defi) {
        return {
          address: checksummed,
          slug: defi.slug,
          name: defi.name,
          type: "defi",
          category: defi.category,
          chainId: defi.chainId,
          auditedBy: defi.auditedBy,
        };
      }
    }

    // Check Agent
    if (!typeHint || typeHint === "agent") {
      const agent = ADDRESS_TO_AGENT.get(addrLower);
      if (agent) {
        return {
          address: checksummed,
          slug: agent.slug,
          name: agent.name,
          type: "agent",
          category: agent.category,
          chainId: agent.chainId,
        };
      }
    }

    // Unknown address
    return null;
  }

  // Try as slug
  // Check DeFi slugs
  if (!typeHint || !["agent"].includes(typeHint)) {
    const defi = DEFI_SLUGS[normalized];
    if (defi) {
      return {
        address: defi.address,
        slug: normalized,
        name: defi.name,
        type: "defi",
        category: defi.category,
        chainId: defi.chainId,
        auditedBy: defi.auditedBy,
      };
    }
  }

  // Check Agent slugs
  if (!typeHint || typeHint === "agent") {
    const agent = AGENT_SLUGS[normalized];
    if (agent) {
      return {
        address: agent.address,
        slug: normalized,
        name: agent.name,
        type: "agent",
        category: agent.category,
        chainId: agent.chainId,
      };
    }
  }

  return null;
}

/**
 * Get all known entities of a given type.
 */
export function getAllEntities(type?: EntityType): ResolvedEntity[] {
  const results: ResolvedEntity[] = [];

  if (!type || type === "defi" || type === "memecoin" || type === "stablecoin") {
    for (const [slug, info] of Object.entries(DEFI_SLUGS)) {
      // Skip aliases (only include entries where this is the first slug for the address)
      const addrLower = info.address.toLowerCase();
      const canonical = ADDRESS_TO_DEFI.get(addrLower);
      if (canonical && canonical.slug === slug) {
        results.push({
          address: info.address,
          slug,
          name: info.name,
          type: "defi",
          category: info.category, chainId: info.chainId,
          auditedBy: info.auditedBy,
        });
      }
    }
  }

  if (!type || type === "agent") {
    for (const [slug, info] of Object.entries(AGENT_SLUGS)) {
      const addrLower = info.address.toLowerCase();
      const canonical = ADDRESS_TO_AGENT.get(addrLower);
      if (canonical && canonical.slug === slug) {
        results.push({
          address: info.address,
          slug,
          name: info.name,
          type: "agent",
          category: info.category, chainId: info.chainId,
        });
      }
    }
  }

  return results;
}

/**
 * Get the known protocols map for use by interaction discovery.
 * Returns a Map<address, {name, category}> for all known entities.
 */
export function getKnownProtocolsMap(): Map<
  string,
  { name: string; category: string; chainId: number }
> {
  const map = new Map<string, { name: string; category: string; chainId: number }>();

  for (const info of Array.from(ADDRESS_TO_DEFI.values())) {
    map.set(info.address, { name: info.name, category: info.category, chainId: info.chainId });
  }
  for (const info of Array.from(ADDRESS_TO_AGENT.values())) {
    map.set(info.address, { name: info.name, category: info.category, chainId: info.chainId });
  }

  return map;
}
