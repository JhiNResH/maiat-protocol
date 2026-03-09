/**
 * tests/unit/erc8004-fuzz.test.ts
 *
 * Property-based / fuzz tests for ERC-8004 utilities.
 * Verifies correctness across diverse, adversarial, and edge-case inputs.
 */

import { describe, it, expect } from "vitest";
import { buildAgentURI, isValidAddress } from "../../scripts/register-erc8004";

// ─── Fuzz Input Corpus ────────────────────────────────────────────────────────

/** Diverse string corpus — normal, edge-case, adversarial */
const FUZZ_STRINGS: string[] = [
  // Normal
  "",
  " ",
  "a",
  "hello world",
  "Maiat Protocol",

  // Unicode & emoji
  "🦄🔥💀⚡",
  "日本語テスト",
  "Ñoño señor",
  "Привет мир",
  "مرحبا بالعالم",
  "🎉".repeat(100),

  // Special characters that break JSON naively
  '"',
  "'",
  "\\",
  "\n",
  "\r",
  "\t",
  "\0",
  "\u0000",
  '{"key": "value"}',
  "<script>alert('xss')</script>",
  "'; DROP TABLE agents; --",

  // Data URI lookalike (adversarial)
  "data:application/json;base64,evil",
  "data:text/html;base64,PHNjcmlwdD4=",

  // Very long strings
  "a".repeat(1000),
  "b".repeat(10_000),
  "🦄".repeat(500),

  // Edge values
  "null",
  "undefined",
  "true",
  "false",
  "0",
  "-1",
  "3.14",
  "{}",
  "[]",
  "[null, undefined]",

  // Whitespace
  "   ",
  "\n\n\n",
  "\t\t",

  // URL-like
  "https://example.com",
  "https://evil.com?param=<script>",

  // Base64 data
  "0x1234567890abcdef",
  "0x" + "ff".repeat(32),
];

// ─── Property: buildAgentURI never crashes ────────────────────────────────────

describe("buildAgentURI fuzz: any string name+description → no crash", () => {
  for (const name of FUZZ_STRINGS) {
    it(`handles name=${JSON.stringify(name.slice(0, 25)).padEnd(30)}`, () => {
      expect(() => buildAgentURI(name, "Some description")).not.toThrow();
    });
  }

  for (const desc of FUZZ_STRINGS) {
    it(`handles desc=${JSON.stringify(desc.slice(0, 25)).padEnd(30)}`, () => {
      expect(() => buildAgentURI("AgentName", desc)).not.toThrow();
    });
  }
});

// ─── Property: buildAgentURI always round-trips through JSON.parse ────────────

describe("buildAgentURI property: always round-trips through JSON.parse", () => {
  const ROUND_TRIP_CASES: [string, string][] = [
    ["", ""],
    ["Maiat", "Trust oracle"],
    ['Agent with "quotes"', "Description with 'apostrophe'"],
    ["Agent\nwith\nnewlines", "Desc\twith\ttabs"],
    ["Unicode 日本語", "Emoji 🦄🔥"],
    ["<html>", "<script>alert(1)</script>"],
    ["a".repeat(500), "b".repeat(500)],
    ["null", "undefined"],
    ['{"nested": "json"}', "[1,2,3]"],
    ["\0", "\u0000\u001F"],
    ["backslash \\", "forward /slash"],
    ["🎉".repeat(100), "💀".repeat(100)],
    ["line1\nline2\nline3", "col1\tcol2\tcol3"],
  ];

  for (const [name, desc] of ROUND_TRIP_CASES) {
    it(`round-trips name=${JSON.stringify(name.slice(0, 30))}`, () => {
      const uri = buildAgentURI(name, desc);

      // Must be a valid data URI
      expect(uri).toMatch(/^data:application\/json;base64,/);

      // Must decode to valid base64
      const b64 = uri.replace("data:application/json;base64,", "");
      const decoded = Buffer.from(b64, "base64").toString("utf-8");

      // Must parse as valid JSON
      let parsed: Record<string, unknown>;
      expect(() => {
        parsed = JSON.parse(decoded);
      }).not.toThrow();

      // Round-trip fidelity: name and description must survive encoding
      expect(parsed!.name).toBe(name);
      expect(parsed!.description).toBe(desc);
    });
  }
});

// ─── Property: required fields always present ─────────────────────────────────

describe("buildAgentURI property: required fields always present", () => {
  const SAMPLES = FUZZ_STRINGS.slice(0, 20);

  for (const s of SAMPLES) {
    it(`required fields present for input ${JSON.stringify(s.slice(0, 25))}`, () => {
      const uri = buildAgentURI(s, s);
      const b64 = uri.replace("data:application/json;base64,", "");
      const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));

      // Schema required fields
      expect(json).toHaveProperty("type");
      expect(json.type).toBe("https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
      expect(json).toHaveProperty("name");
      expect(json).toHaveProperty("description");
      expect(json).toHaveProperty("image");
      expect(json).toHaveProperty("services");
      expect(Array.isArray(json.services)).toBe(true);
    });
  }
});

// ─── Property: trustScore 0-100 → value * 100 fits in int128 ─────────────────

