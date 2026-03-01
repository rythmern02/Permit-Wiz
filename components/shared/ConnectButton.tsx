"use client";

import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { Button } from "@/components/ui/button";
import { CHAIN_NAMES } from "@/lib/constants";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  if (isConnected && address) {
    const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
    const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;

    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-sm backdrop-blur-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          <span className="text-muted-foreground">{chainName}</span>
          <span className="font-mono text-foreground">{truncated}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => disconnect()}
          className="text-muted-foreground hover:text-destructive"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => {
        const connector = connectors[0];
        if (connector) connect({ connector });
      }}
      disabled={isPending}
      className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:brightness-110"
    >
      {isPending ? (
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Connecting…
        </span>
      ) : (
        "Connect Wallet"
      )}
    </Button>
  );
}
