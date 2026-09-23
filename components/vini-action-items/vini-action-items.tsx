'use client';

/**
 * Action Items, the native page body.
 *
 * Ported from the iframe app's ActionItemsConsole. Same three tabs, same
 * grouping, same master and detail shape, same write flows. Differences worth
 * knowing before editing:
 *
 * No mock. The iframe rendered a bundled queue when no scope was present. This
 * renders its error state instead.
 *
 * The KPI numbers come from the metrics endpoint, not from counting loaded
 * rows. The tab badges DO count loaded rows, and say so, because the row
 * endpoint returns one page.
 *
 * Every write reports back. A write that only landed in the browser says so in
 * the toast, and a failed write rolls the row back.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PiChecksBold, PiGearBold, PiListBold } from 'react-icons/pi';

import {
  ViniActionItemsWriteResult,
  ViniMetricsState,
} from '@/hooks/use-vini-action-items';

import {
  CARD,
  EmptyPanel,
  IntentBadge,
  SecondaryButton,
  SectionLabel,
  cx,
} from './vini-action-items-atoms';
import {
  ViniActionItem,
  ViniActionItemsDepartment,
  ViniActionItemsMode,
  ViniActionItemsUser,
  ViniIncorrectReason,
  ViniIntentTaxonomy,
  ViniResolutionType,
  customerLabel,
  dayKeyOf,
  deptOf,
  formatCount,
  intentLabel,
  isPastSla,
  matchesDepartment,
  reopenWouldHide,
  daysSortWeight,
} from './vini-action-items-data';
import ViniActionItemsDetail from './vini-action-items-detail';
import {
  ViniCustomerPanel,
  ViniSourceDrawer,
} from './vini-action-items-drawers';
import ViniActionItemsKpis, {
  ViniKpiFilterState,
} from './vini-action-items-kpis';
import {
  REPEAT_CALLER_MIN,
  UNASSIGNED_GROUP_KEY,
  VINI_EMPTY_QUEUE_FILTERS,
  ViniGroupBy,
  ViniQueueBandHeader,
  ViniQueueBulkBar,
  ViniQueueEmpty,
  ViniQueueFilterBar,
  ViniQueueFilters,
  ViniQueueFlatRow,
  ViniQueueGroup,
  ViniQueueGroupRow,
  bandItems,
} from './vini-action-items-queue';
import {
  ViniIncorrectTab,
  ViniResolvedTab,
} from './vini-action-items-resolved';
import ViniActionItemsRules from './vini-action-items-rules';

type Tab = 'unresolved' | 'resolved' | 'incorrect';

interface ViniActionItemsProps {
  items: ViniActionItem[];
  taxonomy: ViniIntentTaxonomy;
  taxonomyLoaded: boolean;
  users: ViniActionItemsUser[];
  metrics: ViniMetricsState;
  department: ViniActionItemsDepartment;
  /** Sales, Service, or Reception, which shares this route. */
  mode: ViniActionItemsMode;
  enterpriseId: string;
  teamId: string;
  onResolve: (args: {
    actionItemIds: string[];
    resolutionType: ViniResolutionType;
    note?: string;
  }) => Promise<ViniActionItemsWriteResult>;
  onAssign: (args: {
    actionItemId: string;
    userId: string;
  }) => Promise<ViniActionItemsWriteResult>;
  onMarkIncorrect: (args: {
    actionItemId: string;
    reason: ViniIncorrectReason;
    correctedIntentCode?: string;
  }) => Promise<ViniActionItemsWriteResult>;
  onReopenLocally: (actionItemId: string) => void;
  onRestoreIncorrectLocally: (actionItemId: string) => void;
  onSaveIntentSla: (args: {
    intentCode: string;
    slaMinutes: number;
    serviceType: string;
  }) => Promise<ViniActionItemsWriteResult>;
}