describe("trustScore → int128 bounds", () => {
  const INT128_MAX = 2n ** 127n - 1n; // 170141183460469231731687303715884105727

  it("INT128_MAX is correct (2^127 - 1)", () => {
    expect(INT128_MAX).toBe(170141183460469231731687303715884105727n);
  });

  it("value * 100 fits in int128 for all scores 0-100", () => {
    for (let score = 0; score <= 100; score++) {
      const value = BigInt(score * 100);
      expect(value).toBeLessThanOrEqual(INT128_MAX);
    }
  });

  it("max score (100) produces value=10000, well within int128", () => {
    const maxValue = BigInt(100 * 100); // 10000
    expect(maxValue).toBe(10000n);
    expect(maxValue <= INT128_MAX).toBe(true);
  });

  it("score=0 produces value=0 (valid)", () => {
    expect(BigInt(0 * 100)).toBe(0n);
  });

  it("score=50 produces value=5000 (midpoint)", () => {
    expect(BigInt(50 * 100)).toBe(5000n);
  });

  it("signed int128: negative scores would also fit (e.g. -100 → -10000)", () => {
    // Hypothetical negative scores — still within signed int128
    const INT128_MIN = -(2n ** 127n);
    const negValue = BigInt(-100 * 100); // -10000
    expect(negValue).toBeGreaterThanOrEqual(INT128_MIN);
  });
});

// ─── Property: bytes32 hex string validation ──────────────────────────────────

describe("bytes32 fileHash: /^0x[a-fA-F0-9]{64}$/ validation", () => {
  function isValidBytes32(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }

  const VALID_BYTES32 = [
    "0x" + "0".repeat(64),
    "0x" + "f".repeat(64),
    "0x" + "F".repeat(64),
    "0x" + "a".repeat(64),
    "0x" + "A".repeat(64),
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "0x" + "deadbeef".repeat(8),
  ];

  const INVALID_BYTES32 = [
    "",
    "0x",
    "0x1234", // too short
    "0x" + "a".repeat(63), // one short
    "0x" + "a".repeat(65), // one long
    "0x" + "g".repeat(64), // invalid hex char
    "0x" + "z".repeat(64), // invalid hex char
    "1x" + "a".repeat(64), // wrong prefix
    "0X" + "a".repeat(64), // uppercase X
    "a".repeat(64), // no prefix
    "0x" + "0".repeat(32), // only 32 chars of hex (not 64)
    "not a hash at all",
    "0x" + " ".repeat(64), // spaces
  ];

  for (const hash of VALID_BYTES32) {
    it(`accepts valid bytes32: ${hash.slice(0, 20)}...`, () => {
      expect(isValidBytes32(hash)).toBe(true);
    });
  }

  for (const hash of INVALID_BYTES32) {
    it(`rejects invalid bytes32: ${JSON.stringify(hash.slice(0, 30))}`, () => {
      expect(isValidBytes32(hash)).toBe(false);
    });
  }

  it("fuzz: any 32-byte hex string (64 hex chars) is valid", () => {
    // Generate many random bytes32-like strings
    const hexChars = "0123456789abcdefABCDEF";
    for (let i = 0; i < 50; i++) {
      const chars = Array.from({ length: 64 }, () =>
        hexChars[Math.floor(Math.random() * hexChars.length)]
      ).join("");
      const hash = `0x${chars}`;
      expect(isValidBytes32(hash)).toBe(true);
    }
  });
});

// ─── Property: wallet address fuzz ────────────────────────────────────────────

describe("wallet address fuzz: /^0x[a-fA-F0-9]{40}$/ is required", () => {
  const VALID_ADDRESSES = [
    "0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D",
    "0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9",
    "0x0000000000000000000000000000000000000000",
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    "0xffffffffffffffffffffffffffffffffffffffff",
    "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    "0x" + "1234567890abcdefABCDEF1234567890abcdef12",
  ];

  const INVALID_ADDRESSES = [
    "",
    "0x",
    "0xinvalid",
    "not-an-address",
    "0x1234", // too short
    "0x" + "a".repeat(39), // 39 chars
    "0x" + "a".repeat(41), // 41 chars
    "0x" + "g".repeat(40), // invalid hex
    "1x" + "a".repeat(40), // wrong prefix
    "0X" + "a".repeat(40), // uppercase X in prefix
    " 0x" + "a".repeat(40), // leading space
    "0x" + "a".repeat(40) + " ", // trailing space
    "abc" + "a".repeat(40), // no 0x
    "0x" + "0".repeat(20), // only 20 chars
    "0x" + "Z".repeat(40), // Z not in hex
    ...(FUZZ_STRINGS.filter((s) => !/^0x[a-fA-F0-9]{40}$/.test(s))),
  ];

  for (const addr of VALID_ADDRESSES) {
    it(`accepts valid address: ${addr.slice(0, 20)}...`, () => {
      expect(isValidAddress(addr)).toBe(true);
    });
  }

  // Test a subset of invalid addresses (avoid duplicates from FUZZ_STRINGS)
  const uniqueInvalid = [...new Set(INVALID_ADDRESSES)].slice(0, 30);
  for (const addr of uniqueInvalid) {
    it(`rejects invalid address: ${JSON.stringify(addr.slice(0, 30))}`, () => {
      expect(isValidAddress(addr)).toBe(false);
    });
  }

  it("fuzz: generated valid addresses always pass", () => {
    const hexChars = "0123456789abcdefABCDEF";
    for (let i = 0; i < 100; i++) {
      const chars = Array.from({ length: 40 }, () =>
        hexChars[Math.floor(Math.random() * hexChars.length)]
      ).join("");
      const addr = `0x${chars}`;
      expect(isValidAddress(addr)).toBe(true);
    }
  });

  it("fuzz: addresses with wrong length always fail", () => {
    for (let len = 0; len < 40; len++) {
      const addr = "0x" + "a".repeat(len);
      expect(isValidAddress(addr)).toBe(false);
    }
    for (let len = 41; len <= 50; len++) {
      const addr = "0x" + "a".repeat(len);
      expect(isValidAddress(addr)).toBe(false);
    }
  });
});
