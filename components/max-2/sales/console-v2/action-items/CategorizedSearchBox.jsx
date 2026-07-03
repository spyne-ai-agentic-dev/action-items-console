"use client"

/**
 * CategorizedSearchBox — a search input with a categorized results dropdown.
 * As the user types, matches are grouped under three labeled sections
 * (Customers · Intents · Action items). Each row is independently clickable
 * and fires the matching pick callback. Matched substrings are highlighted.
 *
 * Props:
 *   items           ActionItem[]          — source list to search action items
 *   value           string                — controlled query string
 *   onChange        (next: string)        — query changed (typing / clear)
 *   onPickCustomer  (customer_id: string)
 *   onPickIntent    (intent_id: string)
 *   onPickItem      (action_item_id: string)
 *   placeholder?    string
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { MaterialSymbol } from '@/components/max-2/material-symbol'
import { cn } from '@/lib/utils'
import {
  INTENT_TAXONOMY, DEPT_BADGE, CUSTOMERS,
} from './data'

const GROUP_LIMIT = 5

/* Highlight the matched substring (case-insensitive) with a soft-primary mark. */
function Highlight({ text, query }) {
  const t = text ?? ''
  const q = (query ?? '').trim()
  if (!q) return <>{t}</>
  const idx = t.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return <>{t}</>
  const before = t.slice(0, idx)
  const hit = t.slice(idx, idx + q.length)
  const after = t.slice(idx + q.length)
  return (
    <>
      {before}
      <mark
        className="rounded-[3px] px-0.5"
        style={{ background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' }}
      >
        {hit}
      </mark>
      {after}
    </>
  )
}

function IntentBadge({ intentId, highlightQuery }) {
  const intent = INTENT_TAXONOMY[intentId]
  if (!intent) return <span className="spyne-badge spyne-badge-neutral" style={{ fontSize: 10 }}>{intentId}</span>
  return (
    <span className={cn('spyne-badge', DEPT_BADGE[intent.dept])} style={{ fontSize: 10 }}>
      {highlightQuery != null
        ? <Highlight text={intent.display_name} query={highlightQuery} />
        : intent.display_name}
    </span>
  )
}

function GroupHeader({ children }) {
  return (
    <div
      className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: 'var(--spyne-text-muted)' }}
    >
      {children}
    </div>
  )
}

function ResultRow({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="spyne-focus-ring flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--spyne-primary-soft)]"
    >
      {children}
    </button>
  )
}

function MoreCaption({ n }) {
  return (
    <div className="px-2.5 pb-1.5 pt-0.5 text-[10.5px] font-medium" style={{ color: 'var(--spyne-text-muted)' }}>
      +<span className="tabular-nums">{n}</span> more
    </div>
  )
}

