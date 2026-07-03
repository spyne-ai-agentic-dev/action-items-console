/**
 * GET-only Action Items client for the embed.
 *
 * ⚠️ READ-ONLY: this module performs ONLY `GET` requests. No PUT/POST/PATCH/DELETE.
 * Returns mapped ActionItems when an embed scope (enterpriseId+teamId+token) is present,
 * otherwise null so the caller falls back to the bundled mock data.
 */
import { CUSTOMERS, USERS, prettyIntent, deptFromServiceType, type ActionItem } from "./data"
import { getEmbedScope, apiBaseForEnv } from "./be-scope"
import { mapBeItem, customersFromBe, usersFromBe } from "./be-mapper"

/** env-aware same-origin proxy URL — carries ?env= from the embed scope so the server picks UAT vs prod creds. */
function scopeEnv(): string {
  return (window as unknown as { __AI_SCOPE__?: { env?: string } }).__AI_SCOPE__?.env || "prod"
}
function beUrl(path: string): URL {
  const u = new URL(path, window.location.origin)
  u.searchParams.set("env", scopeEnv())
  return u
}

/** Same-origin audio URL for the waveform player — proxies the recording so WaveSurfer can fetch
 *  the bytes without CORS (the S3/LiveKit recording hosts block cross-origin fetch from the embed). */
export function recordingProxyUrl(callId: string): string {
  const u = beUrl("/api/call-recording")
  u.searchParams.set("callId", callId)
  return u.toString()
}

