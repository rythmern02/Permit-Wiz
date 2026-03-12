"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import type { Hex, Address } from "viem";
import dynamic from "next/dynamic";
import { ConnectButton } from "@/components/shared/ConnectButton";
import { WizardStepper } from "@/components/permit/WizardStepper";
import { PayloadForm } from "@/components/permit/PayloadForm";
import type { PermitDomain, PermitMessage } from "@/lib/eip712";
import type { SplitSignature } from "@/hooks/useVerifyPermit";
import type { TokenData } from "@/hooks/usePermitData";
import { useCallback } from "react";

const SigningStudio = dynamic(
  () => import("@/components/permit/SigningStudio").then((mod) => mod.SigningStudio),
  { ssr: false }
);

const VerificationBadge = dynamic(
  () => import("@/components/permit/VerificationBadge").then((mod) => mod.VerificationBadge),
  { ssr: false }
);

const CodeExport = dynamic(
  () => import("@/components/permit/CodeExport").then((mod) => mod.CodeExport),
  { ssr: false }
);

interface PermitState {
  domain: PermitDomain | null;
  message: PermitMessage | null;
  tokenData: TokenData | null;
  signature: Hex | null;
  splitSig: SplitSignature | null;
  tokenAddress: Address | null;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<PermitState>({
    domain: null,
    message: null,
    tokenData: null,
    signature: null,
    splitSig: null,
    tokenAddress: null,
  });

  const handlePayloadReady = (
    domain: PermitDomain,
    message: PermitMessage,
    tokenData: TokenData,
  ) => {
    setState((s) => ({
      ...s,
      domain,
      message,
      tokenData,
      tokenAddress: domain.verifyingContract,
    }));
    setCurrentStep(3);
  };

  const handleSigned = (signature: Hex) => {
    setState((s) => ({ ...s, signature }));
    setCurrentStep(4);
  };

  const handleReset = () => {
    setState({
      domain: null,
      message: null,
      tokenData: null,
      signature: null,
      splitSig: null,
      tokenAddress: null,
    });
    setCurrentStep(1);
  };

  const handleVerified = useCallback(({ splitSignature }: { splitSignature: SplitSignature }) => {
    setState((s) => ({ ...s, splitSig: splitSignature }));
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-orange-500/5 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Permit-Wiz
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Gasless Signature Tool for Rootstock
                  </p>
                </div>
              </div>
            </div>
            <ConnectButton />
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground/80">
            Generate, sign, and verify{" "}
            <span className="text-foreground font-medium">ERC-2612 Permit</span>{" "}
            payloads instantly. Debug &quot;Invalid Signature&quot; errors by
            inspecting domain data, nonces, and recovered addresses.
          </p>
        </header>

        {/* Wizard Steps */}
        <div className="mb-8 rounded-2xl border border-border/30 bg-card/30 p-4 backdrop-blur-sm">
          <WizardStepper
            currentStep={currentStep}
            onStepClick={(step) => {
              if (step < currentStep) setCurrentStep(step);
            }}
          />
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {!isConnected && (
            <div className="rounded-2xl border border-border/30 bg-card/30 p-8 text-center backdrop-blur-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/30">
                <svg
                  className="h-8 w-8 text-muted-foreground/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold">Connect Your Wallet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect a wallet on Rootstock Mainnet or Testnet to begin.
              </p>
            </div>
          )}

          {isConnected && (currentStep === 1 || currentStep === 2) && (
            <PayloadForm 
               onPayloadReady={handlePayloadReady} 
               onStepChange={(stepId) => setCurrentStep(stepId === "fetch" ? 1 : 2)}
            />
          )}

          {isConnected &&
            currentStep === 3 &&
            state.domain &&
            state.message && (
              <SigningStudio
                domain={state.domain}
                message={state.message}
                onSigned={handleSigned}
              />
            )}

          {isConnected &&
            currentStep === 4 &&
            state.signature &&
            state.domain &&
            state.message &&
            address && (
              <div className="space-y-6">
                <VerificationBadge
                  signature={state.signature}
                  domain={state.domain}
                  message={state.message}
                  owner={address}
                  onVerified={handleVerified}
                />

                {state.tokenData && state.tokenAddress && state.splitSig && (
                  <CodeExport
                    domain={state.domain}
                    message={state.message}
                    signature={state.signature}
                    splitSig={state.splitSig}
                    tokenData={state.tokenData}
                    tokenAddress={state.tokenAddress}
                  />
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full rounded-xl border border-border/30 bg-card/30 py-3 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:bg-card/50 hover:text-foreground"
                >
                  ← Start New Permit
                </button>
              </div>
            )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-muted-foreground/50">
          <p>
            Built for the <span className="text-orange-400/70">Rootstock</span>{" "}
            ecosystem &middot; EIP-2612 &middot; EIP-712
          </p>
        </footer>
      </div>
    </main>
  );
}
