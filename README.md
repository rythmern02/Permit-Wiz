![Rootstock Banner](https://raw.githubusercontent.com/rsksmart/devportal/main/rootstock-logo.png)

# Permit-Wiz: Gasless Signature Tool for Rootstock 

[![Rootstock](https://img.shields.io/badge/Rootstock-Ecosystem-orange?style=for-the-badge&logo=rootstock)](https://rootstock.io/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Viem](https://img.shields.io/badge/Viem-wagmi-blue?style=for-the-badge)](https://viem.sh/)

"Gasless" transactions (using RIF Relay) are a massive selling point for Rootstock, but debugging failed EIP-712 signatures—the dreaded `"Invalid Signature"` error—can be a nightmare for developers. A single mismatched chain ID, version string, or nonce will cause the entire transaction to revert.

**Permit-Wiz** is a purpose-built developer tool that lets you generate, sign, and instantly verify ERC-2612 Permit payloads. It automatically extracts the exact DOMAIN_SEPARATOR from the smart contract, eliminating guesswork and helping you find bugs in seconds.

## Features

- 🔍 **Auto-Fetcher**: Input any token contract address. Permit-Wiz uses on-chain `eth_call`s to automatically pull the token's `name()`, `version()`, `decimals()`, and precisely what its current `nonces(owner)` is.
- 🏗️ **Payload Builder**: A clean UI to construct your permit parameters (Spender, Value, Deadline) using the mathematically correct EIP-712 domain data parsed from the contract.
- ✍️ **Signing Studio**: Prompts your connected web3 wallet (MetaMask, Rabby, etc.) to securely sign the exact Typed Data JSON.
- ✅ **Verification Engine**: Instantly takes the generated `v`, `r`, and `s` signature components and mathematically recovers the signer's address via `verifyTypedData`. If it matches the Owner, your signature is guaranteed to work on-chain.
- 💻 **Code Snippet Export**: Generates the exact **Solidity** (for smart contracts) and **JavaScript/TypeScript** (using Viem) snippets needed to execute your perfectly signed permit.

## Tech Stack

- **Frontend Core**: React 19 / Next.js 16
- **Web3 Layer**: Viem & Wagmi (for checksum handling, EIP-712 hashing, and deterministic RPC calls)
- **Styling**: Tailwind CSS & shadcn/ui
- **Cryptography**: Native EIP-2612 Standard implementation / `ecrecover`

## Getting Started

### Prerequisites

- Node.js version `^20.0.0`
- A Rootstock Mainnet or Testnet configured wallet (e.g., MetaMask).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/permit-wiz.git
   cd permit-wiz
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

## Testing on Rootstock Mainnet

Because ERC-2612 wasn't heavily standardized until recently, older tokens on Rootstock (like RIF or DOC) may not implement the `nonces(owner)` function natively (unless wrapped/upgraded).

**Known Working ERC-2612 Tokens for Testing:**
- **stRIF (Staked RIF)**: `0x5db91e24BD32059584bbDb831A901f1199f3d459`
- *Most modern DEX LP Tokens (e.g., Uniswap V3 position NFTs, SushiSwap V2 LPs)*

If you try a token that isn't compatible, the Auto-Fetcher will gracefully alert you: *"Failed to read nonces(owner). This token likely does not support ERC-2612 permit."*

## 📖 How It Works Under the Hood

Permit-Wiz solves the classic *"Why did my payload fail?"* problem through multi-layered fallback RPC calls:

1. **Checksum Handling**: Adapts strictly to Rootstock's EIP-1191 chain-specific checksums.
2. **Byte32 Fallbacks**: Some older DeFi tokens (MakerDAO-style) return `bytes32` strings instead of dynamic `string` for `name()` and `symbol()`. Permit-Wiz auto-detects and decodes these.
3. **Upgradeable Proxies**: Transparent proxies on Rootstock can revert on simple view-calls. Permit-Wiz correctly detects initialization failures vs standard non-compliance.

---
*Built for the Rootstock Developer Ecosystem.* 🧡
