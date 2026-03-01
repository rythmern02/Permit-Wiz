import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { rootstock, rootstockTestnet } from "./constants";

export const config = createConfig({
  chains: [rootstock, rootstockTestnet],
  connectors: [injected()],
  transports: {
    [rootstock.id]: http(),
    [rootstockTestnet.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
