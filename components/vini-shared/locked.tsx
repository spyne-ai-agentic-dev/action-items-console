'use client';

/**
 * A control the merged 17-Sep design asks for that no backend field can answer
 * yet. The element is still rendered, but in an explicit locked state: muted,
 * the words "Not available yet", and the reason in a title tooltip.
 *
 * Never a zero, never a dash that reads as zero, never a made-up value. A
 * missing number has to say it is missing.
 *
 * When a field lands, drop its entry from LOCKED_REASONS and wire the element
 * to real data. Nothing else in the UI changes.
 */

export type LockedKey =
  | 'bookedVia'
  | 'dmsSyncState'
  | 'dmsSyncWait'
  | 'dmsCertifiedProviders'
  | 'addAppointment'
  | 'resolvedHistory'
  | 'unresolve'
  | 'activityTrail';

export const LOCKED_LABEL = 'Not available yet';

export const LOCKED_REASONS: Record<LockedKey, string> = {
  bookedVia:
    'No backend field yet separates a Spyne booking from an advisor or a walk-in.',
  dmsSyncState:
    "No backend field yet says whether an appointment reached the dealer's DMS.",
  dmsSyncWait: 'No backend field yet records how long a DMS write-back waited.',
  dmsCertifiedProviders:
    'No list exists yet of which DMS providers are certified for write-back.',
  addAppointment:
    'Booking from here needs a certified DMS write path, which does not exist yet.',
  resolvedHistory:
    'The list endpoint only returns open items, so closed history cannot be paged.',
  unresolve:
    'No backend endpoint reopens a resolved item, so this reverts in the browser only.',
  activityTrail:
    'No backend event trail exists yet beyond the created and closed stamps.',
};

/** Inline, for a table cell or a chip. */
export function Locked({
  reason,
  className = '',
}: {
  reason: LockedKey;
  className?: string;
}) {
  return (
    <span
      title={LOCKED_REASONS[reason]}
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] italic text-[#9ca3af] ${className}`}
    >
      {LOCKED_LABEL}
    </span>
  );
}

/** A KPI tile whose number is not computable yet. Deliberately shows no digit. */
export function LockedKpi({
  label,
  reason,
}: {
  label: string;
  reason: LockedKey;
}) {
  return (
    <div
      title={LOCKED_REASONS[reason]}
      className="rounded-2xl border border-dashed border-[#e5e7eb] bg-[#fcfcfd] px-4 py-3.5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
        {label}
      </p>
      <p className="mt-1 text-[12px] italic text-[#9ca3af]">{LOCKED_LABEL}</p>
    </div>
  );
}
