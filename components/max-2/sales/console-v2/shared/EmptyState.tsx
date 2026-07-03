"use client";

/**
 * EmptyState — centered glyph-in-disc + title + helper + optional CTA. Two
 * intents: a "first-run" aspirational nudge vs a "filtered" no-results state.
 */

import type { ReactNode } from "react";
import { MaterialSymbol } from "@/components/max-2/material-symbol";

export function EmptyState({
  glyph = "inbox",
  title,
  helper,
  action,
  className = "",
}: {
  glyph?: string;
  title: string;
  helper?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <span
        className="mb-3 inline-flex size-10 items-center justify-center rounded-xl"
        style={{ background: "var(--spyne-primary-soft)", color: "var(--spyne-primary)" }}
      >
        <MaterialSymbol name={glyph} size={20} />
      </span>
      <p className="text-[14px] font-semibold" style={{ color: "var(--spyne-text-primary)" }}>
        {title}
      </p>
      {helper && (
        <p className="mt-1 max-w-xs text-[12px] leading-relaxed" style={{ color: "var(--spyne-text-muted)" }}>
          {helper}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
