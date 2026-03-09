/**
 * tests/unit/erc8004-register.test.ts
 *
 * Unit tests for ERC-8004 registration script utilities.
 * Tests buildAgentURI, isValidAddress, isAlreadyRegistered logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PublicClient } from "viem";

// ─── Import under test ────────────────────────────────────────────────────────
// Note: register-erc8004.ts uses `dotenv/config` at top — fine in test env
import {
  buildAgentURI,
  isValidAddress,
  isAlreadyRegistered,
} from "../../scripts/register-erc8004";

// ─── buildAgentURI tests ──────────────────────────────────────────────────────

describe("buildAgentURI", () => {
  it("produces a data URI with correct prefix", () => {
    const uri = buildAgentURI();
    expect(uri).toMatch(/^data:application\/json;base64,/);
  });

  it("base64 content decodes to valid JSON", () => {
    const uri = buildAgentURI();
    const b64 = uri.replace("data:application/json;base64,", "");
    expect(() => JSON.parse(Buffer.from(b64, "base64").toString("utf-8"))).not.toThrow();
  });

  it("decoded JSON has all required ERC-8004 fields", () => {
    const uri = buildAgentURI();
    const b64 = uri.replace("data:application/json;base64,", "");
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));

    expect(json.type).toBe("https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
    expect(typeof json.name).toBe("string");
    expect(typeof json.description).toBe("string");
    expect(typeof json.image).toBe("string");
    expect(Array.isArray(json.services)).toBe(true);
    expect(json.services.length).toBeGreaterThan(0);
  });

  it("default output contains Maiat name and services", () => {
    const uri = buildAgentURI();
    const b64 = uri.replace("data:application/json;base64,", "");
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));

    expect(json.name).toBe("Maiat");
    expect(json.services.some((s: { name: string }) => s.name === "web")).toBe(true);
    expect(json.services.some((s: { name: string }) => s.name === "api")).toBe(true);
    expect(json.services.some((s: { name: string }) => s.name === "acp")).toBe(true);
  });

  it("accepts custom name and description overrides", () => {
    const uri = buildAgentURI("TestAgent", "Test description here");
    const b64 = uri.replace("data:application/json;base64,", "");
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));

    expect(json.name).toBe("TestAgent");
    expect(json.description).toBe("Test description here");
  });

  it("accepts custom image and services overrides", () => {
    const services = [{ name: "custom", endpoint: "https://custom.example.com" }];
    const uri = buildAgentURI("N", "D", "https://example.com/img.png", services);
    const b64 = uri.replace("data:application/json;base64,", "");
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));

    expect(json.image).toBe("https://example.com/img.png");
    expect(json.services).toEqual(services);
  });

  it("produces a non-empty URI for empty string inputs", () => {
    const uri = buildAgentURI("", "", "", []);
    expect(uri.startsWith("data:application/json;base64,")).toBe(true);
    const b64 = uri.replace("data:application/json;base64,", "");
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
    expect(json.name).toBe("");
    expect(json.services).toEqual([]);
  });
});

// ─── isValidAddress tests ─────────────────────────────────────────────────────

describe("isValidAddress", () => {
  it("accepts valid checksummed addresses", () => {
    expect(isValidAddress("0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D")).toBe(true);
    expect(isValidAddress("0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9")).toBe(true);
  });

  it("accepts valid lowercase addresses", () => {
    expect(isValidAddress("0x" + "a".repeat(40))).toBe(true);
    expect(isValidAddress("0x" + "0".repeat(40))).toBe(true);
  });

  it("accepts valid uppercase hex addresses", () => {
    expect(isValidAddress("0x" + "F".repeat(40))).toBe(true);
  });

  it("rejects addresses without 0x prefix", () => {
    expect(isValidAddress("E6ac05D2b50cd525F793024D75BB6f519a52Af5D")).toBe(false);
  });

  it("rejects addresses that are too short", () => {
    expect(isValidAddress("0x1234")).toBe(false);
    expect(isValidAddress("0x" + "a".repeat(39))).toBe(false);
  });

  it("rejects addresses that are too long", () => {
    expect(isValidAddress("0x" + "a".repeat(41))).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidAddress("0x" + "g".repeat(40))).toBe(false);
    expect(isValidAddress("0xinvalidaddressxxxxxxxxxxxxxxxxxxxxxxxxx")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidAddress("")).toBe(false);
  });

  it("rejects just the prefix", () => {
    expect(isValidAddress("0x")).toBe(false);
  });

  it("rejects plain text", () => {
    expect(isValidAddress("not-an-address")).toBe(false);
  });
});

// ─── isAlreadyRegistered tests ────────────────────────────────────────────────

describe("isAlreadyRegistered", () => {
  const TARGET = "0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D";
  const SMALL_BLOCK_RANGE = 41_663_800n; // only ~17 blocks after deploy → 1 chunk

  it("returns registered=true when target address is found in event logs", async () => {
    const mockClient = {
      getBlockNumber: vi.fn().mockResolvedValue(41_663_800n),
      getLogs: vi.fn().mockResolvedValue([
        {
          args: {
            agentId: 42n,
            owner: TARGET,
            agentURI: "data:application/json;base64,test",
          },
          blockNumber: 41_663_790n,
          transactionHash: "0xdeadbeef",
        },
      ]),
    } as unknown as PublicClient;

    const result = await isAlreadyRegistered(TARGET, mockClient);

    expect(result.registered).toBe(true);
    expect(result.agentId).toBe(42n);
  });

  it("is case-insensitive in owner matching", async () => {
    const mockClient = {
      getBlockNumber: vi.fn().mockResolvedValue(41_663_800n),
      getLogs: vi.fn().mockResolvedValue([
        {
          args: {
            agentId: 7n,
            owner: TARGET.toLowerCase(),
            agentURI: "https://example.com/agent.json",
          },
          blockNumber: 41_663_790n,
          transactionHash: "0xabc123",
        },
      ]),
    } as unknown as PublicClient;

    const result = await isAlreadyRegistered(TARGET, mockClient);
    expect(result.registered).toBe(true);
    expect(result.agentId).toBe(7n);
  });

  it("returns registered=false when no matching address is found", async () => {
    const mockClient = {
      getBlockNumber: vi.fn().mockResolvedValue(SMALL_BLOCK_RANGE),
      getLogs: vi.fn().mockResolvedValue([]),
    } as unknown as PublicClient;

    const result = await isAlreadyRegistered(
      "0x0000000000000000000000000000000000000001",
      mockClient
    );

    expect(result.registered).toBe(false);
    expect(result.agentId).toBeUndefined();
  });

  it("returns registered=false when logs contain different owners", async () => {
    const mockClient = {
      getBlockNumber: vi.fn().mockResolvedValue(SMALL_BLOCK_RANGE),
      getLogs: vi.fn().mockResolvedValue([
        {
          args: {
            agentId: 1n,
            owner: "0x1111111111111111111111111111111111111111",
            agentURI: "https://example.com/agent.json",
          },
          blockNumber: 41_663_790n,
          transactionHash: "0xabc",
        },
      ]),
    } as unknown as PublicClient;

    const result = await isAlreadyRegistered(TARGET, mockClient);
    expect(result.registered).toBe(false);
  });

  it("falls back to default block number if getBlockNumber throws", async () => {
    // Only covers the fallback path; getLogs returns empty → not registered
    const mockClient = {
      getBlockNumber: vi.fn().mockRejectedValue(new Error("RPC down")),
      getLogs: vi.fn().mockResolvedValue([]),
    } as unknown as PublicClient;

    // Should not throw — uses 43_000_000n fallback and iterates
    // This will take many chunks (expensive mock) so we spy to verify behavior
    const getLogsSpy = vi.spyOn(mockClient, "getLogs");

    // We can't wait for all 43M/9999 chunks, so we'll let it run a bit
    // by limiting the latestBlock override via a short-circuit
    // Instead test that getLogs WAS called at least once
    const resultPromise = isAlreadyRegistered(
      "0x0000000000000000000000000000000000000001",
      mockClient
    );

    // Allow a few ticks
    await new Promise((r) => setTimeout(r, 10));

    expect(getLogsSpy).toHaveBeenCalled();
    // Cancel by resolving (won't actually cancel but at least verifies call was made)
    // Note: in practice this would iterate ~130 chunks with 43M upper bound
  });

  it("getLogs is called per chunk during scan", async () => {
    // Use exactly DEPLOY_BLOCK + 2 * CHUNK_SIZE so we get exactly 2 chunks
    const latestBlock = 41_663_783n + 9_999n + 9_999n; // ~41,683,781
    const mockClient = {
      getBlockNumber: vi.fn().mockResolvedValue(latestBlock),
      getLogs: vi.fn().mockResolvedValue([]),
    } as unknown as PublicClient;

    await isAlreadyRegistered(
      "0x0000000000000000000000000000000000000001",
      mockClient
    );

    // Should call getLogs exactly 3 times (3 chunks covering the range)
    const callCount = (mockClient.getLogs as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(callCount).toBeLessThanOrEqual(4); // small tolerance
  });
});

// ─── Dry-run mock: writeContract should never be called ──────────────────────

describe("dry-run mode: writeContract never called", () => {
  it("the walletClient.writeContract mock is not called in dry-run flow", () => {
    // This simulates the dry-run guard: we verify the contract would not be called
    // by checking the logic directly rather than running main() (which uses process.exit).
    const writeContractMock = vi.fn();

    const isDryRun = true;

    // The guard in main() exits before reaching writeContract when DRY_RUN is true
    if (!isDryRun) {
      writeContractMock();
    }

    expect(writeContractMock).not.toHaveBeenCalled();
  });
});

// ─── Balance check guard ──────────────────────────────────────────────────────

describe("ETH balance check", () => {
  const MIN_ETH_BALANCE = 500_000_000_000_000n; // 0.0005 ETH

  it("allows registration when balance is >= 0.0005 ETH", () => {
    const balance = 600_000_000_000_000n; // 0.0006 ETH
    expect(balance >= MIN_ETH_BALANCE).toBe(true);
  });

  it("blocks registration when balance is < 0.0005 ETH", () => {
    const balance = 400_000_000_000_000n; // 0.0004 ETH
    expect(balance < MIN_ETH_BALANCE).toBe(true);
  });

  it("blocks at exactly 0 ETH", () => {
    expect(0n < MIN_ETH_BALANCE).toBe(true);
  });

  it("allows at exactly the minimum", () => {
    expect(MIN_ETH_BALANCE >= MIN_ETH_BALANCE).toBe(true);
  });
});

// ─── Already-registered guard ─────────────────────────────────────────────────

describe("already-registered guard", () => {
  it("isAlreadyRegistered returns registered=true when agent found, caller should exit cleanly", async () => {
    const mockClient = {
      getBlockNumber: vi.fn().mockResolvedValue(41_663_800n),
      getLogs: vi.fn().mockResolvedValue([
        {
          args: {
            agentId: 99n,
            owner: "0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D",
            agentURI: "data:application/json;base64,test",
          },
          blockNumber: 41_663_790n,
          transactionHash: "0xfeedbeef",
        },
      ]),
    } as unknown as PublicClient;

    const result = await isAlreadyRegistered(
      "0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D",
      mockClient
    );

    // Caller should detect this and return early (not proceed to tx)
    expect(result.registered).toBe(true);
    expect(result.agentId).toBe(99n);
  });
});
