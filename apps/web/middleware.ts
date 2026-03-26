/**
 * Next.js Middleware — x402 Payment Gate (CDP Facilitator)
 *
 * Uses official @x402/next SDK with CDP facilitator for production payment
 * verification on Base mainnet. Replaces the manual withPaymentGate wrapper.
 *
 * All /api/x402/* routes are payment-protected here.
 * Route handlers export their logic directly (no wrapping needed).
 */

import { paymentProxy, x402ResourceServer } from "@x402/next";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createFacilitatorConfig } from "@coinbase/x402";

// ── Config ──────────────────────────────────────────────────────────────

const PAY_TO = "0xB1e504aE1ce359B4C2a6DC5d63aE6199a415f312";
const NETWORK = "eip155:8453"; // Base mainnet

// CDP Facilitator (production — supports Base mainnet)
const facilitatorConfig = createFacilitatorConfig(
  process.env.CDP_API_KEY_ID,
  process.env.CDP_API_KEY_SECRET,
);

const facilitatorClient = new HTTPFacilitatorClient(facilitatorConfig);

const server = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());

// ── Route Pricing ───────────────────────────────────────────────────────

export const middleware = paymentProxy(
  {
    "/api/x402/trust": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.02",
          network: NETWORK,
          payTo: PAY_TO,
        },
      ],
      description: "Trust score lookup for agents and tokens",
      mimeType: "application/json",
    },
    "/api/x402/token-check": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.01",
          network: NETWORK,
          payTo: PAY_TO,
        },
      ],
      description: "Token honeypot and safety check",
      mimeType: "application/json",
    },
    "/api/x402/reputation": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.03",
          network: NETWORK,
          payTo: PAY_TO,
        },
      ],
      description: "Full agent reputation and behavioral trust score",
      mimeType: "application/json",
    },
    "/api/x402/token-forensics": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.05",
          network: NETWORK,
          payTo: PAY_TO,
        },
      ],
      description: "Deep AI-powered project analysis",
      mimeType: "application/json",
    },
    "/api/x402/register-passport": {
      accepts: [
        {
          scheme: "exact",
          price: "$1.00",
          network: NETWORK,
          payTo: PAY_TO,
        },
      ],
      description: "Register a Maiat Passport with ENS, ERC-8004, and KYA",
      mimeType: "application/json",
    },
  },
  server,
);

// ── Matcher ─────────────────────────────────────────────────────────────

export const config = {
  matcher: ["/api/x402/:path*"],
};
