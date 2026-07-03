"use client"

/**
 * CreateActionItemModal — a centered, portalled "Create action item" form for
 * the Action Items console. Mints a valid ActionItem and hands it back via
 * onCreate, then closes. Mirrors the polished sales-console kit: brand-only CTA,
 * paired semantics, 11px uppercase labels, tabular-nums metrics, and the
 * shared MaterialSymbol (which drops `style`, so glyph color rides on a wrapper
 * <span>). No clock/random reads during render — the only timestamp is minted
 * inside the submit handler, where a Date() call is fine.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MaterialSymbol } from '@/components/max-2/material-symbol'
import { INTENT_TAXONOMY, DEPT_BADGE, CHANNEL_META, CUSTOMERS, USERS } from './data'

const DEPT_LABEL = { sales: 'Sales', service: 'Service', both: 'Sales + Service', compliance: 'Compliance' }

// Intent ids in a stable display order — the index seeds the (deterministic) id.
const INTENT_IDS = Object.keys(INTENT_TAXONOMY)

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'lead'

const FIELD_LABEL =
  'mb-1 block text-[11px] font-semibold uppercase tracking-wide'

function FieldLabel({ children }) {
  return (
    <span className={FIELD_LABEL} style={{ color: 'var(--spyne-text-muted)' }}>
      {children}
    </span>
  )
}

const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

/**
 * CustomerCombobox — search existing customers by name/phone OR create a new one,
 * in a single field. Picking an existing customer or "create new" sets a chip;
 * the × re-opens the search. Replaces the old plain <select> + separate new-name input.
 */
