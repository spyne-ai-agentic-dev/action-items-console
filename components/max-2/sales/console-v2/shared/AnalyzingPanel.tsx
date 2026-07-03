"use client";

/**
 * AnalyzingPanel — the "no bare spinner" AI ceremony. A scan-sweep host + a
 * pinging primary dot + a streamed checklist of human-readable steps. Built on
 * the existing .spyne-scan-host / .spyne-scan-sweep CSS. Use it anywhere VINI
 * is "thinking" (audience parse, describe→analyze, batch test).
 */

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export function AnalyzingPanel({
  title = "VINI is analyzing",
  steps,
  stepIntervalMs = 700,
  className = "",
}: {
  title?: string;
  steps: string[];
  stepIntervalMs?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    if (shown >= steps.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), stepIntervalMs);
    return () => clearTimeout(t);
  }, [shown, steps.length, stepIntervalMs]);

  return (
    <div className={`spyne-card spyne-scan-host p-5 ${className}`}>
      <span className="spyne-scan-sweep" aria-hidden />
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--spyne-primary)" }} />
          <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: "var(--spyne-primary)" }} />
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--spyne-primary)" }}>
          <Sparkles size={13} /> {title}
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {steps.slice(0, shown).map((s, i) => (
          <li
            key={i}
            className="spyne-animate-fade-in flex items-center gap-2.5 text-[13px]"
            style={{ color: "var(--spyne-text-secondary)" }}
          >
            <span
              className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
              style={{ background: "var(--spyne-primary-soft)", color: "var(--spyne-primary)" }}
            >
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
