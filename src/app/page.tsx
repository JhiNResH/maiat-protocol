"use client";

import { useState } from "react";

interface ScoreResult {
  address: string;
  score: number;
  risk: string;
  type: string;
  flags: string[];
  details: {
    txCount: number;
    isContract: boolean;
    isKnownScam: boolean;
  };
  timestamp: string;
  oracle: string;
}

function scoreColor(score: number): string {
  if (score > 700) return "text-green-400";
  if (score > 400) return "text-yellow-400";
  return "text-red-400";
}

function scoreBorder(score: number): string {
  if (score > 700) return "border-green-500";
  if (score > 400) return "border-yellow-500";
  return "border-red-500";
}

function scoreBg(score: number): string {
  if (score > 700) return "bg-green-900/20";
  if (score > 400) return "bg-yellow-900/20";
  return "bg-red-900/20";
}

export default function HomePage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/v1/score/${address.trim()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Unknown error");
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
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          🛡️ Agent Trust Score
        </h1>
        <p className="text-gray-400 text-sm max-w-sm mx-auto">
          On-chain trust scoring for any Ethereum or Base address. Powered by{" "}
          <span className="text-indigo-400 font-medium">MAIAT Protocol</span>.
        </p>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl flex gap-2"
      >
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x... Ethereum / Base address"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading || !address.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-3 rounded-lg transition-colors text-sm"
        >
          {loading ? "Scoring…" : "Score"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-6 w-full max-w-xl bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div
          className={`mt-8 w-full max-w-xl rounded-xl border-2 p-6 ${scoreBorder(result.score)} ${scoreBg(result.score)}`}
        >
          {/* Score */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                Trust Score
              </div>
              <div className={`text-6xl font-black ${scoreColor(result.score)}`}>
                {result.score}
                <span className="text-2xl text-gray-500 font-normal">
                  /1000
                </span>
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-xl font-bold ${scoreColor(result.score)} uppercase`}
              >
                {result.risk}
              </div>
              <div className="text-xs text-gray-400 mt-1">{result.type}</div>
            </div>
          </div>

          {/* Address */}
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-1">Address</div>
            <div className="font-mono text-xs text-gray-300 break-all">
              {result.address}
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-900/60 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">
                {result.details.txCount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">Transactions</div>
            </div>
            <div className="bg-gray-900/60 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">
                {result.details.isContract ? "✅" : "❌"}
              </div>
              <div className="text-xs text-gray-400">Contract</div>
            </div>
            <div className="bg-gray-900/60 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">
                {result.details.isKnownScam ? "⚠️" : "✅"}
              </div>
              <div className="text-xs text-gray-400">Scam Check</div>
            </div>
          </div>

          {/* Flags */}
          {result.flags.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-2">Flags</div>
              <div className="flex flex-wrap gap-2">
                {result.flags.map((flag) => (
                  <span
                    key={flag}
                    className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded font-mono"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-xs text-gray-600 mt-2 flex justify-between">
            <span>Oracle: {result.oracle}</span>
            <span>{new Date(result.timestamp).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Swap Link */}
      <a
        href="/swap"
        className="mt-8 inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-5 py-3 rounded-xl transition-colors text-sm"
      >
        🔄 Swap Tokens with Trust Scoring →
      </a>

      {/* Footer */}
      <p className="mt-16 text-gray-600 text-xs">
        MAIAT Protocol · Agent Trust Infrastructure · Base
      </p>
    </main>
  );
}
