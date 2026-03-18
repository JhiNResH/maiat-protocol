export { default as MaiatTrustPlugin } from "./maiatTrustPlugin";
export type { IMaiatTrustPluginOptions, TrustResponse } from "./maiatTrustPlugin";

// Re-export ACP evaluator defaults for GAME SDK users
export {
  MAIAT_EVALUATOR_ADDRESS,
  MAIAT_ACP_HOOK_ADDRESS,
  MAIAT_EVALUATOR_CLUSTER,
  MAIAT_ACP_DEFAULTS,
} from "@jhinresh/maiat-sdk";
