"use client";

import { useCallback, useState, useRef } from "react";
import { usePublicClient, useChainId } from "wagmi";
import type { Address } from "viem";
import { hexToString } from "viem";
import {
  IERC20PermitABI,
  ERC20Bytes32ABI,
  NonceAlternativesABI,
} from "@/abis/IERC20Permit";
import { buildDomain, type PermitDomain } from "@/lib/eip712";
import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";

export interface TokenData {
  name: string;
  symbol: string;
  decimals: number;
  version: string;
  nonce: bigint;
}

export interface UsePermitDataReturn {
  tokenData: TokenData | null;
  domain: PermitDomain | null;
  isLoading: boolean;
  error: string | null;
  warnings: string[];
  fetch: () => void;
}

const LOG_PREFIX = "[PermitWiz]";

/** Cache TTL in milliseconds (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  td: TokenData;
  warnings: string[];
  domain: PermitDomain;
  /** Unix epoch ms when this entry was stored. */
  storedAt: number;
}

// Module-level cache with TTL.
const tokenDataCache = new Map<string, CacheEntry>();

/**
 * Returns a cached entry only if it is still fresh (within TTL).
 * Stale entries are deleted on access.
 */
function getCacheEntry(key: string): CacheEntry | null {
  const entry = tokenDataCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    tokenDataCache.delete(key);
    return null;
  }
  return entry;
}

/**
 * Decode a bytes32 value to a UTF-8 string (strips null bytes).
 * Some older tokens (MakerDAO-style) return bytes32 instead of string.
 */
function decodeBytes32String(hex: `0x${string}`): string {
  try {
    return hexToString(hex, { size: 32 }).replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

/**
 * Try reading a contract field with a primary ABI, then fall back to alternatives.
 * Returns [value, warningMessage | null].
 */
async function tryReadWithFallback<T>(
  client: ReturnType<typeof usePublicClient>,
  address: Address,
  primary: {
    functionName: string;
    abi: any;
    args?: readonly unknown[];
  },
  fallbacks: Array<{
    functionName: string;
    abi: any;
    args?: readonly unknown[];
    transform?: (v: unknown) => T;
    label: string;
  }>,
  fieldName: string,
): Promise<{ value: T | null; warning: string | null; failed: boolean }> {
  if (!client) return { value: null, warning: null, failed: true };

  // Try primary
  try {
    const result = await client.readContract({
      address,
      abi: primary.abi,
      functionName: primary.functionName,
      args: primary.args,
    });
    return { value: result as T, warning: null, failed: false };
  } catch (primaryErr) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `${LOG_PREFIX} ⚠️ Primary ${fieldName}() call failed, trying fallbacks...`,
      );
    }
  }

  // Try each fallback
  for (const fb of fallbacks) {
    try {
      const result = await client.readContract({
        address,
        abi: fb.abi,
        functionName: fb.functionName,
        args: fb.args,
      });
      const value = fb.transform ? fb.transform(result) : (result as T);
      return { value, warning: fb.label, failed: false };
    } catch {
      // Continue to next fallback
    }
  }

  return { value: null, warning: null, failed: true };
}

