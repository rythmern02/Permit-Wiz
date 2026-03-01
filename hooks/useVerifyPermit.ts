"use client";

import { useState, useCallback } from "react";
import {
  recoverTypedDataAddress,
  hexToSignature,
  type Hex,
  type Address,
} from "viem";
import {
  PERMIT_TYPES,
  type PermitDomain,
  type PermitMessage,
} from "@/lib/eip712";

export interface SplitSignature {
  v: number;
  r: Hex;
  s: Hex;
}

export interface VerificationResult {
  recoveredAddress: Address;
  isMatch: boolean;
  splitSignature: SplitSignature;
}

export function useVerifyPermit() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(
    async (
      signature: Hex,
      domain: PermitDomain,
      message: PermitMessage,
      expectedOwner: Address,
    ) => {
      setIsVerifying(true);
      setError(null);
      setResult(null);

      try {
        // Recover signer from typed data signature
        const recoveredAddress = await recoverTypedDataAddress({
          domain,
          types: PERMIT_TYPES,
          primaryType: "Permit",
          message,
          signature,
        });

        // Split signature into v, r, s
        const { v, r, s } = hexToSignature(signature);

        const isMatch =
          recoveredAddress.toLowerCase() === expectedOwner.toLowerCase();

        setResult({
          recoveredAddress,
          isMatch,
          splitSignature: {
            v: Number(v),
            r,
            s,
          },
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? `Verification failed: ${err.message}`
            : "Unknown verification error",
        );
      } finally {
        setIsVerifying(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isVerifying, error, verify, reset };
}
