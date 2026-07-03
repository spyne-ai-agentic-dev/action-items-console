"use client";

/**
 * SectionLabel — the canonical eyebrow used above content blocks across the
 * console. Replaces four divergent local copies. Optional leading primary glyph
 * (plain or in a soft chip) + uppercase label + optional faint hint.
 */

import { MaterialSymbol } from "@/components/max-2/material-symbol";

export function SectionLabel({
  glyph,
  text,
  hint,
  chip = false,
  className = "",
}: {
  /** Material Symbol ligature name (e.g. "bolt", "database"). */
  glyph?: string;
  text: string;
  hint?: string;
  /** Render the glyph inside a rounded primary-soft chip. */
  chip?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span
        className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide"
        style={{ color: "var(--spyne-text-secondary)" }}
      >
        {glyph &&
          (chip ? (
            <span
              className="inline-flex size-6 items-center justify-center rounded-lg"
              style={{ background: "var(--spyne-primary-soft)", color: "var(--spyne-primary)" }}
            >
              <MaterialSymbol name={glyph} size={14} />
            </span>
          ) : (
            <span className="inline-flex self-center" style={{ color: "var(--spyne-primary)" }}>
              <MaterialSymbol name={glyph} size={14} />
            </span>
          ))}
        {text}
      </span>
      {hint && (
        <span className="text-[10.5px]" style={{ color: "var(--spyne-text-muted)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
