"use client";

/**
 * ProcessingButton — replaces instant state-flips on async-feeling actions
 * (Start backfill, Save mapping, Request upload, Resolve). On click: an
 * optimistic processing state (spinner + plain-English label) resolves into a
 * success state. No bare flips, no surprise.
 */

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { MaterialSymbol } from "@/components/max-2/material-symbol";

type Phase = "idle" | "processing" | "done";

export function ProcessingButton({
  children,
  processingLabel = "Working…",
  doneLabel = "Done",
  onRun,
  durationMs = 900,
  variant = "primary",
  icon,
  className = "",
}: {
  children: ReactNode;
  processingLabel?: string;
  doneLabel?: string;
  onRun?: () => void | Promise<void>;
  durationMs?: number;
  variant?: "primary" | "secondary";
  /** Material Symbol ligature shown in the idle state. */
  icon?: string;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const run = async () => {
    if (phase !== "idle") return;
    setPhase("processing");
    try {
      await onRun?.();
    } catch {
      /* surface the success-ceremony optimistically regardless in demo */
    }
    setTimeout(() => setPhase("done"), durationMs);
  };
  const base = variant === "primary" ? "spyne-btn-primary" : "spyne-btn-secondary";
  return (
    <button
      type="button"
      onClick={run}
      disabled={phase !== "idle"}
      className={`${base} ${className}`}
      style={phase === "done" ? { background: "var(--spyne-success-text)", color: "#fff", borderColor: "transparent" } : undefined}
    >
      {phase === "processing" ? (
        <>
          <RefreshCw size={14} className="animate-spin" /> {processingLabel}
        </>
      ) : phase === "done" ? (
        <span className="spyne-animate-scale-in inline-flex items-center gap-1.5">
          <MaterialSymbol name="check_circle" size={16} /> {doneLabel}
        </span>
      ) : (
        <>
          {icon && <MaterialSymbol name={icon} size={16} />} {children}
        </>
      )}
    </button>
  );
}
