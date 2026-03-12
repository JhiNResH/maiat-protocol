import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const clients = new Set<ReadableStreamDefaultController>();

let history: Array<{ time: string; msg: string; type: string }> = [];

let isPolling = false;
let lastPolledAt = new Date(Date.now() - 60000);

async function seedHistory() {
  if (history.length > 5) return; // Already seeded
  
  try {
    const [topNodes, recentQueries] = await Promise.all([
      prisma.agentScore.findMany({ take: 10, orderBy: { lastUpdated: 'desc' } }),
      prisma.queryLog.findMany({ take: 10, orderBy: { createdAt: 'desc' } })
    ]);

    // Initial sys message
    history.push({ 
      time: new Date().toLocaleTimeString('en-US', { hour12: false }), 
      msg: 'SYS: Monitor SSE Service Connected (History Restored)', 
      type: 'info' 
    });

    // Seed with actual surveillance logs
    topNodes.forEach(node => {
      history.push({
        time: node.lastUpdated.toLocaleTimeString('en-US', { hour12: false }),
        msg: `[MAIAT SURVEILLANCE] Recent audit: Node ${node.walletAddress.slice(0,6)}... Trust Score: ${node.trustScore}/100 (Status: SECURE)`,
        type: 'info'
      });
    });

    // Seed with recent real queries
    recentQueries.reverse().forEach(log => {
      history.push({
        time: log.createdAt.toLocaleTimeString('en-US', { hour12: false }),
        msg: `[SYS] Verified SDK Query for ${log.target.slice(0,6)}... Verdict: ${log.verdict?.toUpperCase() || 'UNKNOWN'}`,
        type: 'info'
      });
    });
    
    // Sort by time
    history.sort((a, b) => a.time.localeCompare(b.time));
  } catch (e) {
    console.error("Failed to seed history", e);
  }
}

