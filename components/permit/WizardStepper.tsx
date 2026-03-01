"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  id: number;
  title: string;
  description: string;
}

const steps: Step[] = [
  { id: 1, title: "Fetch", description: "Token Data" },
  { id: 2, title: "Build", description: "Permit Payload" },
  { id: 3, title: "Sign", description: "EIP-712 Data" },
  { id: 4, title: "Verify", description: "Signature" },
];

interface WizardStepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function WizardStepper({
  currentStep,
  onStepClick,
}: WizardStepperProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isActive = currentStep === step.id;
        const isClickable = onStepClick && step.id < currentStep;

        return (
          <div key={step.id} className="flex flex-1 items-center">
            {/* Step circle + label */}
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                "group flex flex-col items-center gap-1.5 transition-all duration-300",
                isClickable && "cursor-pointer",
              )}
            >
              <div
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300",
                  isCompleted &&
                    "border-emerald-500 bg-emerald-500/20 text-emerald-400",
                  isActive &&
                    "border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_16px_rgba(249,115,22,0.3)]",
                  !isCompleted &&
                    !isActive &&
                    "border-border/50 bg-card/30 text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span>{step.id}</span>
                )}
                {isActive && (
                  <span className="absolute -inset-1 animate-ping rounded-full border border-orange-500/30" />
                )}
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-xs font-medium transition-colors",
                    isActive
                      ? "text-orange-400"
                      : isCompleted
                        ? "text-emerald-400"
                        : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {step.description}
                </p>
              </div>
            </button>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="mx-2 h-0.5 flex-1">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isCompleted
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-500/50"
                      : "bg-border/30",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
