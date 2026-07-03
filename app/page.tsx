"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ActionItemsConsole } from "@/components/max-2/sales/console-v2/action-items"
import { fetchActionItemsViaProxy } from "@/components/max-2/sales/console-v2/action-items/be-client"
import type { ActionItem } from "@/components/max-2/sales/console-v2/action-items/data"

/**
 * Standalone Action Items — the iframe target. ALL scope is read from the URL:
 *
 *   /?env=uat|prod&enterpriseId=<id>&teamId=<id>&department=all|sales|service
 *   optional: &userId=<id>&userEmail=<email>   (acting BDC — recorded on resolve/assign)
 *
 * `env` selects the backend creds server-side (UAT vs prod). Enterprise/team scope the data.
 * When embedded (enterpriseId present) it renders chrome-free. Opened bare (no enterpriseId), a
 * slim helper lets you build the URL for local testing — the URL stays the single source of truth.
 */
function ActionItemsApp() {
  const params = useSearchParams()
  const env = (params.get("env") || "prod").toLowerCase()
  const ent = params.get("enterpriseId") ?? params.get("enterprise_id") ?? ""
  const team = params.get("teamId") ?? params.get("team_id") ?? ""
  const dept = params.get("department") ?? params.get("serviceType") ?? params.get("tab") ?? "all"
  const userId = params.get("userId") ?? params.get("user_id") ?? ""
  const userEmail = params.get("userEmail") ?? params.get("email") ?? ""

  const [items, setItems] = useState<ActionItem[] | undefined>(undefined)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load whenever the URL scope changes. be-client reads env/ent/team from window.__AI_SCOPE__.
  useEffect(() => {
    let cancelled = false
    ;(window as unknown as { __AI_SCOPE__?: object }).__AI_SCOPE__ = {
      env, enterpriseId: ent, teamId: team, department: dept, userId, userEmail, token: "",
    }
    setItems(undefined)
    setError(null)
    setCount(null)
    fetchActionItemsViaProxy(ent || undefined, team || undefined)
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
  }, [env, ent, team, dept, userId, userEmail])

  const scopeLabel = `${ent || "default ent"} / ${team || "default team"}${dept !== "all" ? ` · ${dept}` : ""} · ${env}`

  return (
    <div className="console-v2-sales-root flex h-screen w-full min-w-0 flex-col overflow-hidden bg-spyne-page">
      {/* Local-testing helper — only when no enterprise is supplied. Navigates (URL stays the source of truth). */}
      {!ent && <ScopeHelper env={env} />}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-max2-page pb-3 pt-3">
        {items === undefined ? (
          <div className="flex items-center justify-center py-24 text-[13px] text-spyne-text-muted">Loading action items…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-24 text-center text-[13px]" style={{ color: "var(--spyne-danger-text)" }}>
            Couldn’t load {scopeLabel}: {error}
          </div>
        ) : count === 0 ? (
          <div className="flex items-center justify-center py-24 text-[13px]" style={{ color: "var(--spyne-warning-text)" }}>
            No action items for {scopeLabel}
          </div>
        ) : (
          <ActionItemsConsole
            key={`live-${env}-${ent}-${team}-${dept}`}
            readOnly
            initialItems={items}
            initialDept={dept}
            initialUserId={userId}
            initialUserEmail={userEmail}
          />
        )}
      </div>
    </div>
  )
}

/** Slim URL builder shown only when the page is opened without an enterpriseId (local testing). */
function ScopeHelper({ env }: { env: string }) {
  const [e, setE] = useState(env)
  const [entId, setEntId] = useState("")
  const [teamId, setTeamId] = useState("")
  const [dept, setDept] = useState("all")
  const go = () => {
    const q = new URLSearchParams({ env: e, enterpriseId: entId.trim(), teamId: teamId.trim(), department: dept })
    window.location.search = q.toString()
  }
  return (
    <form
      onSubmit={(ev) => { ev.preventDefault(); go() }}
      className="flex flex-wrap items-center gap-2 border-b border-spyne-border bg-spyne-surface px-4 py-2 text-[12px]"
    >
      <span className="font-semibold text-spyne-text-secondary">Env</span>
      <select value={e} onChange={(ev) => setE(ev.target.value)} className="spyne-input spyne-focus-ring !h-7 cursor-pointer" style={{ paddingRight: 22 }}>
        <option value="prod">Prod</option>
        <option value="uat">UAT</option>
      </select>
      <input value={entId} onChange={(ev) => setEntId(ev.target.value)} placeholder="enterpriseId" className="spyne-input !h-7 w-48" />
      <input value={teamId} onChange={(ev) => setTeamId(ev.target.value)} placeholder="teamId" className="spyne-input !h-7 w-48" />
      <select value={dept} onChange={(ev) => setDept(ev.target.value)} className="spyne-input spyne-focus-ring !h-7 cursor-pointer" style={{ paddingRight: 22 }}>
        <option value="all">All</option>
        <option value="sales">Sales</option>
        <option value="service">Service</option>
      </select>
      <button type="submit" className="spyne-btn-primary !h-7 !text-[12px]">Load</button>
      <span className="text-spyne-text-muted">scope comes from the URL — this just builds it</span>
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
