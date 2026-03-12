import {
  GameWorker,
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import { Maiat } from "@jhinresh/maiat-sdk";

/**
 * Maiat Trust Score Plugin for GAME SDK
 * 
 * Lets your Virtuals agent verify trust before swapping or transacting.
 * Powered by Maiat Protocol (https://maiat.io)
 */

interface IMaiatTrustPluginOptions {
  id?: string;
  name?: string;
  description?: string;
  apiUrl?: string;
  apiKey?: string;
  minScore?: number;
}

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
      clientId: "game-node-plugin"
    });

    this.minScore = options.minScore ?? 3.0; // 0–10 scale
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
        "or AI agent. Returns a score (0–10), risk level, and any warning flags.",
      args: [
        {
          name: "identifier",
          description: "Ethereum/Base address OR project name (e.g. 'Uniswap', 'AIXBT').",
          type: "string",
        },
      ] as const,
      executable: async (args: any, logger: any) => {
        try {
          if (!args.identifier) {
            return new ExecutableGameFunctionResponse(
              ExecutableGameFunctionStatus.Failed,
              "identifier is required"
            );
          }

          logger(`[Maiat] Checking trust score for: ${args.identifier}`);
          const res = await this.sdk.agentTrust(args.identifier);

          const score = res.trustScore / 10;
          const risk = res.verdict === "avoid" ? "HIGH" : (res.verdict === "caution" ? "MEDIUM" : "LOW");
          const safe = score >= this.minScore;

          const summary = `Trust score for ${args.identifier}: ${score.toFixed(1)}/10 | Risk: ${risk} | Safe: ${safe ? "YES" : "NO"}`;
          logger(`[Maiat] ${summary}`);

          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Done,
            JSON.stringify({
              address: res.address,
              score,
              risk,
              safe,
              summary
            })
          );
        } catch (e: any) {
          logger(`[Maiat] Error: ${e.message}`);
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Failed to query score: ${e.message}`
          );
        }
      },
    });
  }

  // ── Function 2: gate_swap ─────────────────────
  get gateSwap() {
    return new GameFunction({
      name: "gate_swap",
      description: "Verify both tokens before executing a swap. Returns APPROVED or REJECTED.",
      args: [
        { name: "token_in", description: "Symbol or address of outgoing token.", type: "string" },
        { name: "token_out", description: "Symbol or address of incoming token.", type: "string" },
      ] as const,
      executable: async (args: any, logger: any) => {
        try {
          logger(`[Maiat] Gating swap: ${args.token_in} → ${args.token_out}`);
          const [resIn, resOut] = await Promise.all([
            this.sdk.agentTrust(args.token_in),
            this.sdk.agentTrust(args.token_out),
          ]);

          const scoreIn = resIn.trustScore / 10;
          const scoreOut = resOut.trustScore / 10;

          const rejected: string[] = [];
          if (scoreIn < this.minScore) rejected.push(`${args.token_in} (${scoreIn.toFixed(1)})`);
          if (scoreOut < this.minScore) rejected.push(`${args.token_out} (${scoreOut.toFixed(1)})`);

          if (rejected.length > 0) {
            const reason = `REJECTED: Low trust for ${rejected.join(", ")}`;
            logger(`[Maiat] ${reason}`);
            return new ExecutableGameFunctionResponse(ExecutableGameFunctionStatus.Failed, reason);
          }

          const approval = `APPROVED: Swap safe to proceed. Both tokens pass trust threshold.`;
          logger(`[Maiat] ${approval}`);
          return new ExecutableGameFunctionResponse(ExecutableGameFunctionStatus.Done, approval);
        } catch (e: any) {
          return new ExecutableGameFunctionResponse(ExecutableGameFunctionStatus.Failed, `Gate error: ${e.message}`);
        }
      },
    });
  }

  // ── Function 3: batch_check_trust ─────────────
  get batchCheckTrust() {
    return new GameFunction({
      name: "batch_check_trust",
      description: "Check trust scores for multiple identifiers at once.",
      args: [{ name: "identifiers", description: "Comma-separated list of addresses or names.", type: "string" }] as const,
      executable: async (args: any, logger: any) => {
        try {
          const ids = args.identifiers.split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 10);
          logger(`[Maiat] Batch checking ${ids.length} entries`);

          const results = await Promise.allSettled(ids.map((id: string) => this.sdk.agentTrust(id)));
          const scores = results.map((r: PromiseSettledResult<any>, i: number) => {
            if (r.status === "fulfilled") {
              return { address: r.value.address, score: r.value.trustScore / 10, risk: r.value.verdict };
            }
            return { address: ids[i], error: (r as any).reason?.message };
          });

          return new ExecutableGameFunctionResponse(ExecutableGameFunctionStatus.Done, JSON.stringify(scores));
        } catch (e: any) {
          return new ExecutableGameFunctionResponse(ExecutableGameFunctionStatus.Failed, e.message);
        }
      },
    });
  }
}

export { MaiatTrustPlugin };
export default MaiatTrustPlugin;
