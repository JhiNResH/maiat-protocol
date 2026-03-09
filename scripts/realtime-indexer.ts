/**
 * scripts/realtime-indexer.ts
 *
 * Maiat Real-Time Indexer
 * =======================
 * Persistent process for Railway deployment.
 *
 * 1. Polls Virtuals ACP REST API every 5 min for agent updates
 * 2. Listens to Base mainnet events (EAS attestations, ERC-8004 registrations)
 * 3. Serves health endpoint on PORT
 *
 * Run: npx tsx scripts/realtime-indexer.ts
 * Deploy: Railway worker process
 */

import "dotenv/config";
import http from "node:http";
import { createPublicClient, http as viemHttp, webSocket, parseAbiItem, type Address } from "viem";
import { base } from "viem/chains";
import { PrismaClient } from "@prisma/client";
import { runAcpIndexer, type IndexerResult } from "../src/lib/acp-indexer";

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3001", 10);
const ACP_POLL_INTERVAL = parseInt(process.env.ACP_POLL_INTERVAL_MS || "300000", 10); // 5 min
const BASE_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const BASE_WSS = process.env.BASE_WSS_URL || ""; // Optional WebSocket URL

// Contracts
const EAS_ADDRESS = "0x4200000000000000000000000000000000000021" as Address;
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address;
const ORACLE_ADDRESS = (process.env.MAIAT_ORACLE_ADDRESS || "") as Address;

// Events
const EAS_ATTESTED_EVENT = parseAbiItem(
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaId)"
);
const ERC8004_REGISTERED_EVENT = parseAbiItem(
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)"
);

// ─── State ────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();
let lastAcpResult: IndexerResult | null = null;
let lastAcpTime: Date | null = null;
let eventCount = { eas: 0, erc8004: 0, oracle: 0 };
let startTime = new Date();
let isShuttingDown = false;
let acpTimer: ReturnType<typeof setInterval> | null = null;
let unwatchEas: (() => void) | null = null;
let unwatchErc8004: (() => void) | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 5000; // Start at 5s, max 60s

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(tag: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${tag}] ${msg}`);
}

// ─── ACP Poller ───────────────────────────────────────────────────────────────

async function runAcpPoll() {
  if (isShuttingDown) return;
  log("acp-poll", "Starting ACP index...");
  try {
    const result = await runAcpIndexer({ dryRun: false, prisma });
    lastAcpResult = result;
    lastAcpTime = new Date();
    log("acp-poll", `Done — indexed: ${result.indexed}, updated: ${result.updated}, failed: ${result.failed}`);
  } catch (err) {
    log("acp-poll", `ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Event Listeners (WebSocket) ──────────────────────────────────────────────

