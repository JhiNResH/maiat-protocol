#!/usr/bin/env node
/**
 * Maiat Trust Score MCP Server
 *
 * Provides trust scoring tools to AI agents via the Model Context Protocol.
 *
 * Tools:
 *   - maiat_check_trust: Get trust score for any on-chain address
 *   - maiat_check_token: Check if a token contract is safe
 *   - maiat_batch_check: Check multiple addresses at once
 *   - maiat_submit_review: Submit a trust review (costs 2 Scarab)
 *   - maiat_get_interactions: Discover wallet contract interactions
 *   - maiat_get_passport: Get wallet reputation passport
 *   - maiat_defi_info: Query DeFi protocol by slug/address
 *   - maiat_agent_info: Query AI agent by slug/address
 *
 * Usage with Claude Desktop:
 * ```json
 * {
 *   "mcpServers": {
 *     "maiat": {
 *       "command": "npx",
 *       "args": ["@maiat/mcp-server"],
 *       "env": {
 *         "MAIAT_API_URL": "https://api.maiat.xyz",
 *         "MAIAT_API_KEY": "optional-for-higher-limits"
 *       }
 *     }
 *   }
 * }
 * ```
 */
export {};
