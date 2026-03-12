"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  MaiatTrustPlugin: () => maiatTrustPlugin_default
});
module.exports = __toCommonJS(index_exports);

// src/maiatTrustPlugin.ts
var import_game = require("@virtuals-protocol/game");
var import_maiat_sdk = require("maiat-sdk");
var DEFAULT_MIN_SCORE = 3;
var MaiatTrustPlugin = class {
  constructor(options = {}) {
    this.id = options.id ?? "maiat_trust_worker";
    this.name = options.name ?? "Maiat Trust Score Worker";
    this.description = options.description ?? "Queries Maiat Protocol for trust scores of on-chain addresses, tokens, DeFi protocols, and AI agents. Use before executing any swap, transfer, or interaction to assess counterparty risk.";
    this.sdk = new import_maiat_sdk.Maiat({
      baseUrl: options.apiUrl,
      apiKey: options.apiKey,
      framework: "game-engine",
      clientId: "game-plugin-standard"
    });
    this.minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  }
  getWorker(data) {
    return new import_game.GameWorker({
      id: this.id,
      name: this.name,
      description: this.description,
      functions: data?.functions ?? [
        this.checkTrustScore,
        this.gateSwap,
        this.batchCheckTrust
      ],
      getEnvironment: data?.getEnvironment
    });
  }
  // ── Function 1: check_trust_score ─────────────
  get checkTrustScore() {
    return new import_game.GameFunction({
      name: "check_trust_score",
      description: "Query the Maiat trust score for an on-chain address, token, DeFi protocol, or AI agent. Returns a score (0\u201310), risk level, and any warning flags. Use this before interacting with an unknown address or protocol.",
      args: [
        {
          name: "identifier",
          description: "Ethereum/Base address (0x...) OR project/agent name (e.g. 'Uniswap', 'AIXBT').",
          type: "string"
        }
      ],
      executable: async (args, logger) => {
        try {
          if (!args.identifier) {
            return new import_game.ExecutableGameFunctionResponse(
              import_game.ExecutableGameFunctionStatus.Failed,
              "identifier is required (address or project name)"
            );
          }
          logger(`[Maiat] Checking trust score for: ${args.identifier}`);
          const res = await this.sdk.agentTrust(args.identifier);
          const result = {
            address: res.address,
            score: res.trustScore / 10,
            risk: res.verdict === "avoid" ? "high" : res.verdict === "caution" ? "medium" : "low",
            type: res.dataSource,
            flags: [],
            safe: res.trustScore / 10 >= this.minScore,
            source: "maiat"
          };
          const summary = `Trust score for ${args.identifier}: ${result.score.toFixed(1)}/10 | Risk: ${result.risk.toUpperCase()} | Safe: ${result.safe ? "YES" : "NO"}`;
          logger(`[Maiat] ${summary}`);
          return new import_game.ExecutableGameFunctionResponse(
            import_game.ExecutableGameFunctionStatus.Done,
            JSON.stringify({ ...result, summary })
          );
        } catch (e) {
          logger(`[Maiat] Error: ${e.message}`);
          return new import_game.ExecutableGameFunctionResponse(
            import_game.ExecutableGameFunctionStatus.Failed,
            `Failed to query trust score: ${e.message}`
          );
        }
      }
    });
  }
  // ── Function 2: gate_swap ─────────────────────
  get gateSwap() {
    return new import_game.GameFunction({
      name: "gate_swap",
      description: "Check whether a swap is safe to execute based on Maiat trust scores for both the input and output tokens. Returns APPROVED or REJECTED with reasons. Always call this before executing a token swap.",
      args: [
        {
          name: "token_in",
          description: "Address or name of the token being sold (input token).",
          type: "string"
        },
        {
          name: "token_out",
          description: "Address or name of the token being bought (output token).",
          type: "string"
        },
        {
          name: "min_score",
          description: `Minimum trust score required (0\u201310).`,
          type: "number",
          optional: true
        }
      ],
      executable: async (args, logger) => {
        try {
          if (!args.token_in || !args.token_out) {
            return new import_game.ExecutableGameFunctionResponse(
              import_game.ExecutableGameFunctionStatus.Failed,
              "Both token_in and token_out are required"
            );
          }
          const minScore = args.min_score ?? this.minScore;
          logger(`[Maiat] Gating swap: ${args.token_in} \u2192 ${args.token_out} (min score: ${minScore})`);
          const [resIn, resOut] = await Promise.all([
            this.sdk.agentTrust(args.token_in),
            this.sdk.agentTrust(args.token_out)
          ]);
          const scoreIn = resIn.trustScore / 10;
          const scoreOut = resOut.trustScore / 10;
          const rejected = [];
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
            return new import_game.ExecutableGameFunctionResponse(
              import_game.ExecutableGameFunctionStatus.Failed,
              reason
            );
          }
          const approval = `APPROVED: ${args.token_in} (${scoreIn.toFixed(1)}/10) \u2192 ${args.token_out} (${scoreOut.toFixed(1)}/10) \u2014 both pass threshold`;
          logger(`[Maiat] ${approval}`);
          return new import_game.ExecutableGameFunctionResponse(
            import_game.ExecutableGameFunctionStatus.Done,
            JSON.stringify({
              approved: true,
              message: approval
            })
          );
        } catch (e) {
          logger(`[Maiat] Error: ${e.message}`);
          return new import_game.ExecutableGameFunctionResponse(
            import_game.ExecutableGameFunctionStatus.Failed,
            `Failed to gate swap: ${e.message}`
          );
        }
      }
    });
  }
  // ── Function 3: batch_check_trust ─────────────
  get batchCheckTrust() {
    return new import_game.GameFunction({
      name: "batch_check_trust",
      description: "Check trust scores for multiple addresses or project names at once. Returns a ranked list with risk levels. Useful for comparing options before trading.",
      args: [
        {
          name: "identifiers",
          description: "Comma-separated list of addresses or project names.",
          type: "string"
        }
      ],
      executable: async (args, logger) => {
        try {
          if (!args.identifiers) {
            return new import_game.ExecutableGameFunctionResponse(
              import_game.ExecutableGameFunctionStatus.Failed,
              "identifiers is required (comma-separated list)"
            );
          }
          const ids = args.identifiers.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
          logger(`[Maiat] Batch checking ${ids.length} identifiers`);
          const results = await Promise.allSettled(
            ids.map((id) => this.sdk.agentTrust(id))
          );
          const scores = results.map((r, i) => {
            if (r.status === "fulfilled") {
              return {
                address: r.value.address,
                score: r.value.trustScore / 10,
                risk: r.value.verdict,
                safe: r.value.trustScore / 10 >= this.minScore
              };
            } else {
              return { address: ids[i], score: 0, risk: "unknown", safe: false, error: r.reason?.message };
            }
          });
          scores.sort((a, b) => b.score - a.score);
          logger(`[Maiat] Batch complete. Top: ${scores[0]?.address} (${scores[0]?.score?.toFixed(1)}/10)`);
          return new import_game.ExecutableGameFunctionResponse(
            import_game.ExecutableGameFunctionStatus.Done,
            JSON.stringify({ count: scores.length, results: scores })
          );
        } catch (e) {
          return new import_game.ExecutableGameFunctionResponse(
            import_game.ExecutableGameFunctionStatus.Failed,
            `Batch check failed: ${e.message}`
          );
        }
      }
    });
  }
};
var maiatTrustPlugin_default = MaiatTrustPlugin;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MaiatTrustPlugin
});
