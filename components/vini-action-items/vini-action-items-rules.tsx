'use client';

/**
 * Action item rules: the per-intent SLA config, decision rows 2 and 63.
 *
 * Row 63 is the whole point of the Service view. When the page is scoped to
 * Service, the Sales group is hidden. Sales renders exactly as before, both
 * groups, because the department never changes under it at runtime.
 *
 * Row 64 cut the title decoration and the Reset SLAs control on 17-Sep, so
 * there is no reset here. The only way back to a default is to type it.
 *
 * Two things the iframe app did that this does not. It listed a bundled mock
 * taxonomy when the catalog had not loaded, and its SLA edits mutated a module
 * level object in memory, which looked saved and was not. Here the list is the
 * live catalog only, and every edit is a real write to dealer-intent-config
 * that reverts in the UI when the write fails.
 *
 * The per-channel auto-create toggles the iframe showed are NOT ported. They
 * were seeded from a hardcoded defaults object and wrote nowhere, so every
 * switch was decoration. No endpoint holds that setting.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { PiGearBold, PiXBold } from 'react-icons/pi';

import { ViniActionItemsWriteResult } from '@/hooks/use-vini-action-items';

import {
  CARD,
  EmptyPanel,
  GhostButton,
  SecondaryButton,
  cx,
} from './vini-action-items-atoms';
import {
  VINI_DEPT_LABEL,
  ViniActionItemsDepartment,
  ViniIntentDept,
  ViniIntentMeta,
  ViniIntentTaxonomy,
} from './vini-action-items-data';
import { LockedNote, SLA_UNKNOWN_REASON } from './vini-action-items-locked';

type SlaUnit = 'm' | 'h' | 'd';

const UNIT_MINUTES: Record<SlaUnit, number> = { m: 1, h: 60, d: 1440 };
const UNITS: [SlaUnit, string][] = [
  ['m', 'Min'],
  ['h', 'Hr'],
  ['d', 'Day'],
];

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Show a duration in the unit that reads most naturally for it. */
const splitSla = (minutes: number): { value: number; unit: SlaUnit } => {
  if (minutes < 60) return { value: Math.round(minutes), unit: 'm' };
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: 'd' };
  return { value: round2(minutes / 60), unit: 'h' };
};

