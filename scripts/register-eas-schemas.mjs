/**
 * One-time EAS Schema Registration — Base Sepolia
 * Run: MAIAT_ADMIN_PRIVATE_KEY=0x... ALCHEMY_BASE_SEPOLIA_RPC=... node scripts/register-eas-schemas.mjs
 */

import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

const BASE_SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020";

const SCHEMAS = {
  trustScore: "address agent, uint8 score, string verdict, uint256 timestamp",
  review: "address target, address reviewer, uint8 rating, string comment, bytes32 txHash",
  acpInteraction: "address buyer, address seller, string offering, uint256 fee, uint256 timestamp",
};

async function main() {
  const privateKey = process.env.MAIAT_ADMIN_PRIVATE_KEY || process.env.MAIAT_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ MAIAT_ADMIN_PRIVATE_KEY or MAIAT_PRIVATE_KEY required");
    process.exit(1);
  }

  const rpcUrl = process.env.ALCHEMY_BASE_SEPOLIA_RPC || "https://sepolia.base.org";
  console.log("🔗 RPC:", rpcUrl);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  console.log("👛 Wallet:", signer.address);

  const balance = await provider.getBalance(signer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.error("❌ No ETH on Base Sepolia. Get testnet ETH from https://faucet.quicknode.com/base/sepolia");
    process.exit(1);
  }

  const registry = new SchemaRegistry(BASE_SCHEMA_REGISTRY_ADDRESS);
  registry.connect(signer);

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const results = {};

  for (const [name, schema] of Object.entries(SCHEMAS)) {
    console.log(`\n📋 Registering ${name}...`);
    console.log("   Schema:", schema);
    try {
      const tx = await registry.register({ schema, resolverAddress: ZERO_ADDRESS, revocable: true });
      const uid = await tx.wait();
      console.log(`   ✅ UID: ${uid}`);
      results[name] = uid;
    } catch (e) {
      // If already registered, EAS throws — try to extract UID from error or skip
      if (e.message?.includes("AlreadyExists")) {
        console.log(`   ⚠️  Schema already registered — check easscan for UID`);
      } else {
        throw e;
      }
    }
  }

  console.log("\n\n🎉 Done! Add these to Vercel + Railway env vars:\n");
  console.log(`EAS_TRUST_SCORE_SCHEMA_UID=${results.trustScore}`);
  console.log(`EAS_REVIEW_SCHEMA_UID=${results.review}`);
  console.log(`EAS_ACP_SCHEMA_UID=${results.acpInteraction}`);
  console.log("\nVerify on easscan:");
  console.log(`https://base-sepolia.easscan.org/schema/view/${results.trustScore}`);

  return results;
}

main().catch(console.error);
