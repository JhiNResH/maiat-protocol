/**
 * x402 Payment Protocol Server Configuration
 *
 * Centralized configuration for x402 payment routes.
 * This file creates a shared x402ResourceServer instance used by all
 * x402-protected API routes.
 *
 * Network: Base Sepolia (testnet) - switch to eip155:8453 for mainnet
 */

import { x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

// Maiat wallet address for receiving USDC payments on Base
export const MAIAT_PAY_TO_ADDRESS = "0xB1e504aE1ce359B4C2a6DC5d63aE6199a415f312";

// Network configuration
// Base Sepolia testnet: eip155:84532
// Base mainnet: eip155:8453
export const PAYMENT_NETWORK = (process.env.X402_NETWORK || "eip155:8453") as "eip155:8453" | "eip155:84532";

// Coinbase facilitator URL (handles payment verification & settlement)
const FACILITATOR_URL = "https://facilitator.x402.org";

// Create HTTP facilitator client
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

// Create x402 resource server and register EVM exact payment scheme
export const x402Server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(x402Server);

// Route pricing configuration (centralized for easy updates)
export const X402_PRICES = {
  trust: "$0.02",
  tokenCheck: "$0.01",
  tokenForensics: "$0.05",
  reputation: "$0.03",
  registerPassport: "$1.00",
} as const;

// Helper to create route config
export function createRouteConfig(price: string, description: string) {
  return {
    accepts: {
      scheme: "exact" as const,
      price,
      network: PAYMENT_NETWORK,
      payTo: MAIAT_PAY_TO_ADDRESS,
    },
    description,
  };
}

// CORS headers for x402 routes
export const X402_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Payment, X-Payment-Response",
  "x-powered-by": "maiat-x402",
  "x-payment-protocol": "x402",
} as const;
