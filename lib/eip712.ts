import type { Address } from "viem";

// EIP-712 Permit type definition (ERC-2612 standard)
export const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export interface PermitDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export interface PermitMessage {
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}

export function buildDomain(
  tokenName: string,
  version: string,
  chainId: number,
  verifyingContract: Address,
): PermitDomain {
  return {
    name: tokenName,
    version,
    chainId,
    verifyingContract,
  };
}

export function buildPermitMessage(
  owner: Address,
  spender: Address,
  value: bigint,
  nonce: bigint,
  deadline: bigint,
): PermitMessage {
  return {
    owner,
    spender,
    value,
    nonce,
    deadline,
  };
}

/**
 * Formats the full EIP-712 typed data object for display / signing
 */
export function buildTypedData(domain: PermitDomain, message: PermitMessage) {
  return {
    domain,
    types: PERMIT_TYPES,
    primaryType: "Permit" as const,
    message,
  };
}