function startEventListeners() {
  if (!BASE_WSS) {
    log("events", "No BASE_WSS_URL configured — using HTTP polling fallback");
    startHttpEventPolling();
    return;
  }

  log("events", `Connecting to WebSocket: ${BASE_WSS.replace(/\/[^/]*$/, "/***")}`);

  try {
    const wsClient = createPublicClient({
      chain: base,
      transport: webSocket(BASE_WSS),
    });

    // Watch EAS Attested events
    unwatchEas = wsClient.watchContractEvent({
      address: EAS_ADDRESS,
      event: EAS_ATTESTED_EVENT as any,
      onLogs: (logs) => {
        for (const l of logs) {
          eventCount.eas++;
          const args = l.args as any;
          log("eas-event", `Attestation: recipient=${args.recipient?.slice(0, 10)}... schema=${args.schemaId?.slice(0, 10)}... uid=${args.uid?.slice(0, 10)}...`);
        }
      },
      onError: (err) => {
        log("eas-event", `ERROR: ${err.message}`);
      },
    });

    // Watch ERC-8004 Registered events
    unwatchErc8004 = wsClient.watchContractEvent({
      address: IDENTITY_REGISTRY,
      event: ERC8004_REGISTERED_EVENT as any,
      onLogs: async (logs) => {
        for (const l of logs) {
          eventCount.erc8004++;
          const args = l.args as any;
          log("8004-event", `New agent registered: agentId=${args.agentId} owner=${args.owner}`);

          // Update agent in DB if we have them
          try {
            if (args.owner) {
              await prisma.agentScore.updateMany({
                where: { walletAddress: { equals: args.owner, mode: "insensitive" } },
                data: { lastUpdated: new Date() },
              });
            }
          } catch (err) {
            log("8004-event", `DB update failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      },
      onError: (err) => {
        log("8004-event", `ERROR: ${err.message}`);
      },
    });

    reconnectDelay = 5000; // Reset on successful connect
    log("events", "WebSocket listeners active — watching EAS + ERC-8004 events");

  } catch (err) {
    log("events", `WebSocket connection failed: ${err instanceof Error ? err.message : String(err)}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (isShuttingDown) return;
  log("events", `Reconnecting in ${reconnectDelay / 1000}s...`);
  reconnectTimeout = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 60000); // Exponential backoff, max 60s
    startEventListeners();
  }, reconnectDelay);
}

// ─── HTTP Event Polling (fallback when no WebSocket) ──────────────────────────

let httpPollTimer: ReturnType<typeof setInterval> | null = null;

function startHttpEventPolling() {
  const httpClient = createPublicClient({
    chain: base,
    transport: viemHttp(BASE_RPC),
  });

  let lastBlock = 0n;

  async function pollEvents() {
    if (isShuttingDown) return;
    try {
      const currentBlock = await httpClient.getBlockNumber();
      if (lastBlock === 0n) {
        lastBlock = currentBlock - 100n; // Start 100 blocks back on first run
      }

      if (currentBlock <= lastBlock) return;

      // Poll EAS events
      const easLogs = await httpClient.getLogs({
        address: EAS_ADDRESS,
        event: EAS_ATTESTED_EVENT as any,
        fromBlock: lastBlock + 1n,
        toBlock: currentBlock,
      });

      for (const l of easLogs) {
        eventCount.eas++;
        const args = l.args as any;
        log("eas-poll", `Attestation: recipient=${args.recipient?.slice(0, 10)}... block=${l.blockNumber}`);
      }

      // Poll ERC-8004 events
      const erc8004Logs = await httpClient.getLogs({
        address: IDENTITY_REGISTRY,
        event: ERC8004_REGISTERED_EVENT as any,
        fromBlock: lastBlock + 1n,
        toBlock: currentBlock,
      });

      for (const l of erc8004Logs) {
        eventCount.erc8004++;
        const args = l.args as any;
        log("8004-poll", `New agent: agentId=${args.agentId} owner=${args.owner} block=${l.blockNumber}`);
      }

      lastBlock = currentBlock;
    } catch (err) {
      log("http-poll", `ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Poll every 30 seconds
  httpPollTimer = setInterval(pollEvents, 30_000);
  pollEvents(); // Initial poll
  log("events", "HTTP event polling active (every 30s)");
}

// ─── Health Endpoint ──────────────────────────────────────────────────────────

function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      const uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        uptime: `${uptime}s`,
        lastAcpIndex: lastAcpTime?.toISOString() ?? null,
        lastAcpResult: lastAcpResult ? {
          indexed: lastAcpResult.indexed,
          updated: lastAcpResult.updated,
        } : null,
        events: eventCount,
        config: {
          acpPollInterval: `${ACP_POLL_INTERVAL / 1000}s`,
          wsEnabled: !!BASE_WSS,
          oracleAddress: ORACLE_ADDRESS || null,
        },
      }));
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  server.listen(PORT, () => {
    log("health", `Health endpoint listening on :${PORT}`);
  });

  return server;
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  log("shutdown", `Received ${signal} — shutting down...`);
  isShuttingDown = true;

  if (acpTimer) clearInterval(acpTimer);
  if (httpPollTimer) clearInterval(httpPollTimer);
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (unwatchEas) unwatchEas();
  if (unwatchErc8004) unwatchErc8004();

  await prisma.$disconnect();
  log("shutdown", "Clean shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("main", "🚀 Maiat Real-Time Indexer starting...");
  log("main", `   ACP poll interval: ${ACP_POLL_INTERVAL / 1000}s`);
  log("main", `   WebSocket: ${BASE_WSS ? "enabled" : "disabled (HTTP fallback)"}`);
  log("main", `   Health port: ${PORT}`);

  // Start health server
  startHealthServer();

  // Run immediate ACP index
  await runAcpPoll();

  // Start periodic ACP polling
  acpTimer = setInterval(runAcpPoll, ACP_POLL_INTERVAL);

  // Start event listeners
  startEventListeners();

  log("main", "✅ Indexer running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  log("fatal", `${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
