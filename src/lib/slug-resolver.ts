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

export type EntityType = "defi" | "agent" | "token" | "unknown";

export interface ResolvedEntity {
  address: string;
  slug: string;
  name: string;
  type: EntityType;
  category: string;
  auditedBy?: string[];
}

// --- Known DeFi Protocols (Base Mainnet) ---

const DEFI_SLUGS: Record<string, Omit<ResolvedEntity, "slug" | "type">> = {
  usdc: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    name: "USDC",
    category: "STABLECOIN",
    auditedBy: ["Deloitte"],
  },
  weth: {
    address: "0x4200000000000000000000000000000000000006",
    name: "WETH",
    category: "INFRASTRUCTURE",
  },
  dai: {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    name: "DAI",
    category: "STABLECOIN",
    auditedBy: ["Trail of Bits"],
  },
  usdbc: {
    address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    name: "USDbC",
    category: "STABLECOIN",
  },
  "uniswap-v3-router": {
    address: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    name: "Uniswap V3 Router",
    category: "DEX",
    auditedBy: ["Trail of Bits", "ABDK"],
  },
  "uniswap-universal-router": {
    address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    name: "Uniswap Universal Router",
    category: "DEX",
    auditedBy: ["Trail of Bits"],
  },
  uniswap: {
    address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    name: "Uniswap Universal Router",
    category: "DEX",
    auditedBy: ["Trail of Bits"],
  },
  aerodrome: {
    address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
    name: "Aerodrome Router",
    category: "DEX",
    auditedBy: ["Code4rena"],
  },
  "aave-v3": {
    address: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    name: "Aave V3 Pool",
    category: "LENDING",
    auditedBy: ["OpenZeppelin", "Trail of Bits", "Sigma Prime"],
  },
  aave: {
    address: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    name: "Aave V3 Pool",
    category: "LENDING",
    auditedBy: ["OpenZeppelin", "Trail of Bits", "Sigma Prime"],
  },
  "compound-v3": {
    address: "0xb125E6687d4313864e53df431d5425969c15Eb2F",
    name: "Compound V3 USDC",
    category: "LENDING",
    auditedBy: ["OpenZeppelin", "ChainSecurity"],
  },
  compound: {
    address: "0xb125E6687d4313864e53df431d5425969c15Eb2F",
    name: "Compound V3 USDC",
    category: "LENDING",
    auditedBy: ["OpenZeppelin", "ChainSecurity"],
  },
  morpho: {
    address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    name: "Morpho Blue",
    category: "LENDING",
    auditedBy: ["Spearbit", "Cantina"],
  },
  "chainlink-eth-usd": {
    address: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    name: "Chainlink ETH/USD Feed",
    category: "ORACLE",
    auditedBy: ["Trail of Bits"],
  },
  chainlink: {
    address: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    name: "Chainlink ETH/USD Feed",
    category: "ORACLE",
    auditedBy: ["Trail of Bits"],
  },
  "base-bridge": {
    address: "0x4200000000000000000000000000000000000010",
    name: "L2StandardBridge",
    category: "BRIDGE",
    auditedBy: ["Sherlock", "OpenZeppelin"],
  },
  stargate: {
    address: "0x45f1A95A4D3f3836523F5c83673c797f4d4d263B",
    name: "Stargate Router",
    category: "BRIDGE",
    auditedBy: ["Zellic", "Quantstamp"],
  },
};

// --- Known AI Agents (Base Mainnet) ---

const AGENT_SLUGS: Record<string, Omit<ResolvedEntity, "slug" | "type">> = {
  virtuals: {
    address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
    name: "Virtuals Protocol (VIRTUAL)",
    category: "AGENT_PLATFORM",
  },
  virtual: {
    address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b",
    name: "Virtuals Protocol (VIRTUAL)",
    category: "AGENT_PLATFORM",
  },
  aixbt: {
    address: "0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825",
    name: "AIXBT by Virtuals",
    category: "AGENT",
  },
  luna: {
    address: "0x55cd6469f597452b5a7536e2cd98fde4c1247ee4",
    name: "Luna by Virtuals",
    category: "AGENT",
  },
  vaderai: {
    address: "0x731814e491571a2e9ee3c5b1f7f3b962ee8f4870",
    name: "VaderAI by Virtuals",
    category: "AGENT",
  },
  freysa: {
    address: "0x3e466dad6695879fd783e2bfcb98e16ce15a3caf",
    name: "Freysa AI",
    category: "AGENT",
  },
  sekoia: {
    address: "0x1185cb5122edad199bdbc0cbd7a0457e448f23c7",
    name: "Sekoia by Virtuals",
    category: "AGENT",
  },
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
    if (!typeHint || typeHint === "defi" || typeHint === "token") {
      const defi = ADDRESS_TO_DEFI.get(addrLower);
      if (defi) {
        return {
          address: checksummed,
          slug: defi.slug,
          name: defi.name,
          type: "defi",
          category: defi.category,
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
        };
      }
    }

    // Unknown address
    return null;
  }

  // Try as slug
  // Check DeFi slugs
  if (!typeHint || typeHint === "defi" || typeHint === "token") {
    const defi = DEFI_SLUGS[normalized];
    if (defi) {
      return {
        address: defi.address,
        slug: normalized,
        name: defi.name,
        type: "defi",
        category: defi.category,
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

  if (!type || type === "defi" || type === "token") {
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
          category: info.category,
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
          category: info.category,
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
  { name: string; category: string }
> {
  const map = new Map<string, { name: string; category: string }>();

  for (const info of ADDRESS_TO_DEFI.values()) {
    map.set(info.address, { name: info.name, category: info.category });
  }
  for (const info of ADDRESS_TO_AGENT.values()) {
    map.set(info.address, { name: info.name, category: info.category });
  }

  return map;
}