export async function fetchActionItems(): Promise<ActionItem[] | null> {
  const scope = getEmbedScope()
  if (!scope) return null // no embed scope → caller uses mock

  const base = apiBaseForEnv(scope.env)
  const url = new URL(`${base}/conversation/action-items`)
  url.searchParams.set("enterpriseId", scope.enterpriseId)
  url.searchParams.set("teamId", scope.teamId)
  url.searchParams.set("isCompleted", "false")
  url.searchParams.set("groupByCustomer", "false")
  url.searchParams.set("limit", "100")
  // Department is applied client-side (action items have no department field) — not sent here.

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${scope.token}`,
      Accept: "application/json",
    },
  })
  if (!res.ok) throw new Error(`GET /conversation/action-items → ${res.status}`)

  const body = await res.json()
  // Flat: { data: [...] } · Grouped: { data: [{ actionItems: [...] }], grouped: true }
  const raw: any[] = Array.isArray(body?.data)
    ? body.grouped
      ? body.data.flatMap((g: any) => g?.actionItems ?? [])
      : body.data
    : []

  // Merge live customer/assignee lookups into the shared maps so the console resolves
  // names/phones/initials for live ids (mock entries remain, harmlessly unused).
  Object.assign(CUSTOMERS, customersFromBe(raw))
  Object.assign(USERS, usersFromBe(raw))

  return raw.map(mapBeItem)
}

/**
 * LOCAL/DEV: fetch via the same-origin server proxy (`/api/action-items`) — no CORS, token
 * stays server-side (.env.local). Used by the embed when no token is present in the URL.
 */
export async function fetchActionItemsViaProxy(enterpriseId?: string, teamId?: string): Promise<ActionItem[]> {
  const url = beUrl("/api/action-items")
  if (enterpriseId) url.searchParams.set("enterpriseId", enterpriseId)
  if (teamId) url.searchParams.set("teamId", teamId)
  // Department NOT sent — action items have no department field server-side; filtered client-side.
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" })
  if (!res.ok) throw new Error(`proxy /api/action-items → ${res.status}`)
  const body = await res.json()
  const raw: any[] = Array.isArray(body?.data)
    ? body.grouped
      ? body.data.flatMap((g: any) => g?.actionItems ?? [])
      : body.data
    : []
  Object.assign(CUSTOMERS, customersFromBe(raw))
  Object.assign(USERS, usersFromBe(raw))
  return raw.map(mapBeItem)
}

/** LOCAL/DEV: assignable users for the embed's scope (active users only). */
export async function fetchUsers(): Promise<{ id: string; name: string; initials: string; email?: string }[]> {
  const scope = (window as unknown as { __AI_SCOPE__?: { enterpriseId?: string; teamId?: string } }).__AI_SCOPE__
  const url = beUrl("/api/users")
  if (scope?.enterpriseId) url.searchParams.set("enterpriseId", scope.enterpriseId)
  if (scope?.teamId) url.searchParams.set("teamId", scope.teamId)
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" })
  if (!res.ok) return []
  const body = await res.json()
  const active = body?.data?.activeUsers ?? {}
  return Object.values(active)
    .map((u: any) => {
      const name = u.user_name || u.label || u.email_id || u.user_id || ""
      const parts = String(name).trim().split(/\s+/).filter(Boolean)
      const initials = (parts.length ? parts[0][0] + (parts[1]?.[0] ?? "") : "–").toUpperCase()
      return { id: String(u.user_id), name, initials, email: u.email_id }
    })
    .filter((u) => u.id)
}

/** Assign an action item's lead to a user (PATCH via same-origin proxy). The embed's one write. */
export async function assignActionItem(leadId: string, userId: string): Promise<boolean> {
  if (!leadId || !userId) return false
  const res = await fetch(beUrl("/api/assign").toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ leadId, userId, action: "assign" }),
  })
  return res.ok
}

// Our UI resolution types → backend mark-resolved reasonCode.
export const RESOLVE_REASON_MAP: Record<string, string> = {
  appointment_booked: "APPOINTMENT_BOOKED",
  info_provided: "INFO_PROVIDED",
  customer_unreachable: "UNREACHABLE",
  dnc: "DO_NOT_CONTACT",
  other: "OTHER",
}
// Our UI incorrect reasons → backend mark-incorrect reasonCode.
export const INCORRECT_REASON_MAP: Record<string, string> = {
  wrong_intent: "MISCLASSIFIED_INTENT",
  customer_did_not_say_this: "MISCLASSIFIED_INTENT",
  not_a_task: "NOT_APPLICABLE",
  duplicate_of_existing: "DUPLICATE_ENTRY",
  spam_or_test: "SPAM_OR_TEST_CALL",
  other: "OTHER",
}

/** Mark one or many action items RESOLVED (PUT via proxy). `type` is our UI resolution type. */
export async function resolveActionItems(actionItemId: string | string[], type: string, note?: string, resolvedBy?: string): Promise<boolean> {
  const reasonCode = RESOLVE_REASON_MAP[type] || "OTHER"
  const res = await fetch(beUrl("/api/action-items/resolve").toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ actionItemId, reasonCode, note, resolvedBy }),
  })
  return res.ok
}

/** Mark one or many action items INCORRECT (PUT via proxy). `reason` is our UI incorrect reason. */
export async function markIncorrectActionItems(actionItemId: string | string[], reason: string, note?: string, resolvedBy?: string): Promise<boolean> {
  const reasonCode = INCORRECT_REASON_MAP[reason] || "OTHER"
  // NOTE: the backend mark-incorrect DTO is strict (forbidNonWhitelisted) — it rejects any extra
  // field with 400 "property X should not exist". So the reclassified intent is carried in `note`
  // (accepted), NOT as a dedicated field, until the BE adds a correctedIntent field to the DTO.
  const res = await fetch(beUrl("/api/action-items/incorrect").toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ actionItemId, reasonCode, note, resolvedBy }),
  })
  return res.ok
}

/** Persist a per-rooftop intent SLA / enabled override (PUT dealer-intent-config via proxy). */
export async function upsertDealerIntentConfig(opts: { intentCode: string; serviceType?: string; customSlaMinutes?: number; isEnabled?: boolean; updatedBy?: string }): Promise<boolean> {
  const scope = (window as unknown as { __AI_SCOPE__?: { enterpriseId?: string; teamId?: string } }).__AI_SCOPE__
  const res = await fetch(beUrl("/api/intent-config").toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ enterpriseId: scope?.enterpriseId, teamId: scope?.teamId, ...opts }),
  })
  return res.ok
}

/** GET the master intent catalog (name, serviceType, defaultSlaMinutes, isEnabled, …). */
export async function fetchIntentCatalog(serviceType?: string, isEnabled?: boolean): Promise<any[]> {
  const url = beUrl("/api/intent-catalog")
  if (serviceType && serviceType !== "all") url.searchParams.set("serviceType", serviceType)
  if (isEnabled != null) url.searchParams.set("isEnabled", String(isEnabled))
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" })
  if (!res.ok) return []
  const body = await res.json()
  return Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []
}

/** GET per-rooftop dealer intent config (custom SLA + enabled), scoped to the embed's enterprise/team. */
export async function fetchDealerIntentConfig(serviceType?: string): Promise<any[]> {
  const scope = (window as unknown as { __AI_SCOPE__?: { enterpriseId?: string; teamId?: string } }).__AI_SCOPE__
  const url = beUrl("/api/intent-config")
  if (scope?.enterpriseId) url.searchParams.set("enterpriseId", scope.enterpriseId)
  if (scope?.teamId) url.searchParams.set("teamId", scope.teamId)
  if (serviceType && serviceType !== "all") url.searchParams.set("serviceType", serviceType)
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" })
  if (!res.ok) return []
  const body = await res.json()
  return Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []
}

/** GET the public extraction config (canonical intents + system prompt) for a department. */
export async function fetchExtractionConfig(department = "sales"): Promise<any | null> {
  const url = beUrl("/api/extraction-config")
  url.searchParams.set("department", department)
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" })
  if (!res.ok) return null
  return res.json()
}

/**
 * Build the live intent taxonomy {intentCode: {display_name, dept, sla_hours, timeSensitive}} by
 * merging intent-catalog (name + default SLA) · extraction-config (labels + time-sensitivity) ·
 * dealer-intent-config (per-rooftop SLA overrides). Returned map is merged into INTENT_TAXONOMY.
 */
export async function fetchLiveTaxonomy(): Promise<Record<string, { display_name: string; dept: any; sla_hours: number; timeSensitive?: boolean }>> {
  const [cat, exSales, exSvc, dealer] = await Promise.all([
    fetchIntentCatalog().catch(() => []),
    fetchExtractionConfig("sales").catch(() => null),
    fetchExtractionConfig("service").catch(() => null),
    fetchDealerIntentConfig().catch(() => []),
  ])
  const out: Record<string, { display_name: string; dept: any; sla_hours: number; timeSensitive?: boolean }> = {}
  for (const c of cat) {
    if (!c?.intentCode) continue
    out[c.intentCode] = { display_name: c.name || prettyIntent(c.intentCode), dept: deptFromServiceType(c.serviceType), sla_hours: (c.defaultSlaMinutes ?? 1440) / 60 }
  }
  for (const ex of [exSales, exSvc]) {
    for (const i of (ex?.intents || [])) {
      const e = out[i.key] || (out[i.key] = { display_name: prettyIntent(i.key), dept: deptFromServiceType(ex?.department), sla_hours: 24 })
      if (i.displayLabel) e.display_name = i.displayLabel
      if (i.isTimeSensitive != null) e.timeSensitive = i.isTimeSensitive
    }
  }
  for (const d of dealer) {
    if (d?.intentCode && d.customSlaMinutes != null && out[d.intentCode]) out[d.intentCode].sla_hours = d.customSlaMinutes / 60
  }
  return out
}

/** LOCAL/DEV: call detail (recording, transcript, AI summary) via the same-origin proxy. */
export async function fetchCallReport(callId: string): Promise<any | null> {
  if (!callId) return null
  const res = await fetch(beUrl("/api/call-report").toString() + `&callId=${encodeURIComponent(callId)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`call-report ${res.status}`)
  return res.json()
}

