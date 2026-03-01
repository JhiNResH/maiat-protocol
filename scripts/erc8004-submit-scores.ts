/**
 * scripts/erc8004-submit-scores.ts
 *
 * ERC-8004 Reputation Registry — Submit ACP Trust Scores
 * ======================================================
 * Reads all agents from Supabase agent_scores table,
 * resolves their ERC-8004 agentId via IdentityRegistry,
 * then submits trust scores as feedback to ReputationRegistry.
 *
 * Usage:
 *   npx tsx scripts/erc8004-submit-scores.ts           # submit all
 *   npx tsx scripts/erc8004-submit-scores.ts --dry-run # preview only
 */

import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { PrismaClient } from "@prisma/client";

// ─── Config ───────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");

const IDENTITY_REGISTRY   = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address;
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address;

// IdentityRegistry deployment block (verified on-chain — do NOT scan from 0)
const DEPLOY_BLOCK = 41_663_783n;
const CHUNK        = 9_999n;

const TENDERLY_RPC  = "https://base.gateway.tenderly.co";
const BASE_RPC      = "https://mainnet.base.org";

// ERC-8004 Registered event
const REGISTERED_EVENT = parseAbiItem(
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)"
);

// ABI for submitFeedback
const REPUTATION_REGISTRY_ABI = [
  {
    name: "submitFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId",       type: "uint256" },
      { name: "value",         type: "int128"  },
      { name: "valueDecimals", type: "uint8"   },
      { name: "tag1",          type: "string"  },
      { name: "tag2",          type: "string"  },
      { name: "endpoint",      type: "string"  },
      { name: "fileURI",       type: "string"  },
      { name: "fileHash",      type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const TX_DELAY_MS = 200; // 200ms between txs to avoid nonce issues

// ─── Batch Owner Map ──────────────────────────────────────────────────────────

/**
 * Pre-fetch ALL Registered events from the IdentityRegistry and build an
 * owner→agentId map.  This allows O(1) per-agent lookup instead of scanning
 * 110 chunks per agent.
 */
async function buildOwnerMap(): Promise<Map<string, bigint>> {
  const map = new Map<string, bigint>();

  const tryFetch = async (rpc: string): Promise<Map<string, bigint>> => {
    const client = createPublicClient({ chain: base, transport: http(rpc) });
    const latest = await client.getBlockNumber();
    console.log(`   ↳ RPC: ${rpc.replace("https://", "")} (latest: ${latest.toLocaleString()})`);

    for (let from = DEPLOY_BLOCK; from <= latest; from += CHUNK) {
      const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
      const logs = await client.getLogs({
        address: IDENTITY_REGISTRY,
        event: REGISTERED_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      for (const log of logs) {
        if (log.args.owner && log.args.agentId !== undefined) {
          map.set(log.args.owner.toLowerCase(), log.args.agentId);
        }
      }
    }
    return map;
  };

  for (const rpc of [TENDERLY_RPC, BASE_RPC]) {
    try {
      return await tryFetch(rpc);
    } catch (e) {
      console.warn(`   ⚠️  ${rpc.replace("https://", "")} failed: ${(e as Error).message?.slice(0, 60)}`);
    }
  }
  console.warn("⚠️  All RPCs failed — ERC-8004 lookup disabled; all agents will be skipped.");
  return map;
}

// ─── Prisma ──────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

interface AgentScoreRow {
  walletAddress: string;
  trustScore: number;
  totalJobs: number;
  completionRate: number;
  paymentRate: number;
  rawMetrics: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Build the per-agent endpoint URL for ERC-8004 feedback metadata. */
function buildEndpoint(walletAddress: string): string {
  return `https://maiat-protocol.vercel.app/api/v1/agent/${walletAddress}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌐 ERC-8004 Reputation Registry — Submit ACP Trust Scores");
  console.log(`   Registry: ${REPUTATION_REGISTRY}`);
  console.log(`   Chain: Base Mainnet (8453)`);
  if (DRY_RUN) console.log("   ⚠️  DRY RUN — no transactions will be sent\n");
  else console.log("   🔴 LIVE MODE — transactions WILL be sent\n");

  // 1. Read agents from Supabase
  console.log("📦 Loading agents from Supabase...");
  // trustScore is NOT nullable in the schema (Int, no `?`)
  // so no where-filter needed; just sort descending
  const agents: AgentScoreRow[] = await (prisma as any).agentScore.findMany({
    orderBy: { trustScore: "desc" },
  });

  console.log(`   Found ${agents.length} agents with trust scores\n`);

  if (agents.length === 0) {
    console.log("❌ No agents found. Run acp-indexer first.");
    await prisma.$disconnect();
    return;
  }

  // 2. Pre-build owner→agentId map (single scan, all chunks)
  console.log("⛓️  Building ERC-8004 owner map (scanning IdentityRegistry)...");
  const ownerMap = await buildOwnerMap();
  console.log(`   Registered agents on ERC-8004: ${ownerMap.size}\n`);

  // 3. Setup wallet (only needed for live mode)
  let writeContractFn: ((args: {
    agentId: bigint;
    value: bigint;
    endpoint: string;
  }) => Promise<`0x${string}`>) | null = null;

  let signerAddress = "";

  if (!DRY_RUN) {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("PRIVATE_KEY not set in .env");

    const normalized = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(normalized as `0x${string}`);
    signerAddress = account.address;

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(BASE_RPC),
    });

    console.log(`🔑 Signer: ${signerAddress}\n`);

    writeContractFn = ({ agentId, value, endpoint }) =>
      walletClient.writeContract({
        address: REPUTATION_REGISTRY,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "submitFeedback",
        args: [
          agentId,
          value as unknown as bigint,          // int128
          2,                                    // valueDecimals
          "acp-trust-score",
          "maiat-v1",
          endpoint,
          "",
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        ],
        chain: base,
      });
  }

  // 3. Process each agent
  let submitted = 0;
  let skipped = 0;
  let failed = 0;

  console.log("─────────────────────────────────────────────────────────────────────");
  console.log("  Wallet                                       Score    AgentId  Status");
  console.log("─────────────────────────────────────────────────────────────────────");

  for (const agent of agents) {
    const { walletAddress, trustScore } = agent;
    const shortAddr = `${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}`;

    // Resolve ERC-8004 agentId via pre-built map (O(1))
    const agentId: bigint | null = ownerMap.get(walletAddress.toLowerCase()) ?? null;

    if (agentId === null) {
      console.log(
        `  ${shortAddr.padEnd(46)} ${String(trustScore).padStart(3)}/100  —          ⏭  not on ERC-8004`
      );
      skipped++;
      continue;
    }

    const endpoint = buildEndpoint(walletAddress);
    // trust_score * 100 (e.g. 85 → 8500)
    const value = BigInt(trustScore * 100);

    if (DRY_RUN) {
      console.log(
        `  ${shortAddr.padEnd(46)} ${String(trustScore).padStart(3)}/100  ${String(agentId).padStart(9)}  ✓ would submit`
      );
      submitted++;
      continue;
    }

    // Live: send tx
    try {
      const hash = await writeContractFn!({ agentId, value, endpoint });
      console.log(
        `  ${shortAddr.padEnd(46)} ${String(trustScore).padStart(3)}/100  ${String(agentId).padStart(9)}  ✅ ${hash.slice(0, 20)}...`
      );
      submitted++;
      await sleep(TX_DELAY_MS);
    } catch (e) {
      const msg = ((e as Error).message ?? "unknown").slice(0, 42);
      console.log(
        `  ${shortAddr.padEnd(46)} ${String(trustScore).padStart(3)}/100  ${String(agentId).padStart(9)}  ❌ ${msg}`
      );
      failed++;
    }
  }

  // 4. Summary
  console.log("─────────────────────────────────────────────────────────────────────");
  console.log(`\n📊 Summary:`);
  console.log(`   Total agents:  ${agents.length}`);
  console.log(`   ${DRY_RUN ? "Would submit" : "Submitted"}:   ${submitted}`);
  console.log(`   Skipped:       ${skipped}  (not registered on ERC-8004)`);
  console.log(`   Failed:        ${failed}`);

  if (DRY_RUN) {
    console.log(`\n✅ Dry run complete. Remove --dry-run to send transactions.`);
  } else {
    console.log(`\n✅ Done. ${submitted} feedback records submitted to ERC-8004.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e);
  prisma.$disconnect().finally(() => process.exit(1));
});
