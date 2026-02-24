import { describe, it, expect } from "vitest";
import { resolveSlug, getAllEntities, getKnownProtocolsMap } from "@/lib/slug-resolver";

describe("resolveSlug", () => {
  // --- DeFi slugs ---
  it('resolves "usdc" to correct address', () => {
    const result = resolveSlug("usdc");
    expect(result).not.toBeNull();
    expect(result!.address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(result!.name).toBe("USDC");
    expect(result!.type).toBe("defi");
    expect(result!.category).toBe("STABLECOIN");
  });

  it('resolves "aerodrome" to correct address', () => {
    const result = resolveSlug("aerodrome");
    expect(result).not.toBeNull();
    expect(result!.address).toBe("0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43");
    expect(result!.type).toBe("defi");
  });

  it('resolves "morpho" to correct address', () => {
    const result = resolveSlug("morpho");
    expect(result).not.toBeNull();
    expect(result!.address).toBe("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");
  });

  it("resolves alias: uniswap → Universal Router", () => {
    const result = resolveSlug("uniswap");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Uniswap Universal Router");
  });

  it("resolves alias: aave → Aave V3 Pool", () => {
    const result = resolveSlug("aave");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Aave V3 Pool");
  });

  // --- Agent slugs ---
  it('resolves "aixbt" to correct address', () => {
    const result = resolveSlug("aixbt");
    expect(result).not.toBeNull();
    expect(result!.address).toBe("0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825");
    expect(result!.type).toBe("agent");
  });

  it('resolves "virtuals" to correct address', () => {
    const result = resolveSlug("virtuals");
    expect(result).not.toBeNull();
    expect(result!.address).toBe("0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b");
  });

  // --- Address resolution ---
  it("resolves USDC address to slug", () => {
    const result = resolveSlug("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(result).not.toBeNull();
    expect(result!.slug).toBe("usdc");
    expect(result!.type).toBe("defi");
  });

  it("resolves AIXBT address to slug", () => {
    const result = resolveSlug("0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825");
    expect(result).not.toBeNull();
    expect(result!.slug).toBe("aixbt");
    expect(result!.type).toBe("agent");
  });

  // --- Case insensitivity ---
  it("handles uppercase slugs", () => {
    const result = resolveSlug("USDC");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("USDC");
  });

  it("handles mixed-case addresses", () => {
    const result = resolveSlug("0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913");
    expect(result).not.toBeNull();
    expect(result!.slug).toBe("usdc");
  });

  // --- Type hints ---
  it("filters by defi type hint", () => {
    const result = resolveSlug("usdc", "defi");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("defi");
  });

  it("returns null for agent slug with defi type hint", () => {
    const result = resolveSlug("aixbt", "defi");
    expect(result).toBeNull();
  });

  it("returns null for defi slug with agent type hint", () => {
    const result = resolveSlug("usdc", "agent");
    expect(result).toBeNull();
  });

  // --- Unknown slugs ---
  it("returns null for unknown slug", () => {
    expect(resolveSlug("unknown-protocol")).toBeNull();
  });

  it("returns null for unknown address", () => {
    expect(resolveSlug("0x0000000000000000000000000000000000000001")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(resolveSlug("")).toBeNull();
  });
});

describe("getAllEntities", () => {
  it("returns all entities when no type specified", () => {
    const entities = getAllEntities();
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.some((e) => e.type === "defi")).toBe(true);
    expect(entities.some((e) => e.type === "agent")).toBe(true);
  });

  it("filters to only defi entities", () => {
    const entities = getAllEntities("defi");
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.every((e) => e.type === "defi")).toBe(true);
  });

  it("filters to only agent entities", () => {
    const entities = getAllEntities("agent");
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.every((e) => e.type === "agent")).toBe(true);
  });

  it("no duplicate addresses among defi entities", () => {
    const entities = getAllEntities("defi");
    const addresses = entities.map((e) => e.address.toLowerCase());
    const unique = new Set(addresses);
    expect(unique.size).toBe(addresses.length);
  });

  it("no duplicate addresses among agent entities", () => {
    const entities = getAllEntities("agent");
    const addresses = entities.map((e) => e.address.toLowerCase());
    const unique = new Set(addresses);
    expect(unique.size).toBe(addresses.length);
  });
});

describe("getKnownProtocolsMap", () => {
  it("returns a non-empty map", () => {
    const map = getKnownProtocolsMap();
    expect(map.size).toBeGreaterThan(0);
  });

  it("includes USDC", () => {
    const map = getKnownProtocolsMap();
    expect(map.has("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")).toBe(true);
  });

  it("map values have name and category", () => {
    const map = getKnownProtocolsMap();
    for (const [, info] of map) {
      expect(info.name).toBeTruthy();
      expect(info.category).toBeTruthy();
    }
  });
});
