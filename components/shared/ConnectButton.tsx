"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { Button } from "@/components/ui/button";
import { CHAIN_NAMES } from "@/lib/constants";
import { Loader2, Wallet, ChevronDown, X } from "lucide-react";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, variables } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [showConnectors, setShowConnectors] = useState(false);

  if (isConnected && address) {
    const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
    const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;

    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 text-sm backdrop-blur-sm">
          <span
            className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
            aria-hidden="true"
          />
          <span className="text-muted-foreground">{chainName}</span>
          <span className="font-mono text-foreground">{truncated}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => disconnect()}
          aria-label="Disconnect wallet"
          className="text-muted-foreground hover:text-destructive"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  // If only one connector is available, connect directly — no picker needed.
  if (connectors.length === 1) {
    const connector = connectors[0];
    const isConnecting = isPending && variables?.connector === connector;
    return (
      <Button
        onClick={() => connect({ connector })}
        disabled={isPending}
        aria-label={`Connect with ${connector.name}`}
        className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:brightness-110"
      >
        {isConnecting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Connecting…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4" aria-hidden="true" />
            Connect Wallet
          </span>
        )}
      </Button>
    );
  }

  // Multiple connectors: show a dropdown so the user explicitly picks their wallet.
  return (
    <div className="relative">
      <Button
        onClick={() => setShowConnectors((v) => !v)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={showConnectors}
        aria-label="Select wallet to connect"
        className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:brightness-110"
      >
        <span className="flex items-center gap-2">
          <Wallet className="h-4 w-4" aria-hidden="true" />
          Connect Wallet
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showConnectors ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </Button>

      {showConnectors && (
        <div
          role="listbox"
          aria-label="Available wallets"
          className="absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-lg border border-border/50 bg-card shadow-lg backdrop-blur-sm"
        >
          <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Choose wallet
            </span>
            <button
              type="button"
              onClick={() => setShowConnectors(false)}
              aria-label="Close wallet picker"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          {connectors.map((connector) => {
            const isConnecting =
              isPending && variables?.connector === connector;
            return (
              <button
                key={connector.uid}
                type="button"
                role="option"
                aria-selected={false}
                aria-label={`Connect with ${connector.name}`}
                disabled={isPending}
                onClick={() => {
                  connect({ connector });
                  setShowConnectors(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/30 disabled:opacity-60"
              >
                {isConnecting ? (
                  <Loader2
                    className="h-4 w-4 animate-spin text-orange-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Wallet
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span>{connector.name}</span>
                {isConnecting && (
                  <span className="ml-auto text-xs text-orange-400">
                    Connecting…
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
