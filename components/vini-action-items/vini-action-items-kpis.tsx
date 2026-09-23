'use client';

/**
 * The KPI row: Past SLA now, Unassigned, Repeat callers, Cleared today.
 *
 * Decision rows 20, 21, 11 and 22. Every tile is also a one-click filter on
 * the queue, which is how it behaves in production today (features rows 1-4).
 *
 * The numbers come from the metrics endpoint, NOT from counting the rows this
 * page happens to have loaded. The row endpoint returns one page of open items,
 * so counting them would under-report a rooftop with a real backlog. When the
 * metrics endpoint cannot answer, the tile locks. It never falls back to a
 * count of what is on screen, and it never shows zero.
 */
import React from 'react';
import {
  PiArrowsClockwiseBold,
  PiCheckCircleBold,
  PiUserBold,
  PiWarningBold,
} from 'react-icons/pi';

import { ViniMetricsState } from '@/hooks/use-vini-action-items';

import { cx } from './vini-action-items-atoms';
import {
  VINI_METRICS_WINDOW_CAVEAT,
  ViniActionItemMetricKey,
  ViniServiceMetric,
  formatCount,
  metricIsLive,
} from './vini-action-items-data';
import {
  LockedTile,
  METRICS_FAILED_REASON,
  METRICS_UNAVAILABLE_REASON,
} from './vini-action-items-locked';

export interface ViniKpiFilterState {
  pastSlaOnly: boolean;
  unassignedOnly: boolean;
  repeatOnly: boolean;
}

interface TileSpec {
  key: ViniActionItemMetricKey;
  label: string;
  caption: string;
  icon: React.ReactNode;
  /** Whether this tile toggles a queue filter, and which one. */
  filter?: keyof ViniKpiFilterState;
  /** Cleared today jumps to the Resolved tab instead of filtering. */
  jumpToResolved?: boolean;
  tone: 'danger' | 'warning' | 'primary' | 'success';
}

/** Row 18 openNow is the live-state backlog; row 19 pastSla is a subset of it. */
const TILES: TileSpec[] = [
  {
    key: 'pastSla',
    label: 'Past SLA now',
    caption: 'live',
    icon: <PiWarningBold size={13} />,
    filter: 'pastSlaOnly',
    tone: 'danger',
  },
  {
    key: 'unassigned',
    label: 'Unassigned',
    caption: 'no owner yet',
    icon: <PiUserBold size={13} />,
    filter: 'unassignedOnly',
    tone: 'warning',
  },
  {
    key: 'repeatCallers',
    label: 'Repeat callers',
    caption: 'about to call again',
    icon: <PiArrowsClockwiseBold size={13} />,
    filter: 'repeatOnly',
    tone: 'primary',
  },
  {
    key: 'cleared',
    label: 'Cleared today',
    caption: 'resolved in the window',
    icon: <PiCheckCircleBold size={13} />,
    jumpToResolved: true,
    tone: 'success',
  },
];

const TONE_TEXT: Record<TileSpec['tone'], string> = {
  danger: 'text-[#475467]',
  warning: 'text-[#b54708]',
  primary: 'text-[#5b21e6]',
  success: 'text-[#0f6e4f]',
};

const TONE_RING: Record<TileSpec['tone'], string> = {
  danger: 'ring-2 ring-[#98a2b3]',
  warning: 'ring-2 ring-[#b54708]',
  primary: 'ring-2 ring-[#5b21e6]',
  success: 'ring-2 ring-[#0f6e4f]',
};

const LiveTile: React.FC<{
  spec: TileSpec;
  metric: ViniServiceMetric;
  active: boolean;
  onClick?: () => void;
}> = ({ spec, metric, active, onClick }) => {
  // The definition travels with the number, so a tooltip cannot drift from it.
  const title = [
    metric.definition,
    metric.anchor ? `Anchored on ${metric.anchor}.` : null,
    metric.caveat,
    spec.key === 'pastSla' ? VINI_METRICS_WINDOW_CAVEAT : null,
    active ? 'Filtering by this. Click to clear.' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <p className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-[#98a2b3]">
        {spec.icon}
        {spec.label}
      </p>
      <p
        className={cx(
          'mt-1 text-[26px] font-bold tabular-nums leading-none',
          TONE_TEXT[spec.tone]
        )}
      >
        {formatCount(metric.value as number)}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-[#98a2b3]">
        {spec.caption}
      </p>
    </>
  );

  if (!onClick) {
    return (
      <div
        title={title}
        className="flex min-w-0 flex-col justify-center rounded-2xl border border-[#eceef2] bg-white px-4 py-3"
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={spec.filter ? active : undefined}
      title={title}
      className={cx(
        'flex min-w-0 flex-col justify-center rounded-2xl border border-[#eceef2] bg-white px-4 py-3 text-left transition-colors hover:border-[#d0d5dd]',
        active && TONE_RING[spec.tone]
      )}
    >
      {content}
    </button>
  );
};

const ViniActionItemsKpis: React.FC<{
  metrics: ViniMetricsState;
  filters: ViniKpiFilterState;
  onToggleFilter: (key: keyof ViniKpiFilterState) => void;
  onJumpToResolved: () => void;
}> = ({ metrics, filters, onToggleFilter, onJumpToResolved }) => {
  if (metrics.kind === 'loading') {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((spec) => (
          <div
            key={spec.key}
            className="h-[76px] animate-pulse rounded-2xl bg-[#eceef2]"
          />
        ))}
      </div>
    );
  }

  // Not deployed here, or the call failed. Either way the tiles lock, so the
  // page never puts a zero where a real backlog might be.
  if (metrics.kind !== 'ready') {
    const reason =
      metrics.kind === 'unavailable'
        ? METRICS_UNAVAILABLE_REASON
        : METRICS_FAILED_REASON;
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((spec) => (
          <LockedTile
            key={spec.key}
            label={spec.label}
            reason={reason}
            caption={spec.caption}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((spec) => {
        const metric = metrics.data.metrics[spec.key];

        // The endpoint's own "never a silent zero" contract: a row it could
        // not compute comes back available:false with its reason attached.
        if (!metricIsLive(metric)) {
          return (
            <LockedTile
              key={spec.key}
              label={spec.label}
              reason={
                metric?.locked?.reason ??
                metric?.definition ??
                METRICS_FAILED_REASON
              }
              caption={spec.caption}
            />
          );
        }

        const active = spec.filter ? filters[spec.filter] : false;
        return (
          <LiveTile
            key={spec.key}
            spec={spec}
            metric={metric as ViniServiceMetric}
            active={active}
            onClick={
              spec.jumpToResolved
                ? onJumpToResolved
                : spec.filter
                  ? () =>
                      onToggleFilter(spec.filter as keyof ViniKpiFilterState)
                  : undefined
            }
          />
        );
      })}
    </div>
  );
};

export default ViniActionItemsKpis;
