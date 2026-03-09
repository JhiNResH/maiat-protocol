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

      // Auto-onboard: grant first-call Scarab bonus
      try {
        const { maybeGrantFirstCallBonus } = await import("@/lib/scarab");
        await maybeGrantFirstCallBonus(walletAddress);
      } catch { /* non-critical */ }
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

/**
 * Sign a message with the agent's Privy server wallet.
 * Used for SIWE claims, reviews, market positions — same as user signing with their wallet.
 */
export async function signMessage(clientId: string, message: string): Promise<string | null> {
  if (!clientId) return null;
  if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) return null;

  try {
    // Get walletId from DB
    const record = await prisma.callerWallet.findUnique({
      where: { clientId },
    });
    if (!record?.walletId) return null;

    const { PrivyClient } = await import("@privy-io/server-auth");
    const privy = new PrivyClient(
      process.env.PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET
    );

    const { signature } = await privy.walletApi.ethereum.signMessage({
      walletId: record.walletId,
      message,
    });

    return signature;
  } catch (err) {
    console.error(`[caller-wallet] signMessage failed for ${clientId}:`, err);
    return null;
  }
}

/**
 * Full SIWE claim flow for agents — get nonce, sign, submit.
 * Returns the claim result or null on failure.
 */
export async function agentClaimScarab(clientId: string): Promise<Record<string, unknown> | null> {
  const walletAddress = await getCallerWallet(clientId);
  if (!walletAddress) return null;

  const { getAddress } = await import("viem");
  const checksumAddress = getAddress(walletAddress);

  // Step 1: Get nonce
  const nonceRes = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.maiat.io"}/api/v1/scarab/nonce?address=${checksumAddress}`
  );
  if (!nonceRes.ok) return null;
  const { nonce, expiresAt } = await nonceRes.json() as { nonce: string; expiresAt: string };

  // Step 2: Sign the claim message (same format as frontend)
  const message = [
    `Claim daily Scarab for ${checksumAddress}`,
    `Nonce: ${nonce}`,
    `Expiration: ${expiresAt}`,
  ].join("\n");

  const signature = await signMessage(clientId, message);
  if (!signature) return null;

  // Step 3: Submit claim (same endpoint as users)
  const claimRes = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.maiat.io"}/api/v1/scarab/claim`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: checksumAddress, signature, nonce, expiresAt }),
    }
  );

  if (!claimRes.ok) return null;
  return claimRes.json() as Promise<Record<string, unknown>>;
}
