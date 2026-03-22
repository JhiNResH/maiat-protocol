/**
 * Test suite for /api/v1/402-index/scores endpoint
 * Validates trust scoring for 402 Index integration
 */

import { describe, it, expect, beforeAll } from "@jest/globals";

describe("GET /api/v1/402-index/scores", () => {
  const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

  it("should require endpoints[] query parameter", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/402-index/scores`);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("endpoints");
  });

  it("should score Maiat endpoints as highly-trusted", async () => {
    const params = new URLSearchParams({
      "endpoints[]": "https://app.maiat.io/api/x402/trust",
      "endpoints[]": "https://app.maiat.io/api/x402/token-check",
    });

    const res = await fetch(
      `${BASE_URL}/api/v1/402-index/scores?${params.toString()}`
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.endpoints).toHaveLength(2);

    data.endpoints.forEach((endpoint: any) => {
      expect(endpoint.maiatScore).toBeGreaterThanOrEqual(90);
      expect(endpoint.status).toBe("highly-trusted");
      expect(endpoint.sybilRisk).toBe("low");
      expect(endpoint.lastVerified).toBeDefined();
    });
  });

  it("should return unvetted status for unknown endpoints", async () => {
    const params = new URLSearchParams({
      "endpoints[]": "https://unknown-api.xyz/endpoint",
    });

    const res = await fetch(
      `${BASE_URL}/api/v1/402-index/scores?${params.toString()}`
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.endpoints[0].maiatScore).toBe(0);
    expect(data.endpoints[0].status).toBe("unvetted");
    expect(data.endpoints[0].reason).toContain("not found");
  });

  it("should reject more than 20 endpoints", async () => {
    const endpoints = Array.from({ length: 21 }, (_, i) =>
      encodeURIComponent(`https://api${i}.xyz`)
    );
    const queryString = endpoints.map((e) => `endpoints[]=${e}`).join("&");

    const res = await fetch(
      `${BASE_URL}/api/v1/402-index/scores?${queryString}`
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("20"),
      })
    );
  });

  it("should include score calculation methodology", async () => {
    const params = new URLSearchParams({
      "endpoints[]": "https://app.maiat.io/api/x402/trust",
    });

    const res = await fetch(
      `${BASE_URL}/api/v1/402-index/scores?${params.toString()}`
    );
    const data = await res.json();

    expect(data.scoreCalculation).toContain("completion_rate");
    expect(data.scoreCalculation).toContain("uptime");
    expect(data.generatedAt).toBeDefined();
  });

  it("should respect rate limits (50/hour)", async () => {
    let lastStatus = 200;

    // Try to make 52 requests rapidly (should hit rate limit on 51st+)
    for (let i = 0; i < 52; i++) {
      const params = new URLSearchParams({
        "endpoints[]": `https://api${i}.xyz`,
      });

      const res = await fetch(
        `${BASE_URL}/api/v1/402-index/scores?${params.toString()}`
      );
      lastStatus = res.status;

      if (res.status === 429) {
        break;
      }
    }

    expect(lastStatus).toBe(429);
  });

  it("should cache responses for 5 minutes", async () => {
    const params = new URLSearchParams({
      "endpoints[]": "https://app.maiat.io/api/x402/trust",
    });

    const res = await fetch(
      `${BASE_URL}/api/v1/402-index/scores?${params.toString()}`
    );

    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("max-age=300");
  });
});
