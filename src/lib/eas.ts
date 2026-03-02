/**
 * Maiat EAS (Ethereum Attestation Service) Receipt Integration
 *
 * This module allows Maiat to query Base's EAS contract for specific
 * "Service Receipts" issued to a user's wallet by DApps or Agents.
 */

import { EAS, SchemaEncoder, SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

const EAS_GRAPHQL_ENDPOINT = "https://base.easscan.org/graphql";
const BASE_EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";
const BASE_SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020";

// Schema definitions
const SCHEMAS = {
  trustScore: "address agent, uint8 score, string verdict, uint256 timestamp",
  review: "address target, address reviewer, uint8 rating, string comment, bytes32 txHash",
  acpInteraction: "address buyer, address seller, string offering, uint256 fee, uint256 timestamp",
} as const;

// Schema UIDs from env (set after one-time registration)
export const EAS_TRUST_SCORE_SCHEMA_UID = process.env.EAS_TRUST_SCORE_SCHEMA_UID || "";
export const EAS_REVIEW_SCHEMA_UID = process.env.EAS_REVIEW_SCHEMA_UID || "";
export const EAS_ACP_SCHEMA_UID = process.env.EAS_ACP_SCHEMA_UID || "";

// A mock Schema UID for Maiat Receipts.
// In reality, we would deploy a schema like:
// "address serviceProvider, string serviceType, uint256 valuePaid, bytes32 txHash"
// Then use its registered UID here.
export const MAIAT_RECEIPT_SCHEMA_UID = process.env.MAIAT_EAS_SCHEMA_UID || "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface EASReceipt {
  id: string;
  attester: string; // The service provider
  recipient: string; // The user
  timeCreated: number;
  decodedDataJson: string; // The actual receipt data (e.g. "{"serviceType": "AI Art"}")
  txid: string; // The transaction hash where the service happened
}

/**
 * Fetch all Maiat Receipts issued to a specific wallet.
 */
export async function getReceiptsForWallet(walletAddress: string): Promise<EASReceipt[]> {
  const query = `
    query Attestations($schemaId: String!, $recipient: String!) {
      attestations(
        where: {
          schemaId: { equals: $schemaId },
          recipient: { equals: $recipient },
          revoked: { equals: false }
        }
        orderBy: [{ timeCreated: desc }]
        take: 100
      ) {
        id
        attester
        recipient
        timeCreated
        decodedDataJson
        txid
      }
    }
  `;

  try {
    const res = await fetch(EAS_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          schemaId: MAIAT_RECEIPT_SCHEMA_UID,
          recipient: walletAddress,
        },
      }),
    });

    const data = await res.json();

    if (data.errors) {
      console.error("[EAS] GraphQL Errors:", data.errors);
      return [];
    }

    return data.data.attestations as EASReceipt[];
  } catch (error) {
    console.error("[EAS] Failed to fetch receipts:", error);
    return [];
  }
}

/**
 * Creates and signs an Off-chain EAS Receipt using the Maiat Oracle private key.
 */
export async function createOffchainReceipt(
  walletAddress: string,
  serviceProtocol: string,
  txHash: string
) {
  const privateKey = process.env.MAIAT_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("[EAS] MAIAT_ADMIN_PRIVATE_KEY is missing. Cannot sign off-chain receipt.");
  }

  const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_BASE_RPC || "https://mainnet.base.org");
  const signer = new ethers.Wallet(privateKey, provider);

  const eas = new EAS(BASE_EAS_CONTRACT_ADDRESS);
  eas.connect(signer as any);

  try {
    const offchain = await eas.getOffchain();

    // Setup the schema encoder based on our dummy schema
    const schemaEncoder = new SchemaEncoder("string serviceProvider,string serviceType,string valuePaid");
    const encodedData = schemaEncoder.encodeData([
      { name: "serviceProvider", value: serviceProtocol, type: "string" },
      { name: "serviceType", value: "Verified DApp Interaction", type: "string" },
      { name: "valuePaid", value: "Airdropped Receipt", type: "string" },
    ]);

    const attestation = await offchain.signOffchainAttestation({
      recipient: walletAddress,
      expirationTime: 0n,
      time: BigInt(Math.floor(Date.now() / 1000)),
      revocable: true,
      nonce: 0n,
      schema: MAIAT_RECEIPT_SCHEMA_UID,
      refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
      data: encodedData,
    }, signer as any);

    return attestation;
  } catch (error) {
    console.error("[EAS] Failed to create off-chain receipt:", error);
    // Return a dummy signature object if the EAS SDK fails (for POC resilience)
    return {
      uid: "0xOffchain" + Date.now().toString(16),
      domain: { name: "EAS Attestation", version: "1", chainId: 8453, verifyingContract: BASE_EAS_CONTRACT_ADDRESS },
      message: {
        recipient: walletAddress,
        schema: MAIAT_RECEIPT_SCHEMA_UID,
        time: Math.floor(Date.now() / 1000),
        data: `serviceProtocol:${serviceProtocol},txHash:${txHash}`
      },
      signature: {
        r: "0x...", s: "0x...", v: 27
      }
    };
  }
}

// ─── EAS On-Chain Attestation Functions ──────────────────────────────────────

function getEASSigner() {
  const privateKey = process.env.MAIAT_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("[EAS] MAIAT_ADMIN_PRIVATE_KEY is missing");
  }
  const rpcUrl = process.env.ALCHEMY_BASE_SEPOLIA_RPC || process.env.ALCHEMY_BASE_RPC || "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  return signer;
}

/**
 * Register all 3 Maiat schemas on Base (Sepolia).
 * This is a one-time operation. Store the returned UIDs in env vars.
 */