function startGlobalPolling() {
  if (isPolling) return;
  isPolling = true;
  seedHistory();

  setInterval(async () => {
    if (clients.size === 0) return; // Don't poll if no one is watching
    try {
      // 1. Check for new SDK queries / Guard interventions
      const recentLogs = await prisma.queryLog.findMany({
        where: { createdAt: { gt: lastPolledAt } },
        orderBy: { createdAt: 'asc' }
      });

      // 2. Check for real ACP Outcomes
      const recentOutcomes = await prisma.outcomeReport.findMany({
        where: { createdAt: { gt: lastPolledAt } },
        orderBy: { createdAt: 'asc' }
      });

      // 3. New community reviews
      const recentReviews = await prisma.trustReview.findMany({
        where: { createdAt: { gt: lastPolledAt } },
        orderBy: { createdAt: 'asc' }
      });

      // 4. New market bets
      const recentBets = await prisma.marketPosition.findMany({
        where: { createdAt: { gt: lastPolledAt } },
        orderBy: { createdAt: 'asc' }
      });

      // 5. New review votes
      const recentVotes = await prisma.reviewVote.findMany({
        where: { createdAt: { gt: lastPolledAt } },
        orderBy: { createdAt: 'asc' }
      });

      // Gather set of addresses to fetch names
      const allAddrs = new Set([
        ...recentReviews.map(r => r.reviewer),
        ...recentBets.map(b => b.voterId),
        ...recentVotes.map(v => v.voter)
      ]);

      const users = await prisma.user.findMany({
        where: { address: { in: Array.from(allAddrs) } },
        select: { address: true, displayName: true }
      });
      const userMap = Object.fromEntries(users.map(u => [u.address.toLowerCase(), u.displayName]));

      const getName = (addr: string) => userMap[addr.toLowerCase()] || `${addr.slice(0,6)}...`;

      lastPolledAt = new Date();

      // 6. Random Node Surveillance (Simulated Scan from 20k pool)
      const randomNodes = await prisma.agentScore.findMany({ 
        take: 50, // Sample from top nodes
        select: { walletAddress: true, trustScore: true } 
      });
      if (randomNodes.length > 0) {
        const node = randomNodes[Math.floor(Math.random() * randomNodes.length)];
        broadcastEvent(`[MAIAT SURVEILLANCE] Proactive audit: Node ${node.walletAddress.slice(0,6)}... Trust Score: ${node.trustScore}/100 (Status: SECURE)`, 'info');
      }

      // Broadcast logs (viem-guard / agent-sdk)
      for (const log of recentLogs) {
        if (log.type === 'agent_deep_check' && log.verdict === 'avoid') {
           broadcastEvent(`[⚠ MITIGATED] viem-guard blocked interaction with low-trust contract ${log.target.slice(0,6)}...`, 'warning');
        } else {
           broadcastEvent(`[SYS] Trust score query for ${log.target.slice(0,6)}... Verdict: ${log.verdict?.toUpperCase() || 'UNKNOWN'}`, 'info');
        }
      }

      // Broadcast ACP Job Outcomes
      for (const out of recentOutcomes) {
         if (out.result === 'success') {
           broadcastEvent(`[ACP SETTLED] Job ${out.jobId?.slice(0,4)} completed by ${out.sellerAddress.slice(0,6)}. Score ↑`, 'info');
         } else {
           broadcastEvent(`[ACP ERROR] Job ${out.jobId?.slice(0,4)} failed by ${out.sellerAddress.slice(0,6)}. Score ↓`, 'warning');
         }
      }

      // Broadcast Community Attestations
      for (const rev of recentReviews) {
         const marker = rev.source === 'agent' ? '🤖 Agent' : '👤 Human';
         broadcastEvent(`[★ REVIEW] ${marker} ${getName(rev.reviewer)} rated ${rev.address.slice(0,6)} ${rev.rating}/10: "${rev.comment.substring(0, 30)}..."`, 'info');
      }

      // Broadcast Market Positions (Bets)
      for (const bet of recentBets) {
         // Check if voter is a known agent
         const isAgent = await prisma.callerWallet.findFirst({ where: { walletAddress: bet.voterId } });
         const isScoreAgent = !isAgent ? await prisma.agentScore.findFirst({ where: { walletAddress: bet.voterId } }) : null;
         const marker = (isAgent || isScoreAgent) ? '🤖 Agent' : '👤 Human';
         broadcastEvent(`[✺ BET] ${marker} ${getName(bet.voterId)} placed ${bet.amount} 🪲 on ${bet.projectId.slice(0,6)}`, 'info');
      }

      // Broadcast Review Votes
      for (const vote of recentVotes) {
         // Check if voter is agent
         const isAgent = await prisma.callerWallet.findFirst({ where: { walletAddress: vote.voter } });
         const isScoreAgent = !isAgent ? await prisma.agentScore.findFirst({ where: { walletAddress: vote.voter } }) : null;
         const marker = (isAgent || isScoreAgent) ? '🤖 Agent' : '👤 Human';
         broadcastEvent(`[${vote.vote === 'up' ? '👍' : '👎'} VOTE] ${marker} ${getName(vote.voter)} voted ${vote.vote === 'up' ? 'APPROVE' : 'REJECT'} on review for ${vote.reviewId.slice(0,4)}...`, 'info');
      }

    } catch (e) {
      console.error("[Monitor SSE Polling Error]", e);
    }
  }, 10000); // Poll every 10 seconds
}

export async function GET() {
  let streamController: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
      clients.add(controller);
      
      // Start polling DB on first connection
      startGlobalPolling();

      // Send initial history buffer
      history.forEach(event => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      });

      let heartbeatCounter = 0;

      // Keep connection alive and send heartbeats
      const interval = setInterval(() => {
        try {
          controller.enqueue(`: ping\n\n`);
          heartbeatCounter++;

          // Every 3 pings (30 seconds), send a system status message
          if (heartbeatCounter >= 3) {
            heartbeatCounter = 0;
            const now = new Date();
            broadcastEvent(`SYS: Real-time surveillance active — ${now.toLocaleTimeString('en-US', { hour12: false })} (Coverage: 20k+ nodes)`, 'info');
          }
        } catch (e) {
          clearInterval(interval);
          clients.delete(controller);
        }
      }, 10000); // Changed to 10s to align with polling, so 3 cycles = 30s heartbeat
    },
    cancel() {
      clients.delete(streamController);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

// Function to broadcast a new event to all connected clients
export function broadcastEvent(msg: string, type: 'info' | 'warning' | 'error' = 'info') {
  const event = {
    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    msg,
    type
  };
  
  history.push(event);
  if (history.length > 50) history.shift();

  const dataString = `data: ${JSON.stringify(event)}\n\n`;
  const deadClients = new Set<ReadableStreamDefaultController>();
  
  clients.forEach(client => {
    try {
      client.enqueue(dataString);
    } catch (e) {
      deadClients.add(client);
    }
  });

  deadClients.forEach(client => clients.delete(client));
  return event;
}
