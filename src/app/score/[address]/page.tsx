import { Metadata } from "next";
import { computeTrustScore } from "@/lib/scoring";
import SwapSection from "@/components/SwapSection";

type Props = {
  params: Promise<{ address: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;

  let score: number | null = null;
  let risk: string | null = null;

  try {
    const result = await computeTrustScore(address);
    score = result.score;
    risk = result.risk;
  } catch {
    // ignore, show generic meta
  }

  const title = score !== null
    ? `Trust Score ${score}/1000 — ${address.slice(0, 10)}… | MAIAT`
    : `Agent Trust Score — ${address.slice(0, 10)}… | MAIAT`;

  const description = score !== null
    ? `On-chain trust score for ${address}: ${score}/1000 (${risk} risk). Powered by MAIAT Protocol.`
    : `Check on-chain trust score for ${address} on MAIAT Protocol.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "MAIAT Protocol",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

function scoreColor(score: number): string {
  if (score > 700) return "#4ade80"; // green-400
  if (score > 400) return "#facc15"; // yellow-400
  return "#f87171"; // red-400
}

function riskLabel(score: number): string {
  if (score > 700) return "LOW RISK";
  if (score > 400) return "MEDIUM RISK";
  if (score > 100) return "HIGH RISK";
  return "CRITICAL RISK";
}

export default async function ScorePage({ params }: Props) {
  const { address } = await params;

  let result = null;
  let errorMsg: string | null = null;

  try {
    result = await computeTrustScore(address);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Failed to compute score";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#030712",
        color: "#f3f4f6",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "4rem 1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
        🛡️ MAIAT Trust Score
      </h1>
      <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "2rem" }}>
        On-chain agent trust scoring · Base Sepolia
      </p>

      {errorMsg && (
        <div
          style={{
            background: "#450a0a",
            border: "1px solid #b91c1c",
            color: "#fca5a5",
            borderRadius: "0.75rem",
            padding: "1rem 1.5rem",
            maxWidth: "600px",
            width: "100%",
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {result && (
        <div
          style={{
            maxWidth: "600px",
            width: "100%",
            border: `2px solid ${scoreColor(result.score)}`,
            borderRadius: "0.75rem",
            padding: "1.5rem",
            background: "rgba(17,24,39,0.8)",
          }}
        >
          {/* Score headline */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                Trust Score
              </div>
              <div style={{ fontSize: "3.5rem", fontWeight: 900, color: scoreColor(result.score), lineHeight: 1 }}>
                {result.score}
                <span style={{ fontSize: "1.5rem", color: "#6b7280", fontWeight: 400 }}>/1000</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: scoreColor(result.score) }}>
                {riskLabel(result.score)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                {result.type}
              </div>
            </div>
          </div>

          {/* Address */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>Address</div>
            <div style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#d1d5db", wordBreak: "break-all" }}>
              {address}
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
            {[
              { label: "Transactions", value: result.details.txCount.toLocaleString() },
              { label: "Contract", value: result.details.isContract ? "Yes" : "No" },
              { label: "Scam Check", value: result.details.isKnownScam ? "⚠️ Flagged" : "✅ Clear" },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  background: "rgba(17,24,39,0.6)",
                  borderRadius: "0.5rem",
                  padding: "0.75rem",
                  textAlign: "center",
                  border: "1px solid #1f2937",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "#f9fafb" }}>{value}</div>
                <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: "0.25rem" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Flags */}
          {result.flags.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.5rem" }}>Flags</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {result.flags.map((flag) => (
                  <span
                    key={flag}
                    style={{
                      background: "#1f2937",
                      color: "#9ca3af",
                      fontSize: "0.7rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      fontFamily: "monospace",
                    }}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div style={{ borderTop: "1px solid #1f2937", paddingTop: "1rem", marginTop: "0.5rem" }}>
            <a
              href="/"
              style={{
                display: "inline-block",
                background: "#4f46e5",
                color: "#fff",
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Score Another Address →
            </a>
          </div>
        </div>
      )}

      {result && <SwapSection address={address} />}

      <p style={{ marginTop: "4rem", color: "#374151", fontSize: "0.75rem" }}>
        MAIAT Protocol · Agent Trust Infrastructure
      </p>
    </main>
  );
}
