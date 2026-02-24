"use client";

import { useState } from "react";
import { TOKENS } from "@/lib/uniswap";

interface TrustInfo {
  score: number;
  risk: string;
}

interface QuoteData {
  quote: {
    amountIn: string;
    amountOut: string;
    gasFeeUSD: string;
    routeString: string;
    tokenIn: string;
    tokenOut: string;
    chainId: number;
    quoteId: string;
    swapper: string;
    requestId: string;
    slippage: { tolerance: number };
    route: unknown[];
    gasFee: string;
    permitData: Record<string, unknown> | null;
  };
  trust: {
    tokenIn: TrustInfo | null;
    tokenOut: TrustInfo | null;
  };
}

const POPULAR_TOKENS = [
  { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  { symbol: "WETH", address: TOKENS.WETH_BASE, decimals: 18 },
  { symbol: "USDC", address: TOKENS.USDC_BASE, decimals: 6 },
] as const;

function trustColor(risk: string): string {
  if (risk === "LOW") return "text-green-400";
  if (risk === "MEDIUM") return "text-yellow-400";
  return "text-red-400";
}

function trustBg(risk: string): string {
  if (risk === "LOW") return "bg-green-900/20 border-green-800";
  if (risk === "MEDIUM") return "bg-yellow-900/20 border-yellow-800";
  return "bg-red-900/20 border-red-800";
}

export default function SwapPage() {
  const [swapper, setSwapper] = useState("");
  const [tokenIn, setTokenIn] = useState(POPULAR_TOKENS[0].address);
  const [tokenInCustom, setTokenInCustom] = useState("");
  const [tokenOut, setTokenOut] = useState(POPULAR_TOKENS[2].address);
  const [tokenOutCustom, setTokenOutCustom] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [swapTx, setSwapTx] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolvedTokenIn = tokenIn === "custom" ? tokenInCustom : tokenIn;
  const resolvedTokenOut = tokenOut === "custom" ? tokenOutCustom : tokenOut;

  async function handleQuote() {
    if (!swapper.trim() || !amount.trim()) return;

    setLoading(true);
    setQuote(null);
    setSwapTx(null);
    setError(null);

    try {
      const res = await fetch("/api/v1/swap/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swapper: swapper.trim(),
          tokenIn: resolvedTokenIn,
          tokenOut: resolvedTokenOut,
          amount: amount.trim(),
          chainId: 8453,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to get quote");
      } else {
        setQuote(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSwap() {
    if (!quote) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quote.quote),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to get swap tx");
      } else {
        setSwapTx(data.swap);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center px-4 py-16">
      <div className="mb-8 text-center">
        <a href="/" className="text-gray-500 text-xs hover:text-gray-300 transition-colors">
          ← Back to Score
        </a>
        <h1 className="text-3xl font-bold tracking-tight mt-3 mb-2">
          🔄 Trust-Scored Swap
        </h1>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          Swap tokens on Base with built-in trust scoring. Every quote includes counterparty risk assessment.
        </p>
      </div>

      <div className="w-full max-w-lg space-y-4">
        {/* Swapper Address */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
            Your Wallet Address
          </label>
          <input
            type="text"
            value={swapper}
            onChange={(e) => setSwapper(e.target.value)}
            placeholder="0x..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {/* Token In */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
            You Pay
          </label>
          <div className="flex gap-2 mb-2">
            <select
              value={tokenIn}
              onChange={(e) => setTokenIn(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {POPULAR_TOKENS.map((t) => (
                <option key={`in-${t.symbol}`} value={t.address}>
                  {t.symbol}
                </option>
              ))}
              <option value="custom">Custom Token</option>
            </select>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (in wei)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              spellCheck={false}
            />
          </div>
          {tokenIn === "custom" && (
            <input
              type="text"
              value={tokenInCustom}
              onChange={(e) => setTokenInCustom(e.target.value)}
              placeholder="Token contract address (0x...)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              spellCheck={false}
            />
          )}
        </div>

        {/* Arrow */}
        <div className="text-center text-gray-600 text-lg">↓</div>

        {/* Token Out */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
            You Receive
          </label>
          <select
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
          >
            {POPULAR_TOKENS.map((t) => (
              <option key={`out-${t.symbol}`} value={t.address}>
                {t.symbol}
              </option>
            ))}
            <option value="custom">Custom Token</option>
          </select>
          {tokenOut === "custom" && (
            <input
              type="text"
              value={tokenOutCustom}
              onChange={(e) => setTokenOutCustom(e.target.value)}
              placeholder="Token contract address (0x...)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              spellCheck={false}
            />
          )}
        </div>

        {/* Quote Button */}
        <button
          onClick={handleQuote}
          disabled={loading || !swapper.trim() || !amount.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
        >
          {loading && !quote ? "Getting Quote..." : "Get Quote"}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Quote Result */}
        {quote && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Quote
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Output</div>
                <div className="text-sm font-bold text-white font-mono truncate">
                  {quote.quote.amountOut}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Gas Fee</div>
                <div className="text-sm font-bold text-white">
                  ${quote.quote.gasFeeUSD}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Route</div>
                <div className="text-sm font-bold text-white truncate">
                  {quote.quote.routeString || "CLASSIC"}
                </div>
              </div>
            </div>

            {/* Trust Scores */}
            <div className="flex gap-3">
              {quote.trust.tokenIn && (
                <div className={`flex-1 border rounded-lg p-3 text-center ${trustBg(quote.trust.tokenIn.risk)}`}>
                  <div className="text-xs text-gray-400 mb-1">Token In Trust</div>
                  <div className={`text-lg font-bold ${trustColor(quote.trust.tokenIn.risk)}`}>
                    {quote.trust.tokenIn.score}
                    <span className="text-xs font-normal text-gray-500">/1000</span>
                  </div>
                  <div className={`text-xs font-medium ${trustColor(quote.trust.tokenIn.risk)}`}>
                    {quote.trust.tokenIn.risk}
                  </div>
                </div>
              )}
              {quote.trust.tokenOut && (
                <div className={`flex-1 border rounded-lg p-3 text-center ${trustBg(quote.trust.tokenOut.risk)}`}>
                  <div className="text-xs text-gray-400 mb-1">Token Out Trust</div>
                  <div className={`text-lg font-bold ${trustColor(quote.trust.tokenOut.risk)}`}>
                    {quote.trust.tokenOut.score}
                    <span className="text-xs font-normal text-gray-500">/1000</span>
                  </div>
                  <div className={`text-xs font-medium ${trustColor(quote.trust.tokenOut.risk)}`}>
                    {quote.trust.tokenOut.risk}
                  </div>
                </div>
              )}
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
            >
              {loading ? "Building Tx..." : "Execute Swap"}
            </button>
          </div>
        )}

        {/* Swap Tx Result */}
        {swapTx && (
          <div className="bg-gray-900/60 border border-green-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3">
              ✅ Transaction Ready
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Sign this transaction with your wallet to execute the swap.
            </p>
            <pre className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto font-mono">
              {JSON.stringify(swapTx, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="mt-16 text-gray-600 text-xs">
        MAIAT Protocol · Trust-Scored Swaps · Base
      </p>
    </main>
  );
}
