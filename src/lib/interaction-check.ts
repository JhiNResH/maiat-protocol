/**
 * Interaction Verification — checks if a wallet has interacted with a target address on Base
 *
 * Used to gate reviews: you can only review contracts you've actually used.
 * Uses Basescan API to verify on-chain transaction history.
 */

const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY ?? "";

// --- Types ---

export interface InteractionProof {
  hasInteracted: boolean;
  txCount: number;
  firstTxDate: string | null;
  lastTxDate: string | null;
}

export interface DiscoveredContract {
  address: string;
  name: string | null;
  category: string | null;
  txCount: number;
  firstTxDate: string;
  lastTxDate: string;
}

// --- Cache ---

interface CacheEntry {
  proof: InteractionProof;
  expiresAt: number;
}

const interactionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cacheKey(wallet: string, target: string): string {
  return `${wallet.toLowerCase()}:${target.toLowerCase()}`;
}

// --- Basescan helpers ---

interface BasescanTx {
  hash: string;
  from: string;
  to: string;
  timeStamp: string;
  value: string;
  isError: string;
}

/**
 * Check if a wallet has interacted with a specific target address on Base.
 *
 * Looks at both outgoing (from=wallet, to=target) and incoming (from=target, to=wallet) txs.
 * Only counts successful transactions (isError === "0").
 */
export async function checkInteraction(
  walletAddress: string,
  targetAddress: string
): Promise<InteractionProof> {
  const key = cacheKey(walletAddress, targetAddress);

  // Check cache
  const cached = interactionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.proof;
  }

  if (!BASESCAN_API_KEY) {
    console.warn(
      "[interaction-check] BASESCAN_API_KEY not set, allowing all interactions"
    );
    return {
      hasInteracted: true,
      txCount: 0,
      firstTxDate: null,
      lastTxDate: null,
    };
  }

  try {
    // Fetch outgoing txs from wallet
    const url = `https://api.basescan.org/api?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=1000&sort=asc&apikey=${BASESCAN_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      result: BasescanTx[] | string;
    };

    if (data.status !== "1" || !Array.isArray(data.result)) {
      // No transactions found or API error
      const proof: InteractionProof = {
        hasInteracted: false,
        txCount: 0,
        firstTxDate: null,
        lastTxDate: null,
      };
      interactionCache.set(key, {
        proof,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return proof;
    }

    const targetLower = targetAddress.toLowerCase();

    // Filter txs that involve the target address (either as sender or receiver)
    const matchingTxs = data.result.filter(
      (tx) =>
        tx.isError === "0" &&
        (tx.to?.toLowerCase() === targetLower ||
          tx.from?.toLowerCase() === targetLower)
    );

    const proof: InteractionProof = {
      hasInteracted: matchingTxs.length > 0,
      txCount: matchingTxs.length,
      firstTxDate:
        matchingTxs.length > 0
          ? new Date(parseInt(matchingTxs[0].timeStamp) * 1000).toISOString()
          : null,
      lastTxDate:
        matchingTxs.length > 0
          ? new Date(
              parseInt(matchingTxs[matchingTxs.length - 1].timeStamp) * 1000
            ).toISOString()
          : null,
    };

    interactionCache.set(key, {
      proof,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return proof;
  } catch (error) {
    console.error("[interaction-check] Error checking interaction:", error);
    // Fail open — don't block reviews if Basescan is down
    return {
      hasInteracted: true,
      txCount: 0,
      firstTxDate: null,
      lastTxDate: null,
    };
  }
}

/**
 * Discover all contracts a wallet has interacted with on Base.
 *
 * Returns unique `to` addresses from the wallet's transaction history,
 * filtered to only include contract addresses (not EOAs).
 * Used by the wallet discovery endpoint.
 */
export async function discoverInteractions(
  walletAddress: string,
  knownProtocols: Map<string, { name: string; category: string }>
): Promise<DiscoveredContract[]> {
  if (!BASESCAN_API_KEY) {
    return [];
  }

  try {
    const url = `https://api.basescan.org/api?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${BASESCAN_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      result: BasescanTx[] | string;
    };

    if (data.status !== "1" || !Array.isArray(data.result)) {
      return [];
    }

    // Group by unique `to` addresses
    const contractMap = new Map<
      string,
      { txCount: number; firstTs: number; lastTs: number }
    >();

    for (const tx of data.result) {
      if (tx.isError !== "0" || !tx.to) continue;
      const toAddr = tx.to.toLowerCase();
      const ts = parseInt(tx.timeStamp);

      const existing = contractMap.get(toAddr);
      if (existing) {
        existing.txCount++;
        existing.firstTs = Math.min(existing.firstTs, ts);
        existing.lastTs = Math.max(existing.lastTs, ts);
      } else {
        contractMap.set(toAddr, { txCount: 1, firstTs: ts, lastTs: ts });
      }
    }

    // Match against known protocols and build results
    const results: DiscoveredContract[] = [];
    for (const [addr, info] of contractMap) {
      // Check if this is a known protocol (case-insensitive lookup)
      let known: { name: string; category: string } | undefined;
      for (const [knownAddr, proto] of knownProtocols) {
        if (knownAddr.toLowerCase() === addr) {
          known = proto;
          break;
        }
      }

      // Only include known protocols (skip random EOA addresses)
      if (known) {
        results.push({
          address: addr,
          name: known.name,
          category: known.category,
          txCount: info.txCount,
          firstTxDate: new Date(info.firstTs * 1000).toISOString(),
          lastTxDate: new Date(info.lastTs * 1000).toISOString(),
        });
      }
    }

    // Sort by txCount descending
    return results.sort((a, b) => b.txCount - a.txCount);
  } catch (error) {
    console.error("[interaction-check] Error discovering interactions:", error);
    return [];
  }
}
