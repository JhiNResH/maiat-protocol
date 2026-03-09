/**
 * scripts/check-erc8004.ts
 *
 * ERC-8004 Identity & Reputation Registry — Full Audit
 * ====================================================
 * Scans IdentityRegistry for all registrations and checks reputation scores.
 * No private key required (read-only).
 *
 * Usage:
 *   npx tsx scripts/check-erc8004.ts                      # all registered agents
 *   npx tsx scripts/check-erc8004.ts --address 0xABC...  # filter by wallet
 */

import "dotenv/config";
import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { base } from "viem/chains";

// ─── Config ───────────────────────────────────────────────────────────────────

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address;
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address;
const DEPLOY_BLOCK = 41_663_783n;
const CHUNK_SIZE = 9_999n;

const MAIAT_WALLET = "0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D" as Address;
const EAS_DEPLOYER = "0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9" as Address;

const TENDERLY_RPC = "https://base.gateway.tenderly.co";
const BASE_RPC = "https://mainnet.base.org";
const RPC_URLS = [TENDERLY_RPC, BASE_RPC] as const;

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const REGISTERED_EVENT = parseAbiItem(
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)"
);

const REPUTATION_ABI = [
  {
    name: "getReputation",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "count", type: "uint256" },
      { name: "value", type: "int256" },
    ],
  },
  {
    name: "getReputationNormalized",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── CLI flags ────────────────────────────────────────────────────────────────

const addrFlagIdx = process.argv.indexOf("--address");
const FILTER_ADDRESS =
  addrFlagIdx !== -1 && process.argv[addrFlagIdx + 1]
    ? process.argv[addrFlagIdx + 1].toLowerCase()
    : null;

// ─── Client Factory ───────────────────────────────────────────────────────────

function makeClient(rpc: string) {
  return createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 15_000 }),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Decode agent name from agentURI.
 * Handles data:application/json;base64,... or plain HTTPS URLs.
 * Returns null on failure.
 */