/** LOCAL/DEV: the customer's conversations via the same-origin proxy. Returns { conversations, summary }.
 *  Scoped to the embed's selected department (window.__AI_SCOPE__.department) so leads/conversations
 *  match the top-level department filter; falls back to the proxy default when unset. */
export async function fetchConversations(customerId: string): Promise<{ conversations: any[]; summary: any }> {
  const scope = (window as unknown as { __AI_SCOPE__?: { department?: string; enterpriseId?: string; teamId?: string } }).__AI_SCOPE__
  const dept = scope?.department && scope.department !== "all" ? scope.department : undefined
  const url = beUrl("/api/conversations")
  url.searchParams.set("customerId", customerId)
  // Enterprise/team are UI-driven (window.__AI_SCOPE__) — pass them so the drawer follows the
  // entered rooftop, not the proxy's env defaults. Proxy falls back to env only when unset.
  if (scope?.enterpriseId) url.searchParams.set("enterpriseId", scope.enterpriseId)
  if (scope?.teamId) url.searchParams.set("teamId", scope.teamId)
  if (dept) url.searchParams.set("department", dept)
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`conversations ${res.status}`)
  const body = await res.json()
  const data = body?.data ?? {}
  return { conversations: Array.isArray(data.conversations) ? data.conversations : [], summary: data.summary ?? null }
}
