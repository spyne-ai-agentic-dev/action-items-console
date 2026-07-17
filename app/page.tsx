"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { ActionItemsConsole } from "@/components/max-2/sales/console-v2/action-items"
import { fetchActionItems, fetchCompletedActionItems } from "@/components/max-2/sales/console-v2/action-items/be-client"
import { withRepeatCallerCounts, type ActionItem } from "@/components/max-2/sales/console-v2/action-items/data"
import { initAnalytics, identifyOperator, registerScope, track } from "@/lib/analytics"

/**
 * Standalone Action Items — the iframe target.
 *
 *   /?env=<uat|stag|prod>&enterpriseId=<id>&teamId=<id>&token=<bearer>   ← full scope (from the host URL)
 *   optional: &serviceType=sales|service, &userId=<id>&userEmail=<email>
 *   (snake_case aliases enterprise_id / team_id / bearerToken are also accepted)
 *
 * `serviceType` is the CANONICAL department param — it matches the real converse-ai host URL
 * contract (e.g. .../action-items?enterprise_id=...&team_id=...&serviceType=service). `department`
 * is accepted as a read-only legacy alias for older links, but the console always WRITES
 * `serviceType` back to the URL, never `department` — so the address bar never carries both.
 *
 * ALL scope — env, token, enterpriseId, teamId — is read from the iframe URL and mirrored onto
 * window.__AI_SCOPE__; the backend is called directly from the browser (no /api proxy).
 * DEPARTMENT is a UI toggle (Sales | Service, default Sales); switching it re-fetches with a
 * loading state, then renders that department's view.
 */
/** Best-effort read of ?serviceType= from the EMBEDDING page's url (document.referrer). Only
 *  available when the host's referrer policy preserves the query cross-origin; returns null
 *  otherwise (harmless — the caller falls through to the default). */
function referrerServiceType(): string | null {
  if (typeof document === "undefined" || !document.referrer) return null
  try {
    const v = new URL(document.referrer).searchParams.get("serviceType")
    return v === "sales" || v === "service" ? v : null
  } catch { return null }
}

/** postMessage to the embedding host — no-op when not iframed. Payload carries no secrets, so a
 *  wildcard target origin is safe (the host validates `source` before acting). */
function postToHost(msg: Record<string, string>) {
  if (typeof window === "undefined" || window.parent === window) return
  try { window.parent.postMessage(msg, "*") } catch { /* host gone — ignore */ }
}

