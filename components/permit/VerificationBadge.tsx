"use client";

import { useEffect } from "react";
import type { Hex, Address } from "viem";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVerifyPermit } from "@/hooks/useVerifyPermit";
import type { PermitDomain, PermitMessage } from "@/lib/eip712";
import {
  ShieldCheck,
  ShieldX,
  Loader2,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface VerificationBadgeProps {
  signature: Hex;
  domain: PermitDomain;
  message: PermitMessage;
  owner: Address;
  onVerified?: (result: {
    splitSignature: { v: number; r: Hex; s: Hex };
  }) => void;
}

export function VerificationBadge({
  signature,
  domain,
  message,
  owner,
  onVerified,
}: VerificationBadgeProps) {
  const { result, isVerifying, error, verify } = useVerifyPermit();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const onVerifiedRef = useRef(onVerified);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  useEffect(() => {
    const controller = new AbortController();
    verify(signature, domain, message, owner, controller.signal);
    return () => controller.abort();
  }, [signature, domain, message, owner, verify]);

  useEffect(() => {
    if (result && onVerifiedRef.current) {
      onVerifiedRef.current({ splitSignature: result.splitSignature });
    }
  }, [result]);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopiedField(null), 2000);
      }
    } catch (err) {
      console.error("Failed to copy code to clipboard", err);
    }
  };

  if (isVerifying) {
    return (
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
          <span className="text-muted-foreground">Verifying signature…</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 backdrop-blur-sm">
        <CardContent className="flex items-center gap-3 py-8">
          <ShieldX className="h-8 w-8 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Verification Failed</p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          {result.isMatch ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          ) : (
            <ShieldX className="h-5 w-5 text-destructive" />
          )}
          <CardTitle className="text-lg">Verification Result</CardTitle>
        </div>
        <CardDescription>
          ecrecover result for the EIP-712 typed data signature.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Match Badge */}
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 ${
            result.isMatch
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          {result.isMatch ? (
            <>
              <ShieldCheck className="h-10 w-10 text-emerald-400" />
              <div>
                <p className="text-lg font-semibold text-emerald-400">
                  ✓ Signature Valid
                </p>
                <p className="text-sm text-emerald-400/70">
                  Recovered address matches the permit owner
                </p>
              </div>
            </>
          ) : (
            <>
              <ShieldX className="h-10 w-10 text-destructive" />
              <div>
                <p className="text-lg font-semibold text-destructive">
                  ✗ Signature Mismatch
                </p>
                <p className="text-sm text-destructive/70">
                  Recovered address does NOT match the owner — check your domain
                  data
                </p>
              </div>
            </>
          )}
        </div>

        {/* Address Comparison */}
        <div className="space-y-2">
          <AddressRow
            label="Owner"
            address={owner}
            copied={copiedField === "owner"}
            onCopy={() => copyToClipboard(owner, "owner")}
          />
          <AddressRow
            label="Recovered"
            address={result.recoveredAddress}
            isMatch={result.isMatch}
            copied={copiedField === "recovered"}
            onCopy={() => copyToClipboard(result.recoveredAddress, "recovered")}
          />
        </div>

        {/* Split Signature */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Signature Components
          </p>
          <div className="grid gap-2">
            <SigField
              label="v"
              value={result.splitSignature.v.toString()}
              copied={copiedField === "v"}
              onCopy={() =>
                copyToClipboard(result.splitSignature.v.toString(), "v")
              }
            />
            <SigField
              label="r"
              value={result.splitSignature.r}
              copied={copiedField === "r"}
              onCopy={() => copyToClipboard(result.splitSignature.r, "r")}
            />
            <SigField
              label="s"
              value={result.splitSignature.s}
              copied={copiedField === "s"}
              onCopy={() => copyToClipboard(result.splitSignature.s, "s")}
            />
          </div>
        </div>

        {/* Raw Signature */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Raw Signature
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(signature, "sig")}
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {copiedField === "sig" ? (
                <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              {copiedField === "sig" ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="overflow-x-auto break-all rounded-lg border border-border/30 bg-muted/20 p-2 text-xs text-foreground/70">
            {signature}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

function AddressRow({
  label,
  address,
  isMatch,
  copied,
  onCopy,
}: {
  label: string;
  address: string;
  isMatch?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {label}
        </Badge>
        <span className="font-mono text-sm text-foreground/80">{address}</span>
      </div>
      <div className="flex items-center gap-2">
        {isMatch !== undefined && (
          <span className={isMatch ? "text-emerald-400" : "text-destructive"}>
            {isMatch ? "✓" : "✗"}
          </span>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function SigField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2 overflow-hidden">
        <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
          {label}
        </Badge>
        <span className="truncate font-mono text-xs text-foreground/70">
          {value}
        </span>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="ml-2 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
