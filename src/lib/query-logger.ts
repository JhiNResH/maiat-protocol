import { prisma } from "@/lib/prisma";

export interface QueryLogInput {
  type: "agent_trust" | "agent_deep_check" | "token_check" | "trust_swap";
  target: string;
  buyer?: string;
  jobId?: string;
  trustScore?: number | null;
  verdict?: string | null;
  amountIn?: string;
  amountOut?: string;
  clientId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

/**
 * Fire-and-forget query log — never throws, never blocks the response.
 * Every logged query is training data for Maiat's trust model.
 */
export function logQuery(input: QueryLogInput): void {
  prisma.queryLog
    .create({
      data: {
        type: input.type,
        target: input.target.toLowerCase(),
        buyer: input.buyer?.toLowerCase() ?? null,
        jobId: input.jobId ?? null,
        trustScore:
          typeof input.trustScore === "number" ? input.trustScore : null,
        verdict: input.verdict ?? null,
        amountIn: input.amountIn ?? null,
        amountOut: input.amountOut ?? null,
        clientId: input.clientId ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (input.metadata ?? null) as any,
      },
    })
    .then(() => {
      // Feedback loop: recalculate agent score after ACP query
      if (input.type === "agent_trust" || input.type === "agent_deep_check") {
        import("@/lib/feedback-loop")
          .then(({ recalculateAgentScore }) =>
            recalculateAgentScore(input.target)
          )
          .catch(() => {});
      }
    })
    .catch((err) => {
      // Silent — logging should never break the main flow
      console.error("[query-logger] failed to write log:", err);
    });
}
