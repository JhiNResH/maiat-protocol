import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, checkIpRateLimit } from "@/lib/ratelimit";

const rateLimiter = createRateLimiter("wallet:interactions", 30, 60);

// --- CORS helpers ---
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

interface AlchemyTransfer {
  to: string | null;
  from: string | null;
  category: string;
}

interface AlchemyResponse {
  result?: {
    transfers: AlchemyTransfer[];
  };
  error?: {
    message: string;
  };
}

async function fetchAlchemyTransfers(
  address: string,
  direction: "from" | "to"
): Promise<AlchemyTransfer[]> {
  const alchemyRpc = process.env.ALCHEMY_BASE_RPC;
  if (!alchemyRpc) {
    throw new Error("ALCHEMY_BASE_RPC not configured");
  }

  const params: Record<string, unknown> = {
    category: ["external", "erc20"],
    withMetadata: false,
    maxCount: "0x3E8", // 1000 in hex
  };

  if (direction === "from") {
    params.fromAddress = address;
  } else {
    params.toAddress = address;
  }

  const response = await fetch(alchemyRpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [params],
    }),
  });

  if (!response.ok) {
    throw new Error(`Alchemy API error: ${response.status}`);
  }

  const data: AlchemyResponse = await response.json();

  if (data.error) {
    throw new Error(`Alchemy error: ${data.error.message}`);
  }

  return data.result?.transfers ?? [];
}

interface InteractionCount {
  address: string;
  txCount: number;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  // Validate address format
  if (!isValidAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Rate limit
  const { success: rateLimitOk } = await checkIpRateLimit(request, rateLimiter);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Too many requests. Retry after 1 minute." },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  const normalizedAddress = address.toLowerCase();

  try {
    // Fetch transfers from Alchemy
    const [outgoingTransfers, incomingTransfers] = await Promise.all([
      fetchAlchemyTransfers(normalizedAddress, "from"),
      fetchAlchemyTransfers(normalizedAddress, "to"),
    ]);

    // Count interactions by unique 'to' addresses from outgoing txs
    const interactionMap = new Map<string, number>();

    for (const tx of outgoingTransfers) {
      if (tx.to) {
        const toAddr = tx.to.toLowerCase();
        interactionMap.set(toAddr, (interactionMap.get(toAddr) ?? 0) + 1);
      }
    }

    // Also count 'from' addresses from incoming txs
    for (const tx of incomingTransfers) {
      if (tx.from) {
        const fromAddr = tx.from.toLowerCase();
        interactionMap.set(fromAddr, (interactionMap.get(fromAddr) ?? 0) + 1);
      }
    }

    // Sort by txCount and take top 20
    const sortedInteractions: InteractionCount[] = Array.from(
      interactionMap.entries()
    )
      .map(([addr, count]) => ({ address: addr, txCount: count }))
      .sort((a, b) => b.txCount - a.txCount)
      .slice(0, 20);

    // Get user for hasReviewed check
    const user = await prisma.user.findUnique({
      where: { address: normalizedAddress },
    });

    // Look up each address in our DB (check both agentScore and legacy project tables)
    const interacted = await Promise.all(
      sortedInteractions.map(async (interaction) => {
        // Check agentScore table first (16K+ ACP agents)
        const agent = await prisma.agentScore.findFirst({
          where: { walletAddress: { equals: interaction.address, mode: 'insensitive' } },
        });

        // Fallback to legacy project table
        const project = !agent ? await prisma.project.findFirst({
          where: { address: interaction.address },
        }) : null;

        const isKnown = !!(agent || project);
        const raw = agent?.rawMetrics as Record<string, unknown> | null;

        let hasReviewed = false;
        if (user && project) {
          const review = await prisma.review.findFirst({
            where: {
              reviewerId: user.id,
              projectId: project.id,
            },
          });
          hasReviewed = !!review;
        }

        if (agent) {
          return {
            name: (raw?.name as string) || agent.walletAddress,
            address: interaction.address,
            category: (raw?.category as string) || null,
            txCount: interaction.txCount,
            isKnown: true,
            hasReviewed: false, // TODO: check TrustReview table
            trustScore: agent.trustScore,
          };
        }

        if (project) {
          return {
            name: project.name,
            address: interaction.address,
            category: project.category,
            txCount: interaction.txCount,
            isKnown: true,
            hasReviewed,
            trustScore: project.trustScore ?? null,
          };
        }

        return {
          name: null,
          address: interaction.address,
          category: null,
          txCount: interaction.txCount,
          isKnown: false,
          hasReviewed: false,
          trustScore: null,
        };
      })
    );

    return NextResponse.json(
      {
        address: normalizedAddress,
        interactedCount: interactionMap.size,
        interacted,
        source: "alchemy",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Interactions API error:", err);

    // Graceful fallback when Alchemy is unavailable
    return NextResponse.json(
      {
        address: normalizedAddress,
        interactedCount: 0,
        interacted: [],
        source: "unavailable",
      },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
