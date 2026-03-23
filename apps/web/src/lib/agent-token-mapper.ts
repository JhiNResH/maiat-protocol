/**
 * Agent-Token Mapper
 *
 * Resolves an ACP agent's wallet address → their token contract address on Base.
 *
 * Strategy (in order):
 * 1. Check Supabase agent_scores table for tokenAddress field (if exists)
 * 2. Query Virtuals ACP API: GET /api/agents/v5/search?q={walletAddress}
 *    → look for agent.tokenAddress or agent.token fields
 * 3. Return null if not found (not all agents have tokens)
 */

import { PrismaClient } from "@prisma/client";
import { getAddress, isAddress } from "viem";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentTokenInfo {
  walletAddress: string;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  agentName: string | null;
  source: "DB" | "VIRTUALS_API" | "NOT_FOUND";
}

interface VirtualsAgentResponse {
  id: number;
  name: string;
  walletAddress: string;
  tokenAddress?: string | null;
  token?: {
    address?: string;
    symbol?: string;
  } | null;
}

interface VirtualsSearchResponse {
  data: VirtualsAgentResponse[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const VIRTUALS_SEARCH_URL = "https://acpx.virtuals.io/api/agents/v5/search";

// ─── Helper: Normalize address ───────────────────────────────────────────────

function normalizeAddress(address: string): string | null {
  if (!isAddress(address)) return null;
  try {
    return getAddress(address);
  } catch {
    return address.toLowerCase();
  }
}

// ─── Main Function ───────────────────────────────────────────────────────────

export async function getAgentToken(
  walletAddress: string,
  prisma?: PrismaClient
): Promise<AgentTokenInfo> {
  // Normalize the wallet address
  const normalized = normalizeAddress(walletAddress);
  if (!normalized) {
    return {
      walletAddress,
      tokenAddress: null,
      tokenSymbol: null,
      agentName: null,
      source: "NOT_FOUND",
    };
  }

  // 1. Try DB first (if Prisma available and column exists)
  if (prisma) {
    try {
      const agent = await prisma.agentScore.findUnique({
        where: { walletAddress: normalized.toLowerCase() },
        select: {
          tokenAddress: true,
          tokenSymbol: true,
          rawMetrics: true,
        },
      });

      if (agent?.tokenAddress) {
        const rawMetrics = agent.rawMetrics as { name?: string } | null;
        return {
          walletAddress: normalized,
          tokenAddress: agent.tokenAddress,
          tokenSymbol: agent.tokenSymbol,
          agentName: rawMetrics?.name ?? null,
          source: "DB",
        };
      }
    } catch {
      // Column might not exist yet, or DB error — continue to API fallback
    }
  }

  // 2. Query Virtuals API
  try {
    const url = `${VIRTUALS_SEARCH_URL}?query=${encodeURIComponent(normalized)}&topK=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (!res.ok) {
      console.warn(`[agent-token-mapper] Virtuals API error: ${res.status}`);
      return {
        walletAddress: normalized,
        tokenAddress: null,
        tokenSymbol: null,
        agentName: null,
        source: "NOT_FOUND",
      };
    }

    const json = (await res.json()) as VirtualsSearchResponse;
    const agents = json.data ?? [];

    // Find agent where walletAddress matches (case-insensitive)
    const matchedAgent = agents.find(
      (a) => a.walletAddress?.toLowerCase() === normalized.toLowerCase()
    );

    if (matchedAgent) {
      // Extract tokenAddress from either direct field or nested token object
      const tokenAddress = matchedAgent.tokenAddress ?? matchedAgent.token?.address ?? null;
      const tokenSymbol = matchedAgent.token?.symbol ?? null;

      if (tokenAddress) {
        return {
          walletAddress: normalized,
          tokenAddress,
          tokenSymbol,
          agentName: matchedAgent.name,
          source: "VIRTUALS_API",
        };
      }

      // Agent found but no token
      return {
        walletAddress: normalized,
        tokenAddress: null,
        tokenSymbol: null,
        agentName: matchedAgent.name,
        source: "NOT_FOUND",
      };
    }
  } catch (e) {
    console.warn(`[agent-token-mapper] Virtuals API fetch error:`, e);
  }

  // 3. Not found
  return {
    walletAddress: normalized,
    tokenAddress: null,
    tokenSymbol: null,
    agentName: null,
    source: "NOT_FOUND",
  };
}

// ─── Reverse Lookup: Token → Agent ───────────────────────────────────────────

export interface TokenAgentInfo {
  tokenAddress: string;
  walletAddress: string | null;
  agentName: string | null;
  trustScore: number | null;
  source: "DB" | "NOT_FOUND";
}

export async function getAgentByToken(
  tokenAddress: string,
  prisma: PrismaClient
): Promise<TokenAgentInfo> {
  const normalized = normalizeAddress(tokenAddress);
  if (!normalized) {
    return {
      tokenAddress,
      walletAddress: null,
      agentName: null,
      trustScore: null,
      source: "NOT_FOUND",
    };
  }

  try {
    const agent = await prisma.agentScore.findFirst({
      where: { tokenAddress: normalized.toLowerCase() },
      select: {
        walletAddress: true,
        trustScore: true,
        rawMetrics: true,
      },
    });

    if (agent) {
      const rawMetrics = agent.rawMetrics as { name?: string } | null;
      return {
        tokenAddress: normalized,
        walletAddress: agent.walletAddress,
        agentName: rawMetrics?.name ?? null,
        trustScore: agent.trustScore,
        source: "DB",
      };
    }
  } catch {
    // Column might not exist or DB error
  }

  return {
    tokenAddress: normalized,
    walletAddress: null,
    agentName: null,
    trustScore: null,
    source: "NOT_FOUND",
  };
}

// ─── Batch Lookup: For populating script ─────────────────────────────────────

export async function fetchAgentTokenFromVirtuals(
  walletAddress: string
): Promise<{ tokenAddress: string | null; tokenSymbol: string | null; agentName: string | null }> {
  const normalized = normalizeAddress(walletAddress);
  if (!normalized) {
    return { tokenAddress: null, tokenSymbol: null, agentName: null };
  }

  try {
    const url = `${VIRTUALS_SEARCH_URL}?query=${encodeURIComponent(normalized)}&topK=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (!res.ok) {
      return { tokenAddress: null, tokenSymbol: null, agentName: null };
    }

    const json = (await res.json()) as VirtualsSearchResponse;
    const agents = json.data ?? [];

    const matchedAgent = agents.find(
      (a) => a.walletAddress?.toLowerCase() === normalized.toLowerCase()
    );

    if (matchedAgent) {
      const tokenAddress = matchedAgent.tokenAddress ?? matchedAgent.token?.address ?? null;
      const tokenSymbol = matchedAgent.token?.symbol ?? null;
      return {
        tokenAddress,
        tokenSymbol,
        agentName: matchedAgent.name,
      };
    }
  } catch {
    // Ignore errors for batch operations
  }

  return { tokenAddress: null, tokenSymbol: null, agentName: null };
}