export function usePermitData(
  tokenAddress: Address | undefined,
  ownerAddress: Address | undefined,
): UsePermitDataReturn {
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [domain, setDomain] = useState<PermitDomain | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  /**
   * Race-condition guard using useRef so that reading/writing the current run
   * ID is safe in React Strict Mode and concurrent rendering, where state
   * updater functions may be called multiple times.
   */
  const runIdRef = useRef(0);

  const fetchTokenData = useCallback(async () => {
    if (!tokenAddress || !ownerAddress || !publicClient) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `${LOG_PREFIX} ❌ Cannot fetch: missing address or client`,
          {
            tokenAddress,
            ownerAddress,
            hasClient: !!publicClient,
          },
        );
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    setWarnings([]);
    setTokenData(null);
    setDomain(null);

    // Capture the run ID for this invocation.
    const currentRunId = ++runIdRef.current;

    const cacheKey = `${chainId}-${tokenAddress.toLowerCase()}-${ownerAddress.toLowerCase()}`;
    const cached = getCacheEntry(cacheKey);
    if (cached) {
      // Guard: ensure no newer fetch has started since the cache lookup.
      if (runIdRef.current !== currentRunId) return;
      setTokenData(cached.td);
      setDomain(cached.domain);
      setWarnings(cached.warnings);
      setIsLoading(false);
      return;
    }

    const newWarnings: string[] = [];

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `${LOG_PREFIX} 🔍 Fetching token data for ${tokenAddress} on chain ${chainId}...`,
      );
    }

    try {
      // Parallelize RPC calls using Promise.all where possible
      const [
        nameResult,
        symbolResult,
        decimalsResult,
        nonceResult,
        versionResult,
        code,
      ] = await Promise.all([
        tryReadWithFallback<string>(
          publicClient,
          tokenAddress,
          { functionName: "name", abi: IERC20PermitABI },
          [
            {
              functionName: "name",
              abi: ERC20Bytes32ABI,
              transform: (v) => decodeBytes32String(v as `0x${string}`),
              label: "Token returns bytes32 for name() — decoded successfully.",
            },
          ],
          "name",
        ),
        tryReadWithFallback<string>(
          publicClient,
          tokenAddress,
          { functionName: "symbol", abi: IERC20PermitABI },
          [
            {
              functionName: "symbol",
              abi: ERC20Bytes32ABI,
              transform: (v) => decodeBytes32String(v as `0x${string}`),
              label:
                "Token returns bytes32 for symbol() — decoded successfully.",
            },
          ],
          "symbol",
        ),
        tryReadWithFallback<number>(
          publicClient,
          tokenAddress,
          { functionName: "decimals", abi: IERC20PermitABI },
          [],
          "decimals",
        ),
        tryReadWithFallback<bigint>(
          publicClient,
          tokenAddress,
          {
            functionName: "nonces",
            abi: IERC20PermitABI,
            args: [ownerAddress],
          },
          [
            {
              functionName: "_nonces",
              abi: NonceAlternativesABI,
              args: [ownerAddress],
              label: "Token uses _nonces() instead of nonces().",
            },
            {
              functionName: "getNonce",
              abi: NonceAlternativesABI,
              args: [ownerAddress],
              label: "Token uses getNonce() instead of nonces().",
            },
          ],
          "nonces",
        ),
        tryReadWithFallback<string>(
          publicClient,
          tokenAddress,
          { functionName: "version", abi: IERC20PermitABI },
          [],
          "version",
        ),
        publicClient.getCode({ address: tokenAddress }),
      ]);

      // Bail out if a newer fetch has superseded this one.
      if (runIdRef.current !== currentRunId) return;

      if (!code || code === "0x") {
        const msg =
          "No contract found at this address. Please verify the address and the connected network.";
        if (process.env.NODE_ENV !== "production") {
          console.warn(`${LOG_PREFIX} ❌ ${msg}`, {
            address: tokenAddress,
            chainId,
          });
        }
        setError(msg);
        setIsLoading(false);
        return;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `${LOG_PREFIX} ✓ Contract exists at ${tokenAddress} (${code.length} bytes of code)`,
        );
      }

      let hasDomainSeparator = false;
      let contractDomainSeparator: string | null = null;
      try {
        const returnedDs = await publicClient.readContract({
          address: tokenAddress,
          abi: IERC20PermitABI,
          functionName: "DOMAIN_SEPARATOR",
        });
        hasDomainSeparator = true;
        contractDomainSeparator = returnedDs as string;
        if (process.env.NODE_ENV !== "production") {
          console.log(`${LOG_PREFIX} ✓ DOMAIN_SEPARATOR() exists`);
        }
      } catch {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `${LOG_PREFIX} ⚠️ DOMAIN_SEPARATOR() not found or reverted`,
          );
        }
      }

      // Bail out again after the second async block.
      if (runIdRef.current !== currentRunId) return;

      // --- Evaluate results ---

      // If both name and symbol fail, the contract's view functions are broken
      if (nameResult.failed && symbolResult.failed) {
        const msg =
          "This contract's view functions are reverting. " +
          "It may be an uninitialized proxy, a paused contract, or not ERC-20 compatible. " +
          "Try verifying on the block explorer that name() and symbol() are callable.";
        if (process.env.NODE_ENV !== "production") {
          console.warn(`${LOG_PREFIX} ❌ ${msg}`, { address: tokenAddress });
        }
        setError(msg);
        setIsLoading(false);
        return;
      }

      // Name: use result or fallback
      const name = nameResult.failed
        ? "Unknown Token"
        : (nameResult.value ?? "Unknown Token");
      if (nameResult.failed) {
        newWarnings.push(
          'Could not read name() — using "Unknown Token". Signing may still work if you know the correct domain name.',
        );
      } else if (nameResult.warning) {
        newWarnings.push(nameResult.warning);
      }

      // Symbol
      const symbol = symbolResult.failed
        ? "???"
        : (symbolResult.value ?? "???");
      if (symbolResult.failed) {
        newWarnings.push('Could not read symbol() — using "???".');
      } else if (symbolResult.warning) {
        newWarnings.push(symbolResult.warning);
      }

      // Decimals
      const decimals = decimalsResult.failed
        ? 18
        : Number(decimalsResult.value ?? 18);
      if (decimalsResult.failed) {
        newWarnings.push("Could not read decimals() — defaulting to 18.");
      }

      // Nonce: this is critical for ERC-2612
      if (nonceResult.failed) {
        const msg =
          "Failed to read nonces(owner). This token likely does not support ERC-2612 permit. " +
          "The contract must implement a nonces() function for permit to work.";
        if (process.env.NODE_ENV !== "production") {
          console.warn(`${LOG_PREFIX} ❌ ${msg}`, { address: tokenAddress });
        }
        if (!hasDomainSeparator) {
          setError(
            msg +
            " No DOMAIN_SEPARATOR() was found either, confirming this is not an ERC-2612 token.",
          );
        } else {
          setError(msg);
        }
        setIsLoading(false);
        return;
      }
      const nonce = nonceResult.value ?? BigInt(0);
      if (nonceResult.warning) {
        newWarnings.push(nonceResult.warning);
      }

      // Version
      let version = "1";
      if (!versionResult.failed && versionResult.value) {
        version = versionResult.value;
      } else {
        newWarnings.push(
          'version() not found on contract — defaulting to "1". If signing fails, the contract may use a different version string.',
        );
      }

      if (version !== "1" && process.env.NODE_ENV !== "production") {
        console.log(
          `${LOG_PREFIX} ℹ️ Non-standard version detected: "${version}"`,
        );
      }

      if (!hasDomainSeparator) {
        newWarnings.push(
          "DOMAIN_SEPARATOR() was not found. The token might still support permit but domain validation is not possible.",
        );
      }

      // --- Success! Set state ---
      const td: TokenData = { name, symbol, decimals, version, nonce };
      setTokenData(td);

      const domainObj = buildDomain(name, version, chainId, tokenAddress);

      if (hasDomainSeparator && contractDomainSeparator) {
        const computedDs = keccak256(
          encodeAbiParameters(
            parseAbiParameters([
              "bytes32",
              "bytes32",
              "bytes32",
              "uint256",
              "address",
            ]),
            [
              keccak256(
                new TextEncoder().encode(
                  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
                ),
              ),
              keccak256(new TextEncoder().encode(name)),
              keccak256(new TextEncoder().encode(version)),
              BigInt(chainId),
              tokenAddress,
            ],
          ),
        );
        if (
          computedDs.toLowerCase() !==
          contractDomainSeparator.toLowerCase()
        ) {
          newWarnings.push(
            `DOMAIN_SEPARATOR mismatch! Computed: ${computedDs.substring(0, 10)}..., Contract: ${contractDomainSeparator.substring(0, 10)}... The version or name string may be incorrect.`,
          );
        }
      }

      setDomain(domainObj);
      setWarnings(newWarnings);

      // Store in cache with current timestamp for TTL tracking.
      tokenDataCache.set(cacheKey, {
        td,
        warnings: newWarnings,
        domain: domainObj,
        storedAt: Date.now(),
      });

      if (process.env.NODE_ENV !== "production") {
        console.log(`${LOG_PREFIX} ✅ Token fetched successfully:`, {
          name,
          symbol,
          decimals,
          version,
          nonce: nonce.toString(),
          chainId,
          hasDomainSeparator,
          warnings: newWarnings.length,
        });
      }

      setIsLoading(false);
    } catch (err) {
      if (runIdRef.current !== currentRunId) return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `${LOG_PREFIX} ❌ Unexpected error during token fetch:`,
          err,
        );
      }
      setError(
        `Failed to read contract data: ${msg}. Check the address and ensure you're on the correct network.`,
      );
      setIsLoading(false);
    }
  }, [tokenAddress, ownerAddress, publicClient, chainId]);

  return {
    tokenData,
    domain,
    isLoading,
    error,
    warnings,
    fetch: fetchTokenData,
  };
}
