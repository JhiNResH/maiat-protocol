"use strict";
/**
 * Demo: Trust-gated x402 payment flow
 *
 * Shows how Maiat protects agents from paying untrusted recipients.
 *
 * Usage:
 *   npx tsx packages/x402-plugin/src/demo.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("./index.js");
async function main() {
    console.log("🛡️  Maiat x402 Trust-Gated Payment Demo\n");
    const client = (0, index_js_1.createTrustGatedClient)({
        minScore: 3.0,
        maxPriceUsd: 0.50,
        warnOnly: false,
        onCheck: (addr, score, risk) => {
            console.log(`  📊 Trust check: ${addr.slice(0, 10)}... → ${score}/10 (${risk})`);
        },
        onBlocked: (addr, score) => {
            console.log(`  🚫 BLOCKED: ${addr.slice(0, 10)}... (${score}/10)`);
        },
        onPayment: (url, price, score) => {
            console.log(`  💰 PAID: ${price} to ${url} (trust: ${score}/10)`);
        },
    });
    // Demo 1: Pre-check a known trusted address (USDC on Base)
    console.log("─── Demo 1: Pre-check trusted address ───");
    try {
        const check = await client.precheck("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
        console.log(`  Result: ${check.recommendation}\n`);
    }
    catch (e) {
        console.log(`  Error: ${e.message}\n`);
    }
    // Demo 2: Pre-check a random new address (likely low trust)
    console.log("─── Demo 2: Pre-check unknown address ───");
    try {
        const check = await client.precheck("0x0000000000000000000000000000000000000001");
        console.log(`  Result: ${check.recommendation}\n`);
    }
    catch (e) {
        console.log(`  Error: ${e.message}\n`);
    }
    // Demo 3: Fetch a non-402 URL (passes through)
    console.log("─── Demo 3: Non-402 URL (pass-through) ───");
    try {
        const result = await client.fetch("https://httpbin.org/get");
        console.log(`  Status: ${result.response.status}, Paid: ${result.paid}, Trust-checked: ${result.trustChecked}\n`);
    }
    catch (e) {
        console.log(`  Error: ${e.message}\n`);
    }
    // Demo 4: Fetch Maiat's own x402 trust-gate
    console.log("─── Demo 4: Maiat x402 trust-gate ───");
    try {
        const result = await client.fetch("https://maiat-protocol.vercel.app/api/v1/trust-gate?agent=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
        console.log(`  Status: ${result.response.status}, Paid: ${result.paid}, Trust-checked: ${result.trustChecked}`);
        if (result.trustScore) {
            console.log(`  Recipient trust: ${result.trustScore.score}/10 (${result.trustScore.risk})`);
        }
        console.log();
    }
    catch (e) {
        if (e instanceof index_js_1.X402TrustError) {
            console.log(`  Trust blocked: ${e.message}\n`);
        }
        else if (e instanceof index_js_1.X402PriceError) {
            console.log(`  Price blocked: ${e.message}\n`);
        }
        else {
            console.log(`  Error: ${e.message}\n`);
        }
    }
    console.log("✅ Demo complete");
}
main().catch(console.error);
//# sourceMappingURL=demo.js.map