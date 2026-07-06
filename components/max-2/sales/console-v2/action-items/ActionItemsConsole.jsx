"use client"

/**
 * Action Items — master/detail console (matches the vini-product reference).
 * LEFT: action items grouped by Customer / Intent / Assignee (or a flat None
 * view), sorted by SLA burn (breaching first). RIGHT: the matching open items
 * stacked in a list — each with what-needs-doing, the source message, assignee,
 * an activity trail, and Resolve / Assign / Incorrect. Manager vs My-queue
 * scope + a manager SLA strip on top. Categorized search, an intent filter, a
 * group-by control, typed resolution, clickable resolved rows, a customer
 * sidebar drawer, a create-item modal, and a read-only rules panel.
 */

import { useEffect, useMemo, useState } from 'react'
import { MaterialSymbol } from '@/components/max-2/material-symbol'
import { max2Classes, spyneSalesLayout } from '@/lib/design-system/max-2'
import { cn } from '@/lib/utils'
import { EmptyState, SectionLabel, SpyneSwitch } from '../shared'
import CategorizedSearchBox from './CategorizedSearchBox'
import CreateActionItemModal from './CreateActionItemModal'
import CustomerSidebar from './CustomerSidebar'
import CallConversationDrawer from './CallConversationDrawer'
import { fetchUsers, assignActionItem, resolveActionItems, markIncorrectActionItems, fetchLiveTaxonomy, upsertDealerIntentConfig } from './be-client'
import {
  ACTION_ITEMS, INTENT_TAXONOMY, DEPT_BADGE, DEPT_LABEL, CHANNEL_META, CUSTOMERS, USERS,
  CURRENT_USER_ID,
  RESOLUTION_TYPES, RESOLUTION_TYPE_LABEL, RESOLUTION_TYPE_GLYPH,
  ageLabel, ageMinutes, isPastSla, slaBurnRatio, deptOf,
  formatCreatedAt, formatSla, createdDayKey, mergeLiveIntents,
} from './data'

// Snapshot of the predefined per-intent SLA hours (captured before any in-session edit),
// so the Rules panel can offer "Reset SLAs". Edits mutate INTENT_TAXONOMY in memory only
// (session-local, not persisted — resets on reload).
const SLA_DEFAULTS = Object.fromEntries(Object.values(INTENT_TAXONOMY).map((i) => [i.id, i.sla_hours]))

// SLA editing in minutes / hours / days — the stored unit stays `sla_hours` (may be fractional).
const SLA_UNIT_HOURS = { m: 1 / 60, h: 1, d: 24 }
const SLA_UNITS = [['m', 'Min'], ['h', 'Hr'], ['d', 'Day']]
const round2 = (n) => Math.round(n * 100) / 100
// Express sla_hours as the most natural {value, unit} for editing (<1h → minutes, exact days → days).
function splitSla(hours) {
  if (hours < 1) return { value: Math.round(hours * 60), unit: 'm' }
  if (hours >= 24 && hours % 24 === 0) return { value: hours / 24, unit: 'd' }
  return { value: round2(hours), unit: 'h' }
}

const INCORRECT_REASONS = [
  { value: 'wrong_intent', label: 'Wrong intent' },
  { value: 'not_a_task', label: 'Not a task' },
  { value: 'customer_did_not_say_this', label: "Customer didn't say this" },
  { value: 'duplicate_of_existing', label: 'Duplicate of existing' },
  { value: 'other', label: 'Other' },
]

const GROUP_BY = [
  ['customer', 'Customer', 'person'],
  ['intent', 'Intent', 'sell'],
  ['assignee', 'Assignee', 'badge'],
  ['none', 'None', 'list'],
]

/** Channels that auto-create action items (rules-panel demo seed). */
const CHANNEL_AUTOCREATE_DEFAULTS = {
  call: true, sms: true, chat: true, email: true, hitl_takeover: false, hitl_warm_transfer: false,
}

