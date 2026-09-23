'use client';

/**
 * The Resolved and Incorrect tabs.
 *
 * Decision rows kept: 18 a single search box, 24 the Resolved tab,
 * 36 the resolution note and type on a closed row, 38 Reopen and nothing else
 * on the closed panel, 1 the Incorrect tab.
 *
 * Row 17, the Resolved tab's own full filter bar, was cut on 17-Sep. One search
 * box replaces it, so the six dropdowns production ships are gone on purpose.
 *
 * Row 37, paging the full closed list, is NOT built. The list endpoint only
 * answers `isCompleted=false`, so closed history is never fetched. That is the
 * real cause of production stalling at "30 of 902", not a broken load-more
 * trigger. The footer says so with the shared `resolvedHistory` reason instead
 * of shipping a Load more button that cannot load anything.
 */
import React, { useMemo, useState } from 'react';
import {
  PiArrowCounterClockwiseBold,
  PiCheckCircleBold,
  PiFlagBold,
  PiMagnifyingGlassBold,
  PiNoteBold,
  PiXBold,
} from 'react-icons/pi';

import { LOCKED_REASONS, Locked } from '@/components/vini-shared/locked';

import {
  AssigneeLine,
  CARD,
  ChannelChip,
  CustomerNameButton,
  EmptyPanel,
  IntentBadge,
  SecondaryButton,
  SectionLabel,
  cx,
} from './vini-action-items-atoms';
import {
  VINI_INCORRECT_REASON_LABEL,
  VINI_RESOLUTION_TYPE_LABEL,
  ViniActionItem,
  ViniActionItemsUser,
  ViniIntentTaxonomy,
  customerLabel,
  formatCount,
  formatSla,
  formatTimestamp,
  intentMeta,
} from './vini-action-items-data';

const matchesSearch = (item: ViniActionItem, query: string): boolean => {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    (customerLabel(item) ?? '').toLowerCase().includes(needle) ||
    (item.resolutionNote ?? '').toLowerCase().includes(needle) ||
    (item.whatNeedsDoing ?? '').toLowerCase().includes(needle)
  );
};

const SearchBox: React.FC<{
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <PiMagnifyingGlassBold
      size={14}
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]"
    />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-9 w-full rounded-lg border border-[#eceef2] bg-white pl-8 pr-8 text-[12.5px] text-[#15161d] placeholder:text-[#98a2b3] focus:border-[#5b21e6] focus:outline-none"
    />
    {value ? (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear the search"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#98a2b3] hover:text-[#667085]"
      >
        <PiXBold size={12} />
      </button>
    ) : null}
  </div>
);

/* ── Closed detail ───────────────────────────────────────────────── */

