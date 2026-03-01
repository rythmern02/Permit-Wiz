"use client";

import { useState } from "react";
import { useSignTypedData, useAccount, useSwitchChain } from "wagmi";
import type { Hex } from "viem";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  buildTypedData,
  type PermitDomain,
  type PermitMessage,
} from "@/lib/eip712";
import {
  PenTool,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Eye,
} from "lucide-react";

interface SigningStudioProps {
  domain: PermitDomain;
  message: PermitMessage;
  onSigned: (signature: Hex) => void;
}

export function SigningStudio({
  domain,
  message,
  onSigned,
}: SigningStudioProps) {
  const { chainId: accountChainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [copied, setCopied] = useState(false);
  const [showPayload, setShowPayload] = useState(true);

  const { signTypedData, isPending, error, reset } = useSignTypedData();

  const typedData = buildTypedData(domain, message);
  const isChainMismatch = accountChainId !== domain.chainId;

  const handleSign = () => {
    if (isChainMismatch) {
      switchChain({ chainId: domain.chainId as 30 | 31 });
      return;
    }

    reset();
    signTypedData(
      {
        domain,
        types: typedData.types,
        primaryType: "Permit",
        message: {
          ...message,
          value: message.value,
          nonce: message.nonce,
          deadline: message.deadline,
        },
      },
      {
        onSuccess: (data) => {
          onSigned(data);
        },
      },
    );
  };

  const payloadJson = JSON.stringify(
    {
      domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: {
        ...message,
        value: message.value.toString(),
        nonce: message.nonce.toString(),
        deadline: message.deadline.toString(),
      },
    },
    null,
    2,
  );

  const copyPayload = async () => {
    await navigator.clipboard.writeText(payloadJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse error messages for friendly display
  const getErrorMessage = () => {
    if (!error) return null;
    const msg = error.message || "";
    if (msg.includes("User rejected") || msg.includes("user rejected")) {
      return {
        type: "warning" as const,
        text: "You rejected the signature request. Click Sign again when ready.",
      };
    }
    if (msg.includes("chain") || msg.includes("Chain")) {
      return {
        type: "error" as const,
        text: "Chain mismatch detected. Please switch to the correct network.",
      };
    }
    return {
      type: "error" as const,
      text: msg.length > 200 ? msg.slice(0, 200) + "…" : msg,
    };
  };

  const errorInfo = getErrorMessage();

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-orange-400" />
            <CardTitle className="text-lg">Signing Studio</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            EIP-712
          </Badge>
        </div>
        <CardDescription>
          Review the EIP-712 typed data below, then sign with your wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chain Mismatch Warning */}
        {isChainMismatch && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Your wallet is on chain {accountChainId}, but the permit targets
              chain {domain.chainId}. Click Sign to switch.
            </span>
          </div>
        )}

        {/* Payload Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowPayload(!showPayload)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye className="h-3 w-3" />
              {showPayload ? "Hide" : "Show"} Typed Data Payload
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyPayload}
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {showPayload && (
            <pre className="max-h-80 overflow-auto rounded-lg border border-border/30 bg-muted/20 p-3 text-xs leading-relaxed text-foreground/80">
              {payloadJson}
            </pre>
          )}
        </div>

        {/* Error Display */}
        {errorInfo && (
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
              errorInfo.type === "warning"
                ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            {errorInfo.type === "warning" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{errorInfo.text}</span>
          </div>
        )}

        {/* Sign Button */}
        <Button
          onClick={handleSign}
          disabled={isPending}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:brightness-110"
          size="lg"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for wallet…
            </span>
          ) : isChainMismatch ? (
            "Switch Chain & Sign"
          ) : (
            <>
              <PenTool className="mr-2 h-4 w-4" />
              Sign Permit
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