function ActionItemsApp() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const ent = params.get("enterpriseId") ?? params.get("enterprise_id") ?? ""
  const team = params.get("teamId") ?? params.get("team_id") ?? ""
  const token = params.get("token") ?? params.get("bearerToken") ?? ""
  const env = (params.get("env") ?? params.get("environment") ?? "prod").toLowerCase()
  const userId = params.get("userId") ?? params.get("user_id") ?? ""
  const userEmail = params.get("userEmail") ?? params.get("email") ?? ""
  // serviceType is canonical (matches the real host URL contract); department is a legacy read alias.
  // Third fallback: the HOST page's own query string via document.referrer — when the console is
  // iframed and the host puts ?serviceType=service on ITS url but forgets to forward it into the
  // iframe src, the referrer (when the host's referrer policy preserves it) still carries the param.
  const initialDept = (
    params.get("serviceType") ?? params.get("department") ?? referrerServiceType() ?? "sales"
  ).toLowerCase()

  const [department, setDepartment] = useState(initialDept === "service" ? "service" : "sales")
  const [items, setItems] = useState<ActionItem[] | undefined>(undefined)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep the URL's `serviceType` param in sync with the toggle (replace, not push — a toggle isn't
  // a navigation event) so the current view is always a shareable/bookmarkable link matching the
  // real host contract: a rep can copy the address bar URL, or an email/SMS template can build a
  // direct `?serviceType=sales|service` link that opens straight to that tab. Drops a legacy
  // `department=` param if present, so the URL never carries both names at once. Skip the very
  // first render so opening a URL that omits `serviceType` doesn't immediately rewrite it — only
  // an actual toggle click updates the URL.
  //
  // IFRAME NOTE: this rewrites the IFRAME's own URL. The browser address bar belongs to the HOST
  // page, which a cross-origin iframe cannot touch — so we ALSO notify the host via postMessage
  // ("serviceTypeChange", below) and the host syncs its own URL. Without that host listener, the
  // address bar cannot change; that's a browser security boundary, not a bug here.
  const skipFirstUrlSync = useRef(true)
  useEffect(() => {
    if (skipFirstUrlSync.current) { skipFirstUrlSync.current = false; return }
    const next = new URLSearchParams(params.toString())
    next.set("serviceType", department)
    next.delete("department")
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    // Tell the embedding host the department changed so it can sync ITS url (the address bar).
    postToHost({ source: "action-items-console", type: "serviceTypeChange", serviceType: department })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department])

  // Analytics: init once, identify the operator from the URL scope (no cookies — see analytics.ts),
  // and record the adoption "app load" signal. scope_missing / load outcomes fire in the effects below.
  useEffect(() => {
    initAnalytics()
    const hasUserIdentity = !!(userId || userEmail)
    identifyOperator({ userId, userEmail, enterpriseId: ent, teamId: team })
    registerScope({ env, enterpriseId: ent, teamId: team, department, hasUserIdentity })
    const scopePresent = !!(ent && team && token)
    track("console:app_load", "adoption", {
      is_iframed: typeof window !== "undefined" && window.parent !== window,
      scope_present: scopePresent,
      has_user_identity: hasUserIdentity,
      department,
    })
    if (!scopePresent) {
      track("console:scope_missing", "adoption", {
        has_enterprise_id: !!ent,
        has_team_id: !!team,
        has_token: !!token,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Host → iframe bridge: the host can switch the department at any time (e.g. its own tabs, or a
  // deep-link it resolved after load) by posting { type: "setServiceType", serviceType } to this
  // iframe. On mount we announce readiness + our initial department so the host can reconcile.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data
      if (!d || typeof d !== "object" || d.type !== "setServiceType") return
      const v = String(d.serviceType ?? "").toLowerCase()
      if (v === "sales" || v === "service") {
        if (v !== department) track("console:department_switch", "adoption", { from: department, to: v, changed_via: "host" })
        setDepartment(v)
      }
    }
    window.addEventListener("message", onMessage)
    postToHost({ source: "action-items-console", type: "ready", serviceType: department })
    return () => window.removeEventListener("message", onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch whenever scope OR department changes. Department toggle → items:undefined → loading → view.
  useEffect(() => {
    let cancelled = false
    ;(window as unknown as { __AI_SCOPE__?: object }).__AI_SCOPE__ = {
      env, enterpriseId: ent, teamId: team, department, userId, userEmail, token,
    }
    setItems(undefined) // shows the loading state
    setError(null)
    setCount(null)
    // Keep scope super-properties current (department changes at runtime).
    registerScope({ env, enterpriseId: ent, teamId: team, department, hasUserIdentity: !!(userId || userEmail) })
    const startedAt = Date.now()
    // Direct backend calls (no proxy) — pending (queue) + completed (resolved/incorrect, from the DB
    // so those tabs persist across reloads). Uses env + token straight from the iframe URL.
    Promise.all([fetchActionItems(), fetchCompletedActionItems()])
      .then(([pending, completed]) => {
        if (cancelled) return
        const pend = Array.isArray(pending) ? pending : []
        const done = Array.isArray(completed) ? completed : []
        // Dedup by id (an item is either pending or completed) — pending wins if it somehow appears in both.
        const seen = new Set(pend.map((i) => i.action_item_id))
        const merged = withRepeatCallerCounts([...pend, ...done.filter((i) => !seen.has(i.action_item_id))])
        setItems(merged)
        setCount(merged.length) // render the console if there's ANY data (so Resolved/Incorrect tabs show)
        const loadMs = Date.now() - startedAt
        track("console:load_duration", "adoption", {
          load_ms: loadMs, is_slow: loadMs > 4000,
          pending_count: pend.length, completed_count: done.length, merged_count: merged.length,
          department,
        })
        if (merged.length === 0) track("console:empty", "adoption", { department })
      })
      .catch((e) => {
        if (cancelled) return
        setItems([])
        setCount(null)
        const msg = String((e as Error)?.message || e)
        setError(msg)
        track("console:load_fail", "issue", { error_message: msg, department, load_ms: Date.now() - startedAt })
      })
    return () => { cancelled = true }
  }, [ent, team, department, userId, userEmail, token, env])

  const scopeLabel = `${ent || "default ent"} / ${team || "default team"} · ${department}`

  return (
    <div className="console-v2-sales-root flex h-screen w-full min-w-0 flex-col overflow-hidden bg-spyne-page">
      {/* Department toggle (Sales | Service) — persists across the loading state. */}
      <div className="flex flex-none items-center gap-3 border-b border-spyne-border bg-spyne-surface px-4 py-2">
        {!ent && <ScopeHelper />}
        <div className="ml-auto inline-flex items-center gap-1 rounded-lg border border-spyne-border p-0.5" role="tablist" aria-label="Department">
          {(["sales", "service"] as const).map((d) => {
            const active = department === d
            return (
              <button
                key={d}
                role="tab"
                aria-selected={active}
                onClick={() => { if (!active) { track("console:department_switch", "adoption", { from: department, to: d, changed_via: "toggle" }); setDepartment(d) } }}
                className="rounded-md px-3.5 py-1 text-[12.5px] font-semibold capitalize transition-colors spyne-focus-ring"
                style={active ? { background: "var(--spyne-primary)", color: "#fff" } : { color: "var(--spyne-text-secondary)" }}
              >
                {d}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-max2-page pb-3 pt-3">
        {items === undefined ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-24 text-[13px] text-spyne-text-muted">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
            Loading {department} action items…
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center py-24 text-center text-[13px]" style={{ color: "var(--spyne-danger-text)" }}>
            Couldn’t load {scopeLabel}: {error}
          </div>
        ) : count === 0 ? (
          <div className="flex flex-1 items-center justify-center py-24 text-[13px]" style={{ color: "var(--spyne-warning-text)" }}>
            No {department} action items for {scopeLabel}
          </div>
        ) : (
          <ActionItemsConsole
            key={`live-${ent}-${team}-${department}`}
            readOnly
            initialItems={items}
            initialDept={department}
            initialUserId={userId}
            initialUserEmail={userEmail}
          />
        )}
      </div>
    </div>
  )
}

/** Slim URL builder shown only when opened without an enterprise_id (local testing). */
function ScopeHelper() {
  const [entId, setEntId] = useState("")
  const [teamId, setTeamId] = useState("")
  const go = () => {
    const q = new URLSearchParams({ enterprise_id: entId.trim(), team_id: teamId.trim() })
    window.location.search = q.toString()
  }
  return (
    <form onSubmit={(ev) => { ev.preventDefault(); go() }} className="flex items-center gap-2 text-[12px]">
      <input value={entId} onChange={(ev) => setEntId(ev.target.value)} placeholder="enterprise_id" className="spyne-input !h-7 w-44" />
      <input value={teamId} onChange={(ev) => setTeamId(ev.target.value)} placeholder="team_id" className="spyne-input !h-7 w-44" />
      <button type="submit" className="spyne-btn-primary !h-7 !text-[12px]">Load</button>
      <span className="text-spyne-text-muted">env comes from the backend base URL (server-side)</span>
    </form>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ActionItemsApp />
    </Suspense>
  )
}