const ViniActionItemsRules: React.FC<{
  taxonomy: ViniIntentTaxonomy;
  taxonomyLoaded: boolean;
  department: ViniActionItemsDepartment;
  onSave: (args: {
    intentCode: string;
    slaMinutes: number;
    serviceType: string;
  }) => Promise<ViniActionItemsWriteResult>;
  onClose: () => void;
}> = ({ taxonomy, taxonomyLoaded, department, onSave, onClose }) => {
  const [draft, setDraft] = useState<
    Record<string, { value: number; unit: SlaUnit }>
  >({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Seeded from the live taxonomy, and reseeded whenever a save lands.
  useEffect(() => {
    setDraft(
      Object.fromEntries(
        Object.values(taxonomy)
          .filter((intent) => intent.slaMinutes != null)
          .map((intent) => [intent.intentCode, splitSla(intent.slaMinutes)])
      )
    );
  }, [taxonomy]);

  // Row 63. Service hides the Sales group. Sales is left untouched.
  const hideSalesGroup = department === 'service';

  const byDept = useMemo(() => {
    const grouped: Partial<Record<ViniIntentDept, ViniIntentMeta[]>> = {};
    for (const intent of Object.values(taxonomy)) {
      if (hideSalesGroup && intent.dept === 'sales') continue;
      const bucket = grouped[intent.dept];
      if (bucket) bucket.push(intent);
      else grouped[intent.dept] = [intent];
    }
    for (const bucket of Object.values(grouped)) {
      bucket?.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    return grouped;
  }, [taxonomy, hideSalesGroup]);

  const commit = async (intent: ViniIntentMeta) => {
    const entry = draft[intent.intentCode];
    if (!entry) return;
    const minutes = Math.max(
      1,
      Math.min(43_200, Math.round(entry.value * UNIT_MINUTES[entry.unit]))
    );
    if (minutes === intent.slaMinutes) return;

    setSaving(intent.intentCode);
    await onSave({
      intentCode: intent.intentCode,
      slaMinutes: minutes,
      serviceType: intent.dept === 'sales' ? 'sales' : 'service',
    });
    setSaving(null);
  };

  const groups = Object.entries(byDept) as [ViniIntentDept, ViniIntentMeta[]][];

  return (
    <div className="fixed inset-0 z-[200]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[#0f172a]/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Action item rules"
        className="absolute right-0 top-0 flex h-full w-full max-w-[92vw] flex-col bg-white shadow-2xl sm:w-[460px]"
      >
        <div className="flex flex-none items-center gap-2.5 border-b border-[#eceef2] px-4 py-3.5">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#f3efff] text-[#5b21e6]">
            <PiGearBold size={15} />
          </span>
          <p className="flex-1 text-[15px] font-bold text-[#15161d]">
            Action item rules, {VINI_DEPT_LABEL[department]}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-lg text-[#98a2b3] hover:bg-[#f1f2f6]"
          >
            <PiXBold size={16} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <p className="text-[11px] leading-relaxed text-[#667085]">
            The rooftop&apos;s own SLA per intent. Editing one saves it to this
            rooftop only, against dealer-intent-config. The catalog default is
            left alone.
          </p>

          {!taxonomyLoaded ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-9 animate-pulse rounded-lg bg-[#eceef2]"
                />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className={CARD}>
              <EmptyPanel
                title="No intents came back for this rooftop"
                body="The intent catalog is empty here, so there is nothing to set an SLA on."
              />
            </div>
          ) : (
            groups.map(([dept, intents]) => (
              <div key={dept} className={cx(CARD, 'p-3')}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-[#f1f2f6] px-2 py-0.5 text-[10px] font-semibold text-[#667085]">
                    {VINI_DEPT_LABEL[dept]}
                  </span>
                  <span className="text-[10.5px] tabular-nums text-[#98a2b3]">
                    {intents.length}{' '}
                    {intents.length === 1 ? 'intent' : 'intents'}
                  </span>
                </div>
                <ul className="flex flex-col gap-1">
                  {intents.map((intent) => {
                    const entry = draft[intent.intentCode];
                    return (
                      <li
                        key={intent.intentCode}
                        className="flex items-center gap-2 rounded-md bg-[#fafafa] px-2 py-2"
                      >
                        <span
                          className="min-w-0 flex-1 truncate text-[12px] text-[#667085]"
                          title={intent.intentCode}
                        >
                          {intent.displayName}
                          {intent.slaIsRooftopOverride ? (
                            <span className="ml-1 text-[9.5px] font-bold uppercase text-[#5b21e6]">
                              set here
                            </span>
                          ) : null}
                        </span>

                        {!entry ? (
                          // No catalog SLA and no rooftop override. Not zero.
                          <LockedNote reason={SLA_UNKNOWN_REASON} />
                        ) : (
                          <>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={entry.value}
                              disabled={saving === intent.intentCode}
                              aria-label={`SLA for ${intent.displayName}`}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  [intent.intentCode]: {
                                    unit: entry.unit,
                                    value: Math.max(
                                      0,
                                      parseFloat(event.target.value) || 0
                                    ),
                                  },
                                }))
                              }
                              onBlur={() => commit(intent)}
                              className="h-7 w-14 flex-none rounded-md border border-[#eceef2] px-1.5 text-right text-[12px] tabular-nums focus:border-[#5b21e6] focus:outline-none disabled:opacity-40"
                            />
                            <div className="inline-flex flex-none overflow-hidden rounded-md border border-[#eceef2]">
                              {UNITS.map(([unit, label], index) => {
                                const on = entry.unit === unit;
                                return (
                                  <button
                                    key={unit}
                                    type="button"
                                    aria-pressed={on}
                                    title={`Set the SLA in ${label.toLowerCase()}s`}
                                    onClick={() =>
                                      setDraft((current) => {
                                        // The duration stays put, the number converts.
                                        const minutes =
                                          entry.value *
                                          UNIT_MINUTES[entry.unit];
                                        return {
                                          ...current,
                                          [intent.intentCode]: {
                                            unit,
                                            value: round2(
                                              minutes / UNIT_MINUTES[unit]
                                            ),
                                          },
                                        };
                                      })
                                    }
                                    className={cx(
                                      'h-7 px-2 text-[10.5px] font-bold uppercase tracking-wide',
                                      index > 0 && 'border-l border-[#eceef2]',
                                      on
                                        ? 'bg-[#5b21e6] text-white'
                                        : 'bg-white text-[#98a2b3]'
                                    )}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex-none border-t border-[#eceef2] px-4 py-3">
          <SecondaryButton className="h-9 w-full" onClick={onClose}>
            Done
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
};

export { GhostButton };
export default ViniActionItemsRules;