const ViniActionItems: React.FC<ViniActionItemsProps> = ({
  items,
  taxonomy,
  taxonomyLoaded,
  users,
  metrics,
  department,
  mode,
  enterpriseId,
  teamId,
  onResolve,
  onAssign,
  onMarkIncorrect,
  onReopenLocally,
  onRestoreIncorrectLocally,
  onSaveIntentSla,
}) => {
  const [tab, setTab] = useState<Tab>('unresolved');
  const [groupBy, setGroupBy] = useState<ViniGroupBy>('customer');
  const [filters, setFilters] = useState<ViniQueueFilters>(
    VINI_EMPTY_QUEUE_FILTERS
  );
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(
    null
  );
  const [customerPanelId, setCustomerPanelId] = useState<string | null>(null);
  const [sourceView, setSourceView] = useState<{
    item: ViniActionItem;
    mode: 'call' | 'conversation';
  } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const flash = useCallback((text: string, ok: boolean) => {
    setToast({ text, ok });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  /* ── Department scoping ─────────────────────────────────────────── */

  /**
   * Reception shares this route and this department.
   *
   * The old page sent `serviceType=reception` to the embed, which the embed
   * then treated as neither Sales nor Service, so nothing filtered out.
   * Reception is kept on the Service taxonomy here, because a receptionist is
   * fielding the same calls a Service BDC is, and the alternative is a blank
   * page. The banner below says which scope is in force.
   */
  const inDepartment = useCallback(
    (item: ViniActionItem) =>
      matchesDepartment(deptOf(item, taxonomy), department),
    [taxonomy, department]
  );

  const departmentItems = useMemo(
    () => items.filter(inDepartment),
    [items, inDepartment]
  );

  /**
   * Items the department match excludes.
   *
   * These are the `both` intents, invisible under Sales and under Service.
   * The count is stated out loud instead of the list silently shrinking. See
   * matchesDepartment in the data file for why it is not simply fixed.
   */
  const hiddenByDepartment = useMemo(
    () => items.filter((item) => !inDepartment(item)),
    [items, inDepartment]
  );

  const pending = useMemo(
    () => departmentItems.filter((item) => item.status === 'pending'),
    [departmentItems]
  );
  const resolved = useMemo(
    () => departmentItems.filter((item) => item.status === 'completed'),
    [departmentItems]
  );
  const incorrect = useMemo(
    () => departmentItems.filter((item) => item.status === 'incorrect'),
    [departmentItems]
  );

  /* ── Filters ────────────────────────────────────────────────────── */

  const callbackIntentCodes = useMemo(
    () =>
      Object.values(taxonomy)
        .filter((intent) => /callback/i.test(intent.intentCode))
        .map((intent) => intent.intentCode),
    [taxonomy]
  );

  const filteredPending = useMemo(
    () =>
      pending.filter((item) => {
        if (filters.intent !== 'all' && item.intentCode !== filters.intent) {
          return false;
        }
        if (filters.assignment === 'unassigned' && item.assigneeUserId) {
          return false;
        }
        if (filters.assignment === 'assigned' && !item.assigneeUserId) {
          return false;
        }
        if (
          filters.assignment !== 'all' &&
          filters.assignment !== 'assigned' &&
          filters.assignment !== 'unassigned' &&
          item.assigneeUserId !== filters.assignment
        ) {
          return false;
        }
        if (filters.pastSlaOnly && isPastSla(item, taxonomy) !== true) {
          return false;
        }
        if (filters.unassignedOnly && item.assigneeUserId) return false;
        if (filters.repeatOnly && item.repeatCallerCount < REPEAT_CALLER_MIN) {
          return false;
        }
        if (
          filters.created !== 'all' &&
          dayKeyOf(item.createdAt) !== filters.created
        ) {
          return false;
        }
        if (
          filters.callbacksOnly &&
          !callbackIntentCodes.includes(item.intentCode)
        ) {
          return false;
        }
        if (filters.search) {
          const needle = filters.search.toLowerCase();
          const name = (customerLabel(item) ?? '').toLowerCase();
          if (
            !item.whatNeedsDoing.toLowerCase().includes(needle) &&
            !name.includes(needle)
          ) {
            return false;
          }
        }
        return true;
      }),
    [pending, filters, taxonomy, callbackIntentCodes]
  );

  const flatSorted = useMemo(
    () =>
      [...filteredPending].sort(
        (a, b) => daysSortWeight(b) - daysSortWeight(a)
      ),
    [filteredPending, taxonomy]
  );

  const groups = useMemo<ViniQueueGroup[]>(() => {
    if (groupBy === 'none') return [];
    const keyOf = (item: ViniActionItem) =>
      groupBy === 'intent'
        ? item.intentCode
        : groupBy === 'assignee'
          ? (item.assigneeUserId ?? UNASSIGNED_GROUP_KEY)
          : item.customerId;

    const buckets = new Map<string, ViniActionItem[]>();
    for (const item of flatSorted) {
      const key = keyOf(item);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(item);
      else buckets.set(key, [item]);
    }

    const worstOf = (bucket: ViniActionItem[]) =>
      Math.max(...bucket.map((item) => daysSortWeight(item)));

    return [...buckets.entries()]
      .map(([key, bucket]) => ({ key, items: bucket }))
      .sort((a, b) => worstOf(b.items) - worstOf(a.items));
  }, [flatSorted, groupBy, taxonomy]);

  const isFlat = groupBy === 'none';
  const activeGroupKey = isFlat
    ? null
    : (selectedGroupKey ?? groups[0]?.key ?? null);

  const activeItems = useMemo<ViniActionItem[]>(() => {
    if (isFlat) {
      const one = flatSorted.find(
        (item) => item.actionItemId === selectedItemId
      );
      if (one) return [one];
      return flatSorted[0] ? [flatSorted[0]] : [];
    }
    if (selectedItemId) {
      const one = filteredPending.find(
        (item) => item.actionItemId === selectedItemId
      );
      if (one) return [one];
    }
    return groups.find((group) => group.key === activeGroupKey)?.items ?? [];
  }, [
    isFlat,
    flatSorted,
    selectedItemId,
    filteredPending,
    groups,
    activeGroupKey,
  ]);

  // After a resolve empties the selection, advance instead of going blank.
  useEffect(() => {
    if (tab !== 'unresolved' || activeItems.length > 0) return;
    if (isFlat) {
      const next = flatSorted[0]?.actionItemId ?? null;
      if (next !== selectedItemId) setSelectedItemId(next);
    } else {
      const next = groups[0]?.key ?? null;
      if (next !== selectedGroupKey) {
        setSelectedGroupKey(next);
        setSelectedItemId(null);
      }
    }
  }, [
    tab,
    activeItems.length,
    isFlat,
    flatSorted,
    groups,
    selectedItemId,
    selectedGroupKey,
  ]);

  const resetSelection = () => {
    setSelectedGroupKey(null);
    setSelectedItemId(null);
  };

  /* ── Writes ─────────────────────────────────────────────────────── */

  const runWrite = useCallback(
    async (work: () => Promise<ViniActionItemsWriteResult>) => {
      setBusy(true);
      try {
        const result = await work();
        if (result.message) flash(result.message, result.ok);
      } finally {
        setBusy(false);
      }
    },
    [flash]
  );

  const handleResolve = (
    item: ViniActionItem,
    resolutionType: ViniResolutionType,
    note: string
  ) =>
    runWrite(() =>
      onResolve({
        actionItemIds: [item.actionItemId],
        resolutionType,
        note,
      })
    );

  const handleResolveMany = (targets: ViniActionItem[]) => {
    const ids = targets
      .filter((item) => item.status === 'pending')
      .map((item) => item.actionItemId);
    if (!ids.length) return;
    setCheckedIds(new Set());
    return runWrite(() =>
      onResolve({
        actionItemIds: ids,
        resolutionType: 'other',
        note: 'Resolved in bulk from the console',
      })
    );
  };

  const handleAssign = (item: ViniActionItem, userId: string) =>
    runWrite(() => onAssign({ actionItemId: item.actionItemId, userId }));

  const handleMarkIncorrect = (
    item: ViniActionItem,
    reason: ViniIncorrectReason,
    correctedIntentCode?: string
  ) =>
    runWrite(() =>
      onMarkIncorrect({
        actionItemId: item.actionItemId,
        reason,
        correctedIntentCode,
      })
    );

  /* ── Tabs ───────────────────────────────────────────────────────── */

  const TABS: [Tab, string, number][] = [
    ['unresolved', 'Unresolved', filteredPending.length],
    ['resolved', 'Resolved', resolved.length],
    ['incorrect', 'Incorrect', incorrect.length],
  ];

  const bands = useMemo(
    () => (isFlat ? bandItems(flatSorted, taxonomy) : []),
    [isFlat, flatSorted, taxonomy]
  );

  const detailTitle = isFlat || selectedItemId ? null : activeGroupKey;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold leading-[1.2] tracking-[-0.035em] text-[#15161d] sm:text-[24px]">
            Action Alerts
          </h1>
          <p className="mt-0.5 text-[12px] text-[#667085]">
            What Spyne needs a human to finish. Ranked by days.
          </p>
        </div>
        <SecondaryButton onClick={() => setRulesOpen(true)}>
          <PiGearBold size={14} /> Rules
        </SecondaryButton>
      </div>

      {/* Reception shares this route, so it says which scope it is running. */}
      {mode === 'reception' ? (
        <p className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#fcfcfd] px-3 py-2 text-[11px] text-[#667085]">
          Reception is showing the Service queue. There is no separate Reception
          scope on action items.
        </p>
      ) : null}

      <ViniActionItemsKpis
        metrics={metrics}
        filters={{
          pastSlaOnly: filters.pastSlaOnly,
          unassignedOnly: filters.unassignedOnly,
          repeatOnly: filters.repeatOnly,
        }}
        onToggleFilter={(key: keyof ViniKpiFilterState) => {
          setFilters((current) => ({ ...current, [key]: !current[key] }));
          setTab('unresolved');
          resetSelection();
        }}
        onJumpToResolved={() => setTab('resolved')}
      />

      <div
        role="tablist"
        className="flex items-center gap-1 border-b border-[#eceef2]"
      >
        {TABS.map(([id, label, count]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={cx(
                '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors',
                active
                  ? 'border-[#5b21e6] text-[#5b21e6]'
                  : 'border-transparent text-[#98a2b3] hover:text-[#667085]'
              )}
            >
              {label}
              <span
                className={cx(
                  'rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums',
                  active
                    ? 'bg-[#f3efff] text-[#5b21e6]'
                    : 'bg-[#f1f2f6] text-[#98a2b3]'
                )}
              >
                {formatCount(count)}
              </span>
            </button>
          );
        })}
      </div>

      {/* The department match, stated rather than hidden. */}
      {hiddenByDepartment.length > 0 ? (
        <p className="rounded-lg border border-dashed border-[#f0c99a] bg-[#fffaf3] px-3 py-2 text-[11px] leading-snug text-[#b54708]">
          {formatCount(hiddenByDepartment.length)}{' '}
          {hiddenByDepartment.length === 1 ? 'item is' : 'items are'} not shown
          on this tab. Their intent is scoped to both Sales and Service, and
          this queue matches the department exactly, so they appear under
          neither. Widening the match moves Sales counts too, so it is a product
          call, not a display one.
        </p>
      ) : null}

      {tab === 'resolved' ? (
        <ViniResolvedTab
          items={resolved}
          taxonomy={taxonomy}
          users={users}
          department={department}
          onOpenCustomer={setCustomerPanelId}
          reopenWouldHide={(item) =>
            reopenWouldHide(item, taxonomy, department)
          }
          onReopen={(item) => {
            onReopenLocally(item.actionItemId);
            setTab('unresolved');
            flash(
              'Reopened in this browser only. No endpoint reopens a resolved item, so a refresh puts it back.',
              false
            );
          }}
        />
      ) : tab === 'incorrect' ? (
        <ViniIncorrectTab
          items={incorrect}
          taxonomy={taxonomy}
          users={users}
          department={department}
          onOpenCustomer={setCustomerPanelId}
          reopenWouldHide={(item) =>
            reopenWouldHide(item, taxonomy, department)
          }
          onRestore={(item) => {
            onRestoreIncorrectLocally(item.actionItemId);
            setTab('unresolved');
            flash(
              'Restored in this browser only. No endpoint unflags an item, so a refresh puts it back.',
              false
            );
          }}
        />
      ) : (
        <>
          <ViniQueueFilterBar
            filters={filters}
            onChange={(next) => {
              setFilters(next);
              resetSelection();
            }}
            groupBy={groupBy}
            onGroupBy={(next) => {
              setGroupBy(next);
              resetSelection();
            }}
            taxonomy={taxonomy}
            intentCodes={[...new Set(pending.map((item) => item.intentCode))]}
            users={users}
            callbackIntentCodes={callbackIntentCodes}
          />

          <ViniQueueBulkBar
            selectedCount={checkedIds.size}
            visibleCount={filteredPending.length}
            totalCount={pending.length}
            busy={busy}
            onSelectAllVisible={() =>
              setCheckedIds(
                new Set(filteredPending.map((item) => item.actionItemId))
              )
            }
            onClear={() => setCheckedIds(new Set())}
            onResolveSelected={() =>
              handleResolveMany(
                filteredPending.filter((item) =>
                  checkedIds.has(item.actionItemId)
                )
              )
            }
          />

          <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
            <div className="flex min-h-0 flex-col gap-2.5 lg:w-[380px] lg:flex-none">
              <SectionLabel
                icon={<PiListBold size={13} />}
                text="Queue"
                hint={
                  isFlat
                    ? `${formatCount(flatSorted.length)} ${flatSorted.length === 1 ? 'item' : 'items'}`
                    : `${formatCount(groups.length)} ${groups.length === 1 ? 'group' : 'groups'}`
                }
              />

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {(isFlat ? flatSorted.length : groups.length) === 0 ? (
                  <ViniQueueEmpty />
                ) : isFlat ? (
                  // Rows 47, 48 and 49. The bands only exist on the flat view;
                  // grouping by customer already ranks by days.
                  bands.map((band) => (
                    <React.Fragment key={band.band}>
                      <ViniQueueBandHeader
                        band={band.band}
                        count={band.items.length}
                      />
                      {band.items.map((item) => (
                        <ViniQueueFlatRow
                          key={item.actionItemId}
                          item={item}
                          taxonomy={taxonomy}
                          users={users}
                          active={
                            selectedItemId
                              ? selectedItemId === item.actionItemId
                              : flatSorted[0]?.actionItemId ===
                                item.actionItemId
                          }
                          selected={checkedIds.has(item.actionItemId)}
                          onSelect={() => setSelectedItemId(item.actionItemId)}
                          onToggleSelect={() =>
                            setCheckedIds((current) => {
                              const next = new Set(current);
                              if (next.has(item.actionItemId)) {
                                next.delete(item.actionItemId);
                              } else {
                                next.add(item.actionItemId);
                              }
                              return next;
                            })
                          }
                          onOpenCustomer={setCustomerPanelId}
                        />
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  groups.map((group) => (
                    <ViniQueueGroupRow
                      key={group.key}
                      groupBy={groupBy}
                      group={group}
                      taxonomy={taxonomy}
                      users={users}
                      active={activeGroupKey === group.key}
                      expanded={!!expanded[group.key]}
                      selectedIds={checkedIds}
                      onSelect={() => {
                        setSelectedGroupKey(group.key);
                        setSelectedItemId(null);
                      }}
                      onToggleExpand={() =>
                        setExpanded((current) => ({
                          ...current,
                          [group.key]: !current[group.key],
                        }))
                      }
                      onToggleSelectGroup={() =>
                        setCheckedIds((current) => {
                          const next = new Set(current);
                          const ids = group.items.map(
                            (item) => item.actionItemId
                          );
                          const allIn = ids.every((id) => next.has(id));
                          ids.forEach((id) =>
                            allIn ? next.delete(id) : next.add(id)
                          );
                          return next;
                        })
                      }
                      onOpenCustomer={setCustomerPanelId}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2.5">
              <SectionLabel
                icon={<PiChecksBold size={13} />}
                text="Open items"
                hint="resolve, assign or flag"
              />
              <ViniActionItemsDetail
                items={activeItems}
                taxonomy={taxonomy}
                users={users}
                busy={busy}
                title={
                  detailTitle && groupBy === 'intent' ? (
                    <IntentBadge intentCode={detailTitle} taxonomy={taxonomy} />
                  ) : detailTitle && groupBy === 'assignee' ? (
                    <span className="text-[14px] font-bold text-[#15161d]">
                      {detailTitle === UNASSIGNED_GROUP_KEY
                        ? 'Unassigned'
                        : (users.find((user) => user.userId === detailTitle)
                            ?.name ?? 'Owner id only, no name')}
                    </span>
                  ) : (
                    <span className="text-[15px] font-bold text-[#15161d]">
                      {activeItems[0]
                        ? (customerLabel(activeItems[0]) ??
                          'Name not on the record')
                        : ''}
                    </span>
                  )
                }
                subtitle={
                  activeItems.length === 0
                    ? ''
                    : [
                        activeItems[0]?.customerPhone,
                        `${activeItems.length} open ${activeItems.length === 1 ? 'item' : 'items'}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                }
                onResolveAll={() => handleResolveMany(activeItems)}
                onResolve={handleResolve}
                onAssign={handleAssign}
                onMarkIncorrect={handleMarkIncorrect}
                onOpenCustomer={setCustomerPanelId}
                onOpenCall={(item) => setSourceView({ item, mode: 'call' })}
                onOpenConversation={(item) =>
                  setSourceView({ item, mode: 'conversation' })
                }
              />
            </div>
          </div>
        </>
      )}

      {/* Toast. A failed or browser-only write is amber, not green. */}
      {toast ? (
        <div
          role="status"
          className={cx(
            'fixed bottom-6 left-1/2 z-[210] max-w-[92vw] -translate-x-1/2 rounded-lg px-4 py-2.5 text-[12.5px] font-semibold shadow-lg',
            toast.ok ? 'bg-[#15161d] text-white' : 'bg-[#b54708] text-white'
          )}
        >
          {toast.text}
        </div>
      ) : null}

      {customerPanelId ? (
        <ViniCustomerPanel
          customerId={customerPanelId}
          items={items}
          taxonomy={taxonomy}
          onClose={() => setCustomerPanelId(null)}
          onJump={(target, customerId) => {
            setCustomerPanelId(null);
            if (target === 'resolved') {
              setTab('resolved');
              return;
            }
            setTab('unresolved');
            if (target === 'repeat') {
              setFilters((current) => ({ ...current, repeatOnly: true }));
              resetSelection();
              return;
            }
            setGroupBy('customer');
            setSelectedGroupKey(customerId);
            setSelectedItemId(null);
          }}
        />
      ) : null}

      {sourceView ? (
        <ViniSourceDrawer
          item={sourceView.item}
          mode={sourceView.mode}
          enterpriseId={enterpriseId}
          teamId={teamId}
          department={department}
          onClose={() => setSourceView(null)}
        />
      ) : null}

      {rulesOpen ? (
        <ViniActionItemsRules
          taxonomy={taxonomy}
          taxonomyLoaded={taxonomyLoaded}
          department={department}
          onSave={onSaveIntentSla}
          onClose={() => setRulesOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default ViniActionItems;
export { EmptyPanel, CARD, intentLabel };