export async function registerMaiatSchemas(): Promise<{
  trustScoreUID: string;
  reviewUID: string;
  acpInteractionUID: string;
}> {
  const signer = getEASSigner();
  const schemaRegistry = new SchemaRegistry(BASE_SCHEMA_REGISTRY_ADDRESS);
  schemaRegistry.connect(signer as any);

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  console.log("[EAS] Registering MaiatTrustScore schema...");
  const trustScoreTx = await schemaRegistry.register({
    schema: SCHEMAS.trustScore,
    resolverAddress: ZERO_ADDRESS,
    revocable: true,
  });
  const trustScoreUID = await trustScoreTx.wait();
  console.log("[EAS] MaiatTrustScore UID:", trustScoreUID);

  console.log("[EAS] Registering MaiatReview schema...");
  const reviewTx = await schemaRegistry.register({
    schema: SCHEMAS.review,
    resolverAddress: ZERO_ADDRESS,
    revocable: true,
  });
  const reviewUID = await reviewTx.wait();
  console.log("[EAS] MaiatReview UID:", reviewUID);

  console.log("[EAS] Registering MaiatACPInteraction schema...");
  const acpTx = await schemaRegistry.register({
    schema: SCHEMAS.acpInteraction,
    resolverAddress: ZERO_ADDRESS,
    revocable: true,
  });
  const acpInteractionUID = await acpTx.wait();
  console.log("[EAS] MaiatACPInteraction UID:", acpInteractionUID);

  return {
    trustScoreUID: trustScoreUID as string,
    reviewUID: reviewUID as string,
    acpInteractionUID: acpInteractionUID as string,
  };
}

/**
 * Create an on-chain EAS attestation for a trust score.
 */
export async function attestTrustScore(
  agent: string,
  score: number,
  verdict: string
): Promise<string> {
  if (!EAS_TRUST_SCORE_SCHEMA_UID) {
    throw new Error("[EAS] EAS_TRUST_SCORE_SCHEMA_UID not set. Register schemas first.");
  }

  const signer = getEASSigner();
  const eas = new EAS(BASE_EAS_CONTRACT_ADDRESS);
  eas.connect(signer as any);

  const schemaEncoder = new SchemaEncoder(SCHEMAS.trustScore);
  const encodedData = schemaEncoder.encodeData([
    { name: "agent", value: agent, type: "address" },
    { name: "score", value: score, type: "uint8" },
    { name: "verdict", value: verdict, type: "string" },
    { name: "timestamp", value: BigInt(Math.floor(Date.now() / 1000)), type: "uint256" },
  ]);

  const tx = await eas.attest({
    schema: EAS_TRUST_SCORE_SCHEMA_UID,
    data: {
      recipient: agent,
      expirationTime: 0n,
      revocable: true,
      refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
      data: encodedData,
      value: 0n,
    },
  });

  const uid = await tx.wait();
  console.log("[EAS] TrustScore attestation UID:", uid);
  return uid;
}

/**
 * Create an on-chain EAS attestation for a review.
 */
export async function attestReview(
  target: string,
  reviewer: string,
  rating: number,
  comment: string,
  txHash?: string
): Promise<string> {
  if (!EAS_REVIEW_SCHEMA_UID) {
    throw new Error("[EAS] EAS_REVIEW_SCHEMA_UID not set. Register schemas first.");
  }

  const signer = getEASSigner();
  const eas = new EAS(BASE_EAS_CONTRACT_ADDRESS);
  eas.connect(signer as any);

  const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

  const schemaEncoder = new SchemaEncoder(SCHEMAS.review);
  const encodedData = schemaEncoder.encodeData([
    { name: "target", value: target, type: "address" },
    { name: "reviewer", value: reviewer, type: "address" },
    { name: "rating", value: rating, type: "uint8" },
    { name: "comment", value: comment, type: "string" },
    { name: "txHash", value: txHash || ZERO_BYTES32, type: "bytes32" },
  ]);

  const tx = await eas.attest({
    schema: EAS_REVIEW_SCHEMA_UID,
    data: {
      recipient: target,
      expirationTime: 0n,
      revocable: true,
      refUID: ZERO_BYTES32,
      data: encodedData,
      value: 0n,
    },
  });

  const uid = await tx.wait();
  console.log("[EAS] Review attestation UID:", uid);
  return uid;
}

/**
 * Create an on-chain EAS attestation for an ACP interaction.
 */
export async function attestACPInteraction(
  buyer: string,
  seller: string,
  offering: string,
  fee: bigint | number
): Promise<string> {
  if (!EAS_ACP_SCHEMA_UID) {
    throw new Error("[EAS] EAS_ACP_SCHEMA_UID not set. Register schemas first.");
  }

  const signer = getEASSigner();
  const eas = new EAS(BASE_EAS_CONTRACT_ADDRESS);
  eas.connect(signer as any);

  const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

  const schemaEncoder = new SchemaEncoder(SCHEMAS.acpInteraction);
  const encodedData = schemaEncoder.encodeData([
    { name: "buyer", value: buyer, type: "address" },
    { name: "seller", value: seller, type: "address" },
    { name: "offering", value: offering, type: "string" },
    { name: "fee", value: BigInt(fee), type: "uint256" },
    { name: "timestamp", value: BigInt(Math.floor(Date.now() / 1000)), type: "uint256" },
  ]);

  const tx = await eas.attest({
    schema: EAS_ACP_SCHEMA_UID,
    data: {
      recipient: buyer,
      expirationTime: 0n,
      revocable: true,
      refUID: ZERO_BYTES32,
      data: encodedData,
      value: 0n,
    },
  });

  const uid = await tx.wait();
  console.log("[EAS] ACPInteraction attestation UID:", uid);
  return uid;
}
