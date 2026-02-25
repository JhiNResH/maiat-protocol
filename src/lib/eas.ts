/**
 * Maiat EAS (Ethereum Attestation Service) Receipt Integration
 *
 * This module allows Maiat to query Base's EAS contract for specific
 * "Service Receipts" issued to a user's wallet by DApps or Agents.
 */

const EAS_GRAPHQL_ENDPOINT = "https://base.easscan.org/graphql";

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
