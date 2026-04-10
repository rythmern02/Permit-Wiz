"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { parseUnits, getAddress, isAddress } from "viem";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePermitData, type TokenData } from "@/hooks/usePermitData";
import { permitFormSchema } from "@/lib/schemas";
import type { PermitDomain, PermitMessage } from "@/lib/eip712";
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface PayloadFormProps {
  onPayloadReady: (
    domain: PermitDomain,
    message: PermitMessage,
    tokenData: TokenData,
  ) => void;
  onStepChange?: (step: "fetch" | "build") => void;
}

export function PayloadForm({ onPayloadReady, onStepChange }: PayloadFormProps) {
  const { address } = useAccount();
  const [tokenAddress, setTokenAddress] = useState("");
  const [step, setStep] = useState<"fetch" | "build">("fetch");

  // Build step state
  const [spender, setSpender] = useState("");
  const [value, setValue] = useState("");
  const [deadline, setDeadline] = useState("");
  const [buildError, setBuildError] = useState<string | null>(null);

  const validTokenAddr = isAddress(tokenAddress.trim(), { strict: false })
    ? getAddress(tokenAddress.trim())
    : undefined;

  const { tokenData, domain, isLoading, error, warnings, fetch } =
    usePermitData(validTokenAddr, address);

  const handleFetch = () => {
    if (validTokenAddr && address) {
      fetch();
    }
  };

  useEffect(() => {
    if (error) {
      toast.error(error, { duration: 5000 });
    }
  }, [error]);

  const handleSetDeadline1Hour = () => {
    const ts = Math.floor(Date.now() / 1000) + 3600;
    setDeadline(ts.toString());
  };

  const handleBuildPayload = () => {
    setBuildError(null);
    if (!domain || !tokenData || !address) return;

    const parsed = permitFormSchema.safeParse({ spender, value, deadline });
    if (!parsed.success) {
      setBuildError(parsed.error.issues[0].message);
      return;
    }

    try {
      const rawValue = parseUnits(value, tokenData.decimals);
      const dl = BigInt(deadline);

      // Re-validate deadline at build time: the user may have idled between
      // typing the timestamp and clicking Build, expiring the deadline.
      if (dl <= BigInt(Math.floor(Date.now() / 1000))) {
        setBuildError(
          "Deadline is in the past. Please set a future deadline before building the permit.",
        );
        return;
      }

      const message: PermitMessage = {
        owner: address,
        spender: getAddress(spender.trim()),
        value: rawValue,
        nonce: tokenData.nonce,
        deadline: dl,
      };

      onPayloadReady(domain, message, tokenData);
    } catch {
      setBuildError(`Invalid value format for token with ${tokenData.decimals} decimals.`);
    }
  };

  // Determine if build form is valid
  const validation = permitFormSchema.safeParse({ spender, value, deadline });
  const isValidSpender = spender.length > 0 && (validation.success || !validation.error.issues.some(i => i.path.includes("spender")));
  const isValidValue = value.length > 0 && (validation.success || !validation.error.issues.some(i => i.path.includes("value")));
  const isValidDeadline = deadline.length > 0 && (() => {
    const d = parseInt(deadline, 10);
    return !isNaN(d) && d > Math.floor(Date.now() / 1000);
  })();

  const canBuild = validation.success && isValidDeadline && domain && tokenData;

  return (
    <div className="space-y-6">
      {/* Step 1: Fetch Token Data */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-orange-400" />
            <CardTitle className="text-lg">Token Auto-Fetcher</CardTitle>
          </div>
          <CardDescription>
            Enter the ERC-2612 token contract address to auto-detect name,
            nonce, and domain data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token-address">Token Contract Address</Label>
            <div className="flex gap-2">
              <Input
                id="token-address"
                placeholder="0x..."
                value={tokenAddress}
                onChange={(e) => {
                  setTokenAddress(e.target.value);
                  setStep("fetch");
                  onStepChange?.("fetch");
                }}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleFetch}
                disabled={!validTokenAddr || !address || isLoading}
                className="shrink-0 bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Fetch"
                )}
              </Button>
            </div>
          </div>

          {!address && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Connect your wallet first to use as the permit owner.
            </div>
          )}

          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-400"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{w}</span>
            </div>
          ))}

          {/* Token Data Display */}
          {tokenData && domain && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Token data fetched successfully
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DataField label="Name" value={tokenData.name} />
                <DataField label="Symbol" value={tokenData.symbol} />
                <DataField
                  label="Decimals"
                  value={tokenData.decimals.toString()}
                />
                <DataField
                  label="Version"
                  value={tokenData.version}
                  highlight={tokenData.version !== "1"}
                />
                <DataField label="Nonce" value={tokenData.nonce.toString()} />
                <DataField label="Chain ID" value={domain.chainId.toString()} />
              </div>

              <div className="rounded-lg border border-border/30 bg-muted/30 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  DOMAIN_SEPARATOR Preview
                </p>
                <pre className="overflow-x-auto text-xs text-foreground/80">
                  {JSON.stringify(domain, null, 2)}
                </pre>
              </div>

              {step === "fetch" && (
                <Button
                  onClick={() => {
                    setStep("build");
                    onStepChange?.("build");
                  }}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110"
                >
                  Continue to Build Payload
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Build Permit Payload */}
      {step === "build" && tokenData && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-orange-400" />
              <CardTitle className="text-lg">Build Permit Payload</CardTitle>
            </div>
            <CardDescription>
              Configure the permit parameters. The owner is your connected
              address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Owner (your wallet)</Label>
              <Input
                value={address ?? ""}
                disabled
                className="font-mono text-sm opacity-60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="spender">Spender Address</Label>
              <Input
                id="spender"
                placeholder="0x..."
                value={spender}
                onChange={(e) => setSpender(e.target.value)}
                className={`font-mono text-sm ${spender && !isValidSpender ? "border-destructive" : ""}`}
              />
              {spender && !isValidSpender && (
                <p className="text-xs text-destructive">
                  Invalid address format
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Value ({tokenData.symbol})</Label>
              <Input
                id="value"
                type="number"
                step="any"
                placeholder="100.0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono text-sm"
              />
              {isValidValue && tokenData && (
                <p className="text-xs text-muted-foreground">
                  Raw:{" "}
                  {(() => {
                    try {
                      return parseUnits(value, tokenData.decimals).toString();
                    } catch {
                      return "—";
                    }
                  })()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="deadline">Deadline (Unix Timestamp)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSetDeadline1Hour}
                  className="h-auto px-2 py-1 text-xs text-orange-400 hover:text-orange-300"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  +1 Hour
                </Button>
              </div>
              <Input
                id="deadline"
                placeholder={Math.floor(Date.now() / 1000 + 3600).toString()}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="font-mono text-sm"
              />
              {deadline && (
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const d = parseInt(deadline, 10);
                    if (isNaN(d)) return "Invalid timestamp";
                    const date = new Date(d * 1000);
                    const now = Math.floor(Date.now() / 1000);
                    if (d <= now) return "⚠️ Deadline is in the past!";
                    return date.toLocaleString();
                  })()}
                </p>
              )}
            </div>

            {buildError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive font-semibold">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{buildError}</span>
              </div>
            )}

            <Button
              onClick={handleBuildPayload}
              disabled={!canBuild}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110"
            >
              Build & Proceed to Sign
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DataField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/20 p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate font-mono text-sm ${highlight ? "text-amber-400" : "text-foreground"}`}
      >
        {value}
      </p>
      {highlight && (
        <Badge
          variant="outline"
          className="mt-1 border-amber-500/30 text-[10px] text-amber-400"
        >
          Non-standard
        </Badge>
      )}
    </div>
  );
}