/** Turn a minted "c-<slug>" id into a readable display name. */
function humanize(id) {
  if (!id) return ''
  return String(id)
    .replace(/^c-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Resolve a display name that tolerates freshly-minted (off-map) customer ids.
 * Prefers the item's typed customer_name (manually-created items carry one since
 * their c-<slug> id is not in the CUSTOMERS map), then the CUSTOMERS map, then a
 * humanized fallback so a raw slug never reaches the UI.
 */
function customerName(customerId, item) {
  return item?.customer_name ?? CUSTOMERS[customerId]?.name ?? humanize(customerId)
}

/** @param {{ readOnly?: boolean, initialItems?: any[], initialDept?: string, initialUserId?: string, initialUserEmail?: string }} props */
export function ActionItemsConsole({ readOnly = false, initialItems, initialDept = 'all', initialUserId = '', initialUserEmail = '' }) {
  // initialItems (from the GET-only embed) overrides the bundled mock data when provided.
  const [items, setItems] = useState(initialItems ?? ACTION_ITEMS)
  // Acting BDC identity — passed by the host (iframe URL) or picked via the "Acting as" selector.
  // Whoever resolves a ticket is recorded (resolvedBy) AND becomes the assignee (id + email).
  const [actingUserId, setActingUserId] = useState(initialUserId || '')
  const [scope, setScope] = useState('manager') // 'manager' | 'mine'
  const [tab, setTab] = useState('unresolved')
  const [filters, setFilters] = useState({ search: '', assignment: 'all', channel: 'all', dept: initialDept || 'all', intent: 'all', sla: 'all', repeat: false, created: 'all' })
  // Apply a metric-tile / quick-chip filter and snap back to the Unresolved tab so the
  // filtered queue is actually visible (metrics are global KPIs; the click filters the list).
  const applyQuickFilter = (patch) => { setFilters((f) => ({ ...f, ...patch })); setTab('unresolved'); setResolvedDetailId(null) }
  const [groupBy, setGroupBy] = useState('customer')
  const [selectedGroup, setSelectedGroup] = useState(null)  // group key (customer/intent/assignee) the user picked
  const [selectedItemId, setSelectedItemId] = useState(null) // single action_item_id (None view + search highlight)
  const [expanded, setExpanded] = useState({})
  const [incorrectFor, setIncorrectFor] = useState(null)   // action_item_id awaiting reason
  const [assigningFor, setAssigningFor] = useState(null)   // action_item_id awaiting assignee
  const [resolvingFor, setResolvingFor] = useState(null)   // action_item_id awaiting resolution type
  const [highlightId, setHighlightId] = useState(null)     // action_item_id pulsed after a search pick
  const [sidebarCustomer, setSidebarCustomer] = useState(null)
  const [sourceView, setSourceView] = useState(null) // { item, mode: 'call'|'conversation' } | null
  const [createOpen, setCreateOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [resolvedDetailId, setResolvedDetailId] = useState(null) // open resolved/incorrect item in detail
  const [toast, setToast] = useState(null)
  // Bumped when a per-intent SLA is edited in the Rules panel → recompute burn/sort/past-SLA.
  const [slaVersion, setSlaVersion] = useState(0)

  const [users, setUsers] = useState([]) // live assignable users (embed scope)
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600) }

  // The acting BDC resolved to { id, name, email } from the live user list (+ host-passed email).
  const actingUser = useMemo(() => {
    if (!actingUserId) return null
    const u = users.find((x) => x.id === actingUserId)
    return { id: actingUserId, name: u?.name || USERS[actingUserId]?.name || actingUserId, email: u?.email || initialUserEmail || '' }
  }, [actingUserId, users, initialUserEmail])

  // Live mode: load assignable users for the scope; merge into USERS for name/initials display.
  useEffect(() => {
    if (!initialItems) return
    let cancelled = false
    fetchUsers()
      .then((us) => { if (cancelled || !us.length) return; setUsers(us); us.forEach((u) => { USERS[u.id] = { name: u.name, initials: u.initials } }) })
      .catch(() => {})
    // Merge the live intent catalog (labels/SLA/dept) into INTENT_TAXONOMY, then re-render.
    fetchLiveTaxonomy()
      .then((tax) => { if (!cancelled && tax && Object.keys(tax).length) { mergeLiveIntents(tax); setSlaVersion((v) => v + 1) } })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect the fetched data: whenever the embed hands us a NEW array (scope change or reload),
  // reset the board to it. The reference is stable between loads, so local optimistic edits
  // (resolve/assign/incorrect) made between fetches are never clobbered.
  useEffect(() => {
    setItems(initialItems ?? ACTION_ITEMS)
  }, [initialItems])

  const pending = useMemo(() => items.filter((i) => i.status === 'pending'), [items])
  // Resolved + Incorrect honour the Manager/Mine scope just like Unresolved:
  // in 'mine' scope, restrict to the current user's items so the tab COUNTS and
  // LISTS stay consistent across all three tabs.
  const inScope = (i) => scope !== 'mine' || i.assignee_user_id === CURRENT_USER_ID
  const resolved = useMemo(() => items.filter((i) => i.status === 'completed' && inScope(i)), [items, scope])
  const incorrect = useMemo(() => items.filter((i) => i.status === 'incorrect' && inScope(i)), [items, scope])

  // Department-scoped sets for the TOP-BAR metrics + tab totals: pending/resolved restricted to the
  // active department (intent→dept) and Manager/Mine scope, but NOT the drill-down filters — so the
  // bar shows e.g. Sales 57 / Service 43 (not the 100-item total), while clicking a tile narrows the list.
  const inDept = (i) => filters.dept === 'all' || deptOf(i) === filters.dept
  const deptPending = useMemo(() => pending.filter((i) => inScope(i) && inDept(i)), [pending, filters.dept, scope, slaVersion])
  const deptResolved = useMemo(() => resolved.filter(inDept), [resolved, filters.dept, slaVersion])
  const deptIncorrect = useMemo(() => incorrect.filter(inDept), [incorrect, filters.dept, slaVersion])

  const filteredPending = useMemo(() => pending.filter((i) => {
    if (scope === 'mine' && i.assignee_user_id !== CURRENT_USER_ID) return false
    if (filters.assignment === 'unassigned' && i.assignee_user_id) return false
    if (filters.assignment === 'assigned' && !i.assignee_user_id) return false
    if (filters.channel !== 'all' && i.source_channel !== filters.channel) return false
    if (filters.dept !== 'all' && deptOf(i) !== filters.dept) return false
    if (filters.intent !== 'all' && i.intent_id !== filters.intent) return false
    if (filters.sla === 'past' && !isPastSla(i)) return false
    if (filters.sla === 'atrisk' && (isPastSla(i) || slaBurnRatio(i) < 0.75)) return false
    if (filters.repeat && i.repeat_caller_count < 3) return false
    if (filters.created !== 'all' && createdDayKey(i) !== filters.created) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const name = customerName(i.customer_id, i).toLowerCase()
      if (!i.intent_recap.toLowerCase().includes(q) && !name.includes(q) && !i.action_item_id.includes(q)) return false
    }
    return true
  }), [pending, filters, scope, slaVersion])

  // Flat, SLA-burn-sorted list (used by the None view + as the source for groups).
  const flatSorted = useMemo(
    () => [...filteredPending].sort((a, b) => slaBurnRatio(b) - slaBurnRatio(a)),
    [filteredPending, slaVersion]
  )

  // Group the filtered list by the active groupBy key, sorting groups by worst SLA burn.
  const groups = useMemo(() => {
    if (groupBy === 'none') return []
    const keyOf = (it) =>
      groupBy === 'intent' ? it.intent_id
      : groupBy === 'assignee' ? (it.assignee_user_id ?? '__unassigned__')
      : it.customer_id
    const map = new Map()
    for (const it of filteredPending) {
      const k = keyOf(it)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(it)
    }
    const arr = [...map.entries()]
      .filter(([, its]) => its.length > 0)
      .map(([key, its]) => ({ key, items: [...its].sort((a, b) => slaBurnRatio(b) - slaBurnRatio(a)) }))
    const maxBurn = (its) => (its.length ? Math.max(...its.map(slaBurnRatio)) : -1)
    arr.sort((a, b) => maxBurn(b.items) - maxBurn(a.items))
    return arr
  }, [filteredPending, groupBy, slaVersion])

  // Top-bar metrics reflect the active DEPARTMENT only (deptPending/deptResolved), not the 100-item total.
  const metrics = useMemo(() => ({
    breaching: deptPending.filter(isPastSla).length,
    unassigned: deptPending.filter((i) => !i.assignee_user_id).length,
    repeatCallers: new Set(deptPending.filter((i) => i.repeat_caller_count >= 3).map((i) => i.customer_id)).size,
    clearedToday: deptResolved.filter((i) => i.closed_at && createdDayKey({ ...i, created_at: i.closed_at }) === 'today').length,
  }), [deptPending, deptResolved, slaVersion])

  // ── Selection resolution ──────────────────────────────────────────
  // None view → a single item; grouped views → a group's worth of items.
  const isFlat = groupBy === 'none'
  const activeGroupKey = isFlat ? null : (selectedGroup ?? groups[0]?.key ?? null)

  const activeItems = useMemo(() => {
    if (isFlat) {
      const one = flatSorted.find((i) => i.action_item_id === selectedItemId)
      return one ? [one] : (flatSorted[0] ? [flatSorted[0]] : [])
    }
    if (selectedItemId) {
      const one = filteredPending.find((i) => i.action_item_id === selectedItemId)
      if (one) return [one]
    }
    const g = groups.find((x) => x.key === activeGroupKey)
    return g ? g.items : []
  }, [isFlat, flatSorted, selectedItemId, filteredPending, groups, activeGroupKey])

  // The customer the right pane is about (header + resolve-all + sidebar link).
  const activeCustomerId = activeItems[0]?.customer_id ?? null

  // ── Mutations ─────────────────────────────────────────────────────
  // Live mode → also fire the real backend write (PUT mark-resolved / mark-incorrect) best-effort;
  // optimistic local update first, honest toast if the backend write isn't reachable.
  const isLive = initialItems != null
  const resolveTyped = async (id, resolutionType, note) => {
    const closedAt = new Date().toISOString()
    const it = items.find((i) => i.action_item_id === id)
    // Resolver becomes the assignee (id + email via the user record).
    setItems((p) => p.map((i) => (i.action_item_id === id
      ? { ...i, status: 'completed', resolution_type: resolutionType, resolution_note: note?.trim() || undefined, closed_at: closedAt, assignee_user_id: actingUser?.id ?? i.assignee_user_id }
      : i)))
    setResolvingFor(null)
    flash(actingUser ? `Resolved — assigned to ${actingUser.name}` : 'Resolved — moved to Resolved')
    if (isLive) {
      const ok = await resolveActionItems(id, resolutionType, note, actingUser?.id) // resolvedBy = acting BDC
      const leadId = it?.lead_id || it?.customer_id
      if (actingUser && leadId) await assignActionItem(leadId, actingUser.id) // store resolver as assignee
      if (!ok) flash('Saved in view — backend resolve not reachable yet')
    }
  }
  // Scope resolve-all to the currently-VISIBLE (filtered) items so the action
  // matches its "Resolve all {filtered count}" label — never silently resolving
  // pending items the user can't see under the active filters.
  const resolveAll = async (visibleItems) => {
    const pend = (visibleItems ?? []).filter((i) => i.status === 'pending')
    const ids = [...new Set(pend.map((i) => i.action_item_id))]
    if (ids.length === 0) return
    const closedAt = new Date().toISOString()
    setItems((p) => p.map((i) => (ids.includes(i.action_item_id) && i.status === 'pending'
      ? { ...i, status: 'completed', resolution_type: i.resolution_type ?? 'info_provided', closed_at: closedAt, assignee_user_id: actingUser?.id ?? i.assignee_user_id }
      : i)))
    flash('All items resolved'); setResolvingFor(null); setIncorrectFor(null)
    if (isLive) {
      const ok = await resolveActionItems(ids, 'info_provided', 'Bulk resolved from console', actingUser?.id)
      if (actingUser) for (const it of pend) { const leadId = it.lead_id || it.customer_id; if (leadId) await assignActionItem(leadId, actingUser.id) }
      if (!ok) flash('Saved in view — backend resolve not reachable yet')
    }
  }
  const markIncorrect = async (id, reason, correctedIntentId) => {
    const orig = items.find((i) => i.action_item_id === id)?.intent_id
    const correctName = correctedIntentId ? (INTENT_TAXONOMY[correctedIntentId]?.display_name || correctedIntentId) : null
    setItems((p) => p.map((i) => (i.action_item_id === id ? {
      ...i,
      status: 'incorrect',
      incorrect_reason: reason,
      // Reclassify: the intent tag becomes the CORRECT intent; keep the original for the record.
      ...(correctedIntentId ? { original_intent_id: i.intent_id, intent_id: correctedIntentId, corrected_intent_id: correctedIntentId } : {}),
    } : i)))
    setIncorrectFor(null)
    flash(correctName ? `Reclassified to ${correctName} + flagged` : 'Marked incorrect — excluded from closure rate')
    // The corrected intent rides in `note` — the BE mark-incorrect DTO rejects a dedicated field.
    const note = correctName ? `Reclassified from ${INTENT_TAXONOMY[orig]?.display_name || orig || 'unknown'} → ${correctName} (${correctedIntentId})` : undefined
    if (isLive && !(await markIncorrectActionItems(id, reason, note, actingUser?.id))) flash('Saved in view — backend flag not reachable yet')
  }
  const undoIncorrect = (id) => { setItems((p) => p.map((i) => (i.action_item_id === id ? { ...i, status: 'pending', incorrect_reason: undefined, corrected_intent_id: undefined, ...(i.original_intent_id ? { intent_id: i.original_intent_id, original_intent_id: undefined } : {}) } : i))); flash('Restored to Unresolved') }
  const assign = async (id, userId) => {
    const it = items.find((i) => i.action_item_id === id)
    const leadId = it?.lead_id || it?.customer_id
    const uname = users.find((u) => u.id === userId)?.name ?? USERS[userId]?.name ?? 'rep'
    setAssigningFor(null)
    if (leadId) {
      const ok = await assignActionItem(leadId, userId) // real PATCH direct to backend
      if (!ok) { flash('Could not assign — try again'); return }
    }
    setItems((p) => p.map((i) => (i.action_item_id === id ? { ...i, assignee_user_id: userId } : i)))
    flash(`Assigned to ${uname}`)
  }

  // ── Search-pick wiring ────────────────────────────────────────────
  // If a picked target would be hidden by an active intent/channel/dept/assignment
  // filter, clear only the conflicting filter(s) so the target becomes visible —
  // instead of silently snapping the selection to groups[0].
  const clearFiltersHiding = (it) => {
    if (!it) return
    setFilters((f) => {
      const next = { ...f }
      if (f.intent !== 'all' && it.intent_id !== f.intent) next.intent = 'all'
      if (f.channel !== 'all' && it.source_channel !== f.channel) next.channel = 'all'
      if (f.dept !== 'all' && deptOf(it) !== f.dept) next.dept = 'all'
      if (f.assignment === 'assigned' && !it.assignee_user_id) next.assignment = 'all'
      if (f.assignment === 'unassigned' && it.assignee_user_id) next.assignment = 'all'
      return next
    })
  }
  const focusCustomer = (customerId) => {
    const rep = items.find((i) => i.customer_id === customerId && i.status === 'pending') ?? items.find((i) => i.customer_id === customerId)
    clearFiltersHiding(rep)
    if (groupBy === 'customer') { setSelectedGroup(customerId); setSelectedItemId(null) }
    else if (groupBy === 'none') { const first = flatSorted.find((i) => i.customer_id === customerId) ?? rep; setSelectedItemId(first?.action_item_id ?? null) }
    else { setGroupBy('customer'); setSelectedGroup(customerId); setSelectedItemId(null) }
  }
  const pickItem = (actionItemId) => {
    const it = items.find((i) => i.action_item_id === actionItemId)
    if (!it) return
    clearFiltersHiding(it)
    if (groupBy === 'none') setSelectedItemId(actionItemId)
    else {
      const k = groupBy === 'intent' ? it.intent_id : groupBy === 'assignee' ? (it.assignee_user_id ?? '__unassigned__') : it.customer_id
      setSelectedGroup(k); setSelectedItemId(actionItemId)
    }
    setHighlightId(actionItemId)
    setTimeout(() => setHighlightId(null), 2000)
  }

  // After resolving, if the active selection emptied out, advance to the next group/item.
  useEffect(() => {
    if (tab !== 'unresolved') return
    if (activeItems.length === 0) {
      if (isFlat) { const next = flatSorted[0]?.action_item_id ?? null; if (next !== selectedItemId) setSelectedItemId(next) }
      else { const next = groups[0]?.key ?? null; if (next !== selectedGroup) { setSelectedGroup(next); setSelectedItemId(null) } }
    }
  }, [activeItems.length, isFlat, flatSorted, groups, selectedItemId, selectedGroup, tab])

  const resetSelection = () => { setSelectedGroup(null); setSelectedItemId(null) }

  return (
    <div className={cn(spyneSalesLayout.pageStack, 'min-h-0 flex-1 [&>*+*]:!mt-3')}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={max2Classes.pageTitle}>Action items</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Acting BDC — recorded as resolver + assignee when resolving. Host may pass it via URL. */}
          {(users.length > 0 || actingUser) && (
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--spyne-text-muted)' }} title="Who is resolving — recorded as the resolver and stored as the assignee (id + email)">
              <MaterialSymbol name="badge" size={14} /> Acting as
              <select value={actingUserId} onChange={(e) => setActingUserId(e.target.value)} className="spyne-input spyne-focus-ring cursor-pointer" style={{ fontSize: 12, height: 32, paddingRight: 22, maxWidth: 150 }}>
                <option value="">Select you…</option>
                {(users.length ? users : Object.entries(USERS).filter(([id]) => id !== 'vini_agent').map(([id, u]) => ({ id, name: u.name }))).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
          )}
          <button onClick={() => setRulesOpen(true)} className="spyne-btn-ghost !h-9 !text-[12.5px]" title="Action-item rules & routing">
            <MaterialSymbol name="settings" size={16} /> Rules
          </button>
          {!readOnly && (
            <button onClick={() => setCreateOpen(true)} className="spyne-btn-primary !h-9 !text-[12.5px]">
              <MaterialSymbol name="add_task" size={16} /> Create action item
            </button>
          )}
          <div className="inline-flex rounded-lg border border-spyne-border bg-spyne-surface p-0.5">
            {[['manager', 'Manager', 'groups'], ['mine', 'My queue', 'person']].map(([id, label, icon]) => (
              <button key={id} onClick={() => { setScope(id); resetSelection() }} className={cn('spyne-focus-ring inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors', scope === id ? 'bg-spyne-primary text-white' : 'text-spyne-text-secondary hover:text-spyne-text-primary')}>
                <MaterialSymbol name={icon} size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SLA banner — the hero answer + one-click metric filters */}
      <SlaHero
        metrics={metrics}
        filters={filters}
        onApply={applyQuickFilter}
        onClearedToday={() => { setTab('resolved'); setResolvedDetailId(null) }}
      />

      {/* Tabs — self-contained horizontal nav (underline + spacing) */}
      <div role="tablist" className="flex items-center gap-1" style={{ borderBottom: '1px solid var(--spyne-border)' }}>
        {[['unresolved', 'Unresolved', filteredPending.length], ['resolved', 'Resolved', deptResolved.length], ['incorrect', 'Incorrect', deptIncorrect.length]].map(([id, label, n]) => {
          const active = tab === id
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => { setTab(id); setResolvedDetailId(null) }}
              className="spyne-focus-ring -mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors"
              style={active ? { borderColor: 'var(--spyne-primary)', color: 'var(--spyne-primary)' } : { borderColor: 'transparent', color: 'var(--spyne-text-muted)' }}
            >
              {label}
              <span className="rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums" style={active ? { background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' } : { background: 'var(--spyne-page-bg)', color: 'var(--spyne-text-muted)' }}>{n}</span>
            </button>
          )
        })}
      </div>

      {tab === 'resolved' ? (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1"><ResolvedList items={deptResolved} openId={resolvedDetailId} onOpen={setResolvedDetailId} onOpenSidebar={setSidebarCustomer} onOpenSource={(it, m) => setSourceView({ item: it, mode: m })} /></div>
      ) : tab === 'incorrect' ? (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1"><IncorrectList items={deptIncorrect} onUndo={undoIncorrect} onOpenSidebar={setSidebarCustomer} onOpenSource={(it, m) => setSourceView({ item: it, mode: m })} /></div>
      ) : (
        <>
          {/* Filters */}
          <FilterBar
            filters={filters}
            onChange={setFilters}
            items={items}
            groupBy={groupBy}
            onGroupBy={(g) => { setGroupBy(g); resetSelection() }}
            onPickCustomer={focusCustomer}
            onPickIntent={(intentId) => setFilters((f) => ({ ...f, intent: intentId }))}
            onPickItem={pickItem}
          />

          {/* Master / detail */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
            {/* LEFT list */}
            <div className="flex min-h-0 flex-col gap-2.5 lg:w-[380px] lg:shrink-0">
              <SectionLabel
                glyph="reorder"
                text="Queue"
                hint={`${isFlat ? flatSorted.length : groups.length} ${isFlat ? (flatSorted.length === 1 ? 'item' : 'items') : (groups.length === 1 ? 'group' : 'groups')} · worst SLA first`}
              />
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {(isFlat ? flatSorted.length === 0 : groups.length === 0) ? (
                <div className="spyne-card">
                  <EmptyState glyph="filter_alt_off" title="No items match these filters" helper="Try clearing a filter or widening your search." />
                </div>
              ) : isFlat ? (
                flatSorted.map((it) => (
                  <FlatItemRow
                    key={it.action_item_id}
                    item={it}
                    active={selectedItemId ? selectedItemId === it.action_item_id : flatSorted[0]?.action_item_id === it.action_item_id}
                    highlight={highlightId === it.action_item_id}
                    onSelect={() => { setSelectedItemId(it.action_item_id) }}
                    onOpenSidebar={() => setSidebarCustomer(it.customer_id)}
                  />
                ))
              ) : (
                groups.map((g) => (
                  <GroupRow
                    key={g.key}
                    groupBy={groupBy}
                    group={g}
                    active={activeGroupKey === g.key}
                    expanded={!!expanded[g.key]}
                    onSelect={() => { setSelectedGroup(g.key); setSelectedItemId(null) }}
                    onToggle={() => setExpanded((m) => ({ ...m, [g.key]: !m[g.key] }))}
                    onResolveAll={() => resolveAll(g.items)}
                    readOnly={readOnly}
                    onOpenSidebar={(cid) => setSidebarCustomer(cid)}
                  />
                ))
              )}
              </div>
            </div>

            {/* RIGHT detail */}
            <div className="flex min-h-0 flex-1 flex-col gap-2.5">
              <SectionLabel glyph="task_alt" text="Open items" hint="resolve · assign · flag" />
              <div className="spyne-card flex min-h-0 flex-1 flex-col p-0">
              {activeItems.length === 0 ? (
                <EmptyState
                  glyph="task_alt"
                  title={`Select ${isFlat ? 'an item' : 'a group'}`}
                  helper="Pick from the queue to see its open items and resolve them here."
                  className="flex-1"
                />
              ) : (
                <RightPane
                  customerId={activeCustomerId}
                  items={activeItems}
                  groupBy={groupBy}
                  groupKey={activeGroupKey}
                  isSingle={isFlat || !!selectedItemId}
                  incorrectFor={incorrectFor}
                  assigningFor={assigningFor}
                  resolvingFor={resolvingFor}
                  highlightId={highlightId}
                  onResolve={resolveTyped}
                  onAskResolve={setResolvingFor}
                  onCancelResolve={() => setResolvingFor(null)}
                  onResolveAll={() => resolveAll(activeItems)}
                  onAskIncorrect={setIncorrectFor}
                  onMarkIncorrect={markIncorrect}
                  onAskAssign={setAssigningFor}
                  onAssign={assign}
                  users={users}
                  canAssign
                  canResolve
                  readOnly={readOnly}
                  onOpenSource={(it, m) => setSourceView({ item: it, mode: m })}
                  onOpenSidebar={setSidebarCustomer}
                />
              )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="spyne-animate-slide-up fixed left-1/2 bottom-6 z-[200] flex -translate-x-1/2 items-center gap-1.5 rounded-lg px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-lg" style={{ background: 'var(--spyne-text-primary)' }}>
          <MaterialSymbol name="check_circle" size={14} /> {toast}
        </div>
      )}

      {/* Floating layers */}
      {sidebarCustomer && (
        <CustomerSidebar customerId={sidebarCustomer} items={items} onClose={() => setSidebarCustomer(null)} />
      )}
      {sourceView && (
        <CallConversationDrawer item={sourceView.item} mode={sourceView.mode} onClose={() => setSourceView(null)} />
      )}
      {createOpen && !readOnly && (
        <CreateActionItemModal onCreate={(item) => { setItems((p) => [item, ...p]); flash('Action item created'); }} onClose={() => setCreateOpen(false)} />
      )}
      {rulesOpen && <RulesPanel onClose={() => setRulesOpen(false)} onEditSla={() => setSlaVersion((v) => v + 1)}
        onPersistSla={isLive ? (async (code, minutes, dept) => {
          const ok = await upsertDealerIntentConfig({ intentCode: code, serviceType: dept === 'sales' ? 'sales' : 'service', customSlaMinutes: minutes, updatedBy: actingUser?.id || 'console' })
          flash(ok ? `SLA saved (${minutes}m)` : 'SLA saved in view — backend not reachable')
          return ok
        }) : null} />}
    </div>
  )
}

/* ── SLA hero ────────────────────────────────────────────────────── */
/* The page's single most important answer: how many items are past SLA.
   Big tabular number anchors the left; secondary queue stats are demoted to a
   quiet, divider-separated rail on the right so the eye lands on the hero first. */

function SlaHero({ metrics, filters, onApply, onClearedToday }) {
  const breaching = metrics.breaching > 0
  const pastActive = filters?.sla === 'past'
  const heroTone = breaching ? 'var(--spyne-danger-text)' : 'var(--spyne-success-text)'
  return (
    <div
      className="spyne-animate-fade-in flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-5 py-2.5"
      style={{
        background: breaching ? 'var(--spyne-danger-subtle)' : 'var(--spyne-success-subtle)',
        border: `1px solid ${breaching ? 'var(--spyne-danger-muted)' : 'var(--spyne-success-muted)'}`,
      }}
    >
      {/* Hero number — click to filter the queue to past-SLA items (tier 1 + tier 3 eyebrow) */}
      <button
        type="button"
        onClick={() => onApply?.({ sla: pastActive ? 'all' : 'past' })}
        aria-pressed={pastActive}
        title={pastActive ? 'Filtering to past-SLA items — click to clear' : 'Filter to past-SLA items'}
        className="spyne-focus-ring -mx-2 -my-1 flex items-center gap-4 rounded-xl px-2 py-1 text-left transition-colors hover:bg-white/50"
        style={pastActive ? { boxShadow: `inset 0 0 0 2px ${heroTone}`, background: 'rgba(255,255,255,0.55)' } : undefined}
      >
        <span
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: breaching ? 'var(--spyne-danger-subtle)' : 'var(--spyne-success-subtle)',
            color: heroTone,
            boxShadow: `inset 0 0 0 1px ${breaching ? 'var(--spyne-danger-muted)' : 'var(--spyne-success-muted)'}`,
          }}
        >
          <MaterialSymbol name={breaching ? 'warning' : 'task_alt'} size={24} />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>
            Past SLA now {pastActive && <span style={{ color: heroTone }}>· filtering</span>}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-bold leading-none tabular-nums" style={{ color: heroTone }}>{metrics.breaching}</span>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--spyne-text-secondary)' }}>{breaching ? (metrics.breaching === 1 ? 'item breaching' : 'items breaching') : 'all clear'}</span>
          </div>
        </div>
      </button>

      {/* Secondary queue stats — demoted, divider-separated rail; each is a one-click filter */}
      <div className="ml-auto flex items-stretch gap-3">
        <HeroStat n={metrics.unassigned} label="Unassigned" icon="person_off" tone="var(--spyne-warning-ink)" active={filters?.assignment === 'unassigned'} onClick={() => onApply?.({ assignment: filters?.assignment === 'unassigned' ? 'all' : 'unassigned' })} />
        <span className="w-px self-stretch" style={{ background: 'var(--spyne-border)' }} />
        <HeroStat n={metrics.repeatCallers} label="Repeat callers" icon="autorenew" tone="var(--spyne-primary)" active={!!filters?.repeat} onClick={() => onApply?.({ repeat: !filters?.repeat })} />
        <span className="w-px self-stretch" style={{ background: 'var(--spyne-border)' }} />
        <HeroStat n={metrics.clearedToday} label="Cleared today" icon="task_alt" tone="var(--spyne-success-text)" onClick={onClearedToday} />
      </div>
    </div>
  )
}

function HeroStat({ n, label, tone, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active ?? undefined}
      title={active ? `Filtering by ${label} — click to clear` : `Filter by ${label}`}
      className="spyne-focus-ring flex flex-col justify-center rounded-lg px-2.5 py-1 transition-colors hover:bg-white/50"
      style={active ? { boxShadow: `inset 0 0 0 2px ${tone}`, background: 'rgba(255,255,255,0.55)' } : undefined}
    >
      <span className="text-[22px] font-bold leading-none tabular-nums" style={{ color: tone }}>{n}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>
        <MaterialSymbol name={icon} size={12} /> {label}
      </span>
    </button>
  )
}

/* ── Filters ─────────────────────────────────────────────────────── */

function FilterBar({ filters, onChange, items, groupBy, onGroupBy, onPickCustomer, onPickIntent, onPickItem }) {
  const set = (patch) => onChange({ ...filters, ...patch })
  // BDC triage chips — one-click filters for the queues reps live in.
  const chips = [
    { key: 'past', label: 'Past SLA', icon: 'warning', active: filters.sla === 'past', on: () => set({ sla: filters.sla === 'past' ? 'all' : 'past' }) },
    { key: 'atrisk', label: 'At risk', icon: 'hourglass_bottom', active: filters.sla === 'atrisk', on: () => set({ sla: filters.sla === 'atrisk' ? 'all' : 'atrisk' }) },
    { key: 'unassigned', label: 'Unassigned', icon: 'person_off', active: filters.assignment === 'unassigned', on: () => set({ assignment: filters.assignment === 'unassigned' ? 'all' : 'unassigned' }) },
    { key: 'repeat', label: 'Repeat callers', icon: 'autorenew', active: !!filters.repeat, on: () => set({ repeat: !filters.repeat }) },
    { key: 'today', label: 'Created today', icon: 'today', active: filters.created === 'today', on: () => set({ created: filters.created === 'today' ? 'all' : 'today' }) },
    { key: 'yesterday', label: 'Created yesterday', icon: 'event', active: filters.created === 'yesterday', on: () => set({ created: filters.created === 'yesterday' ? 'all' : 'yesterday' }) },
    { key: 'callbacks', label: 'Callbacks', icon: 'phone_callback', active: filters.intent === 'callback_request', on: () => set({ intent: filters.intent === 'callback_request' ? 'all' : 'callback_request' }) },
  ]
  // `dept` is a top-level scope (set in the embed header), not a quick filter — leave it out
  // of the in-strip active/clear logic so clearing filters never desyncs from the top scope.
  const anyActive = filters.search || filters.assignment !== 'all' || filters.channel !== 'all' || filters.intent !== 'all' || filters.sla !== 'all' || filters.repeat || filters.created !== 'all'
  const clearAll = () => onChange({ ...filters, search: '', assignment: 'all', channel: 'all', intent: 'all', sla: 'all', repeat: false, created: 'all' })
  return (
    <div className="spyne-card flex flex-col gap-2.5 px-3 py-2.5">
      <div className="min-w-[220px]">
        <CategorizedSearchBox
          items={items.filter((i) => i.status === 'pending')}
          value={filters.search}
          onChange={(next) => onChange({ ...filters, search: next })}
          onPickCustomer={onPickCustomer}
          onPickIntent={onPickIntent}
          onPickItem={onPickItem}
        />
      </div>
      {/* BDC quick filters — one-click triage */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>Quick</span>
        {chips.map((c) => <FilterChip key={c.key} label={c.label} icon={c.icon} active={c.active} on={c.on} />)}
        {anyActive && (
          <button type="button" onClick={clearAll} className="spyne-focus-ring ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-spyne-page-bg" style={{ color: 'var(--spyne-text-muted)' }}>
            <MaterialSymbol name="close" size={13} /> Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select label="Group by" value={groupBy} onChange={onGroupBy} options={GROUP_BY.map(([v, l]) => [v, l])} />
        <span className="hidden h-5 w-px bg-spyne-border sm:inline-block" />
        <Select label="Intent" value={filters.intent} onChange={(v) => onChange({ ...filters, intent: v })} options={[['all', 'All'], ...[...new Set((items || []).map((it) => it.intent_id))].map((id) => [id, INTENT_TAXONOMY[id]?.display_name || id]).sort((a, b) => String(a[1]).localeCompare(String(b[1])))]} />
        <Select label="Assignment" value={filters.assignment} onChange={(v) => onChange({ ...filters, assignment: v })} options={[['all', 'All'], ['assigned', 'Assigned'], ['unassigned', 'Unassigned']]} />
        <Select label="Channel" value={filters.channel} onChange={(v) => onChange({ ...filters, channel: v })} options={[['all', 'All'], ['call', 'Call'], ['sms', 'SMS'], ['chat', 'Chat'], ['email', 'Email']]} />
      </div>
    </div>
  )
}

function FilterChip({ label, icon, active, on }) {
  return (
    <button
      type="button"
      onClick={on}
      aria-pressed={active}
      className="spyne-focus-ring inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors"
      style={active
        ? { background: 'var(--spyne-primary-soft)', borderColor: 'var(--spyne-primary)', color: 'var(--spyne-primary)' }
        : { background: 'var(--spyne-surface)', borderColor: 'var(--spyne-border)', color: 'var(--spyne-text-secondary)' }}
    >
      <MaterialSymbol name={icon} size={14} /> {label}
    </button>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--spyne-text-muted)' }}>
      {label}:
      <select value={value} onChange={(e) => onChange(e.target.value)} className="spyne-input spyne-focus-ring cursor-pointer" style={{ fontSize: 12, height: 32, paddingRight: 22 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

/* ── Shared atoms ────────────────────────────────────────────────── */

function IntentBadge({ intentId }) {
  const intent = INTENT_TAXONOMY[intentId]
  if (!intent) return <span className="spyne-badge spyne-badge-neutral" style={{ fontSize: 10 }}>{intentId}</span>
  return <span className={cn('spyne-badge', DEPT_BADGE[intent.dept])} style={{ fontSize: 10 }}>{intent.display_name}</span>
}

function ChannelChip({ channel }) {
  const ch = CHANNEL_META[channel] ?? { label: 'Unknown', symbol: 'chat' }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--spyne-page-bg)', color: 'var(--spyne-text-secondary)' }} title={ch.label}>
      <MaterialSymbol name={ch.symbol} size={14} /> {ch.label}
    </span>
  )
}

function PastSlaPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: 'var(--spyne-danger-subtle)', color: 'var(--spyne-danger-text)' }}>
      <MaterialSymbol name="warning" size={14} /> Past SLA
    </span>
  )
}

function ResolutionBadge({ type }) {
  if (!type) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: 'var(--spyne-success-subtle)', color: 'var(--spyne-success-text)' }}>
      <MaterialSymbol name={RESOLUTION_TYPE_GLYPH[type] ?? 'check_circle'} size={14} /> {RESOLUTION_TYPE_LABEL[type] ?? type}
    </span>
  )
}

