/**
 * scripts/erc8004-register.ts
 * 
 * Register Maiat as an ERC-8004 agent on Base mainnet
 * Uses EAS deployer wallet (has Base mainnet ETH)
 * 
 * Run: npx tsx scripts/erc8004-register.ts
 */

import "dotenv/config";
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

// ERC-8004 IdentityRegistry ABI (ERC-721 based)
const REGISTRY_ABI = parseAbi([
  "function register(string agentURI) external returns (uint256)",
  "function agentOf(address owner) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

// Maiat agent metadata URI
const MAIAT_URI = JSON.stringify({
  name: "Maiat",
  description: "Trust layer for agentic commerce — behavioral trust scoring for AI agents",
  image: "https://app.maiat.io/maiat-logo.jpg",
  external_url: "https://app.maiat.io",
  properties: {
    type: "trust_oracle",
    chain: "base",
    offerings: ["agent_trust", "agent_reputation", "token_check", "token_forensics", "trust_swap"],
    website: "https://app.maiat.io",
    twitter: "@0xmaiat",
    acp_id: 18281,
  },
});

async function main() {
  const privateKey = process.env.EAS_DEPLOYER_KEY;
  if (!privateKey) throw new Error("EAS_DEPLOYER_KEY not set in .env");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`🔑 Registering from: ${account.address}`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  // Check if already registered
  try {
    const existingAgentId = await publicClient.readContract({
      address: IDENTITY_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "agentOf",
      args: [account.address],
    });
    if (existingAgentId && existingAgentId > 0n) {
      console.log(`⚠️  Already registered! Agent ID: ${existingAgentId}`);
      const uri = await publicClient.readContract({
        address: IDENTITY_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: "tokenURI",
        args: [existingAgentId],
      });
      console.log(`   URI: ${uri}`);
      return;
    }
  } catch (e) {
    // agentOf may not exist or may revert — continue with registration
    console.log("   No existing registration found, proceeding...");
  }

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${Number(balance) / 1e18} ETH`);
  if (balance < 100000n) {
    throw new Error("Insufficient ETH for gas");
  }

  // Register
  console.log(`📝 Registering Maiat on ERC-8004 IdentityRegistry...`);
  console.log(`   Contract: ${IDENTITY_REGISTRY}`);
  console.log(`   URI length: ${MAIAT_URI.length} chars`);

  try {
    const hash = await walletClient.writeContract({
      address: IDENTITY_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "register",
      args: [MAIAT_URI],
    });

    console.log(`✅ TX submitted: ${hash}`);
    console.log(`   BaseScan: https://basescan.org/tx/${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}`);
    
    // Check the new agent ID
    try {
      const agentId = await publicClient.readContract({
        address: IDENTITY_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: "agentOf",
        args: [account.address],
      });
      console.log(`🎉 Maiat registered as Agent ID: ${agentId}`);
    } catch {
      console.log("   (Could not read agentId — check events on BaseScan)");
    }
  } catch (err: any) {
    console.error(`❌ Registration failed:`, err.shortMessage || err.message);
    
    // Try with raw calldata as fallback
    if (err.message?.includes("revert") || err.message?.includes("execution")) {
      console.log("\n💡 The register() function signature may be different.");
      console.log("   Check the contract on BaseScan or try:");
      console.log("   cast call 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 'register(string)' '<uri>' --rpc-url https://mainnet.base.org");
    }
  }
}

main().catch(console.error);
