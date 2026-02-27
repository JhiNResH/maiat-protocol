const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

interface SummaryInput {
  address: string;
  score: number;
  risk: string;
  type: string;
  flags: string[];
  protocolName?: string;
  txCount?: number;
  balanceETH?: number;
  walletAge?: string | null;
}

// Simple cache
const cache = new Map<string, { summary: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function generateSummary(input: SummaryInput): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const cached = cache.get(input.address);
  if (cached && cached.expiresAt > Date.now()) return cached.summary;

  const context = [
    `Address: ${input.address}`,
    `Trust Score: ${input.score}/10 (${input.risk} risk)`,
    `Type: ${input.type}`,
    input.protocolName ? `Known protocol: ${input.protocolName}` : null,
    `Flags: ${input.flags.join(", ") || "none"}`,
    input.txCount !== undefined ? `Transaction count: ${input.txCount}` : null,
    input.balanceETH !== undefined ? `Balance: ${input.balanceETH} ETH` : null,
    input.walletAge ? `Wallet age: ${input.walletAge}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `You are a concise crypto security analyst. Given this on-chain data about a blockchain address, write a 2-3 sentence trust assessment. Be direct and factual. Do not use markdown.

${context}`;

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();

    cache.set(input.address, { summary, expiresAt: Date.now() + CACHE_TTL_MS });
    return summary;
  } catch (err) {
    console.error("[ai-summary]", err);
    return null;
  }
}
