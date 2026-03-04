/**
 * scripts/erc8004-lookup.ts
 *
 * ERC-8004 Identity Registry — Wallet → AgentId Lookup
 * =====================================================
 * Scans Registered events from the Base Mainnet IdentityRegistry
 * to find the ERC-8004 agentId for a given wallet address.
 *
 * The Base RPC limits eth_getLogs to 10,000 blocks per query.
 * We chunk from the contract's known deployment block (41,663,783)
 * so the scan completes in ~110 chunks instead of millions.
 *
 * Usage (standalone):
 *   npx tsx scripts/erc8004-lookup.ts 0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D
 *
 * Import (from other scripts):
 *   import { lookupAgentId } from "./erc8004-lookup"
 */

import "dotenv/config";
import { fileURLToPath } from "url";
import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { base } from "viem/chains";

// ─── Constants ────────────────────────────────────────────────────────────────

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address;

// Contract was deployed at block 41,663,783 (verified via binary search on Base mainnet).
// Starting from here avoids scanning millions of empty blocks.
const DEPLOYMENT_BLOCK = 41_663_783n;

// Base RPC limits eth_getLogs to 10,000 blocks per request.
const CHUNK_SIZE = 9_999n;

// RPC fallback list (in priority order).
// Tenderly public gateway is the most reliable for getLogs with 9999-block ranges.
// mainnet.base.org is the canonical fallback but can have 503 spikes.
const BASE_RPCS = [
  "https://base.gateway.tenderly.co",
  "https://mainnet.base.org",
] as const;

// ERC-8004 IdentityRegistry: Registered(uint256 indexed agentId, string agentURI, address indexed owner)
const REGISTERED_EVENT = parseAbiItem(
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)"
);

// ─── Clients (multi-RPC with fallback) ────────────────────────────────────────

function makeClient(rpcUrl: string) {
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

// ─── Core Function ────────────────────────────────────────────────────────────

/**
 * Look up the ERC-8004 agentId for a given wallet address.
 *
 * Scans Registered events in 9,999-block chunks starting from the
 * contract's deployment block (41,663,783) to work within Base RPC's
 * 10,000-block getLogs limit.  Falls back across BASE_RPCS on 503/rate-limit.
 *
 * @param walletAddress - The owner wallet address to look up
 * @returns agentId as bigint, or null if not registered
 */
export async function lookupAgentId(walletAddress: string): Promise<bigint | null> {
  const normalized = walletAddress.toLowerCase();
  const ownerArg = walletAddress as Address;

  // Try each RPC until we get a usable client
  let client = makeClient(BASE_RPCS[0]);
  let latestBlock: bigint;

  for (const rpc of BASE_RPCS) {
    try {
      client = makeClient(rpc);
      latestBlock = await client.getBlockNumber();
      break;
    } catch {
      // try next
    }
  }
  latestBlock = latestBlock! ?? BigInt(43_000_000); // safe upper bound

  for (let from = DEPLOYMENT_BLOCK; from <= latestBlock; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE - 1n > latestBlock ? latestBlock : from + CHUNK_SIZE - 1n;

    let logs;
    // Try each RPC for this chunk
    let lastError: unknown;
    for (const rpc of BASE_RPCS) {
      try {
        const c = makeClient(rpc);
        try {
          logs = await c.getLogs({
            address: IDENTITY_REGISTRY,
            event: REGISTERED_EVENT,
            args: { owner: ownerArg },
            fromBlock: from,
            toBlock: to,
          });
        } catch {
          // indexed-topic filter unsupported — fall back to unfiltered scan
          const allLogs = await c.getLogs({
            address: IDENTITY_REGISTRY,
            event: REGISTERED_EVENT,
            fromBlock: from,
            toBlock: to,
          });
          logs = allLogs.filter((l) => l.args.owner?.toLowerCase() === normalized);
        }
        lastError = null;
        break; // success
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError) throw lastError;

    if (logs && logs.length > 0) {
      return logs[logs.length - 1].args.agentId ?? null;
    }
  }

  return null;
}

// ─── Standalone Main ──────────────────────────────────────────────────────────

async function main() {
  const walletArg = process.argv[2];

  if (!walletArg) {
    console.error("Usage: npx tsx scripts/erc8004-lookup.ts <walletAddress>");
    console.error(
      "Example: npx tsx scripts/erc8004-lookup.ts 0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D"
    );
    process.exit(1);
  }

  console.log(`🔍 ERC-8004 Identity Lookup`);
  console.log(`   Registry:        ${IDENTITY_REGISTRY}`);
  console.log(`   Chain:           Base Mainnet (8453)`);
  console.log(`   Deployment from: block ${DEPLOYMENT_BLOCK.toLocaleString()}`);
  console.log(`   Wallet:          ${walletArg}\n`);

  const agentId = await lookupAgentId(walletArg);

  if (agentId === null) {
    console.log(`❌ No ERC-8004 registration found for ${walletArg}`);
  } else {
    console.log(`✅ agentId: ${agentId}`);
    console.log(`   Owner:   ${walletArg}`);
  }
}

// Only run main() when executed directly (not when imported)
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  });
}
