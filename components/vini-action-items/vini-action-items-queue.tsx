'use client';

/**
 * The Unresolved queue: filter bar, category bands, grouped rows, bulk select.
 *
 * Decision rows kept here: 3 group by, 4 intent filter, 6 quick chips,
 * 9 multi-item badge, 10 and 11 repeat caller, 12 and 13 bulk select,
 * 25 search, 26 assignee filter, 27 match count, 28 row fields,
 * 29 see-all, 32 urgency pill, 47 Today band, 48 No deadline band,
 * 49 Overdue band.
 *
 * Cut on 17-Sep and therefore absent: row 5 channel filter, row 7 clear-filters
 * chip, row 8 reorder icon, row 16 the four bespoke empty states.
 */
import React, { useMemo } from 'react';
import {
  PiCalendarBlankBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiChecksBold,
  PiClockBold,
  PiMagnifyingGlassBold,
  PiPhoneBold,
  PiWarningBold,
  PiXBold,
} from 'react-icons/pi';

import {
  AssigneeLine,
  CARD,
  CustomerNameButton,
  EmptyPanel,
  FilterChip,
  GhostButton,
  IntentBadge,
  LabelledSelect,
  SectionLabel,
  SlaState,
  cx,
} from './vini-action-items-atoms';
import {
  VINI_BAND_META,
  VINI_BAND_ORDER,
  ViniActionItem,
  ViniActionItemsUser,
  ViniIntentTaxonomy,
  ViniQueueBand,
  ageLabel,
  ageMinutes,
  bandOf,
  customerLabel,
  formatCount,
  intentLabel,
  isPastSla,
} from './vini-action-items-data';

export type ViniGroupBy = 'customer' | 'intent' | 'assignee' | 'none';

export interface ViniQueueFilters {
  search: string;
  intent: string;
  assignment: string;
  pastSlaOnly: boolean;
  unassignedOnly: boolean;
  repeatOnly: boolean;
  created: 'all' | 'today' | 'yesterday';
  callbacksOnly: boolean;
}

export const VINI_EMPTY_QUEUE_FILTERS: ViniQueueFilters = {
  search: '',
  intent: 'all',
  assignment: 'all',
  pastSlaOnly: false,
  unassignedOnly: false,
  repeatOnly: false,
  created: 'all',
  callbacksOnly: false,
};

export const UNASSIGNED_GROUP_KEY = '__unassigned__';

/** Repeat-caller threshold, matching the iframe app's own bar. */
export const REPEAT_CALLER_MIN = 3;

export interface ViniQueueGroup {
  key: string;
  items: ViniActionItem[];
}

/* ── Filter bar ──────────────────────────────────────────────────── */

