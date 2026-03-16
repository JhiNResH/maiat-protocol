import { GameWorker, GameFunction } from "@virtuals-protocol/game";
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
declare class MaiatTrustPlugin {
    private id;
    private name;
    private description;
    private sdk;
    private minScore;
    constructor(options?: IMaiatTrustPluginOptions);
    getWorker(data?: {
        functions?: GameFunction<any>[];
        getEnvironment?: () => Promise<Record<string, any>>;
    }): GameWorker;
    get checkTrustScore(): GameFunction<[{
        readonly name: "identifier";
        readonly description: "Ethereum/Base address (0x...) OR project/agent name (e.g. 'Uniswap', 'AIXBT').";
        readonly type: "string";
    }]>;
    get gateSwap(): GameFunction<[{
        readonly name: "token_in";
        readonly description: "Address or name of the token being sold (input token).";
        readonly type: "string";
    }, {
        readonly name: "token_out";
        readonly description: "Address or name of the token being bought (output token).";
        readonly type: "string";
    }, {
        readonly name: "min_score";
        readonly description: "Minimum trust score required (0–100).";
        readonly type: "number";
        readonly optional: true;
    }]>;
    get batchCheckTrust(): GameFunction<[{
        readonly name: "identifiers";
        readonly description: "Comma-separated list of addresses or project names.";
        readonly type: "string";
    }]>;
    get checkToken(): GameFunction<[{
        readonly name: "address";
        readonly description: "Token contract address to check (0x...)";
        readonly type: "string";
    }, {
        readonly name: "chain";
        readonly description: "Chain to query (default: base)";
        readonly type: "string";
        readonly optional: true;
    }]>;
    get trustSwap(): GameFunction<[{
        readonly name: "swapper";
        readonly description: "Wallet address executing the swap (0x...)";
        readonly type: "string";
    }, {
        readonly name: "token_in";
        readonly description: "Token being sold (0x...)";
        readonly type: "string";
    }, {
        readonly name: "token_out";
        readonly description: "Token being bought (0x...)";
        readonly type: "string";
    }, {
        readonly name: "amount";
        readonly description: "Amount of token_in in wei";
        readonly type: "string";
    }, {
        readonly name: "slippage";
        readonly description: "Slippage tolerance (e.g. 0.5 for 0.5%)";
        readonly type: "string";
        readonly optional: true;
    }]>;
    get reportOutcome(): GameFunction<[{
        readonly name: "job_id";
        readonly description: "The job ID to report outcome for";
        readonly type: "string";
    }, {
        readonly name: "outcome";
        readonly description: "Outcome: success, failure, partial, or expired";
        readonly type: "string";
    }, {
        readonly name: "reporter";
        readonly description: "Address of the reporter (optional)";
        readonly type: "string";
        readonly optional: true;
    }, {
        readonly name: "note";
        readonly description: "Free-form note about the outcome (optional)";
        readonly type: "string";
        readonly optional: true;
    }]>;
}
export { MaiatTrustPlugin };
export type { IMaiatTrustPluginOptions, TrustResponse };
export default MaiatTrustPlugin;
//# sourceMappingURL=maiatTrustPlugin.d.ts.map