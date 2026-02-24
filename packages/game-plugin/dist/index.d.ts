import { GameFunction, GameWorker } from '@virtuals-protocol/game';

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
    private apiUrl;
    private apiKey?;
    private minScore;
    private chain;
    constructor(options?: IMaiatTrustPluginOptions);
    getWorker(data?: {
        functions?: GameFunction<any>[];
        getEnvironment?: () => Promise<Record<string, any>>;
    }): GameWorker;
    get checkTrustScore(): GameFunction<[{
        readonly name: "identifier";
        readonly description: "Ethereum/Base address (0x...) OR project/agent name (e.g. 'Uniswap', 'AIXBT').";
        readonly type: "string";
    }, {
        readonly name: "chain";
        readonly description: "Blockchain to query. Defaults to 'base'.";
        readonly type: "string";
        readonly optional: true;
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
        readonly description: "Minimum trust score required (0–10). Defaults to 3.";
        readonly type: "number";
        readonly optional: true;
    }]>;
    get batchCheckTrust(): GameFunction<[{
        readonly name: "identifiers";
        readonly description: "Comma-separated list of addresses or project names.";
        readonly type: "string";
    }]>;
}

export { type IMaiatTrustPluginOptions, MaiatTrustPlugin, type TrustResponse };