function Assignee({ userId }) {
  if (!userId) return <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: 'var(--spyne-warning-ink)' }}><MaterialSymbol name="mark_email_unread" size={14} /> Unassigned</span>
  const u = USERS[userId]
  return <span className="inline-flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--spyne-text-muted)' }}><MaterialSymbol name="person" size={14} /> {u?.name ?? userId}</span>
}

/** Customer name as an open-in-sidebar button (row-select stays separate via stopPropagation). */
function CustomerNameButton({ customerId, item, onOpen, size = 13 }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(customerId) }}
      className="spyne-focus-ring group inline-flex max-w-full items-center gap-1 truncate rounded text-left font-bold transition-colors"
      style={{ fontSize: size, color: 'var(--spyne-text-primary)' }}
      title="Open customer panel"
    >
      <span className="truncate">{customerName(customerId, item)}</span>
      <span className="inline-flex shrink-0 opacity-50 transition-opacity group-hover:opacity-100" style={{ color: 'var(--spyne-primary)' }}>
        <MaterialSymbol name="open_in_new" size={14} />
      </span>
    </button>
  )
}

/* ── Left: grouped row (Customer / Intent / Assignee) ────────────── */

function GroupRow({ groupBy, group, active, expanded, onSelect, onToggle, onResolveAll, onOpenSidebar, readOnly }) {
  const its = group.items
  const multi = its.length > 1
  const worst = its[0]
  const anyPast = its.some(isPastSla)
  const sameCustomer = its.every((i) => i.customer_id === worst.customer_id)

  // Header content depends on grouping mode.
  let header
  if (groupBy === 'intent') {
    const intent = INTENT_TAXONOMY[group.key]
    header = (
      <div className="flex min-w-0 items-center gap-1.5">
        <IntentBadge intentId={group.key} />
        <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide" style={{ background: 'var(--spyne-page-bg)', color: 'var(--spyne-text-secondary)' }}>{intent ? DEPT_LABEL[intent.dept] : '—'}</span>
      </div>
    )
  } else if (groupBy === 'assignee') {
    const u = group.key === '__unassigned__' ? null : USERS[group.key]
    header = u ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="flex size-5 items-center justify-center rounded-full text-[8.5px] font-bold" style={{ background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' }}>{u.initials}</span>
        <span className="truncate text-[13px] font-bold" style={{ color: 'var(--spyne-text-primary)' }}>{u.name}</span>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: 'var(--spyne-warning-ink)' }}><MaterialSymbol name="mark_email_unread" size={16} /> Unassigned</span>
    )
  } else {
    header = <CustomerNameButton customerId={group.key} item={worst} onOpen={onOpenSidebar} />
  }

  return (
    <div className={cn('spyne-card-interactive', active && 'active-action-card')} style={{ borderLeft: `3px solid ${anyPast ? 'var(--spyne-danger-text)' : active ? 'var(--spyne-primary)' : 'transparent'}` }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); onSelect() } }}
        className="spyne-focus-ring flex w-full items-start gap-2.5 rounded-lg p-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {header}
            {multi && <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums" style={{ background: 'var(--spyne-page-bg)', color: 'var(--spyne-text-secondary)' }}>{its.length} items</span>}
            {worst.repeat_caller_count >= 3 && (
              <span title={`Repeat caller — ${worst.repeat_caller_count} contacts`} className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums" style={{ background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' }}>
                <MaterialSymbol name="autorenew" size={14} /> ×{worst.repeat_caller_count}
              </span>
            )}
            <span className="ml-auto shrink-0">{anyPast ? <PastSlaPill /> : <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>{ageLabel(ageMinutes(worst))}</span>}</span>
          </div>
          <p className="mt-1 line-clamp-1 text-[12px] leading-snug" style={{ color: 'var(--spyne-text-secondary)' }}>{worst.intent_recap}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="inline-flex" style={{ color: 'var(--spyne-text-muted)' }}><MaterialSymbol name={CHANNEL_META[worst.source_channel]?.symbol ?? 'chat'} size={14} /></span>
            {groupBy !== 'assignee' && <Assignee userId={worst.assignee_user_id} />}
            {groupBy === 'assignee' && <span className="text-[10.5px]" style={{ color: 'var(--spyne-text-muted)' }}>{customerName(worst.customer_id, worst)}{!sameCustomer ? ' +' : ''}</span>}
            {multi && (
              <button onClick={(e) => { e.stopPropagation(); onToggle() }} className="spyne-focus-ring ml-auto inline-flex items-center gap-0.5 rounded text-[10.5px] font-semibold" style={{ color: 'var(--spyne-primary)' }}>
                {expanded ? 'Hide' : `See all ${its.length}`} <MaterialSymbol name={expanded ? 'expand_less' : 'expand_more'} size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {multi && expanded && (
        <div className="border-t border-spyne-border px-3 py-2">
          <ul className="flex flex-col gap-1.5">
            {its.map((it) => (
              <li key={it.action_item_id} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: 'var(--spyne-page-bg)' }}>
                <IntentBadge intentId={it.intent_id} />
                {isPastSla(it) ? <PastSlaPill /> : <span className="text-[10px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>{ageLabel(ageMinutes(it))}</span>}
                <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: 'var(--spyne-text-secondary)' }}>{it.intent_recap}</span>
              </li>
            ))}
          </ul>
          {!readOnly && sameCustomer && (
            <button onClick={(e) => { e.stopPropagation(); onResolveAll() }} className="spyne-focus-ring mt-2 inline-flex items-center gap-1 rounded text-[11.5px] font-semibold" style={{ color: 'var(--spyne-primary)' }}>
              <MaterialSymbol name="done_all" size={14} /> Resolve all {its.length}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Left: flat item row (None grouping) ─────────────────────────── */

function FlatItemRow({ item, active, highlight, onSelect, onOpenSidebar }) {
  const past = isPastSla(item)
  const sla = INTENT_TAXONOMY[item.intent_id]?.sla_hours
  return (
    <div className={cn('spyne-card-interactive spyne-animate-fade-in', (active || highlight) && 'active-action-card')} style={{ borderLeft: `3px solid ${past ? 'var(--spyne-danger-text)' : (active || highlight) ? 'var(--spyne-primary)' : 'transparent'}` }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); onSelect() } }}
        className="spyne-focus-ring flex w-full flex-col gap-2 rounded-lg p-3.5 text-left"
      >
        <div className="flex items-center gap-1.5">
          <IntentBadge intentId={item.intent_id} />
          <span className="inline-flex" style={{ color: 'var(--spyne-text-muted)' }}><MaterialSymbol name={CHANNEL_META[item.source_channel]?.symbol ?? 'chat'} size={14} /></span>
          <span className="ml-auto shrink-0">{past ? <PastSlaPill /> : <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>{ageLabel(ageMinutes(item))}</span>}</span>
        </div>
        <p className="line-clamp-2 text-[12.5px] leading-snug" style={{ color: 'var(--spyne-text-primary)' }}>{item.intent_recap}</p>
        <div className="flex items-center gap-2">
          <CustomerNameButton customerId={item.customer_id} item={item} onOpen={onOpenSidebar} size={11} />
          <Assignee userId={item.assignee_user_id} />
          {sla != null && <span className="ml-auto text-[10px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>SLA {sla}h</span>}
        </div>
      </div>
    </div>
  )
}

/* ── Right: detail pane ──────────────────────────────────────────── */

function RightPane({ customerId, items, groupBy, groupKey, isSingle, incorrectFor, assigningFor, resolvingFor, highlightId, onResolve, onAskResolve, onCancelResolve, onResolveAll, onAskIncorrect, onMarkIncorrect, onAskAssign, onAssign, onOpenSidebar, onOpenSource, readOnly, users, canAssign, canResolve }) {
  const multi = items.length > 1
  // The pane can be heterogeneous (Intent / Assignee group spans customers).
  const sameCustomer = items.every((i) => i.customer_id === customerId)

  let title
  if (!isSingle && groupBy === 'intent') title = <span className="inline-flex items-center gap-2"><IntentBadge intentId={groupKey} /></span>
  else if (!isSingle && groupBy === 'assignee') {
    const u = groupKey === '__unassigned__' ? null : USERS[groupKey]
    title = <span className="text-[14px] font-bold" style={{ color: 'var(--spyne-text-primary)' }}>{u?.name ?? 'Unassigned'}</span>
  } else {
    title = <CustomerNameButton customerId={customerId} item={items[0]} onOpen={onOpenSidebar} size={15} />
  }

  const subtitle = (!isSingle && (groupBy === 'intent' || groupBy === 'assignee'))
    ? `${items.length} open item${items.length === 1 ? '' : 's'}`
    : `${CUSTOMERS[customerId]?.phone ? CUSTOMERS[customerId].phone + ' · ' : ''}${items.length} open item${items.length === 1 ? '' : 's'}`

  return (
    <>
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-spyne-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">{title}</div>
          <p className="mt-0.5 text-[11px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>{subtitle}</p>
        </div>
        {(canResolve || !readOnly) && multi && sameCustomer && (
          <button onClick={onResolveAll} className="spyne-btn-secondary !h-8 !text-[12px]"><MaterialSymbol name="done_all" size={14} /> Resolve all {items.length}</button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {items.map((it) => (
          <ItemCard
            key={it.action_item_id}
            item={it}
            highlight={highlightId === it.action_item_id}
            showCustomer={!sameCustomer}
            askingIncorrect={incorrectFor === it.action_item_id}
            askingAssign={assigningFor === it.action_item_id}
            askingResolve={resolvingFor === it.action_item_id}
            onOpenSidebar={onOpenSidebar}
            onAskResolve={() => { onAskAssign(null); onAskIncorrect(null); onAskResolve(it.action_item_id) }}
            onCancelResolve={onCancelResolve}
            onResolve={(type, note) => onResolve(it.action_item_id, type, note)}
            onAskIncorrect={() => { onAskAssign(null); onCancelResolve(); onAskIncorrect(it.action_item_id) }}
            onCancelIncorrect={() => onAskIncorrect(null)}
            onMarkIncorrect={(reason, corrected) => onMarkIncorrect(it.action_item_id, reason, corrected)}
            onAskAssign={() => { onAskIncorrect(null); onCancelResolve(); onAskAssign(it.action_item_id) }}
            onCancelAssign={() => onAskAssign(null)}
            onAssign={(userId) => onAssign(it.action_item_id, userId)}
            users={users}
            canAssign={canAssign}
            canResolve={canResolve}
            readOnly={readOnly}
            onOpenSource={onOpenSource}
          />
        ))}
      </div>
    </>
  )
}

/* ── Activity trail (derived from item fields, no clock at render) ── */

function ActivityTrail({ item }) {
  const steps = []
  steps.push({
    glyph: item.created_by_ai ? 'smart_toy' : 'person',
    label: item.created_by_ai ? 'Logged by Vini (AI)' : 'Logged by an agent',
    time: ageLabel(ageMinutes(item)),
  })
  if (item.assignee_user_id) {
    steps.push({ glyph: 'person_add', label: `Assigned to ${USERS[item.assignee_user_id]?.name ?? item.assignee_user_id}`, time: null })
  }
  if (item.status === 'completed') {
    steps.push({
      glyph: RESOLUTION_TYPE_GLYPH[item.resolution_type] ?? 'check_circle',
      label: `Resolved${item.resolution_type ? ` as ${RESOLUTION_TYPE_LABEL[item.resolution_type]}` : ''}`,
      time: item.closed_at ? ageLabel(ageMinutes({ ...item, created_at: item.closed_at })) : null,
      success: true,
    })
  }
  if (item.status === 'incorrect') {
    steps.push({ glyph: 'flag', label: 'Flagged incorrect', time: null })
  }
  return (
    <div className="mt-1">
      <SectionLabel glyph="history" text="Activity" />
      <ol className="mt-1.5 flex flex-col gap-1.5">
        {steps.map((s, idx) => (
          <li key={idx} className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex" style={{ color: s.success ? 'var(--spyne-success-text)' : 'var(--spyne-text-muted)' }}><MaterialSymbol name={s.glyph} size={14} /></span>
            <span style={{ color: 'var(--spyne-text-secondary)' }}>{s.label}</span>
            {s.time && <span className="ml-auto tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>{s.time}</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ── Right: item card ────────────────────────────────────────────── */

/** Listen / Transcript links to open the source drawer — used by the open, resolved & incorrect
 *  detail panes so the source call/conversation is always one click away for reference. */
function SourceLinks({ item, onOpenSource }) {
  if (!onOpenSource) return null
  const hasConv = item.source_conversation_id || item.evidence_turns?.length
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onOpenSource(item, 'call')} disabled={!item.source_call_id} title={item.source_call_id ? 'Open the call' : 'No call linked'} className="spyne-focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold transition-colors hover:bg-spyne-page-bg disabled:cursor-not-allowed disabled:opacity-40" style={{ color: item.source_call_id ? 'var(--spyne-primary)' : 'var(--spyne-text-muted)' }}><MaterialSymbol name="play_circle" size={14} /> Listen</button>
      <button onClick={() => onOpenSource(item, 'conversation')} disabled={!hasConv} title={hasConv ? 'Open the conversation' : 'No conversation linked'} className="spyne-focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold transition-colors hover:bg-spyne-page-bg disabled:cursor-not-allowed disabled:opacity-40" style={{ color: hasConv ? 'var(--spyne-primary)' : 'var(--spyne-text-muted)' }}><MaterialSymbol name="notes" size={14} /> Transcript</button>
    </div>
  )
}

/** Incorrect flow: pick a reason. "Wrong intent" opens a live-catalog picker to set the CORRECT
 *  intent (reclassify) — passed back as the 2nd arg so it's recorded + sent to the backend. */
function IncorrectPicker({ onMark, onCancel }) {
  const [wrongIntent, setWrongIntent] = useState(false)
  const [correct, setCorrect] = useState('')
  const live = Object.values(INTENT_TAXONOMY).filter((i) => i.live)
  const opts = (live.length ? live : Object.values(INTENT_TAXONOMY)).slice().sort((a, b) => a.display_name.localeCompare(b.display_name))
  if (wrongIntent) {
    return (
      <div className="border-t border-spyne-border px-4 py-3">
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>What’s the correct intent?</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={correct} onChange={(e) => setCorrect(e.target.value)} className="spyne-input spyne-focus-ring !h-8 min-w-[200px] text-[12px]">
            <option value="">Select the correct intent…</option>
            {opts.map((i) => <option key={i.id} value={i.id}>{i.display_name}</option>)}
          </select>
          <button disabled={!correct} onClick={() => onMark('wrong_intent', correct)} className="spyne-btn-primary !h-8 !text-[12px] disabled:opacity-40">Reclassify &amp; flag</button>
          <button onClick={() => setWrongIntent(false)} className="spyne-focus-ring ml-auto rounded text-[11px] font-semibold" style={{ color: 'var(--spyne-text-muted)' }}>Back</button>
        </div>
      </div>
    )
  }
  return (
    <div className="border-t border-spyne-border px-4 py-3">
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>Why is this incorrect?</p>
      <div className="flex flex-wrap gap-1.5">
        {INCORRECT_REASONS.map((r) => (
          <button key={r.value} onClick={() => (r.value === 'wrong_intent' ? setWrongIntent(true) : onMark(r.value))} className="spyne-focus-ring rounded-lg border border-spyne-border px-2 py-1 text-[11px] font-medium transition-colors hover:border-spyne-primary" style={{ color: 'var(--spyne-text-secondary)' }}>{r.label}</button>
        ))}
        <button onClick={onCancel} className="spyne-focus-ring ml-auto rounded text-[11px] font-semibold" style={{ color: 'var(--spyne-text-muted)' }}>Cancel</button>
      </div>
    </div>
  )
}

function ItemCard({ item, highlight, showCustomer, askingIncorrect, askingAssign, askingResolve, onOpenSidebar, onAskResolve, onCancelResolve, onResolve, onAskIncorrect, onCancelIncorrect, onMarkIncorrect, onAskAssign, onCancelAssign, onAssign, readOnly, onOpenSource, users, canAssign, canResolve }) {
  const intent = INTENT_TAXONOMY[item.intent_id]
  const past = isPastSla(item)
  return (
    <div className={cn('spyne-card-interactive spyne-animate-fade-in p-0', highlight && 'active-action-card')} style={{ borderLeft: `3px solid ${past ? 'var(--spyne-danger-text)' : highlight ? 'var(--spyne-primary)' : 'transparent'}` }}>
      {/* Top zone: channel (left) · SLA status — the prominent answer (right).
          Intent is NOT repeated here — it's the "What needs doing" headline just below. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pt-3.5">
        <ChannelChip channel={item.source_channel} />
        <span className="ml-auto inline-flex items-center gap-2">
          {past ? (
            <PastSlaPill />
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums" style={{ color: 'var(--spyne-text-secondary)' }}>
              <span className="inline-flex" style={{ color: 'var(--spyne-text-muted)' }}><MaterialSymbol name="schedule" size={14} /></span>
              {ageLabel(ageMinutes(item))} · SLA {intent ? formatSla(intent.sla_hours) : '?'}
            </span>
          )}
        </span>
      </div>

      <div className="px-4 py-3">
        {showCustomer && (
          <div className="mb-2"><CustomerNameButton customerId={item.customer_id} item={item} onOpen={onOpenSidebar} size={12} /></div>
        )}
        {/* Headline — what needs doing (full width, primary) */}
        <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>What needs doing</p>
        <p className="mt-1 text-[15px] font-semibold leading-snug" style={{ color: 'var(--spyne-text-primary)' }}>{item.intent_recap}</p>

        {/* Two-column body: source quote (primary, left) · details + activity rail (right) */}
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Source — the substance, gets the width */}
          <div className="min-w-0 flex-1 border-l-2 pl-3" style={{ borderColor: 'var(--spyne-border)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>Source</span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => onOpenSource?.(item, 'call')} disabled={!item.source_call_id} title={item.source_call_id ? 'Open the call' : 'No call linked'} className="spyne-focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold transition-colors hover:bg-spyne-page-bg disabled:cursor-not-allowed disabled:opacity-40" style={{ color: item.source_call_id ? 'var(--spyne-primary)' : 'var(--spyne-text-muted)' }}><MaterialSymbol name="play_circle" size={14} /> Listen</button>
                {(() => { const hasSrc = item.source_conversation_id || item.evidence_turns?.length; return (
                <button onClick={() => onOpenSource?.(item, 'conversation')} disabled={!hasSrc} title={hasSrc ? 'Open the conversation' : 'No conversation linked'} className="spyne-focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold transition-colors hover:bg-spyne-page-bg disabled:cursor-not-allowed disabled:opacity-40" style={{ color: hasSrc ? 'var(--spyne-primary)' : 'var(--spyne-text-muted)' }}><MaterialSymbol name="notes" size={14} /> Transcript</button>
                ) })()}
              </div>
            </div>
            {(() => {
              const turns = item.evidence_turns || []
              const cust = turns.filter((t) => t.role === 'customer')
              const ai = turns.filter((t) => t.role === 'ai')
              if (!turns.length) return <p className="mt-1.5 rounded-lg px-2.5 py-2 text-[12.5px] italic leading-relaxed" style={{ background: 'var(--spyne-page-bg)', color: 'var(--spyne-text-secondary)' }}>“{item.source_message}”</p>
              return (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {/* Verbatim customer quote(s) — the real trigger, present in the transcript. */}
                  {cust.map((t, i) => (
                    <div key={i} className="rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed" style={{ background: 'var(--spyne-page-bg)', color: 'var(--spyne-text-secondary)' }}>
                      <span className="mr-1.5 align-top text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>Customer</span>{t.text}
                    </div>
                  ))}
                  {/* Vini's rationale — NOT a spoken line; the AI's reason for creating the item. */}
                  {ai.length > 0 && (
                    <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'var(--spyne-primary-soft)' }}>
                      <p className="mb-0.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-primary)' }}><MaterialSymbol name="smart_toy" size={12} /> Why Vini flagged this</p>
                      {ai.map((t, i) => <p key={i} className="text-[12px] italic leading-relaxed" style={{ color: 'var(--spyne-text-secondary)' }}>{t.text}</p>)}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Right rail — details, assignee, activity (fills the width, de-clutters the left) */}
          <div className="flex flex-col gap-3.5 border-t border-spyne-border pt-3 lg:w-[220px] lg:flex-shrink-0 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div>
              <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>Created</p>
              <p className="text-[11px] tabular-nums" style={{ color: 'var(--spyne-text-secondary)' }}>{formatCreatedAt(item.created_at)}</p>
            </div>
            <div>
              <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>Assignee</p>
              <Assignee userId={item.assignee_user_id} />
            </div>
            <ActivityTrail item={item} />
          </div>
        </div>
      </div>

      {/* Actions — Assign/Resolve/Incorrect enabled in the embed via capability flags (the wired writes) */}
      {(!readOnly || canAssign || canResolve) && (askingResolve && (canResolve || !readOnly) ? (
        <ResolvePicker onResolve={onResolve} onCancel={onCancelResolve} />
      ) : askingAssign && canAssign ? (
        <div className="border-t border-spyne-border px-4 py-3">
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>Assign to</p>
          <div className="flex flex-wrap gap-1.5">
            {((users && users.length) ? users : Object.entries(USERS).filter(([id]) => id !== 'vini_agent').map(([id, u]) => ({ id, name: u.name, initials: u.initials }))).map((u) => (
              <button key={u.id} onClick={() => onAssign(u.id)} className="spyne-focus-ring inline-flex items-center gap-1 rounded-lg border border-spyne-border px-2 py-1 text-[11px] font-medium transition-colors hover:border-spyne-primary" style={{ color: 'var(--spyne-text-secondary)' }}>
                <span className="flex size-4 items-center justify-center rounded-full text-[7.5px] font-bold" style={{ background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' }}>{u.initials}</span>
                {u.name}
              </button>
            ))}
            <button onClick={onCancelAssign} className="spyne-focus-ring ml-auto rounded text-[11px] font-semibold" style={{ color: 'var(--spyne-text-muted)' }}>Cancel</button>
          </div>
        </div>
      ) : askingIncorrect && (canResolve || !readOnly) ? (
        <IncorrectPicker onMark={onMarkIncorrect} onCancel={onCancelIncorrect} />
      ) : (
        <div className="flex items-center gap-2 border-t border-spyne-border px-4 py-3">
          {(canResolve || !readOnly) && <button onClick={onAskResolve} className="spyne-btn-primary !h-8 flex-1 justify-center !text-[12.5px]"><MaterialSymbol name="check_circle" size={16} /> Resolve</button>}
          {(canAssign || !readOnly) && <button onClick={onAskAssign} className="spyne-btn-secondary !h-8 !text-[12px]"><MaterialSymbol name="person_add" size={14} /> Assign</button>}
          {(canResolve || !readOnly) && <button onClick={onAskIncorrect} className="spyne-btn-secondary !h-8 !text-[12px]"><MaterialSymbol name="flag" size={14} /> Incorrect</button>}
        </div>
      ))}
    </div>
  )
}

/* ── Resolve-with-type inline picker ─────────────────────────────── */

function ResolvePicker({ onResolve, onCancel }) {
  const [type, setType] = useState(null)
  const [note, setNote] = useState('')
  return (
    <div className="border-t border-spyne-border px-4 py-3">
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>How was this resolved?</p>
      <div className="flex flex-wrap gap-1.5">
        {RESOLUTION_TYPES.map((r) => (
          <button
            key={r.value}
            onClick={() => setType(r.value)}
            className={cn('spyne-focus-ring inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors', type === r.value ? 'border-spyne-primary' : 'border-spyne-border hover:border-spyne-primary')}
            style={type === r.value ? { background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' } : { color: 'var(--spyne-text-secondary)' }}
          >
            <MaterialSymbol name={r.glyph} size={14} /> {r.label}
          </button>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note · optional"
        className="spyne-input spyne-focus-ring mt-2 w-full"
        style={{ fontSize: 12 }}
      />
      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => onResolve(type ?? 'other', note)} disabled={!type} className="spyne-btn-primary !h-8 flex-1 justify-center !text-[12px]">
          <MaterialSymbol name="check_circle" size={14} /> Confirm resolution
        </button>
        <button onClick={onCancel} className="spyne-focus-ring rounded text-[11px] font-semibold" style={{ color: 'var(--spyne-text-muted)' }}>Cancel</button>
      </div>
    </div>
  )
}

/* ── Resolved tab (clickable rows → detail) ──────────────────────── */

function ResolvedList({ items, openId, onOpen, onOpenSidebar, onOpenSource }) {
  const [f, setF] = useState({ search: '', resolution: 'all', intent: 'all', resolvedBy: 'all', created: 'all', resolvedDate: 'all', pastSla: false })
  if (items.length === 0) return (
    <div className="spyne-card">
      <EmptyState glyph="task_alt" title="No resolved items yet" helper="Items you resolve will be recorded here with their resolution type." />
    </div>
  )
  const distinct = (key) => [...new Set(items.map((i) => i[key]).filter(Boolean))]
  const resolvedDayKey = (ts) => (ts ? createdDayKey({ created_at: ts }) : 'older')
  const filtered = items.filter((it) => {
    if (f.resolution !== 'all' && it.resolution_type !== f.resolution) return false
    if (f.intent !== 'all' && it.intent_id !== f.intent) return false
    if (f.resolvedBy !== 'all' && (it.assignee_user_id || '') !== f.resolvedBy) return false
    if (f.created !== 'all' && createdDayKey(it) !== f.created) return false
    if (f.resolvedDate !== 'all' && resolvedDayKey(it.closed_at) !== f.resolvedDate) return false
    if (f.pastSla && !isPastSla(it)) return false
    if (f.search) {
      const q = f.search.toLowerCase()
      const name = customerName(it.customer_id, it).toLowerCase()
      if (!name.includes(q) && !(it.resolution_note || '').toLowerCase().includes(q) && !(it.intent_recap || '').toLowerCase().includes(q) && !it.action_item_id.toLowerCase().includes(q)) return false
    }
    return true
  })
  const hasFilter = f.search || f.resolution !== 'all' || f.intent !== 'all' || f.resolvedBy !== 'all' || f.created !== 'all' || f.resolvedDate !== 'all' || f.pastSla
  const clear = () => setF({ search: '', resolution: 'all', intent: 'all', resolvedBy: 'all', created: 'all', resolvedDate: 'all', pastSla: false })
  const open = filtered.find((i) => i.action_item_id === openId)
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel glyph="check_circle" text="Resolved" hint={hasFilter ? `${filtered.length} of ${items.length}` : `${items.length} in view`} />
      {/* Filters — customer search · resolution type · intent · resolved-by · created/resolved date · past-SLA */}
      <div className="spyne-card flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5">
        <input value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} placeholder="Search customer / note…" className="spyne-input spyne-focus-ring !h-8 w-48 text-[12px]" />
        <Select label="Resolution" value={f.resolution} onChange={(v) => setF({ ...f, resolution: v })} options={[['all', 'All'], ...distinct('resolution_type').map((t) => [t, RESOLUTION_TYPE_LABEL[t] ?? t])]} />
        <Select label="Intent" value={f.intent} onChange={(v) => setF({ ...f, intent: v })} options={[['all', 'All'], ...distinct('intent_id').map((c) => [c, INTENT_TAXONOMY[c]?.display_name ?? c])]} />
        <Select label="Resolved by" value={f.resolvedBy} onChange={(v) => setF({ ...f, resolvedBy: v })} options={[['all', 'Anyone'], ...distinct('assignee_user_id').map((u) => [u, USERS[u]?.name ?? u])]} />
        <Select label="Created" value={f.created} onChange={(v) => setF({ ...f, created: v })} options={[['all', 'Any'], ['today', 'Today'], ['yesterday', 'Yesterday']]} />
        <Select label="Resolved" value={f.resolvedDate} onChange={(v) => setF({ ...f, resolvedDate: v })} options={[['all', 'Any'], ['today', 'Today'], ['yesterday', 'Yesterday']]} />
        <button onClick={() => setF({ ...f, pastSla: !f.pastSla })} className="spyne-focus-ring inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors" style={{ borderColor: f.pastSla ? 'var(--spyne-danger-text)' : 'var(--spyne-border)', color: f.pastSla ? 'var(--spyne-danger-text)' : 'var(--spyne-text-secondary)', background: f.pastSla ? 'var(--spyne-danger-subtle)' : 'transparent' }}><MaterialSymbol name="warning" size={13} /> Past SLA</button>
        {hasFilter && <button onClick={clear} className="spyne-focus-ring ml-auto rounded text-[11px] font-semibold" style={{ color: 'var(--spyne-text-muted)' }}>Clear</button>}
      </div>
      {filtered.length === 0 ? (
        <div className="spyne-card"><EmptyState glyph="filter_alt" title="No resolved items match" helper="Adjust or clear the filters above." /></div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(320px,420px)]">
        <div className="flex flex-col gap-2">
          {filtered.map((it) => {
            const active = it.action_item_id === openId
            return (
              <button
                key={it.action_item_id}
                onClick={() => onOpen(active ? null : it.action_item_id)}
                className={cn('spyne-card-interactive spyne-focus-ring flex flex-wrap items-center gap-2 p-3 text-left', active && 'active-action-card')}
                style={{ borderLeft: `3px solid ${active ? 'var(--spyne-primary)' : 'transparent'}` }}
              >
                <span className="inline-flex" style={{ color: 'var(--spyne-success-text)' }}><MaterialSymbol name="check_circle" size={16} /></span>
                <IntentBadge intentId={it.intent_id} />
                <span className="text-[13px] font-bold" style={{ color: 'var(--spyne-text-primary)' }}>{customerName(it.customer_id, it)}</span>
                <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--spyne-text-secondary)' }}>{it.resolution_note ?? it.intent_recap}</span>
                {it.resolution_type && <ResolutionBadge type={it.resolution_type} />}
                <span className="text-[10.5px]" style={{ color: 'var(--spyne-text-muted)' }}>{it.assignee_user_id ? `by ${USERS[it.assignee_user_id]?.name ?? 'Unknown'}` : ''}</span>
              </button>
            )
          })}
        </div>
        <div className="spyne-card flex min-h-[280px] flex-col p-0">
          {open ? (
            <ClosedDetail item={open} onOpenSidebar={onOpenSidebar} onOpenSource={onOpenSource} />
          ) : (
            <EmptyState glyph="receipt_long" title="Select a resolved item" helper="Open any row to see its full record and resolution note." className="flex-1" />
          )}
        </div>
      </div>
      )}
    </div>
  )
}

/** Shared read-only detail for resolved (and reusable for closed) items. */
function ClosedDetail({ item, onOpenSidebar, onOpenSource }) {
  const intent = INTENT_TAXONOMY[item.intent_id]
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <IntentBadge intentId={item.intent_id} />
        <ChannelChip channel={item.source_channel} />
      </div>
      <CustomerNameButton customerId={item.customer_id} item={item} onOpen={onOpenSidebar} size={15} />
      {/* Action taken — the resolution, made prominent (the whole point of the Resolved record). */}
      <div className="rounded-lg p-3" style={{ background: 'var(--spyne-success-subtle)' }}>
        <p className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-success-text)' }}><MaterialSymbol name="task_alt" size={14} /> Action taken</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-[14.5px] font-bold" style={{ color: 'var(--spyne-text-primary)' }}>
          <MaterialSymbol name={RESOLUTION_TYPE_GLYPH[item.resolution_type] ?? 'check_circle'} size={18} />
          {item.resolution_type ? (RESOLUTION_TYPE_LABEL[item.resolution_type] ?? item.resolution_type) : 'Resolved'}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--spyne-text-muted)' }}>{item.assignee_user_id ? `by ${USERS[item.assignee_user_id]?.name ?? 'Unknown'}` : 'by console'}{item.closed_at ? ` · ${formatCreatedAt(item.closed_at)}` : ''}</p>
      </div>
      <div>
        <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>What needed doing</p>
        <p className="mt-0.5 text-[13.5px] leading-snug" style={{ color: 'var(--spyne-text-primary)' }}>{item.intent_recap}</p>
      </div>
      <div className="rounded-lg border border-spyne-border p-2.5" style={{ background: 'var(--spyne-page-bg)' }}>
        <div className="mb-1 flex items-center gap-2">
          <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>Source</p>
          <div className="ml-auto"><SourceLinks item={item} onOpenSource={onOpenSource} /></div>
        </div>
        <p className="text-[12px] italic leading-snug" style={{ color: 'var(--spyne-text-secondary)' }}>“{item.source_message}”</p>
      </div>
      {item.resolution_note && (
        <div className="rounded-lg p-2.5" style={{ background: 'var(--spyne-success-subtle)' }}>
          <p className="mb-0.5 inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-success-text)' }}><MaterialSymbol name="sticky_note_2" size={14} /> Resolution note</p>
          <p className="text-[12px] leading-snug" style={{ color: 'var(--spyne-text-secondary)' }}>{item.resolution_note}</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Assignee userId={item.assignee_user_id} />
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}><MaterialSymbol name="schedule" size={14} /> SLA {intent ? formatSla(intent.sla_hours) : '?'}</span>
      </div>
      <div className="border-t border-spyne-border pt-2.5"><ActivityTrail item={item} /></div>
    </div>
  )
}

/* ── Incorrect tab ───────────────────────────────────────────────── */

const INCORRECT_REASON_LABEL = Object.fromEntries(INCORRECT_REASONS.map((r) => [r.value, r.label]))

function IncorrectList({ items, onUndo, onOpenSidebar, onOpenSource }) {
  const [openId, setOpenId] = useState(null)
  if (items.length === 0) return (
    <div className="spyne-card">
      <EmptyState glyph="flag" title="Nothing flagged incorrect" helper="Items you mark incorrect land here and stay out of your closure rate." />
    </div>
  )
  const open = items.find((i) => i.action_item_id === openId)
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel glyph="flag" text="Incorrect" hint={`${items.length} flagged · excluded from closure rate`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(320px,420px)]">
        <div className="flex flex-col gap-2">
          {items.map((it) => {
            const active = it.action_item_id === openId
            return (
              <button key={it.action_item_id} onClick={() => setOpenId(active ? null : it.action_item_id)}
                className={cn('spyne-card-interactive spyne-focus-ring flex flex-wrap items-center gap-2 p-3 text-left', active && 'active-action-card')}
                style={{ borderLeft: `3px solid ${active ? 'var(--spyne-primary)' : 'transparent'}` }}>
                <span className="inline-flex" style={{ color: 'var(--spyne-warning-ink)' }}><MaterialSymbol name="flag" size={16} /></span>
                <IntentBadge intentId={it.intent_id} />
                <span className="text-[13px] font-bold" style={{ color: 'var(--spyne-text-primary)' }}>{customerName(it.customer_id, it)}</span>
                <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--spyne-text-secondary)' }}>{it.intent_recap}</span>
                {it.incorrect_reason && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: 'var(--spyne-warning-subtle)', color: 'var(--spyne-warning-ink)' }}>{INCORRECT_REASON_LABEL[it.incorrect_reason] ?? it.incorrect_reason}</span>}
              </button>
            )
          })}
        </div>
        <div className="spyne-card flex min-h-[280px] flex-col p-0">
          {open ? (
            <IncorrectDetail item={open} onOpenSidebar={onOpenSidebar} onUndo={onUndo} onOpenSource={onOpenSource} />
          ) : (
            <EmptyState glyph="flag" title="Select a flagged item" helper="Open any row to see why it was flagged, the corrected intent, and restore it." className="flex-1" />
          )}
        </div>
      </div>
    </div>
  )
}

/** Read-only detail for a flagged (incorrect) item — mirrors the resolved detail. */
function IncorrectDetail({ item, onOpenSidebar, onUndo, onOpenSource }) {
  const evTurns = Array.isArray(item.evidence_turns) ? item.evidence_turns : []
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <IntentBadge intentId={item.intent_id} />
        <ChannelChip channel={item.source_channel} />
        {item.incorrect_reason && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: 'var(--spyne-warning-subtle)', color: 'var(--spyne-warning-ink)' }}>{INCORRECT_REASON_LABEL[item.incorrect_reason] ?? item.incorrect_reason}</span>}
      </div>
      <CustomerNameButton customerId={item.customer_id} item={item} onOpen={onOpenSidebar} size={15} />
      {item.original_intent_id && (
        <div className="rounded-lg p-3" style={{ background: 'var(--spyne-primary-soft)' }}>
          <p className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-primary)' }}><MaterialSymbol name="sync_alt" size={14} /> Reclassified</p>
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--spyne-text-secondary)' }}>
            <span className="line-through" style={{ color: 'var(--spyne-text-muted)' }}>{INTENT_TAXONOMY[item.original_intent_id]?.display_name ?? item.original_intent_id}</span>
            {' → '}
            <span className="font-bold" style={{ color: 'var(--spyne-text-primary)' }}>{INTENT_TAXONOMY[item.intent_id]?.display_name ?? item.intent_id}</span>
          </p>
        </div>
      )}
      <div>
        <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>Flagged from</p>
        <p className="mt-0.5 text-[13.5px] leading-snug" style={{ color: 'var(--spyne-text-primary)' }}>{item.intent_recap}</p>
      </div>
      <div className="rounded-lg border border-spyne-border p-2.5" style={{ background: 'var(--spyne-page-bg)' }}>
        <div className="mb-1 flex items-center gap-2">
          <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--spyne-text-muted)' }}>Source</p>
          <div className="ml-auto"><SourceLinks item={item} onOpenSource={onOpenSource} /></div>
        </div>
        {evTurns.length ? (
          <div className="flex flex-col gap-1">
            {evTurns.map((t, i) => (
              <p key={i} className="text-[12px] leading-snug" style={{ color: 'var(--spyne-text-secondary)' }}><span className="mr-1 text-[9px] font-bold uppercase" style={{ color: t.role === 'ai' ? 'var(--spyne-primary)' : 'var(--spyne-text-muted)' }}>{t.role === 'ai' ? 'Vini' : 'Customer'}</span>{t.text}</p>
            ))}
          </div>
        ) : (
          <p className="text-[12px] italic leading-snug" style={{ color: 'var(--spyne-text-secondary)' }}>“{item.source_message}”</p>
        )}
      </div>
      <div className="border-t border-spyne-border pt-2.5"><ActivityTrail item={item} /></div>
      <button onClick={() => onUndo(item.action_item_id)} className="spyne-btn-secondary !h-8 justify-center !text-[12px]"><MaterialSymbol name="undo" size={14} /> Restore to queue</button>
    </div>
  )
}

/* ── Rules / config drawer (read-only demo) ──────────────────────── */

function RulesPanel({ onClose, onEditSla, onPersistSla }) {
  const [channelAuto, setChannelAuto] = useState(CHANNEL_AUTOCREATE_DEFAULTS)
  // Editable per-intent SLA (session-only). Mutates INTENT_TAXONOMY in memory + bumps the
  // parent's slaVersion so burn/sort/past-SLA recompute live; "Reset" restores SLA_DEFAULTS.
  // Per-intent SLA draft as {value, unit} (unit ∈ m|h|d). Stored back as sla_hours.
  const [slaDraft, setSlaDraft] = useState(() =>
    Object.fromEntries(Object.values(INTENT_TAXONOMY).map((i) => [i.id, splitSla(i.sla_hours)])),
  )
  const commitHours = (id, hours) => {
    INTENT_TAXONOMY[id].sla_hours = Math.max(1 / 60, Math.min(720, hours)) // 1 minute … 30 days
    onEditSla?.()
  }
  const setSlaValue = (id, raw) => {
    setSlaDraft((p) => {
      const unit = p[id]?.unit ?? 'h'
      const value = Math.max(0, parseFloat(String(raw)) || 0)
      commitHours(id, value * SLA_UNIT_HOURS[unit])
      return { ...p, [id]: { value, unit } }
    })
  }
  const setSlaUnit = (id, unit) => {
    // Re-express the current SLA in the chosen unit — the duration stays put, the number converts.
    setSlaDraft((p) => {
      const hours = INTENT_TAXONOMY[id].sla_hours
      const value = unit === 'm' ? Math.round(hours * 60) : unit === 'd' ? round2(hours / 24) : round2(hours)
      return { ...p, [id]: { value, unit } }
    })
  }
  const resetSla = () => {
    // Only mock intents have a captured default; live-catalog intents keep their catalog SLA.
    Object.values(INTENT_TAXONOMY).forEach((i) => { if (SLA_DEFAULTS[i.id] != null) INTENT_TAXONOMY[i.id].sla_hours = SLA_DEFAULTS[i.id] })
    setSlaDraft(Object.fromEntries(Object.values(INTENT_TAXONOMY).map((i) => [i.id, splitSla(INTENT_TAXONOMY[i.id].sla_hours)])))
    onEditSla?.()
  }
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // In live mode the catalog is the source of truth → show ONLY live-catalog intents
  // (hides the bundled mock tags + camelCase stubs so the SLA config maps to real intent codes).
  const live = !!onPersistSla
  const byDept = useMemo(() => {
    const m = {}
    for (const intent of Object.values(INTENT_TAXONOMY)) {
      if (live && !intent.live) continue
      ;(m[intent.dept] ||= []).push(intent)
    }
    return m
  }, [live])

  return (
    <div className="console-v2-sales-root max2-spyne">
      <div onClick={onClose} className="fixed inset-0 z-[199]" style={{ background: 'rgba(15,23,42,0.45)' }} />
      <div className="spyne-float spyne-animate-slide-up fixed right-0 top-0 z-[200] flex h-full w-[440px] max-w-[92vw] flex-col" style={{ background: 'var(--spyne-surface)' }} role="dialog" aria-modal="true" aria-label="Action-item rules">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-spyne-border px-4 py-3.5">
          <span className="inline-flex size-8 items-center justify-center rounded-lg" style={{ background: 'var(--spyne-primary-soft)', color: 'var(--spyne-primary)' }}><MaterialSymbol name="settings" size={16} /></span>
          <div className="flex-1">
            <h2 className="text-[15px] font-bold" style={{ color: 'var(--spyne-text-primary)' }}>Action-item rules</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="spyne-focus-ring inline-flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-spyne-page-bg" style={{ color: 'var(--spyne-text-muted)' }}><MaterialSymbol name="close" size={20} /></button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          {/* Per-channel auto-create */}
          <div className="flex flex-col gap-2">
            <SectionLabel glyph="hub" text="Auto-create by channel" />
            <div className="spyne-card flex flex-col gap-0.5 p-1.5">
              {Object.entries(CHANNEL_META).map(([id, ch]) => (
                <div key={id} className="flex items-center gap-2.5 rounded-lg px-2 py-2">
                  <span className="inline-flex" style={{ color: 'var(--spyne-text-muted)' }}><MaterialSymbol name={ch.symbol} size={16} /></span>
                  <span className="flex-1 text-[12.5px] font-semibold" style={{ color: 'var(--spyne-text-primary)' }}>{ch.label}</span>
                  <SpyneSwitch checked={!!channelAuto[id]} onChange={(v) => setChannelAuto((p) => ({ ...p, [id]: v }))} label={`Auto-create from ${ch.label}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Department → intents routing + editable per-intent SLA */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <SectionLabel glyph="account_tree" text="Intent routing & SLA" />
              <button type="button" onClick={resetSla} className="spyne-btn-ghost !h-6 !text-[11px]">Reset SLAs</button>
            </div>
            <p className="text-[10.5px]" style={{ color: 'var(--spyne-text-muted)' }}>
              {live
                ? 'Live catalog intents for this rooftop. Editing an SLA saves it to the rooftop (persisted to dealer-intent-config).'
                : 'Predefined intents (the tags). Per-intent SLA is editable in minutes, hours or days — session only, not saved.'}
            </p>
            <div className="flex flex-col gap-2">
              {Object.entries(byDept).map(([dept, intents]) => (
                <div key={dept} className="spyne-card p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={cn('spyne-badge', DEPT_BADGE[dept])} style={{ fontSize: 10 }}>{DEPT_LABEL[dept] ?? dept}</span>
                    <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--spyne-text-muted)' }}>{intents.length} intent{intents.length === 1 ? '' : 's'}</span>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {intents.map((i) => (
                      <li key={i.id} className="flex items-center gap-2 rounded-md px-2 py-2" style={{ background: 'var(--spyne-page-bg)' }}>
                        <span className="flex-1 truncate text-[12px]" style={{ color: 'var(--spyne-text-secondary)' }} title={i.display_name}>{i.display_name}</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={slaDraft[i.id]?.value ?? ''}
                          onChange={(e) => setSlaValue(i.id, e.target.value)}
                          onBlur={() => onPersistSla?.(i.id, Math.round((INTENT_TAXONOMY[i.id]?.sla_hours ?? 24) * 60), i.dept)}
                          className="spyne-input !h-7 w-14 px-1.5 text-right text-[12px] tabular-nums"
                          aria-label={`SLA duration for ${i.display_name}`}
                        />
                        <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-spyne-border">
                          {SLA_UNITS.map(([u, lbl], idx) => {
                            const on = (slaDraft[i.id]?.unit ?? 'h') === u
                            return (
                              <button
                                key={u}
                                type="button"
                                onClick={() => setSlaUnit(i.id, u)}
                                aria-pressed={on}
                                title={`Set SLA in ${lbl.toLowerCase()}s`}
                                className={cn('spyne-focus-ring h-7 px-2 text-[10.5px] font-bold uppercase tracking-wide transition-colors', idx > 0 && 'border-l border-spyne-border')}
                                style={on ? { background: 'var(--spyne-primary)', color: '#fff' } : { background: 'var(--spyne-surface)', color: 'var(--spyne-text-muted)' }}
                              >
                                {lbl}
                              </button>
                            )
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-spyne-border px-4 py-3">
          <button onClick={onClose} className="spyne-btn-secondary !h-9 w-full justify-center !text-[12.5px]">Done</button>
        </div>
      </div>
    </div>
  )
}