const ClosedDetail: React.FC<{
  item: ViniActionItem;
  taxonomy: ViniIntentTaxonomy;
  users: ViniActionItemsUser[];
  onOpenCustomer: (customerId: string) => void;
  /** Absent when reopening would drop the item out of every view. */
  onReopen?: () => void;
  reopenBlockedReason?: string;
}> = ({
  item,
  taxonomy,
  users,
  onOpenCustomer,
  onReopen,
  reopenBlockedReason,
}) => {
  const sla = formatSla(intentMeta(item.intentCode, taxonomy)?.slaMinutes);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <IntentBadge intentCode={item.intentCode} taxonomy={taxonomy} />
        <ChannelChip channel={item.channel} />
      </div>
      <CustomerNameButton item={item} onOpen={onOpenCustomer} size="lg" />

      {/* Row 36. What was actually done, made the headline of the record. */}
      <div className="rounded-lg bg-[#eaf6ee] p-3">
        <p className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide text-[#0f6e4f]">
          <PiCheckCircleBold size={13} /> Action taken
        </p>
        <p className="mt-1 text-[14.5px] font-bold text-[#15161d]">
          {item.resolutionType
            ? VINI_RESOLUTION_TYPE_LABEL[item.resolutionType]
            : 'Resolved, no type recorded'}
        </p>
        <p className="mt-0.5 text-[11px] text-[#667085]">
          {item.closedAt
            ? formatTimestamp(item.closedAt)
            : 'No closed timestamp on the record'}
        </p>
      </div>

      <div>
        <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
          What needed doing
        </p>
        <p className="mt-0.5 text-[13.5px] leading-snug text-[#15161d]">
          {item.whatNeedsDoing || 'No description on the record'}
        </p>
      </div>

      {item.sourceMessage ? (
        <div className="rounded-lg border border-[#eceef2] bg-[#fafafa] p-2.5">
          <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
            Source
          </p>
          <p className="text-[12px] italic leading-snug text-[#667085]">
            {item.sourceMessage}
          </p>
        </div>
      ) : null}

      {/* Row 36, the written note. Absent means absent, not an empty quote. */}
      <div className="rounded-lg bg-[#eaf6ee] p-2.5">
        <p className="mb-0.5 inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide text-[#0f6e4f]">
          <PiNoteBold size={12} /> Resolution note
        </p>
        <p className="text-[12px] leading-snug text-[#667085]">
          {item.resolutionNote || 'Nobody wrote a note when closing this.'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <AssigneeLine item={item} users={users} />
        {sla ? (
          <span className="ml-auto text-[10px] tabular-nums text-[#98a2b3]">
            SLA {sla}
          </span>
        ) : null}
      </div>

      {/* Row 38. Reopen, and only Reopen. Resolve, Assign and Incorrect stay
          off a closed row, and come back once it is Unresolved again. */}
      <div className="border-t border-[#eceef2] pt-2.5">
        {onReopen ? (
          <>
            <SecondaryButton className="h-8 w-full" onClick={onReopen}>
              <PiArrowCounterClockwiseBold size={13} /> Reopen
            </SecondaryButton>
            <p className="mt-1.5 text-[10.5px] leading-snug text-[#b54708]">
              {LOCKED_REASONS.unresolve}
            </p>
          </>
        ) : (
          <p className="text-[10.5px] leading-snug text-[#98a2b3]">
            {reopenBlockedReason}
          </p>
        )}
      </div>
    </div>
  );
};

/* ── Resolved tab ────────────────────────────────────────────────── */

export const ViniResolvedTab: React.FC<{
  items: ViniActionItem[];
  taxonomy: ViniIntentTaxonomy;
  users: ViniActionItemsUser[];
  onOpenCustomer: (customerId: string) => void;
  onReopen: (item: ViniActionItem) => void;
  /** True when reopening this item would hide it from the open queue. */
  reopenWouldHide: (item: ViniActionItem) => boolean;
  department: string;
}> = ({
  items,
  taxonomy,
  users,
  onOpenCustomer,
  onReopen,
  reopenWouldHide,
  department,
}) => {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(
    () => items.filter((item) => matchesSearch(item, search)),
    [items, search]
  );
  const open = filtered.find((item) => item.actionItemId === openId);

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel
        text="Resolved"
        hint={
          search
            ? `${formatCount(filtered.length)} of ${formatCount(items.length)} loaded`
            : `${formatCount(items.length)} resolved in this session`
        }
      />

      {/* The honest framing. These are the items this session closed, not the
          rooftop's closed history, because the history is never fetched. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-[#e5e7eb] bg-[#fcfcfd] px-3 py-2">
        <span className="text-[11px] font-semibold text-[#667085]">
          The rooftop&apos;s full closed history
        </span>
        <Locked reason="resolvedHistory" />
      </div>

      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search a customer or a note"
      />

      {items.length === 0 ? (
        <div className={CARD}>
          <EmptyPanel
            icon={<PiCheckCircleBold size={22} />}
            title="Nothing resolved here yet"
            body="Items you resolve show up here with their resolution type and note."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className={CARD}>
          <EmptyPanel
            icon={<PiMagnifyingGlassBold size={22} />}
            title="No resolved item matches"
            body="Clear the search to see the rest."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(320px,420px)]">
          <div className="flex flex-col gap-2">
            {filtered.map((item) => {
              const active = item.actionItemId === openId;
              return (
                <button
                  key={item.actionItemId}
                  type="button"
                  onClick={() => setOpenId(active ? null : item.actionItemId)}
                  className={cx(
                    CARD,
                    'flex flex-wrap items-center gap-2 border-l-[3px] p-3 text-left',
                    active
                      ? 'border-l-[#5b21e6] ring-1 ring-[#5b21e6]'
                      : 'border-l-transparent'
                  )}
                >
                  <span className="text-[#0f6e4f]">
                    <PiCheckCircleBold size={15} />
                  </span>
                  <IntentBadge
                    intentCode={item.intentCode}
                    taxonomy={taxonomy}
                  />
                  <span className="text-[13px] font-bold text-[#15161d]">
                    {customerLabel(item) ?? 'Name not on the record'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[#667085]">
                    {item.resolutionNote || item.whatNeedsDoing}
                  </span>
                  {item.resolutionType ? (
                    <span className="rounded-full bg-[#eaf6ee] px-2 py-0.5 text-[10.5px] font-semibold text-[#0f6e4f]">
                      {VINI_RESOLUTION_TYPE_LABEL[item.resolutionType]}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className={cx(CARD, 'flex min-h-[280px] flex-col p-0')}>
            {open ? (
              <ClosedDetail
                item={open}
                taxonomy={taxonomy}
                users={users}
                onOpenCustomer={onOpenCustomer}
                onReopen={
                  reopenWouldHide(open) ? undefined : () => onReopen(open)
                }
                reopenBlockedReason={
                  `Reopening this would put it in neither queue. Its intent is not ` +
                  `scoped to ${department}, and the open queue matches the department exactly. ` +
                  `Reopen is hidden rather than letting the item vanish.`
                }
              />
            ) : (
              <EmptyPanel
                icon={<PiNoteBold size={22} />}
                title="Pick a resolved item"
                body="Open any row for its full record and the note the advisor left."
                className="flex-1"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Incorrect tab ───────────────────────────────────────────────── */

export const ViniIncorrectTab: React.FC<{
  items: ViniActionItem[];
  taxonomy: ViniIntentTaxonomy;
  users: ViniActionItemsUser[];
  onOpenCustomer: (customerId: string) => void;
  onRestore: (item: ViniActionItem) => void;
  reopenWouldHide: (item: ViniActionItem) => boolean;
  department: string;
}> = ({
  items,
  taxonomy,
  users,
  onOpenCustomer,
  onRestore,
  reopenWouldHide,
  department,
}) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((item) => item.actionItemId === openId);

  if (items.length === 0) {
    return (
      <div className={CARD}>
        <EmptyPanel
          icon={<PiFlagBold size={22} />}
          title="Nothing flagged incorrect"
          body="Items you mark incorrect land here and stay out of the closure rate."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel
        text="Incorrect"
        hint={`${formatCount(items.length)} flagged, kept out of the closure rate`}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(320px,420px)]">
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const active = item.actionItemId === openId;
            return (
              <button
                key={item.actionItemId}
                type="button"
                onClick={() => setOpenId(active ? null : item.actionItemId)}
                className={cx(
                  CARD,
                  'flex flex-wrap items-center gap-2 border-l-[3px] p-3 text-left',
                  active
                    ? 'border-l-[#5b21e6] ring-1 ring-[#5b21e6]'
                    : 'border-l-transparent'
                )}
              >
                <span className="text-[#b54708]">
                  <PiFlagBold size={15} />
                </span>
                <IntentBadge intentCode={item.intentCode} taxonomy={taxonomy} />
                <span className="text-[13px] font-bold text-[#15161d]">
                  {customerLabel(item) ?? 'Name not on the record'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-[#667085]">
                  {item.whatNeedsDoing}
                </span>
                {item.incorrectReason ? (
                  <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 text-[10.5px] font-semibold text-[#b54708]">
                    {VINI_INCORRECT_REASON_LABEL[item.incorrectReason]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className={cx(CARD, 'flex min-h-[280px] flex-col p-0')}>
          {open ? (
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <IntentBadge intentCode={open.intentCode} taxonomy={taxonomy} />
                <ChannelChip channel={open.channel} />
                {open.incorrectReason ? (
                  <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 text-[10.5px] font-semibold text-[#b54708]">
                    {VINI_INCORRECT_REASON_LABEL[open.incorrectReason]}
                  </span>
                ) : null}
              </div>
              <CustomerNameButton
                item={open}
                onOpen={onOpenCustomer}
                size="lg"
              />

              {open.originalIntentCode ? (
                <div className="rounded-lg bg-[#f3efff] p-3">
                  <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#5b21e6]">
                    Reclassified
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#667085]">
                    <span className="text-[#98a2b3] line-through">
                      {open.originalIntentCode}
                    </span>{' '}
                    to{' '}
                    <span className="font-bold text-[#15161d]">
                      {open.intentCode}
                    </span>
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
                  Flagged from
                </p>
                <p className="mt-0.5 text-[13.5px] leading-snug text-[#15161d]">
                  {open.whatNeedsDoing}
                </p>
              </div>

              {open.sourceMessage ? (
                <div className="rounded-lg border border-[#eceef2] bg-[#fafafa] p-2.5">
                  <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
                    Source
                  </p>
                  <p className="text-[12px] italic leading-snug text-[#667085]">
                    {open.sourceMessage}
                  </p>
                </div>
              ) : null}

              <AssigneeLine item={open} users={users} />

              <div className="border-t border-[#eceef2] pt-2.5">
                {reopenWouldHide(open) ? (
                  <p className="text-[10.5px] leading-snug text-[#98a2b3]">
                    Restoring this would put it in neither queue. Its intent is
                    not scoped to {department}, and the open queue matches the
                    department exactly.
                  </p>
                ) : (
                  <>
                    <SecondaryButton
                      className="h-8 w-full"
                      onClick={() => onRestore(open)}
                    >
                      <PiArrowCounterClockwiseBold size={13} /> Restore to the
                      queue
                    </SecondaryButton>
                    <p className="mt-1.5 text-[10.5px] leading-snug text-[#b54708]">
                      {LOCKED_REASONS.unresolve}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <EmptyPanel
              icon={<PiFlagBold size={22} />}
              title="Pick a flagged item"
              body="Open any row to see why it was flagged and restore it."
              className="flex-1"
            />
          )}
        </div>
      </div>
    </div>
  );
};
