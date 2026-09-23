'use client';

/**
 * Small shared pieces for the Action Items page.
 *
 * Tailwind only, on the same tokens the Overview page uses, so the two tabs
 * read as one console. The iframe app leaned on CSS variables and inline
 * `style` objects from its own design layer; neither exists here and the
 * frontend SOP forbids adding new inline styles.
 */
import React from 'react';
import {
  PiCaretDownBold,
  PiChatCircleBold,
  PiEnvelopeBold,
  PiPhoneBold,
  PiUserBold,
  PiUserCircleBold,
  PiWarningBold,
} from 'react-icons/pi';

import {
  VINI_CHANNEL_LABEL,
  VINI_DEPT_LABEL,
  ViniActionItem,
  ViniActionItemChannel,
  ViniIntentDept,
  ViniIntentTaxonomy,
  assigneeLabel,
  customerLabel,
  formatSla,
  intentLabel,
  intentMeta,
} from './vini-action-items-data';
import { LockedNote, SLA_UNKNOWN_REASON } from './vini-action-items-locked';

export const CARD =
  'rounded-[15px] border border-[#eceef2] bg-white shadow-[0_1px_3px_-1px_rgba(21,22,29,0.07)]';

export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

/* ── Intent badge ────────────────────────────────────────────────── */

const DEPT_BADGE: Record<ViniIntentDept, string> = {
  sales: 'bg-[#eaf0fd] text-[#1d4ed8]',
  service: 'bg-[#eaf6ee] text-[#0f6e4f]',
  both: 'bg-[#f1f2f6] text-[#667085]',
  compliance: 'bg-[#fdecec] text-[#c5221f]',
};

export const IntentBadge: React.FC<{
  intentCode: string;
  taxonomy: ViniIntentTaxonomy;
}> = ({ intentCode, taxonomy }) => {
  const meta = intentMeta(intentCode, taxonomy);
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
        DEPT_BADGE[meta?.dept ?? 'both']
      )}
      title={
        meta
          ? `${VINI_DEPT_LABEL[meta.dept]} intent`
          : 'This intent is not in the rooftop catalog'
      }
    >
      {intentLabel(intentCode, taxonomy)}
    </span>
  );
};

/* ── Channel chip ────────────────────────────────────────────────── */

const CHANNEL_ICON: Record<ViniActionItemChannel, React.ReactNode> = {
  call: <PiPhoneBold size={13} />,
  sms: <PiChatCircleBold size={13} />,
  chat: <PiChatCircleBold size={13} />,
  email: <PiEnvelopeBold size={13} />,
  hitl_takeover: <PiUserCircleBold size={13} />,
  hitl_warm_transfer: <PiUserCircleBold size={13} />,
};

export const ChannelChip: React.FC<{ channel: ViniActionItemChannel }> = ({
  channel,
}) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f2f6] px-2 py-0.5 text-[10px] font-medium text-[#667085]">
    {CHANNEL_ICON[channel]}
    {VINI_CHANNEL_LABEL[channel]}
  </span>
);

/* ── SLA state ───────────────────────────────────────────────────── */

export const PastSlaPill: React.FC = () => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#667085]">
    <PiWarningBold size={12} /> Past SLA
  </span>
);

/**
 * The SLA line for one item.
 *
 * Three real states, never two. Past SLA, on the clock with a measured SLA, or
 * an intent the catalog gave no SLA for, which renders locked rather than a
 * dash that reads as "no deadline".
 */
export const SlaState: React.FC<{
  item: ViniActionItem;
  taxonomy: ViniIntentTaxonomy;
  ageText: string;
  pastSla: boolean | null;
}> = ({ item, taxonomy, ageText, pastSla }) => {
  if (pastSla === true) return <PastSlaPill />;

  const sla = formatSla(intentMeta(item.intentCode, taxonomy)?.slaMinutes);
  if (!sla) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="whitespace-nowrap text-[10.5px] tabular-nums text-[#98a2b3]">
          {ageText}
        </span>
        <LockedNote reason={SLA_UNKNOWN_REASON} />
      </span>
    );
  }

  return (
    <span className="whitespace-nowrap text-[10.5px] font-medium tabular-nums text-[#667085]">
      {ageText} · SLA {sla}
    </span>
  );
};

/* ── Names ───────────────────────────────────────────────────────── */

/**
 * The customer's name, as a button that opens their panel.
 *
 * When the API sent no name, this says so. The iframe app humanised the
 * customer id into a title-cased slug, which puts a name on screen that no
 * system holds and that a BDC could read out to the wrong person.
 */
