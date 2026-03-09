/**
 * scripts/register-erc8004.ts
 *
 * ERC-8004 Identity Registry — Register an AI Agent
 * =================================================
 * Builds an ERC-8004 compliant agentURI and registers the Maiat agent
 * (or any specified wallet) on the Base Mainnet IdentityRegistry.
 *
 * Usage:
 *   npx tsx scripts/register-erc8004.ts                      # register Maiat wallet (default)
 *   npx tsx scripts/register-erc8004.ts --dry-run            # preview, no tx
 *   npx tsx scripts/register-erc8004.ts --wallet 0xABC...   # override target wallet
 */

import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  formatEther,
  type Address,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ─── Config ───────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");

// Parse --wallet flag
const walletFlagIdx = process.argv.indexOf("--wallet");
const DEFAULT_MAIAT_WALLET = "0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D" as Address;
const TARGET_WALLET: string =
  walletFlagIdx !== -1 && process.argv[walletFlagIdx + 1]
    ? process.argv[walletFlagIdx + 1]
    : DEFAULT_MAIAT_WALLET;

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address;
const DEPLOY_BLOCK = 41_663_783n;
const CHUNK_SIZE = 9_999n;

/** 0.0005 ETH in wei — minimum balance before aborting */
const MIN_ETH_BALANCE = 500_000_000_000_000n;

const TENDERLY_RPC = "https://base.gateway.tenderly.co";
const BASE_RPC = "https://mainnet.base.org";
const RPC_URLS = [TENDERLY_RPC, BASE_RPC] as const;

// ─── Maiat Agent Metadata ────────────────────────────────────────────────────

const DEFAULT_NAME = "Maiat";
const DEFAULT_DESCRIPTION =
  "Trust oracle and behavioral reputation layer for the AI agent economy. " +
  "Providing behavioral auditing, reputation attestations via EAS, and real-time threat protection.";
const DEFAULT_IMAGE = "https://app.maiat.io/maiat-logo.png";
const DEFAULT_SERVICES = [
  { name: "web", endpoint: "https://app.maiat.io" },
  { name: "api", endpoint: "https://app.maiat.io/api/v1" },
  { name: "acp", endpoint: "https://acpx.virtuals.io" },
];

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const REGISTERED_EVENT = parseAbiItem(
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)"
);

const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [],
  },
] as const;

// ─── Pure Helpers (exported for testing) ─────────────────────────────────────

/**
 * Build an ERC-8004 agentURI as a data URI (base64-encoded JSON).
 * Conforms to the EIP-8004 registration-v1 schema.
 */
export function buildAgentURI(
  name: string = DEFAULT_NAME,
  description: string = DEFAULT_DESCRIPTION,
  image: string = DEFAULT_IMAGE,
  services: { name: string; endpoint: string }[] = DEFAULT_SERVICES
): string {
  const json = JSON.stringify({
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name,
    description,
    image,
    services,
  });
  const encoded = Buffer.from(json).toString("base64");
  return `data:application/json;base64,${encoded}`;
}

/**
 * Validate an Ethereum address format (0x + 40 hex chars).
 */
export function isValidAddress(addr: string): addr is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

// ─── RPC Client Factory ───────────────────────────────────────────────────────

export function makePublicClient(rpc: string): PublicClient {
  return createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 15_000 }),
  }) as PublicClient;
}

// ─── Core: Check if already registered ───────────────────────────────────────

/**
 * Scan IdentityRegistry from deploy block to check if walletAddress is registered.
 * Returns { registered: true, agentId } if found, else { registered: false }.
 */