export const ViniQueueFilterBar: React.FC<{
  filters: ViniQueueFilters;
  onChange: (next: ViniQueueFilters) => void;
  groupBy: ViniGroupBy;
  onGroupBy: (next: ViniGroupBy) => void;
  taxonomy: ViniIntentTaxonomy;
  /** Intent codes present in this department's open items. */
  intentCodes: string[];
  users: ViniActionItemsUser[];
  /** Intent codes the catalog marks as a callback, for the Callbacks chip. */
  callbackIntentCodes: string[];
}> = ({
  filters,
  onChange,
  groupBy,
  onGroupBy,
  taxonomy,
  intentCodes,
  users,
  callbackIntentCodes,
}) => {
  const patch = (next: Partial<ViniQueueFilters>) =>
    onChange({ ...filters, ...next });

  const intentOptions = useMemo<[string, string][]>(
    () => [
      ['all', 'All'],
      ...intentCodes
        .map((code): [string, string] => [code, intentLabel(code, taxonomy)])
        .sort((a, b) => a[1].localeCompare(b[1])),
    ],
    [intentCodes, taxonomy]
  );

  const assignmentOptions = useMemo<[string, string][]>(
    () => [
      ['all', 'All'],
      ['assigned', 'Assigned'],
      ['unassigned', 'Unassigned'],
      ...users.map((user): [string, string] => [user.userId, user.name]),
    ],
    [users]
  );

  return (
    <div className={cx(CARD, 'flex flex-col gap-2.5 px-3 py-2.5')}>
      <div className="relative">
        <PiMagnifyingGlassBold
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]"
        />
        <input
          value={filters.search}
          onChange={(event) => patch({ search: event.target.value })}
          placeholder="Search the queue by customer or by what needs doing"
          aria-label="Search the queue"
          className="h-9 w-full rounded-lg border border-[#eceef2] bg-white pl-8 pr-8 text-[12.5px] text-[#15161d] placeholder:text-[#98a2b3] focus:border-[#5b21e6] focus:outline-none"
        />
        {filters.search ? (
          <button
            type="button"
            onClick={() => patch({ search: '' })}
            aria-label="Clear the search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#98a2b3] hover:text-[#667085]"
          >
            <PiXBold size={12} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[10px] font-bold uppercase tracking-wide text-[#98a2b3]">
          Quick
        </span>
        <FilterChip
          label="Past SLA"
          icon={<PiWarningBold size={12} />}
          active={filters.pastSlaOnly}
          onClick={() => patch({ pastSlaOnly: !filters.pastSlaOnly })}
        />
        <FilterChip
          label="Unassigned"
          icon={<PiClockBold size={12} />}
          active={filters.unassignedOnly}
          onClick={() => patch({ unassignedOnly: !filters.unassignedOnly })}
        />
        <FilterChip
          label="Repeat callers"
          icon={<PiPhoneBold size={12} />}
          active={filters.repeatOnly}
          onClick={() => patch({ repeatOnly: !filters.repeatOnly })}
        />
        <FilterChip
          label="Created today"
          icon={<PiCalendarBlankBold size={12} />}
          active={filters.created === 'today'}
          onClick={() =>
            patch({ created: filters.created === 'today' ? 'all' : 'today' })
          }
        />
        <FilterChip
          label="Created yesterday"
          icon={<PiCalendarBlankBold size={12} />}
          active={filters.created === 'yesterday'}
          onClick={() =>
            patch({
              created: filters.created === 'yesterday' ? 'all' : 'yesterday',
            })
          }
        />
        {/* The chip only appears when the catalog actually names a callback
            intent. No hardcoded intent code, so a taxonomy rename cannot
            leave a chip behind that silently matches nothing. */}
        {callbackIntentCodes.length > 0 ? (
          <FilterChip
            label="Callbacks"
            icon={<PiPhoneBold size={12} />}
            active={filters.callbacksOnly}
            onClick={() => patch({ callbacksOnly: !filters.callbacksOnly })}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <LabelledSelect
          label="Group by"
          value={groupBy}
          onChange={(value) => onGroupBy(value as ViniGroupBy)}
          options={[
            ['customer', 'Customer'],
            ['intent', 'Intent'],
            ['assignee', 'Assignee'],
            ['none', 'None'],
          ]}
        />
        <LabelledSelect
          label="Intent"
          value={filters.intent}
          onChange={(value) => patch({ intent: value })}
          options={intentOptions}
        />
        <LabelledSelect
          label="Assignee"
          value={filters.assignment}
          onChange={(value) => patch({ assignment: value })}
          options={assignmentOptions}
        />
      </div>
    </div>
  );
};

/* ── Bulk bar ────────────────────────────────────────────────────── */

export const ViniQueueBulkBar: React.FC<{
  selectedCount: number;
  visibleCount: number;
  totalCount: number;
  onSelectAllVisible: () => void;
  onClear: () => void;
  onResolveSelected: () => void;
  busy: boolean;
}> = ({
  selectedCount,
  visibleCount,
  totalCount,
  onSelectAllVisible,
  onClear,
  onResolveSelected,
  busy,
}) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
    {/* Row 27. The filtered count against the full backlog, so a narrowed
        list never reads as a cleared one. */}
    <span className="text-[11.5px] font-medium text-[#667085]">
      Showing {formatCount(visibleCount)} of {formatCount(totalCount)} that
      match
    </span>
    <span className="text-[11.5px] font-semibold text-[#15161d]">
      {formatCount(selectedCount)} selected
    </span>
    <GhostButton onClick={onSelectAllVisible} disabled={visibleCount === 0}>
      Select all visible
    </GhostButton>
    {selectedCount > 0 ? (
      <>
        <button
          type="button"
          onClick={onResolveSelected}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#5b21e6] px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-[#4c1fdd] disabled:opacity-40"
        >
          <PiChecksBold size={12} /> Resolve {formatCount(selectedCount)}
        </button>
        <GhostButton onClick={onClear}>Clear</GhostButton>
      </>
    ) : null}
  </div>
);

/* ── Band header ─────────────────────────────────────────────────── */

const BAND_TONE: Record<ViniQueueBand, string> = {
  overdue: 'border-l-[3px] border-[#98a2b3] bg-[#f5f6f8]',
  today: 'border-l-[3px] border-[#5b21e6] bg-[#f3efff]',
  later: 'border-l-[3px] border-[#d0d5dd] bg-[#fafafa]',
  noDeadline: 'border-l-[3px] border-[#d0d5dd] bg-[#fafafa]',
};

export const ViniQueueBandHeader: React.FC<{
  band: ViniQueueBand;
  count: number;
}> = ({ band, count }) => (
  <div className={cx('rounded-lg px-3 py-2', BAND_TONE[band])}>
    <p className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-[#15161d]">
      {VINI_BAND_META[band].label}
      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#667085]">
        {formatCount(count)}
      </span>
    </p>
    <p className="mt-0.5 text-[10.5px] text-[#667085]">
      {VINI_BAND_META[band].subtitle}
    </p>
  </div>
);

/* ── Rows ────────────────────────────────────────────────────────── */

const RepeatBadge: React.FC<{ count: number }> = ({ count }) => (
  <span
    title={`This customer has contacted the store ${count} times`}
    className="inline-flex items-center gap-0.5 rounded-full bg-[#f3efff] px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums text-[#5b21e6]"
  >
    x{count}
  </span>
);

export const ViniQueueGroupRow: React.FC<{
  groupBy: ViniGroupBy;
  group: ViniQueueGroup;
  taxonomy: ViniIntentTaxonomy;
  users: ViniActionItemsUser[];
  active: boolean;
  expanded: boolean;
  selectedIds: Set<string>;
  onSelect: () => void;
  onToggleExpand: () => void;
  onToggleSelectGroup: () => void;
  onOpenCustomer: (customerId: string) => void;
}> = ({
  groupBy,
  group,
  taxonomy,
  users,
  active,
  expanded,
  selectedIds,
  onSelect,
  onToggleExpand,
  onToggleSelectGroup,
  onOpenCustomer,
}) => {
  const items = group.items;
  const worst = items[0];
  const multi = items.length > 1;
  const anyPast = items.some((item) => isPastSla(item, taxonomy) === true);
  const allSelected = items.every((item) => selectedIds.has(item.actionItemId));

  let header: React.ReactNode;
  if (groupBy === 'intent') {
    header = <IntentBadge intentCode={group.key} taxonomy={taxonomy} />;
  } else if (groupBy === 'assignee') {
    const user = users.find((candidate) => candidate.userId === group.key);
    header =
      group.key === UNASSIGNED_GROUP_KEY ? (
        <span className="text-[13px] font-bold text-[#b54708]">Unassigned</span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-[#f3efff] text-[8.5px] font-bold text-[#5b21e6]">
            {user?.initials ?? '—'}
          </span>
          <span className="truncate text-[13px] font-bold text-[#15161d]">
            {user?.name ?? worst.assigneeName ?? 'Owner id only, no name'}
          </span>
        </span>
      );
  } else {
    header = <CustomerNameButton item={worst} onOpen={onOpenCustomer} />;
  }

  return (
    <div
      className={cx(
        CARD,
        'overflow-hidden border-l-[3px]',
        anyPast
          ? 'border-l-[#98a2b3]'
          : active
            ? 'border-l-[#5b21e6]'
            : 'border-l-transparent',
        active && 'ring-1 ring-[#5b21e6]'
      )}
    >
      <div className="flex items-start gap-2 p-3.5">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleSelectGroup}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select all ${items.length} items in this group`}
          className="mt-0.5 size-3.5 flex-none accent-[#5b21e6]"
        />
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              if (event.key === ' ') event.preventDefault();
              onSelect();
            }
          }}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-1.5">
            {header}
            {multi ? (
              <span className="rounded-full bg-[#f1f2f6] px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums text-[#667085]">
                {items.length} items
              </span>
            ) : null}
            {worst.repeatCallerCount >= REPEAT_CALLER_MIN ? (
              <RepeatBadge count={worst.repeatCallerCount} />
            ) : null}
            <span className="ml-auto shrink-0">
              <SlaState
                item={worst}
                taxonomy={taxonomy}
                ageText={ageLabel(ageMinutes(worst.createdAt))}
                pastSla={isPastSla(worst, taxonomy)}
              />
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-[12px] leading-snug text-[#667085]">
            {worst.whatNeedsDoing}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            {groupBy === 'assignee' ? (
              <span className="truncate text-[10.5px] text-[#98a2b3]">
                {customerLabel(worst) ?? 'Name not on the record'}
              </span>
            ) : (
              <AssigneeLine item={worst} users={users} />
            )}
            {multi ? (
              <GhostButton
                className="ml-auto !text-[10.5px] !text-[#5b21e6]"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleExpand();
                }}
              >
                {expanded ? 'Hide' : `See all ${items.length}`}
                {expanded ? (
                  <PiCaretUpBold size={11} />
                ) : (
                  <PiCaretDownBold size={11} />
                )}
              </GhostButton>
            ) : null}
          </div>
        </div>
      </div>

      {multi && expanded ? (
        <ul className="flex flex-col gap-1.5 border-t border-[#f1f2f5] bg-[#fafafa] px-3 py-2">
          {items.map((item) => (
            <li
              key={item.actionItemId}
              className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5"
            >
              <IntentBadge intentCode={item.intentCode} taxonomy={taxonomy} />
              <SlaState
                item={item}
                taxonomy={taxonomy}
                ageText={ageLabel(ageMinutes(item.createdAt))}
                pastSla={isPastSla(item, taxonomy)}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] text-[#667085]">
                {item.whatNeedsDoing}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export const ViniQueueFlatRow: React.FC<{
  item: ViniActionItem;
  taxonomy: ViniIntentTaxonomy;
  users: ViniActionItemsUser[];
  active: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
  onOpenCustomer: (customerId: string) => void;
}> = ({
  item,
  taxonomy,
  users,
  active,
  selected,
  onSelect,
  onToggleSelect,
  onOpenCustomer,
}) => {
  const past = isPastSla(item, taxonomy);
  return (
    <div
      className={cx(
        CARD,
        'flex items-start gap-2 border-l-[3px] p-3.5',
        past === true
          ? 'border-l-[#98a2b3]'
          : active
            ? 'border-l-[#5b21e6]'
            : 'border-l-transparent',
        active && 'ring-1 ring-[#5b21e6]'
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        onClick={(event) => event.stopPropagation()}
        aria-label="Select this item"
        className="mt-0.5 size-3.5 flex-none accent-[#5b21e6]"
      />
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            if (event.key === ' ') event.preventDefault();
            onSelect();
          }
        }}
        className="flex min-w-0 flex-1 flex-col gap-2 text-left"
      >
        <div className="flex items-center gap-1.5">
          <IntentBadge intentCode={item.intentCode} taxonomy={taxonomy} />
          <span className="ml-auto shrink-0">
            <SlaState
              item={item}
              taxonomy={taxonomy}
              ageText={ageLabel(ageMinutes(item.createdAt))}
              pastSla={past}
            />
          </span>
        </div>
        <p className="line-clamp-2 text-[12.5px] leading-snug text-[#15161d]">
          {item.whatNeedsDoing}
        </p>
        <div className="flex items-center gap-2">
          <CustomerNameButton item={item} onOpen={onOpenCustomer} size="sm" />
          <AssigneeLine item={item} users={users} />
        </div>
      </div>
    </div>
  );
};

/* ── The banded list ─────────────────────────────────────────────── */

/** Band a flat list of items, preserving the caller's sort inside each band. */
export const bandItems = (
  items: ViniActionItem[],
  taxonomy: ViniIntentTaxonomy
): { band: ViniQueueBand; items: ViniActionItem[] }[] => {
  const buckets = new Map<ViniQueueBand, ViniActionItem[]>();
  for (const item of items) {
    const band = bandOf(item, taxonomy);
    const bucket = buckets.get(band);
    if (bucket) bucket.push(item);
    else buckets.set(band, [item]);
  }
  return VINI_BAND_ORDER.filter((band) => buckets.get(band)?.length).map(
    (band) => ({ band, items: buckets.get(band) as ViniActionItem[] })
  );
};

export const ViniQueueEmpty: React.FC = () => (
  <div className={CARD}>
    <EmptyPanel
      icon={<PiMagnifyingGlassBold size={22} />}
      title="No items match these filters"
      body="Try clearing a filter or widening your search."
    />
  </div>
);

export { SectionLabel };
