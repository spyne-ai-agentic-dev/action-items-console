"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { ActionItemsConsole } from "@/components/max-2/sales/console-v2/action-items"
import { fetchActionItems, fetchCompletedActionItems } from "@/components/max-2/sales/console-v2/action-items/be-client"
import { withRepeatCallerCounts, type ActionItem } from "@/components/max-2/sales/console-v2/action-items/data"

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
  const initialDept = (params.get("serviceType") ?? params.get("department") ?? "sales").toLowerCase()

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
  const skipFirstUrlSync = useRef(true)
  useEffect(() => {
    if (skipFirstUrlSync.current) { skipFirstUrlSync.current = false; return }
    const next = new URLSearchParams(params.toString())
    next.set("serviceType", department)
    next.delete("department")
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department])

  // Re-fetch whenever scope OR department changes. Department toggle → items:undefined → loading → view.
  useEffect(() => {
    let cancelled = false
    ;(window as unknown as { __AI_SCOPE__?: object }).__AI_SCOPE__ = {
      env, enterpriseId: ent, teamId: team, department, userId, userEmail, token,
    }
    setItems(undefined) // shows the loading state
    setError(null)
    setCount(null)
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
      })
      .catch((e) => {
        if (cancelled) return
        setItems([])
        setCount(null)
        setError(String((e as Error)?.message || e))
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
                onClick={() => !active && setDepartment(d)}
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
