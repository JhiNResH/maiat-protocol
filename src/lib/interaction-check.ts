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
  isKnown: boolean;
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
 * Fallback to Alchemy to check interaction if Basescan is unavailable.
 */
async function checkInteractionAlchemy(
  walletAddress: string,
  targetAddress: string
): Promise<InteractionProof> {
  const ALCHEMY_RPC = process.env.ALCHEMY_BASE_RPC;
  if (!ALCHEMY_RPC) {
    return { hasInteracted: true, txCount: 0, firstTxDate: null, lastTxDate: null };
  }

  try {
    const res = await fetch(ALCHEMY_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          fromAddress: walletAddress,
          category: ["external", "erc20", "erc721", "erc1155"],
          withMetadata: true,
          maxCount: "0x3e8" // 1000
        }]
      })
    });
    
    const data = await res.json();
    if (!data.result || !Array.isArray(data.result.transfers)) {
      return { hasInteracted: false, txCount: 0, firstTxDate: null, lastTxDate: null };
    }
    
    const targetLower = targetAddress.toLowerCase();
    
    const matchingTxs = data.result.transfers.filter((tx: any) => 
      (tx.to && tx.to.toLowerCase() === targetLower) || 
      (tx.rawContract && tx.rawContract.address && tx.rawContract.address.toLowerCase() === targetLower)
    );
    
    // Sort by timestamp if metadata exists
    matchingTxs.sort((a: any, b: any) => {
      const aTime = a.metadata?.blockTimestamp ? new Date(a.metadata.blockTimestamp).getTime() : 0;
      const bTime = b.metadata?.blockTimestamp ? new Date(b.metadata.blockTimestamp).getTime() : 0;
      return aTime - bTime;
    });

    return {
      hasInteracted: matchingTxs.length > 0,
      txCount: matchingTxs.length,
      firstTxDate: matchingTxs.length > 0 && matchingTxs[0].metadata?.blockTimestamp 
        ? matchingTxs[0].metadata.blockTimestamp : null,
      lastTxDate: matchingTxs.length > 0 && matchingTxs[matchingTxs.length - 1].metadata?.blockTimestamp 
        ? matchingTxs[matchingTxs.length - 1].metadata.blockTimestamp : null,
    };
  } catch (error) {
    console.error("[interaction-check] Error checking interaction via Alchemy:", error);
    return { hasInteracted: true, txCount: 0, firstTxDate: null, lastTxDate: null };
  }
}

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
    console.warn("[interaction-check] BASESCAN_API_KEY not set, falling back to Alchemy");
    const proof = await checkInteractionAlchemy(walletAddress, targetAddress);
    interactionCache.set(key, { proof, expiresAt: Date.now() + CACHE_TTL_MS });
    return proof;
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
      // Fallback if Basescan fails but we have an API key that doesn't work well
      console.warn("[interaction-check] Basescan returned error, trying Alchemy fallback");
      const proof = await checkInteractionAlchemy(walletAddress, targetAddress);
      interactionCache.set(key, { proof, expiresAt: Date.now() + CACHE_TTL_MS });
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
    // Final fallback to open
    return {
      hasInteracted: true,
      txCount: 0,
      firstTxDate: null,
      lastTxDate: null,
    };
  }
}

/**
 * Fallback to Alchemy to discover interactions if Basescan is unavailable.
 */
async function discoverInteractionsAlchemy(
  walletAddress: string,
  knownProtocols: Map<string, { name: string; category: string }>
): Promise<DiscoveredContract[]> {
  const ALCHEMY_RPC = process.env.ALCHEMY_BASE_RPC;
  if (!ALCHEMY_RPC) return [];

  try {
    const res = await fetch(ALCHEMY_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          fromAddress: walletAddress,
          category: ["external", "erc20", "erc721", "erc1155"],
          withMetadata: true,
          maxCount: "0x3e8"
        }]
      })
    });
    
    const data = await res.json();
    if (!data.result || !Array.isArray(data.result.transfers)) {
      return [];
    }

    const contractMap = new Map<
      string,
      { txCount: number; firstTs: number; lastTs: number }
    >();

    for (const tx of data.result.transfers) {
      if (!tx.metadata?.blockTimestamp) continue;
      const ts = new Date(tx.metadata.blockTimestamp).getTime() / 1000;
      
      const addressesToRecord = new Set<string>();
      if (tx.to) addressesToRecord.add(tx.to.toLowerCase());
      if (tx.rawContract?.address) addressesToRecord.add(tx.rawContract.address.toLowerCase());

      for (const toAddr of addressesToRecord) {
        const existing = contractMap.get(toAddr);
        if (existing) {
          existing.txCount++;
          existing.firstTs = Math.min(existing.firstTs, ts);
          existing.lastTs = Math.max(existing.lastTs, ts);
        } else {
          contractMap.set(toAddr, { txCount: 1, firstTs: ts, lastTs: ts });
        }
      }
    }

    // Match against known protocols and build results
    const results: DiscoveredContract[] = [];
    for (const [addr, info] of contractMap) {
      let known: { name: string; category: string } | undefined;
      for (const [knownAddr, proto] of knownProtocols) {
        if (knownAddr.toLowerCase() === addr) {
          known = proto;
          break;
        }
      }

      results.push({
        address: addr,
        name: known?.name || "Unknown Contract",
        category: known?.category || "RAW_CONTRACT",
        txCount: info.txCount,
        firstTxDate: new Date(info.firstTs * 1000).toISOString(),
        lastTxDate: new Date(info.lastTs * 1000).toISOString(),
        isKnown: !!known,
      });
    }

    return results.sort((a, b) => b.txCount - a.txCount);
  } catch (error) {
    console.error("[interaction-check] Error discovering interactions via Alchemy:", error);
    return [];
  }
}

export async function discoverInteractions(
  walletAddress: string,
  knownProtocols: Map<string, { name: string; category: string }>
): Promise<DiscoveredContract[]> {
  if (!BASESCAN_API_KEY) {
    console.warn("[interaction-check] BASESCAN_API_KEY missing, using Alchemy fallback for discovery");
    return discoverInteractionsAlchemy(walletAddress, knownProtocols);
  }

  try {
    const url = `https://api.basescan.org/api?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${BASESCAN_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      result: BasescanTx[] | string;
    };

    if (data.status !== "1" || !Array.isArray(data.result)) {
      console.warn("[interaction-check] Basescan discovery failed, attempting Alchemy fallback");
      return discoverInteractionsAlchemy(walletAddress, knownProtocols);
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

      results.push({
        address: addr,
        name: known?.name || "Unknown Contract",
        category: known?.category || "RAW_CONTRACT",
        txCount: info.txCount,
        firstTxDate: new Date(info.firstTs * 1000).toISOString(),
        lastTxDate: new Date(info.lastTs * 1000).toISOString(),
        isKnown: !!known,
      });
    }

    // Sort by txCount descending
    return results.sort((a, b) => b.txCount - a.txCount);
  } catch (error) {
    console.error("[interaction-check] Error discovering interactions:", error);
    return discoverInteractionsAlchemy(walletAddress, knownProtocols);
  }
}
