"use client"

/**
 * CustomerSidebar — a right-side drawer that gives a quick, focused read on a
 * single customer's action items without leaving the queue. Portaled to
 * document.body so its fixed scrim + panel are viewport-relative (ancestor
 * transforms would otherwise create a containing block). Surfaces a stat row
 * (open / resolved / repeat-caller count), the customer's OPEN items as compact
 * rows, a "Recent resolved" mini-list, and a link to the full profile.
 *
 * Props: { customerId, items, onClose, onViewProfile? }
 *   - items = ALL action items; we filter this customer's items locally.
 */

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { MaterialSymbol } from '@/components/max-2/material-symbol'
import { cn } from '@/lib/utils'
import { StatTile, SectionLabel, EmptyState } from '../shared'
import {
  INTENT_TAXONOMY, DEPT_BADGE, CHANNEL_META, CUSTOMERS, USERS,
  ageLabel, ageMinutes, isPastSla, slaBurnRatio,
} from './data'

/* ── Small inline atoms (kept local so the drawer stays self-contained) ── */

function IntentBadge({ intentId }) {
  const intent = INTENT_TAXONOMY[intentId]
  if (!intent) return <span className="spyne-badge spyne-badge-neutral" style={{ fontSize: 10 }}>{intentId}</span>
  return <span className={cn('spyne-badge', DEPT_BADGE[intent.dept])} style={{ fontSize: 10 }}>{intent.display_name}</span>
}

function PastSlaPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: 'var(--spyne-danger-subtle)', color: 'var(--spyne-danger-text)' }}>
      <MaterialSymbol name="warning" size={14} /> Past SLA
    </span>
  )
}

function Assignee({ userId }) {
  if (!userId) {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: 'var(--spyne-warning-ink)' }}>
        <span style={{ color: 'var(--spyne-warning-ink)' }}><MaterialSymbol name="mark_email_unread" size={14} /></span> Unassigned
      </span>
    )
  }
  const u = USERS[userId]
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--spyne-text-muted)' }}>
      <MaterialSymbol name="person" size={14} /> {u?.name ?? userId}
    </span>
  )
}

/* ── Drawer ──────────────────────────────────────────────────────── */

