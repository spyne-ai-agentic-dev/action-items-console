"use client";

/**
 * StatTile — the canonical KPI tile: optional glyph over a big tabular number
 * over a tiny uppercase micro-label. Replaces ChannelStatBig / MetricChip and
 * ad-hoc metric chips. Numbers are always tabular-nums so they never jitter.
 */

import type { ReactNode } from "react";
import { MaterialSymbol } from "@/components/max-2/material-symbol";

type Tone = "default" | "danger" | "success" | "warning" | "brand";

const INK: Record<Tone, string> = {
  default: "var(--spyne-text-primary)",
  danger: "var(--spyne-danger-text)",
  success: "var(--spyne-success-text)",
  warning: "var(--spyne-warning-ink)",
  brand: "var(--spyne-primary)",
};

export function StatTile({
  glyph,
  value,
  label,
  tone = "default",
  className = "",
}: {
  glyph?: string;
  value: ReactNode;
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={`rounded-lg p-2.5 ${className}`} style={{ background: "var(--spyne-page-bg)" }}>
      {glyph && (
        <span className="mb-1 inline-flex" style={{ color: "var(--spyne-text-muted)" }}>
          <MaterialSymbol name={glyph} size={16} />
        </span>
      )}
      <div className="text-[18px] font-bold leading-none tabular-nums" style={{ color: INK[tone] }}>
        {value}
      </div>
      <div className="mt-1 text-[9.5px] font-medium uppercase tracking-wide" style={{ color: "var(--spyne-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}
