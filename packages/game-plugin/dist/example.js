"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @maiat/game-maiat-plugin — Example usage
 *
 * Before running:
 *   1. npm install
 *   2. Get a GAME API key from https://console.game.virtuals.io
 *   3. Set GAME_API_KEY in your environment (optional: MAIAT_API_KEY)
 */
const game_1 = require("@virtuals-protocol/game");
const maiatTrustPlugin_1 = __importDefault(require("./maiatTrustPlugin"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function main() {
    // 1. Init plugin
    const maiatPlugin = new maiatTrustPlugin_1.default({
        minScore: 3.0, // reject anything below 3.0/10
        chain: "base",
        // apiKey: process.env.MAIAT_API_KEY,   // optional — for higher rate limits
    });
    // 2. Create worker
    const worker = maiatPlugin.getWorker();
    // 3. Attach to a GAME agent
    const agent = new game_1.GameAgent(process.env.GAME_API_KEY, {
        name: "TrustGated Trading Agent",
        goal: "Execute token swaps only after verifying trust scores via Maiat Protocol. Reject any swap involving tokens with trust score below 3.0/10.",
        description: "A DeFi trading agent that uses Maiat trust scoring to avoid rugs and scams.",
        workers: [worker],
    });
    await agent.init();
    // 4. Run examples
    console.log("\n=== Example 1: Check trust score ===");
    await agent.step({ verbose: true });
    console.log("\n=== Example 2: Gate a swap ===");
    // The agent will call gate_swap before executing
    await agent.step({ verbose: true });
}
main().catch(console.error);