export default function CategorizedSearchBox({
  items = [],
  value = '',
  onChange,
  onPickCustomer,
  onPickIntent,
  onPickItem,
  placeholder = 'Search the queue',
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const q = value.trim().toLowerCase()
  const hasQuery = q.length > 0

  /* ── Build the grouped, capped match sets ──────────────────────────── */
  const groups = useMemo(() => {
    if (!hasQuery) return { customers: [], intents: [], items: [] }

    const customers = Object.entries(CUSTOMERS)
      .filter(([, c]) => c.name.toLowerCase().includes(q))
      .map(([id, c]) => ({ id, ...c }))

    const intents = Object.values(INTENT_TAXONOMY)
      .filter((i) => i.display_name.toLowerCase().includes(q))

    const matchedItems = (items ?? []).filter((it) => {
      const recap = (it.intent_recap ?? '').toLowerCase()
      const id = (it.action_item_id ?? '').toLowerCase()
      return recap.includes(q) || id.includes(q)
    })

    return { customers, intents, items: matchedItems }
  }, [q, hasQuery, items])

  const totalMatches = groups.customers.length + groups.intents.length + groups.items.length
  const showDropdown = open && hasQuery

  /* ── Close on outside-click + Escape ───────────────────────────────── */
  useEffect(() => {
    if (!showDropdown) return
    function onMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showDropdown])

  const pick = (fn, arg) => {
    fn?.(arg)
    setOpen(false)
  }

  const custShown = groups.customers.slice(0, GROUP_LIMIT)
  const intentShown = groups.intents.slice(0, GROUP_LIMIT)
  const itemShown = groups.items.slice(0, GROUP_LIMIT)

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Input */}
      <span
        className="pointer-events-none absolute top-1/2 inline-flex -translate-y-1/2"
        style={{ left: 10, color: 'var(--spyne-primary)' }}
      >
        <MaterialSymbol name="search" size={16} />
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange?.(e.target.value); setOpen(true) }}
        onFocus={() => { if (hasQuery) setOpen(true) }}
        className="spyne-input spyne-focus-ring w-full"
        style={{ paddingLeft: 32, paddingRight: value ? 32 : 12, fontSize: 12 }}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => { onChange?.(''); setOpen(false) }}
          className="spyne-focus-ring absolute top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-spyne-page"
          style={{ right: 4, color: 'var(--spyne-text-muted)' }}
        >
          <MaterialSymbol name="close" size={16} />
        </button>
      )}

      {/* Categorized dropdown */}
      {showDropdown && (
        <div
          className="spyne-float absolute left-0 right-0 z-30 mt-1 max-h-[360px] overflow-auto rounded-xl py-1"
          style={{ background: 'var(--spyne-surface)' }}
        >
          {totalMatches === 0 && (
            <div className="px-2.5 py-3 text-[12px]" style={{ color: 'var(--spyne-text-muted)' }}>
              No matches
            </div>
          )}

          {/* Customers */}
          {custShown.length > 0 && (
            <div>
              <GroupHeader>Customers</GroupHeader>
              {custShown.map((c) => (
                <ResultRow key={c.id} onClick={() => pick(onPickCustomer, c.id)}>
                  <span className="inline-flex" style={{ color: 'var(--spyne-primary)' }}>
                    <MaterialSymbol name="person" size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" style={{ color: 'var(--spyne-text-primary)' }}>
                    <Highlight text={c.name} query={value} />
                  </span>
                  <span className="tabular-nums text-[11px]" style={{ color: 'var(--spyne-text-muted)' }}>{c.phone}</span>
                </ResultRow>
              ))}
              {groups.customers.length > GROUP_LIMIT && <MoreCaption n={groups.customers.length - GROUP_LIMIT} />}
            </div>
          )}

          {/* Intents */}
          {intentShown.length > 0 && (
            <div>
              <GroupHeader>Intents</GroupHeader>
              {intentShown.map((i) => (
                <ResultRow key={i.id} onClick={() => pick(onPickIntent, i.id)}>
                  <IntentBadge intentId={i.id} highlightQuery={value} />
                  <span className="text-[11px] capitalize" style={{ color: 'var(--spyne-text-muted)' }}>{i.dept}</span>
                </ResultRow>
              ))}
              {groups.intents.length > GROUP_LIMIT && <MoreCaption n={groups.intents.length - GROUP_LIMIT} />}
            </div>
          )}

          {/* Action items */}
          {itemShown.length > 0 && (
            <div>
              <GroupHeader>Action items</GroupHeader>
              {itemShown.map((it) => {
                const cust = CUSTOMERS[it.customer_id]
                return (
                  <ResultRow key={it.action_item_id} onClick={() => pick(onPickItem, it.action_item_id)}>
                    <IntentBadge intentId={it.intent_id} />
                    <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--spyne-text-secondary)' }}>
                      <Highlight text={it.intent_recap} query={value} />
                    </span>
                    {cust && (
                      <span className="shrink-0 text-[11px] font-medium" style={{ color: 'var(--spyne-text-muted)' }}>{cust.name}</span>
                    )}
                  </ResultRow>
                )
              })}
              {groups.items.length > GROUP_LIMIT && <MoreCaption n={groups.items.length - GROUP_LIMIT} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
