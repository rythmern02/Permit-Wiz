"use client";

import { useCallback, useState } from "react";
import { usePublicClient, useChainId } from "wagmi";
import type { Address } from "viem";
import { hexToString } from "viem";
import {
  IERC20PermitABI,
  ERC20Bytes32ABI,
  NonceAlternativesABI,
} from "@/abis/IERC20Permit";
import { buildDomain, type PermitDomain } from "@/lib/eip712";

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
    abi: readonly unknown[];
    args?: readonly unknown[];
  },
  fallbacks: Array<{
    functionName: string;
    abi: readonly unknown[];
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
      abi: primary.abi as never,
      functionName: primary.functionName as never,
      args: primary.args as never,
    });
    return { value: result as T, warning: null, failed: false };
  } catch (primaryErr) {
    console.warn(
      `${LOG_PREFIX} ⚠️ Primary ${fieldName}() call failed, trying fallbacks...`,
      primaryErr,
    );
  }

  // Try each fallback
  for (const fb of fallbacks) {
    try {
      const result = await client.readContract({
        address,
        abi: fb.abi as never,
        functionName: fb.functionName as never,
        args: fb.args as never,
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

  const fetchTokenData = useCallback(async () => {
    if (!tokenAddress || !ownerAddress || !publicClient) {
      console.error(
        `${LOG_PREFIX} ❌ Cannot fetch: missing address or client`,
        {
          tokenAddress,
          ownerAddress,
          hasClient: !!publicClient,
        },
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setWarnings([]);
    setTokenData(null);
    setDomain(null);

    const newWarnings: string[] = [];

    console.log(
      `${LOG_PREFIX} 🔍 Fetching token data for ${tokenAddress} on chain ${chainId}...`,
    );

    try {
      // Step 1: Verify the contract exists (has code deployed)
      const code = await publicClient.getCode({ address: tokenAddress });
      if (!code || code === "0x") {
        const msg =
          "No contract found at this address. Please verify the address and the connected network.";
        console.error(`${LOG_PREFIX} ❌ ${msg}`, {
          address: tokenAddress,
          chainId,
        });
        setError(msg);
        setIsLoading(false);
        return;
      }
      console.log(
        `${LOG_PREFIX} ✓ Contract exists at ${tokenAddress} (${code.length} bytes of code)`,
      );

      // Step 2: Fetch name with bytes32 fallback
      const nameResult = await tryReadWithFallback<string>(
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
      );

      // Step 3: Fetch symbol with bytes32 fallback
      const symbolResult = await tryReadWithFallback<string>(
        publicClient,
        tokenAddress,
        { functionName: "symbol", abi: IERC20PermitABI },
        [
          {
            functionName: "symbol",
            abi: ERC20Bytes32ABI,
            transform: (v) => decodeBytes32String(v as `0x${string}`),
            label: "Token returns bytes32 for symbol() — decoded successfully.",
          },
        ],
        "symbol",
      );

      // Step 4: Fetch decimals
      const decimalsResult = await tryReadWithFallback<number>(
        publicClient,
        tokenAddress,
        { functionName: "decimals", abi: IERC20PermitABI },
        [],
        "decimals",
      );

      // Step 5: Fetch nonces with alternative function name fallbacks
      const nonceResult = await tryReadWithFallback<bigint>(
        publicClient,
        tokenAddress,
        { functionName: "nonces", abi: IERC20PermitABI, args: [ownerAddress] },
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
      );

      // Step 6: Fetch version (optional, defaults to "1")
      const versionResult = await tryReadWithFallback<string>(
        publicClient,
        tokenAddress,
        { functionName: "version", abi: IERC20PermitABI },
        [],
        "version",
      );

      // Step 7: Check DOMAIN_SEPARATOR existence (optional validation)
      let hasDomainSeparator = false;
      try {
        await publicClient.readContract({
          address: tokenAddress,
          abi: IERC20PermitABI,
          functionName: "DOMAIN_SEPARATOR",
        });
        hasDomainSeparator = true;
        console.log(`${LOG_PREFIX} ✓ DOMAIN_SEPARATOR() exists`);
      } catch {
        console.warn(
          `${LOG_PREFIX} ⚠️ DOMAIN_SEPARATOR() not found or reverted`,
        );
      }

      // --- Evaluate results ---

      // If both name and symbol fail, the contract's view functions are broken
      if (nameResult.failed && symbolResult.failed) {
        const msg =
          "This contract's view functions are reverting. " +
          "It may be an uninitialized proxy, a paused contract, or not ERC-20 compatible. " +
          "Try verifying on the block explorer that name() and symbol() are callable.";
        console.error(`${LOG_PREFIX} ❌ ${msg}`, { address: tokenAddress });
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
        console.error(`${LOG_PREFIX} ❌ ${msg}`, { address: tokenAddress });
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

      if (version !== "1") {
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
      setDomain(domainObj);

      setWarnings(newWarnings);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `${LOG_PREFIX} ❌ Unexpected error during token fetch:`,
        err,
      );
      setError(
        `Failed to read contract data: ${msg}. Check the address and ensure you're on the correct network.`,
      );
    } finally {
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
