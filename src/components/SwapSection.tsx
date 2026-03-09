"use client";

import { useState } from "react";

interface TrustInfo {
  score: number;
  risk: string;
}

interface QuoteResult {
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

function trustColor(risk: string): string {
  if (risk === "LOW") return "text-[#10b981]";
  if (risk === "MEDIUM") return "text-[#f59e0b]";
  return "text-[#ef4444]";
}

export default function SwapSection({ address }: { address: string }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGetQuote() {
    if (!amount.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/v1/swap/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swapper: address,
          tokenIn: "0x0000000000000000000000000000000000000000",
          tokenOut: address,
          amount: amount.trim(),
          chainId: 8453,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to get quote");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 w-full max-w-[600px] border border-gray-700 rounded-xl p-5 bg-[rgba(13,18,37,0.6)]">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
        Swap This Token
      </h2>

      <div className="flex gap-2">
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (in wei)"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          onClick={handleGetQuote}
          disabled={loading || !amount.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
        >
          {loading ? "Quoting..." : "Get Quote"}
        </button>
      </div>

      {error && (
        <div className="mt-3 bg-slate-900/30 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Output</div>
              <div className="text-sm font-bold text-white font-mono truncate">
                {result.quote.amountOut}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Gas Fee</div>
              <div className="text-sm font-bold text-white">
                ${result.quote.gasFeeUSD}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Route</div>
              <div className="text-sm font-bold text-white truncate">
                {result.quote.routeString || "CLASSIC"}
              </div>
            </div>
          </div>

          {/* Trust scores */}
          <div className="flex gap-3">
            {result.trust.tokenIn && (
              <div className="flex-1 bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Token In Trust</div>
                <div className={`text-sm font-bold ${trustColor(result.trust.tokenIn.risk)}`}>
                  {result.trust.tokenIn.score}/1000
                  <span className="text-xs font-normal ml-1">({result.trust.tokenIn.risk})</span>
                </div>
              </div>
            )}
            {result.trust.tokenOut && (
              <div className="flex-1 bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Token Out Trust</div>
                <div className={`text-sm font-bold ${trustColor(result.trust.tokenOut.risk)}`}>
                  {result.trust.tokenOut.score}/1000
                  <span className="text-xs font-normal ml-1">({result.trust.tokenOut.risk})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