export async function isAlreadyRegistered(
  walletAddress: string,
  client: PublicClient
): Promise<{ registered: boolean; agentId?: bigint }> {
  const normalized = walletAddress.toLowerCase();

  let latestBlock: bigint;
  try {
    latestBlock = await client.getBlockNumber();
  } catch {
    latestBlock = 43_000_000n; // safe upper bound
  }

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
      if (log.args.owner?.toLowerCase() === normalized) {
        return { registered: true, agentId: log.args.agentId };
      }
    }
  }

  return { registered: false };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌐 ERC-8004 Identity Registry — Register AI Agent");
  console.log(`   Registry: ${IDENTITY_REGISTRY}`);
  console.log(`   Chain:    Base Mainnet (8453)`);
  console.log(`   Target:   ${TARGET_WALLET}`);
  if (DRY_RUN) {
    console.log("   ⚠️  DRY RUN — no transactions will be sent\n");
  } else {
    console.log("   🔴 LIVE MODE — transactions WILL be sent\n");
  }

  // ── Validate target wallet ─────────────────────────────────────────────────
  if (!isValidAddress(TARGET_WALLET)) {
    console.error(`❌ Invalid wallet address: ${TARGET_WALLET}`);
    process.exit(1);
  }

  // ── Build agentURI ─────────────────────────────────────────────────────────
  const agentURI = buildAgentURI();
  const preview = agentURI.slice(0, 80);
  console.log("📄 Agent URI (preview):");
  console.log(`   ${preview}...`);
  console.log();

  // ── Setup public client with RPC fallback ──────────────────────────────────
  let publicClient = makePublicClient(RPC_URLS[0]);
  let rpcUsed = RPC_URLS[0];

  for (const rpc of RPC_URLS) {
    try {
      publicClient = makePublicClient(rpc);
      await publicClient.getBlockNumber();
      rpcUsed = rpc;
      break;
    } catch {
      console.warn(`   ⚠️  ${rpc.replace("https://", "")} unavailable, trying next...`);
    }
  }
  console.log(`   ✅ RPC: ${rpcUsed.replace("https://", "")}\n`);

  // ── Check if already registered ────────────────────────────────────────────
  console.log("🔍 Checking if already registered...");
  const { registered, agentId: existingId } = await isAlreadyRegistered(
    TARGET_WALLET,
    publicClient
  );

  if (registered) {
    console.log(
      `⏭  ${TARGET_WALLET} is ALREADY registered — agentId: ${existingId}`
    );
    console.log("   Nothing to do. Exiting.");
    return;
  }
  console.log("   Not yet registered. Proceeding with registration.\n");

  // ── Load private key ───────────────────────────────────────────────────────
  const rawKey = process.env.EAS_DEPLOYER_KEY ?? process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error(
      "❌ No private key found. Set EAS_DEPLOYER_KEY or PRIVATE_KEY in .env"
    );
    process.exit(1);
  }
  const normalized = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  const account = privateKeyToAccount(normalized as `0x${string}`);
  console.log(`🔑 Signer: ${account.address}`);

  // ── Check signer ETH balance ───────────────────────────────────────────────
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`   Balance: ${formatEther(balance)} ETH`);

  if (balance < MIN_ETH_BALANCE) {
    console.error(
      `❌ Insufficient ETH. Need ≥ 0.0005 ETH, have ${formatEther(balance)} ETH`
    );
    process.exit(1);
  }
  console.log("   ✅ Balance OK\n");

  // ── Dry-run exit ───────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log("✅ Dry run complete. Would call:");
    console.log(`   register("${agentURI.slice(0, 60)}...")`);
    console.log(`   on ${IDENTITY_REGISTRY}`);
    console.log(`   from ${account.address}`);
    return;
  }

  // ── Setup wallet client ────────────────────────────────────────────────────
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUsed),
  });

  // ── Submit registration tx ─────────────────────────────────────────────────
  console.log("📡 Submitting registration transaction...");
  const txHash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "register",
    args: [agentURI],
    chain: base,
  });

  console.log(`   ✅ Tx sent: ${txHash}`);
  console.log("   ⏳ Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`   ✅ Confirmed in block: ${receipt.blockNumber}`);

  // ── Parse agentId from Registered event ───────────────────────────────────
  const eventLogs = await publicClient.getLogs({
    address: IDENTITY_REGISTRY,
    event: REGISTERED_EVENT,
    fromBlock: receipt.blockNumber,
    toBlock: receipt.blockNumber,
  });

  const regLog = eventLogs.find((l) => l.transactionHash === txHash);

  if (regLog?.args.agentId !== undefined) {
    console.log(`\n🎉 Registration successful!`);
    console.log(`   agentId: ${regLog.args.agentId}`);
    console.log(`   owner:   ${regLog.args.owner}`);
    console.log(`   tx:      ${txHash}`);
    console.log(`   block:   ${receipt.blockNumber}`);
  } else {
    console.log(`\n✅ Transaction confirmed: ${txHash}`);
    console.log(
      "   ⚠️  agentId not found in event logs — verify on block explorer"
    );
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
