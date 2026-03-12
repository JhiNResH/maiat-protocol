import { Maiat } from "@jhinresh/maiat-sdk";

export interface MaiatElizaConfig {
  apiUrl?: string;
  apiKey?: string;
  chain?: string;
  minScore?: number;
}

/**
 * ElizaOS plugin definition following the standard plugin interface.
 */
export function maiatPlugin(config: MaiatElizaConfig = {}) {
  const sdk = new Maiat({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
    framework: "elizaos",
    clientId: "elizaos-plugin-standard"
  });

  const minScore = config.minScore ?? 60; // SDK uses 0-100 scale

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
            const result = await sdk.agentTrust(match[0]);
            const safe = result.trustScore >= minScore;
            const emoji = safe ? "🟢" : result.verdict === "avoid" ? "🔴" : "🟡";

            return {
              text: `${emoji} **Trust Score: ${result.trustScore}/100** (${result.verdict} verdict)\n\nAddress: \`${result.address}\`\nSource: ${result.dataSource}\nJobs: ${result.breakdown.totalJobs}\n\n${safe ? "✅ Safe to interact." : "⚠️ Exercise caution — score below threshold."}`,
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
            const result = await sdk.agentTrust(context.address);
            const safe = result.trustScore >= minScore;
            return {
              pass: safe,
              score: result.trustScore,
              verdict: result.verdict,
              reason: safe
                ? `Address trusted (${result.trustScore}/100)`
                : `Address untrusted (${result.trustScore}/100, ${result.verdict} verdict)`,
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
            text: `You have access to Maiat trust scoring. Before interacting with any unknown on-chain address, use CHECK_TRUST to verify it's safe. Addresses scoring below ${minScore}/100 should be avoided.`,
          };
        },
      },
    ],
  };
}

export default maiatPlugin;
