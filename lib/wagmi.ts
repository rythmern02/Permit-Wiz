import { http, createConfig, fallback } from "wagmi";
import { injected } from "wagmi/connectors";
import { rootstock, rootstockTestnet } from "./constants";

export const config = createConfig({
  chains: [rootstock, rootstockTestnet],
  connectors: [injected()],
  transports: {
    [rootstock.id]: fallback([
      http("https://public-node.rsk.co"),
      http("https://mycrypto.rsk.co")
    ]),
    [rootstockTestnet.id]: fallback([
       http("https://public-node.testnet.rsk.co"),
       http("https://mycrypto.testnet.rsk.co")
    ]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