export default function CustomerSidebar({ customerId, items, onClose, onViewProfile }) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Mount-driven slide-in: render at translateX(100%), then flip to 0 on the
  // next frame so the transition runs. Scrim fades in the same way.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // New customers minted as c-<slug> ids aren't in the CUSTOMERS map, so prefer
  // the typed display name carried on the item. (items is already this customer.)
  const cust = {
    name: items?.find((i) => i.customer_name)?.customer_name ?? CUSTOMERS[customerId]?.name ?? humanize(customerId),
    phone: CUSTOMERS[customerId]?.phone ?? '',
  }

  const { open, resolved, repeatCount } = useMemo(() => {
    const mine = (items ?? []).filter((i) => i.customer_id === customerId)
    const open = mine
      .filter((i) => i.status === 'pending')
      .sort((a, b) => slaBurnRatio(b) - slaBurnRatio(a))
    const resolved = mine
      .filter((i) => i.status === 'completed')
      .sort((a, b) => new Date(b.closed_at ?? b.created_at).getTime() - new Date(a.closed_at ?? a.created_at).getTime())
    // Highest repeat-caller count we've observed for this customer.
    const repeatCount = mine.reduce((m, i) => Math.max(m, i.repeat_caller_count ?? 0), 0)
    return { open, resolved, repeatCount }
  }, [items, customerId])

  if (typeof document === 'undefined') return null

  const recentResolved = resolved.slice(0, 4)

  const drawer = (
    <div className="console-v2-sales-root max2-spyne">
      {/* Scrim — fades in so the overlay doesn't pop. */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.45)',
          zIndex: 199,
          opacity: shown ? 1 : 0,
          transition: 'opacity 220ms var(--spyne-ease-out)',
        }}
      />

      {/* Panel — slides in horizontally from the right edge. */}
      <div
        className="spyne-float fixed right-0 top-0 h-full w-[420px] max-w-[92vw]"
        style={{
          background: 'var(--spyne-surface)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          transform: shown ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 260ms var(--spyne-ease-out)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`${cust.name} — action items`}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-spyne-border px-4 py-3.5">
          <span
            className="inline-flex size-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
            style={{ background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' }}
          >
            {initials(cust.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-bold leading-tight" style={{ color: 'var(--spyne-text-primary)' }}>
              {cust.name}
            </h2>
            {cust.phone && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>
                <MaterialSymbol name="call" size={14} /> {cust.phone}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="spyne-focus-ring inline-flex size-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-spyne-page"
            style={{ color: 'var(--spyne-text-muted)' }}
          >
            <MaterialSymbol name="close" size={20} />
          </button>
        </div>

        {/* Stat row */}
        <div className="grid flex-shrink-0 grid-cols-3 gap-2 px-4 py-3">
          <StatTile glyph="pending_actions" value={open.length} label="Open items" tone={open.some(isPastSla) ? 'danger' : 'default'} />
          <StatTile glyph="task_alt" value={resolved.length} label="Resolved" tone="success" />
          <StatTile glyph="autorenew" value={repeatCount} label="Repeat calls" tone={repeatCount >= 3 ? 'brand' : 'default'} />
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          {/* Open items */}
          <div className="flex flex-col gap-2">
            <SectionLabel glyph="bolt" text="Open items" />
            {open.length === 0 ? (
              <div className="spyne-card p-0">
                <EmptyState glyph="task_alt" title="Nothing open" />
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {open.map((it) => {
                  const past = isPastSla(it)
                  const ch = CHANNEL_META[it.source_channel] ?? { label: 'Unknown', symbol: 'chat' }
                  const sla = INTENT_TAXONOMY[it.intent_id]?.sla_hours
                  return (
                    <li
                      key={it.action_item_id}
                      className="spyne-card p-2.5"
                      style={{ borderLeft: `3px solid ${past ? 'var(--spyne-danger-text)' : 'transparent'}` }}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <IntentBadge intentId={it.intent_id} />
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: 'var(--spyne-page-bg)', color: 'var(--spyne-text-secondary)' }}
                          title={ch.label}
                        >
                          <MaterialSymbol name={ch.symbol} size={14} /> {ch.label}
                        </span>
                        <span className="ml-auto shrink-0">
                          {past ? (
                            <PastSlaPill />
                          ) : (
                            <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>{ageLabel(ageMinutes(it))}</span>
                          )}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-snug" style={{ color: 'var(--spyne-text-primary)' }}>{it.intent_recap}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Assignee userId={it.assignee_user_id} />
                        {sla != null && (
                          <span className="ml-auto text-[10px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>SLA {sla}h</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Recent resolved */}
          {recentResolved.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel glyph="history" text="Recent resolved" />
              <ul className="flex flex-col gap-1.5">
                {recentResolved.map((it) => (
                  <li
                    key={it.action_item_id}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                    style={{ background: 'var(--spyne-page-bg)' }}
                  >
                    <span className="inline-flex flex-shrink-0" style={{ color: 'var(--spyne-success-text)' }}>
                      <MaterialSymbol name="check_circle" size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: 'var(--spyne-text-secondary)' }}>
                      {it.resolution_note ?? it.intent_recap}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>
                      {ageLabel(ageMinutes({ ...it, created_at: it.closed_at ?? it.created_at }))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-spyne-border px-4 py-3">
          {onViewProfile ? (
            <button
              onClick={() => onViewProfile(customerId)}
              className="spyne-btn-secondary !h-9 w-full justify-center !text-[12.5px]"
            >
              View full customer profile <MaterialSymbol name="arrow_forward" size={14} />
            </button>
          ) : (
            <a
              href="/max-2/sales/customers"
              className="spyne-btn-secondary !h-9 w-full justify-center !text-[12.5px]"
              style={{ textDecoration: 'none' }}
            >
              View full customer profile <MaterialSymbol name="arrow_forward" size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(drawer, document.body)
}

/* Fallback display name for minted c-<slug> ids not in the CUSTOMERS map:
   strip a leading "c-", turn dashes into spaces, and title-case. */
function humanize(id) {
  return String(id ?? '')
    .replace(/^c-/, '')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

/* Derive up-to-two-letter initials from a display name. */
function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
