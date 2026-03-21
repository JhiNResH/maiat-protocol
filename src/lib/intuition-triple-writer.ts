/**
 * Intuition Triple Writer
 *
 * Writes Maiat trust scores as Triples to the Intuition knowledge graph.
 * Format: [Agent 0x...] — [maiat-trust-score] — [score:85:proceed]
 *
 * Networks:
 *   Testnet  — Chain ID 13579, INTUITION_NETWORK=testnet
 *   Mainnet  — Chain ID 1155,  INTUITION_NETWORK=mainnet (default)
 *
 * Required env vars:
 *   INTUITION_PRIVATE_KEY  — Maiat treasury wallet private key (hex)
 *   INTUITION_NETWORK      — "testnet" | "mainnet" (default: "testnet")
 */

import {
  createAtomFromString,
  createAtomFromEthereumAccount,
  createTripleStatement,
  findAtomIds,
  findTripleIds,
  intuitionMainnet,
  intuitionTestnet,
  getMultiVaultAddressFromChainId,
} from "@0xintuition/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Chain config ────────────────────────────────────────────────────────────

const NETWORK = process.env.INTUITION_NETWORK === "mainnet" ? "mainnet" : "testnet";
const chain = NETWORK === "mainnet" ? intuitionMainnet : intuitionTestnet;

// Minimum ETH deposit for signal weight (in wei) — 0.001 ETH testnet, 0.0001 mainnet
const SIGNAL_VALUE = NETWORK === "mainnet"
  ? 100_000_000_000_000n   // 0.0001 ETH
  : 1_000_000_000_000_000n; // 0.001 tTRUST

// ─── Client factory ──────────────────────────────────────────────────────────

function getClients() {
  const rawKey = process.env.INTUITION_PRIVATE_KEY;
  if (!rawKey) throw new Error("INTUITION_PRIVATE_KEY env var not set");

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const walletClient = createWalletClient({
    chain,
    transport: http(),
    account,
  });

  const address = getMultiVaultAddressFromChainId(chain.id);

  return { publicClient, walletClient, address };
}

// ─── Verdict helper ──────────────────────────────────────────────────────────

function scoreToVerdict(score: number): "trusted" | "proceed" | "caution" | "avoid" {
  if (score >= 80) return "trusted";
  if (score >= 60) return "proceed";
  if (score >= 40) return "caution";
  return "avoid";
}

// ─── Core triple writer ──────────────────────────────────────────────────────

export interface WriteTripleResult {
  walletAddress: string;
  trustScore: number;
  tripleId: string | null;
  subjectAtomId: string | null;
  predicateAtomId: string | null;
  objectAtomId: string | null;
  txHash: string | null;
  status: "created" | "existing" | "failed";
  error?: string;
}

export async function writeTrustTriple(
  walletAddress: string,
  trustScore: number
): Promise<WriteTripleResult> {
  const base: WriteTripleResult = {
    walletAddress,
    trustScore,
    tripleId: null,
    subjectAtomId: null,
    predicateAtomId: null,
    objectAtomId: null,
    txHash: null,
    status: "failed",
  };

  try {
    const clients = getClients();
    const verdict = scoreToVerdict(trustScore);
    const objectStr = `score:${trustScore}:${verdict}`;

    // ── Step 1: Subject atom — the agent's Ethereum address ──────────────────
    let subjectAtomId: string;
    try {
      const subjectResult = await createAtomFromEthereumAccount(clients, {
        address: walletAddress as `0x${string}`,
        chainId: 8453, // Base mainnet (where the agent lives)
      });
      subjectAtomId = subjectResult.state.termId;
      base.txHash = subjectResult.transactionHash;
    } catch (e: unknown) {
      // May already exist — try string fallback
      const subjectResult = await createAtomFromString(clients, walletAddress);
      subjectAtomId = subjectResult.state.termId;
      base.txHash = subjectResult.transactionHash;
    }
    base.subjectAtomId = subjectAtomId;

    // ── Step 2: Predicate atom — "maiat-trust-score" ─────────────────────────
    const predicateResult = await createAtomFromString(clients, "maiat-trust-score");
    const predicateAtomId = predicateResult.state.termId;
    base.predicateAtomId = predicateAtomId;

    // ── Step 3: Object atom — "score:85:proceed" ─────────────────────────────
    const objectResult = await createAtomFromString(clients, objectStr);
    const objectAtomId = objectResult.state.termId;
    base.objectAtomId = objectAtomId;

    // ── Step 4: Check if triple already exists ────────────────────────────────
    const existingTripleIds = await findTripleIds([
      {
        subject: subjectAtomId,
        predicate: predicateAtomId,
        object: objectAtomId,
      },
    ]);

    if (existingTripleIds && existingTripleIds.length > 0) {
      base.tripleId = existingTripleIds[0];
      base.status = "existing";
      return base;
    }

    // ── Step 5: Create the triple ─────────────────────────────────────────────
    const tripleResult = await createTripleStatement(clients, {
      args: [subjectAtomId, predicateAtomId, objectAtomId],
      value: SIGNAL_VALUE,
    });

    base.tripleId = tripleResult.state?.termId ?? null;
    base.txHash = tripleResult.transactionHash;
    base.status = "created";

    return base;
  } catch (err: unknown) {
    base.status = "failed";
    base.error = err instanceof Error ? err.message : String(err);
    return base;
  }
}

// ─── Batch writer ─────────────────────────────────────────────────────────────

export interface BatchWriteResult {
  total: number;
  created: number;
  existing: number;
  failed: number;
  results: WriteTripleResult[];
  network: string;
  durationMs: number;
}

export async function batchWriteTrustTriples(
  agents: { walletAddress: string; trustScore: number }[],
  opts: { dryRun?: boolean } = {}
): Promise<BatchWriteResult> {
  const start = Date.now();
  const results: WriteTripleResult[] = [];

  if (opts.dryRun) {
    // Dry run: return simulated results without touching chain
    for (const agent of agents) {
      results.push({
        walletAddress: agent.walletAddress,
        trustScore: agent.trustScore,
        tripleId: null,
        subjectAtomId: null,
        predicateAtomId: null,
        objectAtomId: null,
        txHash: null,
        status: "created",
      });
    }
    return {
      total: agents.length,
      created: agents.length,
      existing: 0,
      failed: 0,
      results,
      network: NETWORK,
      durationMs: Date.now() - start,
    };
  }

  // Process sequentially to avoid nonce conflicts
  for (const agent of agents) {
    const result = await writeTrustTriple(agent.walletAddress, agent.trustScore);
    results.push(result);

    // Small delay between txns to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  const created = results.filter((r) => r.status === "created").length;
  const existing = results.filter((r) => r.status === "existing").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return {
    total: agents.length,
    created,
    existing,
    failed,
    results,
    network: NETWORK,
    durationMs: Date.now() - start,
  };
}
