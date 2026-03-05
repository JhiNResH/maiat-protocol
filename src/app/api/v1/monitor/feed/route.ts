import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const clients = new Set<ReadableStreamDefaultController>();

let history: Array<{ time: string; msg: string; type: string }> = [
  { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'SYS: Monitor SSE Service Initialized (REAL DATA MODE)', type: 'info' }
];

let isPolling = false;
let lastPolledAt = new Date();

function startGlobalPolling() {
  if (isPolling) return;
  isPolling = true;

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

      lastPolledAt = new Date();

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
         broadcastEvent(`[✓ VERIFIED] New on-chain attestation recorded for ${rev.address.slice(0,6)}... Rating is ${rev.rating}/5.`, 'info');
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

      // Keep connection alive
      const interval = setInterval(() => {
        try {
          controller.enqueue(`: ping\n\n`);
        } catch (e) {
          clearInterval(interval);
          clients.delete(controller);
        }
      }, 30000);
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
