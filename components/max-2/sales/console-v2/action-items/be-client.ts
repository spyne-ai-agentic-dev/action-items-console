/**
 * Direct Action Items backend client for the iframe embed.
 *
 * Every call goes STRAIGHT to the Spyne backend (conversational-ai-backend) from the browser —
 * there is NO same-origin /api proxy. Scope (env / token / enterpriseId / teamId) comes entirely
 * from the iframe URL, mirrored onto window.__AI_SCOPE__ by app/page.tsx:
 *   /?env=uat|stag|prod&enterpriseId=<id>&teamId=<id>&token=<bearer>
 * env → base URL via apiBaseForEnv (uat-api.spyne.xyz | beta-api.spyne.xyz | api.spyne.ai).
 */
import { CUSTOMERS, USERS, prettyIntent, deptFromServiceType, type ActionItem } from "./data"
import { getEmbedScope, apiBaseForEnv, type EmbedScope } from "./be-scope"
import { mapBeItem, customersFromBe, usersFromBe } from "./be-mapper"

/** Raw URL-injected scope (window.__AI_SCOPE__) — may be partial before params resolve. */
function rawScope(): Partial<EmbedScope> {
  if (typeof window === "undefined") return {}
  return (window as unknown as { __AI_SCOPE__?: Partial<EmbedScope> }).__AI_SCOPE__ || {}
}
/** Backend base URL for the env carried on the iframe URL (defaults to prod). */
function apiBase(): string {
  return apiBaseForEnv(rawScope().env || "prod")
}
/** Request headers with the URL-injected bearer token attached (when present). */
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = rawScope().token
  return { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(extra || {}) }
}

export async function fetchActionItems(): Promise<ActionItem[] | null> {
  const scope = getEmbedScope()
  if (!scope) return null // no embed scope (missing token/enterpriseId/teamId) → caller uses mock

  const url = new URL(`${apiBaseForEnv(scope.env)}/conversation/action-items`)
  url.searchParams.set("enterpriseId", scope.enterpriseId)
  url.searchParams.set("teamId", scope.teamId)
  url.searchParams.set("isCompleted", "false")
  url.searchParams.set("groupByCustomer", "false")
  url.searchParams.set("limit", "100")
  // Department is applied client-side (action items have no department field) — not sent here.

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${scope.token}`, Accept: "application/json" },
    cache: "no-store",
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
 * Completed items (RESOLVED + INCORRECT) from the DB, so the Resolved/Incorrect tabs persist across
 * reloads instead of only showing this session's actions. Filtered to items with a console/human
 * resolution (`meta.resolution`) — skips AI/system-completed items (e.g. outbound SMS) that would
 * otherwise clutter the Resolved tab. Status/reason are derived from meta.resolution in mapBeItem.
 */
export async function fetchCompletedActionItems(): Promise<ActionItem[]> {
  const scope = getEmbedScope()
  if (!scope) return []
  const url = new URL(`${apiBaseForEnv(scope.env)}/conversation/action-items`)
  url.searchParams.set("enterpriseId", scope.enterpriseId)
  url.searchParams.set("teamId", scope.teamId)
  url.searchParams.set("isCompleted", "true")
  url.searchParams.set("groupByCustomer", "false")
  url.searchParams.set("limit", "200")
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${scope.token}`, Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) return []
  const body = await res.json()
  const all: any[] = Array.isArray(body?.data)
    ? body.grouped ? body.data.flatMap((g: any) => g?.actionItems ?? []) : body.data
    : []
  const raw = all.filter((it) => it?.meta?.resolution) // only console/human resolve/flag actions
  Object.assign(CUSTOMERS, customersFromBe(raw))
  Object.assign(USERS, usersFromBe(raw))
  return raw.map(mapBeItem)
}

