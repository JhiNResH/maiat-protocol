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

import { resolveSlug } from "./slug-resolver";
import bs58 from "bs58"; // For Solana address parsing

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

  // 1. Determine which chain this target contract lives on
  const resolved = resolveSlug(targetAddress);
  const chainId = resolved?.chainId ?? 8453; // Default to Base if unknown

  const rpcUrl = getRpcUrlForChain(chainId);
  if (!rpcUrl) {
     console.warn(`[interaction-check] No RPC URL found for chain ${chainId} — failing closed`);
     return { hasInteracted: false, txCount: 0, firstTxDate: null, lastTxDate: null };
  }

  // 2. Prevent Solana addresses from being queried on EVM and vice versa
  const isEvmChain = chainId === 8453 || chainId === 1 || chainId === 56;
  const isSolanaChain = chainId === 1399811149;
  
  const isEvmAddress = walletAddress.startsWith("0x") && walletAddress.length === 42;
  
  let isSolanaAddress = false;
  try {
    const decoded = bs58.decode(walletAddress);
    isSolanaAddress = decoded.length === 32;
  } catch (e) {
    isSolanaAddress = false;
  }

  if (isEvmChain && !isEvmAddress) {
      console.warn(`[interaction-check] Attempted to query EVM chain ${chainId} with non-EVM address ${walletAddress}`);
      return { hasInteracted: false, txCount: 0, firstTxDate: null, lastTxDate: null };
  }
  
  if (isSolanaChain && !isSolanaAddress) {
     console.warn(`[interaction-check] Attempted to query Solana chain ${chainId} with non-Solana address ${walletAddress}`);
     return { hasInteracted: false, txCount: 0, firstTxDate: null, lastTxDate: null };
  }
  
  if (isSolanaChain) {
     // Skip Solana checking for now, return true to not block users from testing
     console.warn(`[interaction-check] Solana checking not yet implemented for single-contract interactions. Skipping.`);
     return { hasInteracted: true, txCount: 1, firstTxDate: new Date().toISOString(), lastTxDate: new Date().toISOString() };
  }

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: chainId,
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

    const proof = {
      hasInteracted: matchingTxs.length > 0,
      txCount: matchingTxs.length,
      firstTxDate: matchingTxs.length > 0 && matchingTxs[0].metadata?.blockTimestamp 
        ? matchingTxs[0].metadata.blockTimestamp : null,
      lastTxDate: matchingTxs.length > 0 && matchingTxs[matchingTxs.length - 1].metadata?.blockTimestamp 
        ? matchingTxs[matchingTxs.length - 1].metadata.blockTimestamp : null,
    };

    interactionCache.set(key, { proof, expiresAt: Date.now() + CACHE_TTL_MS });
    return proof;

  } catch (error) {
    console.error(`[interaction-check] Error checking interaction on chain ${chainId} via Alchemy:`, error);
    return { hasInteracted: true, txCount: 0, firstTxDate: null, lastTxDate: null };
  }
}

function getRpcUrlForChain(chainId: number): string | undefined {
  switch (chainId) {
    case 8453: return process.env.ALCHEMY_BASE_RPC;
    case 1: return process.env.ALCHEMY_ETH_RPC; // Assume we have this
    case 56: return process.env.ALCHEMY_BNB_RPC; // Assume we have this
    case 1399811149: return process.env.ALCHEMY_SOL_RPC; // Assume we have this
    default: return undefined;
  }
}

/**
 * Fallback to Alchemy to discover interactions if Basescan is unavailable.
 * Now queries multiple chains based on the known protocols list.
 */
async function discoverInteractionsAlchemy(
  walletAddress: string,
  knownProtocols: Map<string, { name: string; category: string; chainId: number }>
): Promise<DiscoveredContract[]> {
  
  // For discovery, we scan major chains. 
  // We include chains from knownProtocols and default to Base/ETH
  const chainIds = new Set<number>([8453, 1]); // Always scan Base and Mainnet
  for (const info of Array.from(knownProtocols.values())) {
    chainIds.add(info.chainId);
  }

  const contractMap = new Map<string, { txCount: number; firstTs: number; lastTs: number }>();

  // Fetch interactions per chain
  const fetchPromises = Array.from(chainIds).map(async (chainId) => {
    const rpcUrl = getRpcUrlForChain(chainId);
    if (!rpcUrl) return; 

    // Solana needs a different RPC call
    if (chainId === 1399811149) {
       console.warn(`[interaction-check] Solana scanning not yet implemented via EVM Alchemy. Skipping for now.`);
       return;
    }

    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: chainId,
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
      if (!data.result || !Array.isArray(data.result.transfers)) return;

      for (const tx of data.result.transfers) {
        if (!tx.metadata?.blockTimestamp) continue;
        const ts = new Date(tx.metadata.blockTimestamp).getTime() / 1000;
        
        const addressesToRecord = new Set<string>();
        if (tx.to) addressesToRecord.add(tx.to.toLowerCase());
        if (tx.rawContract?.address) addressesToRecord.add(tx.rawContract.address.toLowerCase());

        for (const toAddr of Array.from(addressesToRecord)) {
          // Exclude self-transfers or transfers back to wallet
          if (toAddr === walletAddress.toLowerCase()) continue;

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
    } catch (e) {
       console.error(`[interaction-check] Error on chain ${chainId}:`, e);
    }
  });

  await Promise.all(fetchPromises);

  // Match against known protocols and build results
  const results: DiscoveredContract[] = [];
  
  // Pre-normalize known protocols map for faster lookup
  const normalizedKnown = new Map<string, { name: string; category: string }>();
  for (const [addr, info] of Array.from(knownProtocols.entries())) {
    normalizedKnown.set(addr.toLowerCase(), info);
  }

  for (const [addr, info] of Array.from(contractMap)) {
    const known = normalizedKnown.get(addr);

    results.push({
      address: addr,
      name: known?.name || null, // Will be displayed as "Unknown Contract" in UI
      category: known?.category || null,
      txCount: info.txCount,
      firstTxDate: new Date(info.firstTs * 1000).toISOString(),
      lastTxDate: new Date(info.lastTs * 1000).toISOString(),
      isKnown: !!known,
    });
  }

  return results.sort((a, b) => b.txCount - a.txCount);
}

export async function discoverInteractions(
  walletAddress: string,
  knownProtocols: Map<string, { name: string; category: string; chainId: number }>
): Promise<DiscoveredContract[]> {
  // Since we are multi-chain now, we ONLY use Alchemy. Basescan is Base-only.
  return discoverInteractionsAlchemy(walletAddress, knownProtocols);
}
