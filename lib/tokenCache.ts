import type { PermitDomain } from "./eip712";

export interface CachedTokenData {
  name: string;
  symbol: string;
  decimals: number;
  version: string;
  nonce: bigint;
}

export interface CacheEntry {
  td: CachedTokenData;
  warnings: string[];
  domain: PermitDomain;
  /** Unix epoch ms when this entry was stored. */
  storedAt: number;
}

/** Cache TTL in milliseconds (5 minutes). */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Build a deterministic cache key from chain id, token, and owner. The owner
 * is part of the key because nonces are per-owner. Addresses are lowercased
 * so different casings of the same address share an entry.
 */
export function buildCacheKey(
  chainId: number,
  tokenAddress: string,
  ownerAddress: string,
): string {
  return `${chainId}-${tokenAddress.toLowerCase()}-${ownerAddress.toLowerCase()}`;
}

const tokenDataCache = new Map<string, CacheEntry>();

/**
 * Returns a cached entry only if it is still fresh (within TTL). Stale entries
 * are deleted on access so the map does not grow unboundedly.
 */
export function getCacheEntry(key: string): CacheEntry | null {
  const entry = tokenDataCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    tokenDataCache.delete(key);
    return null;
  }
  return entry;
}

export function setCacheEntry(key: string, entry: CacheEntry): void {
  tokenDataCache.set(key, entry);
}

/** Exposed for tests so each test starts with a clean cache. */
export function clearCache(): void {
  tokenDataCache.clear();
}