/** Assignable users for the embed's scope (active users only). */
export async function fetchUsers(): Promise<{ id: string; name: string; initials: string; email?: string }[]> {
  const s = rawScope()
  const url = new URL(`${apiBase()}/console/v1/user/get-user-list`)
  if (s.enterpriseId) url.searchParams.set("enterpriseId", s.enterpriseId)
  url.searchParams.set("teamIds", JSON.stringify([s.teamId || ""]))
  url.searchParams.set("page", "1")
  url.searchParams.set("batchSize", "100")
  url.searchParams.set("onlyActive", "true")
  const res = await fetch(url.toString(), { headers: authHeaders(), cache: "no-store" })
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

/** Assign an action item's lead to a user (PATCH). The embed's core write. */
export async function assignActionItem(leadId: string, userId: string): Promise<boolean> {
  if (!leadId || !userId) return false
  const url = new URL(`${apiBase()}/leads/dealer/v1/assignment`)
  url.searchParams.set("lead_id", String(leadId))
  url.searchParams.set("action", "assign")
  url.searchParams.set("user_id", String(userId))
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: "{}",
    cache: "no-store",
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

/** Mark one or many action items RESOLVED (PUT). `type` is our UI resolution type. */
export async function resolveActionItems(actionItemId: string | string[], type: string, note?: string, resolvedBy?: string): Promise<boolean> {
  const reasonCode = RESOLVE_REASON_MAP[type] || "OTHER"
  // The backend DTO requires `note` and `resolvedBy` to be NON-EMPTY strings (empty → 400
  // "note should not be empty"). Fall back to a descriptive default when the UI has none.
  const res = await fetch(`${apiBase()}/conversation/action-items/mark-resolved`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ actionItemId, isComplete: true, resolvedBy: resolvedBy || "console", reasonCode, note: (note && note.trim()) || `Resolved via console (${reasonCode})` }),
    cache: "no-store",
  })
  return res.ok
}

/** Mark one or many action items INCORRECT (PUT). `reason` is our UI incorrect reason. */
export async function markIncorrectActionItems(actionItemId: string | string[], reason: string, note?: string, resolvedBy?: string): Promise<boolean> {
  const reasonCode = INCORRECT_REASON_MAP[reason] || "OTHER"
  // NOTE: the backend mark-incorrect DTO is strict (forbidNonWhitelisted) — it rejects any extra
  // field with 400 "property X should not exist". So the reclassified intent is carried in `note`
  // (accepted), NOT as a dedicated field, until the BE adds a correctedIntent field to the DTO.
  // It ALSO requires `note` + `resolvedBy` to be NON-EMPTY (empty note → 400 "note should not be
  // empty"), which is why flagging without a reclassification used to fail silently — default it.
  const res = await fetch(`${apiBase()}/conversation/action-items/mark-incorrect`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ actionItemId, isComplete: true, resolvedBy: resolvedBy || "console", reasonCode, note: (note && note.trim()) || `Marked incorrect via console (${reasonCode})` }),
    cache: "no-store",
  })
  return res.ok
}

/** Persist a per-rooftop intent SLA / enabled override (PUT dealer-intent-config). */
export async function upsertDealerIntentConfig(opts: { intentCode: string; serviceType?: string; customSlaMinutes?: number; isEnabled?: boolean; updatedBy?: string }): Promise<boolean> {
  if (!opts.intentCode) return false
  const s = rawScope()
  const enterpriseId = s.enterpriseId || ""
  const teamId = s.teamId || ""
  const payload: Record<string, unknown> = { updatedBy: opts.updatedBy || "console" }
  if (opts.serviceType) payload.serviceType = opts.serviceType
  if (opts.customSlaMinutes != null) payload.customSlaMinutes = opts.customSlaMinutes
  if (opts.isEnabled != null) payload.isEnabled = opts.isEnabled
  const url = `${apiBase()}/conversation/dealer-intent-config/${encodeURIComponent(enterpriseId)}/${encodeURIComponent(teamId)}/${encodeURIComponent(opts.intentCode)}`
  const res = await fetch(url, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    cache: "no-store",
  })
  return res.ok
}

