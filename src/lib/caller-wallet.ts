/**
 * Per-Caller Wallet Assignment
 *
 * When an agent calls the Maiat API with X-Maiat-Client header,
 * we auto-assign them a Privy server wallet. This wallet is used for:
 *   - Outcome reporting (as the reporter address)
 *   - Scarab reward distribution
 *   - On-chain identity (EAS attestation subject)
 *
 * Wallets are stored in DB (CallerWallet table) and cached in memory.
 */

import { prisma } from "@/lib/prisma";

// In-memory cache: clientId → wallet address
const walletCache = new Map<string, string>();

/**
 * Get or create a wallet for this API caller.
 * Uses Privy server wallets if configured, otherwise generates a deterministic address.
 */
export async function getCallerWallet(clientId: string): Promise<string | null> {
  if (!clientId || clientId.length < 3) return null;

  // Check memory cache
  const cached = walletCache.get(clientId);
  if (cached) return cached;

  try {
    // Check DB first
    const existing = await prisma.callerWallet.findUnique({
      where: { clientId },
    });

    if (existing) {
      walletCache.set(clientId, existing.walletAddress);
      return existing.walletAddress;
    }

    // Create new wallet via Privy (if configured)
    let walletAddress: string;

    if (process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET) {
      const { PrivyClient } = await import("@privy-io/server-auth");
      const privy = new PrivyClient(
        process.env.PRIVY_APP_ID,
        process.env.PRIVY_APP_SECRET
      );

      const wallet = await privy.walletApi.create({ chainType: "ethereum" });
      walletAddress = wallet.address;

      console.log(`[caller-wallet] Created Privy wallet for ${clientId}: ${walletAddress} (id: ${wallet.id})`);

      // Store in DB
      await prisma.callerWallet.create({
        data: {
          clientId,
          walletAddress,
          walletId: wallet.id,
          provider: "privy",
        },
      });
    } else {
      // Fallback: no Privy — log and skip
      console.log(`[caller-wallet] Privy not configured, skipping wallet for ${clientId}`);
      return null;
    }

    walletCache.set(clientId, walletAddress);
    return walletAddress;
  } catch (err) {
    console.error(`[caller-wallet] Failed for ${clientId}:`, err);
    return null;
  }
}

/**
 * Lookup wallet address for a clientId (read-only, no creation)
 */
export async function lookupCallerWallet(clientId: string): Promise<string | null> {
  if (!clientId) return null;

  const cached = walletCache.get(clientId);
  if (cached) return cached;

  try {
    const record = await prisma.callerWallet.findUnique({
      where: { clientId },
    });
    if (record) {
      walletCache.set(clientId, record.walletAddress);
      return record.walletAddress;
    }
  } catch {
    // Non-critical
  }

  return null;
}
