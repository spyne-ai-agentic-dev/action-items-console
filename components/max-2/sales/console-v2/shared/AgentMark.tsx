"use client";

/**
 * AgentMark — the single VINI sparkle mark. Replaces ~6 inline sparkle SVGs and
 * emoji glyphs across the builder/studio/audience. A lucide Sparkles, optionally
 * in a rounded primary-soft chip sized to the glyph.
 */

import { Sparkles } from "lucide-react";

export function AgentMark({
  size = 16,
  chip = true,
  className = "",
}: {
  size?: number;
  chip?: boolean;
  className?: string;
}) {
  if (!chip) {
    return (
      <span className={`inline-flex ${className}`} style={{ color: "var(--spyne-primary)" }}>
        <Sparkles size={size} />
      </span>
    );
  }
  const box = size + 16;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg ${className}`}
      style={{ width: box, height: box, background: "var(--spyne-primary-soft)", color: "var(--spyne-primary)" }}
    >
      <Sparkles size={size} />
    </span>
  );
}
