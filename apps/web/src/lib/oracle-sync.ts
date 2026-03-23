/**
 * Thin wrapper for auto-attest cron → oracle-updater
 * Accepts specific targets and delegates to the full sync pipeline.
 */

import { syncOracleScores as fullSync } from "./oracle-updater";

/**
 * Sync specific attested targets to the on-chain oracle.
 * Returns number of successfully synced agents.
 */
export async function syncOracleScores(
  _targets: { target: string; score: number }[]
): Promise<number> {
  try {
    const result = await fullSync();
    return result.synced;
  } catch (err) {
    console.error("[oracle-sync] failed:", err);
    return 0;
  }
}
