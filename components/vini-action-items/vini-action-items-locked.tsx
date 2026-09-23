'use client';

/**
 * Locked states this page needs that are not in the shared registry.
 *
 * `@/components/vini-shared/locked` owns the cross-page reasons and three of
 * them apply here as-is: `resolvedHistory`, `unresolve` and `activityTrail`.
 * Those are imported and used directly, never re-implemented.
 *
 * Two gaps on this page have no entry there, and this file does NOT invent one
 * by borrowing a reason that does not fit. A wrong reason in a tooltip is
 * worse than no tooltip, because someone will act on it. These render the same
 * visual language as the shared components, with the real reason spelled out.
 *
 * When the shared registry gains keys for these, delete this file and point
 * the callers at `Locked` / `LockedKpi`. Nothing else in the UI changes.
 */
import React from 'react';

import { LOCKED_LABEL } from '@/components/vini-shared/locked';

/** The metrics endpoint is not deployed in this environment. */
export const METRICS_UNAVAILABLE_REASON =
  'The Service metrics endpoint is not deployed in this environment, so these counts cannot be read. It is live on UAT only as of 17-Sep.';

/** The metrics endpoint answered, but this call failed. */
export const METRICS_FAILED_REASON =
  'The Service metrics call failed, so this count is not known. It is not zero.';

/** The rooftop catalog returned no SLA for this intent. */
export const SLA_UNKNOWN_REASON =
  'No SLA is configured for this intent, so it has no deadline to measure against. Set one in Action item rules.';

/** A KPI tile whose number cannot be read. Deliberately shows no digit. */
export const LockedTile: React.FC<{
  label: string;
  reason: string;
  /** The sublabel a live tile would carry, so the row keeps its rhythm. */
  caption?: string;
}> = ({ label, reason, caption }) => (
  <div
    title={reason}
    className="flex min-w-0 flex-col justify-center rounded-2xl border border-dashed border-[#e5e7eb] bg-[#fcfcfd] px-4 py-3"
  >
    <p className="text-[10.5px] font-bold uppercase tracking-wide text-[#9ca3af]">
      {label}
    </p>
    <p className="mt-1 text-[12px] italic text-[#9ca3af]">{LOCKED_LABEL}</p>
    {caption ? (
      <p className="mt-0.5 truncate text-[10px] text-[#c7cbd4]">{caption}</p>
    ) : null}
  </div>
);

/** Inline, for a table cell or a chip, with a reason of its own. */
export const LockedNote: React.FC<{ reason: string; className?: string }> = ({
  reason,
  className = '',
}) => (
  <span
    title={reason}
    className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] italic text-[#9ca3af] ${className}`}
  >
    {LOCKED_LABEL}
  </span>
);
