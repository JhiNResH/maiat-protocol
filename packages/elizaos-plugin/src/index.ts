/**
 * @maiat/elizaos-plugin
 * 
 * Maiat Trust Score plugin for ElizaOS (ai16z agent framework).
 * 
 * Adds trust checking capabilities to any ElizaOS agent:
 * - "Is this address safe?" → trust score lookup
 * - Auto-gate transactions before execution
 * - Report transaction outcomes back to Maiat
 * 
 * @example
 * ```typescript
 * import { maiatPlugin } from "@maiat/elizaos-plugin";
 * 
 * const agent = new ElizaAgent({
 *   plugins: [maiatPlugin({ minScore: 3.0 })],
 * });
 * ```
 */

// ═══════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════

export interface MaiatElizaConfig {
  apiUrl?: string;
  apiKey?: string;
  chain?: string;
  minScore?: number;
}

interface TrustResult {
  address: string;
  score: number;
  risk: string;
  type: string;
  flags: string[];
  safe: boolean;
}

// ═══════════════════════════════════════════
//  API Client (lightweight)
// ═══════════════════════════════════════════

async function queryMaiat(
  address: string,
  config: MaiatElizaConfig
): Promise<TrustResult> {
  const apiUrl = config.apiUrl || "https://maiat-protocol.vercel.app";
  const chain = config.chain || "base";
  const minScore = config.minScore ?? 3.0;

  const headers: Record<string, string> = {
    "User-Agent": "maiat-elizaos-plugin/0.1.0",
  };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const res = await fetch(`${apiUrl}/api/v1/score/${address}?chain=${chain}`, { headers });

  if (!res.ok) {
    throw new Error(`Maiat API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    address: data.address,
    score: data.score,
    risk: data.risk,
    type: data.type,
    flags: data.flags || [],
    safe: data.score >= minScore,
  };
}

// ═══════════════════════════════════════════
//  ElizaOS Plugin
// ═══════════════════════════════════════════

/**
 * ElizaOS plugin definition following the standard plugin interface.
 * 
 * Registers:
 * - Action: CHECK_TRUST — responds to "is 0x... safe?" type queries
 * - Evaluator: TRUST_GATE — evaluates if an address should be interacted with
 * - Provider: TRUST_DATA — provides trust context for agent reasoning
 */
export function maiatPlugin(config: MaiatElizaConfig = {}) {
  return {
    name: "maiat-trust",
    description: "Trust scoring for on-chain addresses via Maiat Protocol",

    actions: [
      {
        name: "CHECK_TRUST",
        description: "Check the trust score of an on-chain address",
        examples: [
          "Is 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24 safe?",
          "Check trust score for 0x1234...",
          "Should I interact with this address: 0xabcd...?",
        ],
        validate: async (message: string) => {
          return /0x[a-fA-F0-9]{40}/.test(message);
        },
        handler: async (message: string) => {
          const match = message.match(/0x[a-fA-F0-9]{40}/);
          if (!match) return { text: "Please provide a valid Ethereum address (0x...)" };

          try {
            const result = await queryMaiat(match[0], config);
            const emoji = result.safe ? "🟢" : result.risk === "CRITICAL" ? "🔴" : "🟡";

            return {
              text: `${emoji} **Trust Score: ${result.score}/10** (${result.risk} risk)\n\nAddress: \`${result.address}\`\nType: ${result.type}\nFlags: ${result.flags.join(", ") || "None"}\n\n${result.safe ? "✅ Safe to interact." : "⚠️ Exercise caution — low trust score."}`,
              data: result,
            };
          } catch (error) {
            return {
              text: `❌ Could not check trust score: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      },
    ],

    evaluators: [
      {
        name: "TRUST_GATE",
        description: "Evaluates if a target address meets minimum trust requirements",
        handler: async (context: { address?: string }) => {
          if (!context.address) return { pass: true, reason: "No address to check" };

          try {
            const result = await queryMaiat(context.address, config);
            return {
              pass: result.safe,
              score: result.score,
              risk: result.risk,
              reason: result.safe
                ? `Address trusted (${result.score}/10)`
                : `Address untrusted (${result.score}/10, ${result.risk} risk)`,
            };
          } catch {
            return { pass: false, reason: "Trust check failed — blocking by default" };
          }
        },
      },
    ],

    providers: [
      {
        name: "TRUST_DATA",
        description: "Provides trust scoring context for agent reasoning",
        handler: async () => {
          return {
            text: "You have access to Maiat trust scoring. Before interacting with any unknown on-chain address, use CHECK_TRUST to verify it's safe. Addresses scoring below 3.0/10 should be avoided.",
          };
        },
      },
    ],
  };
}

export default maiatPlugin;
