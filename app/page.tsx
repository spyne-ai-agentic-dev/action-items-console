"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ActionItemsConsole } from "@/components/max-2/sales/console-v2/action-items"
import { fetchActionItems } from "@/components/max-2/sales/console-v2/action-items/be-client"
import type { ActionItem } from "@/components/max-2/sales/console-v2/action-items/data"

/**
 * Standalone Action Items — the iframe target.
 *
 *   /?enterprise_id=<id>&team_id=<id>          ← scope (snake_case, converse-ai contract)
 *   optional: &department=sales|service, &userId=<id>&userEmail=<email>
 *
 * ENV is NOT in the URL — it's derived server-side from APP_BACKEND_BASEURL (see lib/be-backend).
 * DEPARTMENT is a UI toggle (Sales | Service, default Sales); switching it re-fetches with a
 * loading state, then renders that department's view.
 */
function ActionItemsApp() {
  const params = useSearchParams()
  const ent = params.get("enterpriseId") ?? params.get("enterprise_id") ?? ""
  const team = params.get("teamId") ?? params.get("team_id") ?? ""
  const token = params.get("token") ?? params.get("bearerToken") ?? ""
  const env = (params.get("env") ?? params.get("environment") ?? "prod").toLowerCase()
  const userId = params.get("userId") ?? params.get("user_id") ?? ""
  const userEmail = params.get("userEmail") ?? params.get("email") ?? ""
  const initialDept = (params.get("department") ?? params.get("serviceType") ?? "sales").toLowerCase()

  const [department, setDepartment] = useState(initialDept === "service" ? "service" : "sales")
  const [items, setItems] = useState<ActionItem[] | undefined>(undefined)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Re-fetch whenever scope OR department changes. Department toggle → items:undefined → loading → view.
  useEffect(() => {
    let cancelled = false
    ;(window as unknown as { __AI_SCOPE__?: object }).__AI_SCOPE__ = {
      env, enterpriseId: ent, teamId: team, department, userId, userEmail, token,
    }
    setItems(undefined) // shows the loading state
    setError(null)
    setCount(null)
    // Direct backend call (no proxy) — uses env + token straight from the iframe URL.
    fetchActionItems()
      .then((live) => {
        if (cancelled) return
        const arr = Array.isArray(live) ? live : []
        setItems(arr)
        setCount(arr.length)
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
