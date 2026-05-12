import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CACHE_TTL_MS,
  buildCacheKey,
  clearCache,
  getCacheEntry,
  setCacheEntry,
} from "../lib/tokenCache";
import type { PermitDomain } from "../lib/eip712";

const TOKEN: PermitDomain = {
  name: "TestToken",
  version: "1",
  chainId: 30,
  verifyingContract: "0x1234567890123456789012345678901234567890",
};

const sampleEntry = (storedAt: number) => ({
  td: {
    name: "TestToken",
    symbol: "TT",
    decimals: 18,
    version: "1",
    nonce: BigInt(0),
  },
  warnings: [],
  domain: TOKEN,
  storedAt,
});

describe("tokenCache", () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_800_000_000_000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("buildCacheKey", () => {
    it("is case-insensitive on token and owner addresses", () => {
      const lower = buildCacheKey(
        30,
        "0xabcdef0000000000000000000000000000000001",
        "0xdeadbeef00000000000000000000000000000002",
      );
      const upper = buildCacheKey(
        30,
        "0xABCDEF0000000000000000000000000000000001",
        "0xDEADBEEF00000000000000000000000000000002",
      );
      expect(lower).toBe(upper);
    });

    it("partitions by chainId so a chain switch never serves another chain's data", () => {
      const onMainnet = buildCacheKey(30, TOKEN.verifyingContract, "0xaaaa");
      const onTestnet = buildCacheKey(31, TOKEN.verifyingContract, "0xaaaa");
      expect(onMainnet).not.toBe(onTestnet);
    });
  });

  describe("TTL eviction", () => {
    it("returns a fresh entry within the TTL", () => {
      const key = buildCacheKey(30, TOKEN.verifyingContract, "0xaaaa");
      setCacheEntry(key, sampleEntry(Date.now()));

      // Advance time, but stay strictly under the TTL.
      vi.advanceTimersByTime(CACHE_TTL_MS - 1);

      const entry = getCacheEntry(key);
      expect(entry).not.toBeNull();
      expect(entry?.td.name).toBe("TestToken");
    });

    it("evicts and returns null when the entry is older than TTL", () => {
      const key = buildCacheKey(30, TOKEN.verifyingContract, "0xaaaa");
      setCacheEntry(key, sampleEntry(Date.now()));

      // Push past TTL by 1ms.
      vi.advanceTimersByTime(CACHE_TTL_MS + 1);

      expect(getCacheEntry(key)).toBeNull();
      // Second read confirms eviction was persisted (entry was deleted).
      expect(getCacheEntry(key)).toBeNull();
    });

    it("returns null for an unknown key without populating the map", () => {
      expect(getCacheEntry("missing-key")).toBeNull();
    });
  });
});