function CustomerCombobox({ customers, customerId, newName, onPickExisting, onPickNew, onClear }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const isNew = customerId === '__new__'
  const selected = customerId && !isNew ? customers[customerId] : null

  // Selected state → a chip with a clear (×) to re-search.
  if (selected || isNew) {
    const name = isNew ? newName : selected?.name
    return (
      <div className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2" style={{ borderColor: 'var(--spyne-border)', background: 'var(--spyne-surface)' }}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' }}>
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--spyne-text-primary)' }}>{name}</p>
          <p className="truncate text-[11px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>{isNew ? 'New customer' : selected?.phone}</p>
        </div>
        <button type="button" onClick={() => { onClear(); setQuery(''); setOpen(false) }} aria-label="Change customer" className="spyne-focus-ring inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-spyne-page" style={{ color: 'var(--spyne-text-muted)' }}>
          <MaterialSymbol name="close" size={14} />
        </button>
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const entries = Object.entries(customers)
  const matches = q
    ? entries.filter(([, c]) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(query.trim()))
    : entries
  const exactMatch = entries.some(([, c]) => c.name.toLowerCase() === q)

  return (
    <div ref={wrapRef} className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 inline-flex" style={{ color: 'var(--spyne-text-muted)' }}>
        <MaterialSymbol name="search" size={16} />
      </span>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search by name or phone…"
        className="spyne-input spyne-focus-ring w-full"
        style={{ fontSize: 13, paddingLeft: 34 }}
        autoFocus
      />
      {open && (
        <div className="spyne-float absolute left-0 right-0 z-30 mt-1 max-h-[256px] overflow-auto rounded-lg" style={{ background: 'var(--spyne-surface)' }}>
          {matches.length > 0 ? (
            matches.slice(0, 8).map(([id, c]) => (
              <button key={id} type="button" onClick={() => { onPickExisting(id); setQuery(''); setOpen(false) }} className="spyne-focus-ring flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-spyne-page">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' }}>{initials(c.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium" style={{ color: 'var(--spyne-text-primary)' }}>{c.name}</span>
                  <span className="block truncate text-[11px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>{c.phone}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-[12px]" style={{ color: 'var(--spyne-text-muted)' }}>No matching customers.</p>
          )}
          {q && !exactMatch && (
            <button type="button" onClick={() => { onPickNew(query.trim()); setOpen(false) }} className="spyne-focus-ring flex w-full items-center gap-2 border-t border-spyne-border px-3 py-2.5 text-left transition-colors hover:bg-spyne-page" style={{ color: 'var(--spyne-primary)' }}>
              <MaterialSymbol name="person_add" size={15} />
              <span className="text-[12.5px] font-semibold">Create “{query.trim()}” as a new customer</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function CreateActionItemModal({
  onCreate,
  onClose,
  customers = CUSTOMERS,
  users = USERS,
}) {
  // Customer can be an existing id, or a free-typed new name.
  const [customerId, setCustomerId] = useState('')
  const [newName, setNewName] = useState('')
  const [intentId, setIntentId] = useState('')
  const [channel, setChannel] = useState('call')
  const [recap, setRecap] = useState('')
  const [source, setSource] = useState('')
  const [assignee, setAssignee] = useState('')

  const isNewCustomer = customerId === '__new__'
  const haveCustomer = isNewCustomer ? newName.trim().length > 0 : customerId.length > 0
  const canSubmit = recap.trim().length > 0 && !!intentId && haveCustomer

  // Assignees: every real rep (Vini AI never gets hand-assigned work here).
  const assignableUsers = useMemo(
    () => Object.entries(users).filter(([id]) => id !== 'vini_agent'),
    [users]
  )

  const intentMeta = intentId ? INTENT_TAXONOMY[intentId] : null

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    if (!canSubmit) return

    // Resolve / mint the customer id.
    let resolvedCustomerId = customerId
    if (isNewCustomer) {
      resolvedCustomerId = `c-${slugify(newName)}`
    }

    // Deterministic, collision-tolerant id — an FNV-1a char-fold over the FULL
    // recap + intent + customer + channel, so distinct items get distinct ids
    // even when recaps share a length. NO Math.random / NO clock. (Per the brief.)
    const fnv1a = (str) => {
      let h = 0x811c9dc5
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
      }
      // Fold to an unsigned, base-36 token for a compact, stable id.
      return (h >>> 0).toString(36)
    }
    const actionItemId = `ai-m${fnv1a(
      `${recap.trim()}|${intentId}|${resolvedCustomerId}|${channel}`
    )}`

    // The ONE timestamp — minted in the handler (event time), never at render.
    const createdAt = new Date().toISOString()

    const item = {
      action_item_id: actionItemId,
      customer_id: resolvedCustomerId,
      // For a brand-new customer, carry the typed display name so the console +
      // sidebar render the real name (its minted c-<slug> id is not in CUSTOMERS).
      // For an existing customer, omit the field entirely.
      ...(isNewCustomer ? { customer_name: newName.trim() } : {}),
      source_channel: channel,
      intent_id: intentId,
      is_primary_intent_of_source: true,
      intent_recap: recap.trim(),
      source_message: source.trim() || recap.trim(),
      created_at: createdAt,
      created_by_ai: false,
      status: 'pending',
      assignee_user_id: assignee || undefined,
      repeat_caller_count: 0,
      last_observed_at: createdAt,
    }

    onCreate(item)
    onClose()
  }

  if (typeof document === 'undefined') return null

  const modal = (
    <div className="console-v2-sales-root max2-spyne">
      {/* Scrim */}
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 z-[200]"
        style={{ background: 'rgba(15,23,42,0.55)' }}
      />

      {/* Centered card */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create action item"
          onClick={(e) => e.stopPropagation()}
          className="spyne-float spyne-animate-scale-in flex max-h-[92vh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl"
          style={{ background: 'var(--spyne-surface)' }}
        >
          {/* Header */}
          <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-spyne-border px-5 py-4">
            <div className="flex items-start gap-2.5">
              <span
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' }}
              >
                <MaterialSymbol name="add_task" size={16} />
              </span>
              <div>
                <h2 className="text-[15px] font-bold" style={{ color: 'var(--spyne-text-primary)' }}>
                  Create action item
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="spyne-focus-ring inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-spyne-page"
              style={{ color: 'var(--spyne-text-muted)' }}
            >
              <MaterialSymbol name="close" size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {/* Customer */}
            <div>
              <FieldLabel>Customer</FieldLabel>
              <CustomerCombobox
                customers={customers}
                customerId={customerId}
                newName={newName}
                onPickExisting={(id) => { setCustomerId(id); setNewName('') }}
                onPickNew={(name) => { setCustomerId('__new__'); setNewName(name) }}
                onClear={() => { setCustomerId(''); setNewName('') }}
              />
            </div>

            {/* Intent */}
            <div>
              <FieldLabel>Intent</FieldLabel>
              <select
                value={intentId}
                onChange={(e) => setIntentId(e.target.value)}
                className="spyne-input spyne-focus-ring w-full cursor-pointer"
                style={{ fontSize: 13 }}
              >
                <option value="" disabled>
                  Select intent
                </option>
                {INTENT_IDS.map((id) => (
                  <option key={id} value={id}>
                    {INTENT_TAXONOMY[id].display_name}
                  </option>
                ))}
              </select>
              {intentMeta && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`spyne-badge ${DEPT_BADGE[intentMeta.dept]}`} style={{ fontSize: 10 }}>
                    {DEPT_LABEL[intentMeta.dept] ?? intentMeta.dept}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums"
                    style={{ background: 'var(--spyne-page-bg)', color: 'var(--spyne-text-secondary)' }}
                  >
                    <span className="inline-flex" style={{ color: 'var(--spyne-text-muted)' }}>
                      <MaterialSymbol name="schedule" size={11} />
                    </span>
                    SLA {intentMeta.sla_hours}h
                  </span>
                </div>
              )}
            </div>

            {/* Channel — segmented icon buttons (faster than a dropdown for a fixed set) */}
            <div>
              <FieldLabel>Channel</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CHANNEL_META).map(([id, c]) => {
                  const active = channel === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setChannel(id)}
                      aria-pressed={active}
                      className="spyne-focus-ring inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors"
                      style={active
                        ? { borderColor: 'var(--spyne-primary)', background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' }
                        : { borderColor: 'var(--spyne-border)', color: 'var(--spyne-text-secondary)' }}
                    >
                      <MaterialSymbol name={c.symbol} size={14} /> {c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Recap (required) */}
            <div>
              <FieldLabel>What needs doing</FieldLabel>
              <textarea
                value={recap}
                onChange={(e) => setRecap(e.target.value)}
                placeholder="e.g. Call the customer back with a lease quote on the 2025 C 300."
                rows={2}
                className="spyne-input spyne-focus-ring w-full resize-y"
                style={{ height: 'auto', minHeight: 60, padding: '8px 12px', fontSize: 13, lineHeight: 1.5 }}
              />
            </div>

            {/* Source message (optional) */}
            <div>
              <FieldLabel>Source message · optional</FieldLabel>
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="The customer's own words, if you have them."
                rows={2}
                className="spyne-input spyne-focus-ring w-full resize-y"
                style={{ height: 'auto', minHeight: 56, padding: '8px 12px', fontSize: 13, lineHeight: 1.5 }}
              />
            </div>

            {/* Assignee (optional) */}
            <div>
              <FieldLabel>Assignee · optional</FieldLabel>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="spyne-input spyne-focus-ring w-full cursor-pointer"
                style={{ fontSize: 13 }}
              >
                <option value="">Unassigned</option>
                {assignableUsers.map(([id, u]) => (
                  <option key={id} value={id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-spyne-border px-5 py-3.5">
            <button onClick={onClose} className="spyne-btn-secondary !h-9 !text-[12.5px]">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="spyne-btn-primary !h-9 !text-[12.5px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MaterialSymbol name="add" size={14} /> Create action item
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
