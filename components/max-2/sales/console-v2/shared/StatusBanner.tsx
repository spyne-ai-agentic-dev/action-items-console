"use client";

/**
 * StatusBanner — a severity-escalating outcome banner. One bold sentence + an
 * optional detail line + an optional inline-right CTA. Fill/ink escalate
 * success → warning → danger so a hard outage never wears the same amber as a
 * mildly-aging feed.
 */

import type { ReactNode } from "react";
import { MaterialSymbol } from "@/components/max-2/material-symbol";
import { SEVERITY, SEVERITY_GLYPH, type Severity } from "./semantic-tokens";

export function StatusBanner({
  severity = "info",
  title,
  detail,
  glyph,
  action,
  className = "",
}: {
  severity?: Severity;
  title: ReactNode;
  detail?: ReactNode;
  /** Override the default per-severity glyph (Material Symbol ligature). */
  glyph?: string;
  action?: ReactNode;
  className?: string;
}) {
  const t = SEVERITY[severity];
  return (
    <div
      className={`spyne-animate-fade-in flex flex-wrap items-center gap-3 rounded-xl p-3 ${className}`}
      style={{ background: t.fill, border: `1px solid ${t.border}` }}
    >
      <span className="inline-flex shrink-0" style={{ color: t.ink }}>
        <MaterialSymbol name={glyph ?? SEVERITY_GLYPH[severity]} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--spyne-text-primary)" }}>
          {title}
        </p>
        {detail && (
          <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "var(--spyne-text-secondary)" }}>
            {detail}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