/** GET the master intent catalog (name, serviceType, defaultSlaMinutes, isEnabled, …). */
export async function fetchIntentCatalog(serviceType?: string, isEnabled?: boolean): Promise<any[]> {
  const url = new URL(`${apiBase()}/conversation/intent-catalog`)
  if (serviceType && serviceType !== "all") url.searchParams.set("serviceType", serviceType)
  if (isEnabled != null) url.searchParams.set("isEnabled", String(isEnabled))
  const res = await fetch(url.toString(), { headers: authHeaders(), cache: "no-store" })
  if (!res.ok) return []
  const body = await res.json()
  return Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []
}

/** GET per-rooftop dealer intent config (custom SLA + enabled), scoped to the embed's enterprise/team. */
export async function fetchDealerIntentConfig(serviceType?: string): Promise<any[]> {
  const s = rawScope()
  const url = new URL(`${apiBase()}/conversation/dealer-intent-config`)
  if (s.enterpriseId) url.searchParams.set("enterpriseId", s.enterpriseId)
  if (s.teamId) url.searchParams.set("teamId", s.teamId)
  if (serviceType && serviceType !== "all") url.searchParams.set("serviceType", serviceType)
  const res = await fetch(url.toString(), { headers: authHeaders(), cache: "no-store" })
  if (!res.ok) return []
  const body = await res.json()
  return Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []
}

/** GET the public extraction config (canonical intents + system prompt) for a department. */
export async function fetchExtractionConfig(department = "sales"): Promise<any | null> {
  const url = new URL(`${apiBase()}/conversation/action-items/config`)
  url.searchParams.set("department", department)
  const res = await fetch(url.toString(), { headers: authHeaders(), cache: "no-store" })
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

/**
 * Same-origin audio shim URL for the waveform player. WaveSurfer fetches the bytes to draw the
 * waveform, but the S3 recording host sends no CORS header, so the presigned URL (obtained directly
 * from fetchCallReport) is piped through a token-free same-origin streamer. See app/api/call-recording.
 */
export function recordingProxyUrl(recordingUrl: string): string {
  if (!recordingUrl) return ""
  // ABSOLUTE url — WaveSurfer's player only accepts http(s):// (a relative /api/… is rejected as
  // "No recording available"). Same-origin, so it still routes through the shim.
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return `${origin}/api/call-recording?url=${encodeURIComponent(recordingUrl)}`
}

/** Call detail (recording, transcript, AI summary) — direct backend call. */
export async function fetchCallReport(callId: string): Promise<any | null> {
  if (!callId) return null
  const url = `${apiBase()}/conversation/vapi/end-call-report-by-id?callId=${encodeURIComponent(callId)}`
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" })
  if (!res.ok) throw new Error(`call-report ${res.status}`)
  return res.json()
}

/** The customer's conversations — direct backend call. Returns { conversations, summary }.
 *  Scoped to the embed's selected department (window.__AI_SCOPE__.department) so leads/conversations
 *  match the top-level department filter; defaults to "service" when unset. */
export async function fetchConversations(customerId: string): Promise<{ conversations: any[]; summary: any }> {
  const s = rawScope()
  const dept = s.department && s.department !== "all" ? s.department : "service"
  const url = new URL(`${apiBase()}/conversation/customers/conversations`)
  url.searchParams.set("customer_id", customerId)
  if (s.enterpriseId) url.searchParams.set("enterprise_id", s.enterpriseId)
  if (s.teamId) url.searchParams.set("team_id", s.teamId)
  url.searchParams.set("department", dept)
  url.searchParams.set("page", "1")
  url.searchParams.set("page_size", "10")
  const res = await fetch(url.toString(), { headers: authHeaders(), cache: "no-store" })
  if (!res.ok) throw new Error(`conversations ${res.status}`)
  const body = await res.json()
  const data = body?.data ?? {}
  return { conversations: Array.isArray(data.conversations) ? data.conversations : [], summary: data.summary ?? null }
}
