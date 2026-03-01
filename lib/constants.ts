import { defineChain } from "viem";

export const rootstock = defineChain({
  id: 30,
  name: "Rootstock Mainnet",
  nativeCurrency: {
    name: "Smart Bitcoin",
    symbol: "RBTC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://public-node.rsk.co"],
    },
  },
  blockExplorers: {
    default: {
      name: "RSK Explorer",
      url: "https://explorer.rsk.co",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 4249540,
    },
  },
});

export const rootstockTestnet = defineChain({
  id: 31,
  name: "Rootstock Testnet",
  nativeCurrency: {
    name: "Test Smart Bitcoin",
    symbol: "tRBTC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://public-node.testnet.rsk.co"],
    },
  },
  blockExplorers: {
    default: {
      name: "RSK Testnet Explorer",
      url: "https://explorer.testnet.rsk.co",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 3154823,
    },
  },
  testnet: true,
});

export const SUPPORTED_CHAINS = [rootstock, rootstockTestnet] as const;

export const CHAIN_NAMES: Record<number, string> = {
  30: "Rootstock Mainnet",
  31: "Rootstock Testnet",
};