export function parseNameFromURI(agentURI: string): string | null {
  try {
    if (agentURI.startsWith("data:application/json;base64,")) {
      const b64 = agentURI.replace("data:application/json;base64,", "");
      const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
      return (json.name as string) ?? null;
    }
    // Plain HTTPS URL — return truncated form
    if (agentURI.startsWith("https://")) {
      return `<${agentURI.slice(8, 50)}>`;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegistrationEntry {
  agentId: bigint;
  owner: string;
  agentURI: string;
  name: string | null;
  blockNumber: bigint;
  txHash: string;
}

interface ReputationData {
  count: number;
  normalizedScore: number;
}

// ─── Scan registrations ───────────────────────────────────────────────────────

async function scanAllRegistrations(
  client: ReturnType<typeof makeClient>
): Promise<RegistrationEntry[]> {
  const entries: RegistrationEntry[] = [];
  const latestBlock = await client.getBlockNumber();

  const totalBlocks = latestBlock - DEPLOY_BLOCK;
  const totalChunks = Number(totalBlocks / CHUNK_SIZE) + 1;

  console.log(
    `   Scanning from block ${DEPLOY_BLOCK.toLocaleString()} → ${latestBlock.toLocaleString()} (~${totalChunks} chunks)...`
  );

  let chunksDone = 0;
  const progressEvery = Math.max(1, Math.floor(totalChunks / 20)); // ~20 dots max

  for (let from = DEPLOY_BLOCK; from <= latestBlock; from += CHUNK_SIZE) {
    const to =
      from + CHUNK_SIZE - 1n > latestBlock ? latestBlock : from + CHUNK_SIZE - 1n;

    const logs = await client.getLogs({
      address: IDENTITY_REGISTRY,
      event: REGISTERED_EVENT,
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      if (
        !log.args.owner ||
        log.args.agentId === undefined ||
        !log.args.agentURI
      ) {
        continue;
      }
      entries.push({
        agentId: log.args.agentId,
        owner: log.args.owner.toLowerCase(),
        agentURI: log.args.agentURI,
        name: parseNameFromURI(log.args.agentURI),
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? "",
      });
    }

    chunksDone++;
    if (chunksDone % progressEvery === 0) {
      process.stdout.write(".");
    }
  }

  process.stdout.write("\n");
  return entries;
}

// ─── Reputation lookup ────────────────────────────────────────────────────────

async function getReputation(
  client: ReturnType<typeof makeClient>,
  agentId: bigint
): Promise<ReputationData | null> {
  try {
    const [rep, normalized] = await Promise.all([
      client.readContract({
        address: REPUTATION_REGISTRY,
        abi: REPUTATION_ABI,
        functionName: "getReputation",
        args: [agentId],
      }),
      client.readContract({
        address: REPUTATION_REGISTRY,
        abi: REPUTATION_ABI,
        functionName: "getReputationNormalized",
        args: [agentId],
      }),
    ]);

    const [count] = rep as [bigint, bigint];
    return {
      count: Number(count),
      normalizedScore: Number(normalized as bigint),
    };
  } catch {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 ERC-8004 Identity & Reputation Registry — Audit");
  console.log(`   IdentityRegistry:   ${IDENTITY_REGISTRY}`);
  console.log(`   ReputationRegistry: ${REPUTATION_REGISTRY}`);
  console.log(`   Chain:              Base Mainnet (8453)`);
  if (FILTER_ADDRESS) console.log(`   Filter:             ${FILTER_ADDRESS}`);
  console.log();

  // ── Setup client with RPC fallback ─────────────────────────────────────────
  let client = makeClient(RPC_URLS[0]);
  let rpcUsed = RPC_URLS[0];

  for (const rpc of RPC_URLS) {
    try {
      client = makeClient(rpc);
      await client.getBlockNumber();
      rpcUsed = rpc;
      break;
    } catch {
      console.warn(`   ⚠️  ${rpc.replace("https://", "")} unavailable, trying next...`);
    }
  }
  console.log(`   ✅ RPC: ${rpcUsed.replace("https://", "")}\n`);

  // ── Scan all registrations ─────────────────────────────────────────────────
  console.log("⛓️  Scanning IdentityRegistry...");
  let entries = await scanAllRegistrations(client);
  console.log(`   ✅ Found ${entries.length} total registration(s)\n`);

  // ── Apply address filter ───────────────────────────────────────────────────
  if (FILTER_ADDRESS) {
    entries = entries.filter((e) => e.owner === FILTER_ADDRESS);
    console.log(`   After filter: ${entries.length} registration(s)\n`);
  }

  // ── Print results ──────────────────────────────────────────────────────────
  if (entries.length === 0) {
    console.log("❌ No registrations found.");
  } else {
    const SEP =
      "──────────────────────────────────────────────────────────────────────────────────";
    console.log(SEP);
    console.log(
      "  AgentId  Owner                                       Name                   Block"
    );
    console.log(SEP);

    for (const entry of entries) {
      const rep = await getReputation(client, entry.agentId);
      const shortOwner = `${entry.owner.slice(0, 10)}...${entry.owner.slice(-6)}`;
      const name = (entry.name ?? "unknown").slice(0, 22).padEnd(22);
      const repStr = rep
        ? `feedbacks: ${rep.count}, score: ${rep.normalizedScore}`
        : "no reputation data";

      console.log(
        `  ${String(entry.agentId).padStart(7)}  ${shortOwner.padEnd(44)} ${name}  ${entry.blockNumber}`
      );
      console.log(`           tx:         ${entry.txHash}`);
      console.log(`           reputation: ${repStr}`);
      console.log();
    }
    console.log(SEP);
  }

  // ── Special wallet status ──────────────────────────────────────────────────
  console.log("\n📋 Special Wallet Status:");

  const checkWallet = (label: string, addr: Address) => {
    const lower = addr.toLowerCase();
    const entry = entries.find((e) => e.owner === lower);
    const shortAddr = `${addr.slice(0, 10)}...${addr.slice(-6)}`;
    if (entry) {
      console.log(
        `   ✅ ${label} (${shortAddr}): registered — agentId=${entry.agentId}`
      );
    } else {
      console.log(`   ❌ ${label} (${shortAddr}): NOT registered on ERC-8004`);
    }
  };

  checkWallet("Maiat wallet    ", MAIAT_WALLET);
  checkWallet("EAS Deployer    ", EAS_DEPLOYER);

  console.log(
    `\n✅ Audit complete. ${entries.length} agent(s) registered on ERC-8004.`
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
