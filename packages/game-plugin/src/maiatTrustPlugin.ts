import {
  GameWorker,
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import { Maiat } from "@jhinresh/maiat-sdk";

// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────

const DEFAULT_MIN_SCORE = 3.0; // 0–10 scale

interface IMaiatTrustPluginOptions {
  id?: string;
  name?: string;
  description?: string;
  apiUrl?: string;
  apiKey?: string;
  minScore?: number;
  chain?: string;
}

interface TrustResponse {
  address: string;
  score: number;
  risk: "low" | "medium" | "high" | "unknown";
  type: string;
  flags: string[];
  safe: boolean;
  source: string;
}

// ─────────────────────────────────────────────
//  Plugin class
// ─────────────────────────────────────────────

class MaiatTrustPlugin {
  private id: string;
  private name: string;
  private description: string;
  private sdk: Maiat;
  private minScore: number;

  constructor(options: IMaiatTrustPluginOptions = {}) {
    this.id = options.id ?? "maiat_trust_worker";
    this.name = options.name ?? "Maiat Trust Score Worker";
    this.description =
      options.description ??
      "Queries Maiat Protocol for trust scores of on-chain addresses, tokens, " +
        "DeFi protocols, and AI agents. Use before executing any swap, transfer, " +
        "or interaction to assess counterparty risk.";
    
    this.sdk = new Maiat({
      baseUrl: options.apiUrl,
      apiKey: options.apiKey,
      framework: "game-engine",
      clientId: "game-plugin-standard"
    });
    
    this.minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  }

  public getWorker(data?: {
    functions?: GameFunction<any>[];
    getEnvironment?: () => Promise<Record<string, any>>;
  }): GameWorker {
    return new GameWorker({
      id: this.id,
      name: this.name,
      description: this.description,
      functions: data?.functions ?? [
        this.checkTrustScore,
        this.gateSwap,
        this.batchCheckTrust,
      ],
      getEnvironment: data?.getEnvironment,
    });
  }

  // ── Function 1: check_trust_score ─────────────
  get checkTrustScore() {
    return new GameFunction({
      name: "check_trust_score",
      description:
        "Query the Maiat trust score for an on-chain address, token, DeFi protocol, " +
        "or AI agent. Returns a score (0–10), risk level, and any warning flags. " +
        "Use this before interacting with an unknown address or protocol.",
      args: [
        {
          name: "identifier",
          description:
            "Ethereum/Base address (0x...) OR project/agent name (e.g. 'Uniswap', 'AIXBT').",
          type: "string",
        }
      ] as const,
      executable: async (args: any, logger: any) => {
        try {
          if (!args.identifier) {
            return new ExecutableGameFunctionResponse(
              ExecutableGameFunctionStatus.Failed,
              "identifier is required (address or project name)"
            );
          }

          logger(`[Maiat] Checking trust score for: ${args.identifier}`);

          const res = await this.sdk.agentTrust(args.identifier);
          
          const result: TrustResponse = {
            address: res.address,
            score: res.trustScore / 10,
            risk: res.verdict === 'avoid' ? 'high' : (res.verdict === 'caution' ? 'medium' : 'low'),
            type: res.dataSource,
            flags: [],
            safe: (res.trustScore / 10) >= this.minScore,
            source: "maiat"
          };

          const summary =
            `Trust score for ${args.identifier}: ${result.score.toFixed(1)}/10 ` +
            `| Risk: ${result.risk.toUpperCase()} ` +
            `| Safe: ${result.safe ? "YES" : "NO"}`;

          logger(`[Maiat] ${summary}`);

          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Done,
            JSON.stringify({ ...result, summary })
          );
        } catch (e: any) {
          logger(`[Maiat] Error: ${e.message}`);
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Failed to query trust score: ${e.message}`
          );
        }
      },
    });
  }

  // ── Function 2: gate_swap ─────────────────────
  get gateSwap() {
    return new GameFunction({
      name: "gate_swap",
      description:
        "Check whether a swap is safe to execute based on Maiat trust scores for " +
        "both the input and output tokens. Returns APPROVED or REJECTED with reasons. " +
        "Always call this before executing a token swap.",
      args: [
        {
          name: "token_in",
          description: "Address or name of the token being sold (input token).",
          type: "string",
        },
        {
          name: "token_out",
          description: "Address or name of the token being bought (output token).",
          type: "string",
        },
        {
          name: "min_score",
          description: `Minimum trust score required (0–10).`,
          type: "number",
          optional: true,
        },
      ] as const,
      executable: async (args: any, logger: any) => {
        try {
          if (!args.token_in || !args.token_out) {
            return new ExecutableGameFunctionResponse(
              ExecutableGameFunctionStatus.Failed,
              "Both token_in and token_out are required"
            );
          }

          const minScore = args.min_score ?? this.minScore;
          logger(`[Maiat] Gating swap: ${args.token_in} → ${args.token_out} (min score: ${minScore})`);

          const [resIn, resOut] = await Promise.all([
            this.sdk.agentTrust(args.token_in),
            this.sdk.agentTrust(args.token_out),
          ]);

          const scoreIn = resIn.trustScore / 10;
          const scoreOut = resOut.trustScore / 10;

          const rejected: string[] = [];
          if (scoreIn < minScore) {
            rejected.push(
              `${args.token_in} score ${scoreIn.toFixed(1)} < ${minScore}`
            );
          }
          if (scoreOut < minScore) {
            rejected.push(
              `${args.token_out} score ${scoreOut.toFixed(1)} < ${minScore}`
            );
          }

          if (rejected.length > 0) {
            const reason = `REJECTED: ${rejected.join("; ")}`;
            logger(`[Maiat] ${reason}`);
            return new ExecutableGameFunctionResponse(
              ExecutableGameFunctionStatus.Failed,
              reason
            );
          }

          const approval =
            `APPROVED: ${args.token_in} (${scoreIn.toFixed(1)}/10) → ` +
            `${args.token_out} (${scoreOut.toFixed(1)}/10) — both pass threshold`;
          logger(`[Maiat] ${approval}`);

          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Done,
            JSON.stringify({
              approved: true,
              message: approval,
            })
          );
        } catch (e: any) {
          logger(`[Maiat] Error: ${e.message}`);
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Failed to gate swap: ${e.message}`
          );
        }
      },
    });
  }

  // ── Function 3: batch_check_trust ─────────────
  get batchCheckTrust() {
    return new GameFunction({
      name: "batch_check_trust",
      description:
        "Check trust scores for multiple addresses or project names at once. " +
        "Returns a ranked list with risk levels. Useful for comparing options before trading.",
      args: [
        {
          name: "identifiers",
          description: "Comma-separated list of addresses or project names.",
          type: "string",
        },
      ] as const,
      executable: async (args: any, logger: any) => {
        try {
          if (!args.identifiers) {
            return new ExecutableGameFunctionResponse(
              ExecutableGameFunctionStatus.Failed,
              "identifiers is required (comma-separated list)"
            );
          }

          const ids = args.identifiers
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
            .slice(0, 10); // max 10

          logger(`[Maiat] Batch checking ${ids.length} identifiers`);

          const results = await Promise.allSettled(
            ids.map((id: string) => this.sdk.agentTrust(id))
          );

          const scores = results.map((r, i) => {
            if (r.status === "fulfilled") {
              return {
                address: r.value.address,
                score: r.value.trustScore / 10,
                risk: r.value.verdict,
                safe: (r.value.trustScore / 10) >= this.minScore
              };
            } else {
              return { address: ids[i], score: 0, risk: "unknown", safe: false, error: (r as any).reason?.message };
            }
          });

          // Sort by score descending
          scores.sort((a: any, b: any) => b.score - a.score);

          logger(`[Maiat] Batch complete. Top: ${scores[0]?.address} (${scores[0]?.score?.toFixed(1)}/10)`);

          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Done,
            JSON.stringify({ count: scores.length, results: scores })
          );
        } catch (e: any) {
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Batch check failed: ${e.message}`
          );
        }
      },
    });
  }
}

export { MaiatTrustPlugin };
export type { IMaiatTrustPluginOptions, TrustResponse };
export default MaiatTrustPlugin;