export const CustomerNameButton: React.FC<{
  item: ViniActionItem;
  onOpen: (customerId: string) => void;
  size?: 'sm' | 'md' | 'lg';
}> = ({ item, onOpen, size = 'md' }) => {
  const name = customerLabel(item);
  const textSize =
    size === 'lg'
      ? 'text-[15px]'
      : size === 'sm'
        ? 'text-[11px]'
        : 'text-[13px]';

  if (!name) {
    return (
      <span className={cx('font-semibold italic text-[#98a2b3]', textSize)}>
        Name not on the record
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(item.customerId);
      }}
      title="Open this customer"
      className={cx(
        'group inline-flex max-w-full items-center gap-1 truncate rounded text-left font-bold text-[#15161d] hover:text-[#5b21e6]',
        textSize
      )}
    >
      <span className="truncate">{name}</span>
    </button>
  );
};

export const AssigneeLine: React.FC<{
  item: ViniActionItem;
  users: { userId: string; name: string }[];
}> = ({ item, users }) => {
  if (!item.assigneeUserId) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold text-[#b54708]">
        <PiUserBold size={12} /> Unassigned
      </span>
    );
  }

  const name = assigneeLabel(item, users as never);
  return (
    <span className="inline-flex items-center gap-1 truncate text-[10.5px] text-[#667085]">
      <PiUserBold size={12} />
      {name ?? (
        <span className="italic text-[#98a2b3]">Owner id only, no name</span>
      )}
    </span>
  );
};

/* ── Controls ────────────────────────────────────────────────────── */

export const FilterChip: React.FC<{
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}> = ({ label, icon, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cx(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
      active
        ? 'border-[#5b21e6] bg-[#f3efff] text-[#5b21e6]'
        : 'border-[#eceef2] bg-white text-[#667085] hover:border-[#d0d5dd]'
    )}
  >
    {icon}
    {label}
  </button>
);

export const LabelledSelect: React.FC<{
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#98a2b3]">
    {label}
    <span className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 cursor-pointer appearance-none rounded-lg border border-[#eceef2] bg-white pl-2 pr-6 text-[12px] font-medium text-[#15161d] focus:border-[#5b21e6] focus:outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <PiCaretDownBold
        size={11}
        className="pointer-events-none absolute right-2 text-[#98a2b3]"
      />
    </span>
  </label>
);

export const PrimaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ className, ...props }) => (
  <button
    type="button"
    {...props}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#5b21e6] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#4c1fdd] disabled:cursor-not-allowed disabled:opacity-40',
      className
    )}
  />
);

export const SecondaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ className, ...props }) => (
  <button
    type="button"
    {...props}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#eceef2] bg-white px-3 py-2 text-[12px] font-semibold text-[#344054] transition-colors hover:border-[#d0d5dd] disabled:cursor-not-allowed disabled:opacity-40',
      className
    )}
  />
);

export const GhostButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ className, ...props }) => (
  <button
    type="button"
    {...props}
    className={cx(
      'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-[#667085] transition-colors hover:bg-[#f1f2f6] disabled:cursor-not-allowed disabled:opacity-40',
      className
    )}
  />
);

export const SectionLabel: React.FC<{
  text: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ text, hint, icon }) => (
  <div className="flex items-center gap-2">
    {icon ? <span className="text-[#98a2b3]">{icon}</span> : null}
    <span className="text-[10.5px] font-bold uppercase tracking-wide text-[#667085]">
      {text}
    </span>
    {hint ? (
      <span className="truncate text-[10.5px] font-medium text-[#98a2b3]">
        {hint}
      </span>
    ) : null}
  </div>
);

export const EmptyPanel: React.FC<{
  icon?: React.ReactNode;
  title: string;
  body?: string;
  className?: string;
  children?: React.ReactNode;
}> = ({ icon, title, body, className, children }) => (
  <div
    className={cx(
      'flex flex-col items-center justify-center gap-1.5 px-6 py-10 text-center',
      className
    )}
  >
    {icon ? <span className="text-[#c7cbd4]">{icon}</span> : null}
    <p className="text-[13px] font-semibold text-[#15161d]">{title}</p>
    {body ? (
      <p className="max-w-[320px] text-[12px] leading-relaxed text-[#98a2b3]">
        {body}
      </p>
    ) : null}
    {children}
  </div>
);
