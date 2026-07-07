/**
 * Maps conversational-ai-backend action-item docs → the console's ActionItem shape.
 * Aligned to the REAL prod response (verified against api.spyne.ai GET /conversation/action-items):
 *   - intent is a top-level UPPERCASE string (e.g. REQUEST_CALLBACK), not meta.intent_id
 *   - the "what needs doing" recap is top-level `description` (`summary` is usually empty)
 *   - the source quote is top-level `evidence`
 *   - source conversation id is `meta.conversationId` (camelCase); channel is call (meta.callSid)
 *   - assigned_to is often "SYSTEM" (auto) → treated as unassigned
 * Forward-compatible: still honours PRD-style `meta.*` fields when present.
 * Defensive: every field has a fallback so a sparse/unknown shape never throws.
 */
import type { ActionItem, Channel, IntentId, ActionItemStatus } from "./data"
import { ensureIntent } from "./data"

const INTENT_IDS: IntentId[] = [
  "pricing_quote", "recall_response", "callback_request", "status_update",
  "appointment_inquiry", "service_intent", "vehicle_inquiry", "trade_in_inquiry",
  "complaint", "sms_takeover", "specific_salesperson", "compliance_alert", "no_show",
]
const CHANNELS: Channel[] = ["call", "sms", "chat", "email", "hitl_takeover", "hitl_warm_transfer"]

// Prod BE intent vocabulary → console IntentId (verified values + room for more).
const BE_INTENT_TO_CONSOLE: Record<string, IntentId> = {
  REQUEST_CALLBACK: "callback_request",
  SERVICE_PARTS_CALLBACK: "callback_request",
  SERVICE_SCHEDULE_APPOINTMENT: "appointment_inquiry",
  SERVICE_SEND_ESTIMATE: "pricing_quote",
  SERVICE_STATUS_UPDATE: "status_update",
  SERVICE_RECALL: "recall_response",
  SERVICE_COMPLAINT: "complaint",
  CUSTOM: "service_intent",
}

function resolveIntent(doc: any, meta: any): IntentId {
  // Prefer the REAL backend intent code (matches the live intent-catalog); ensure a taxonomy
  // entry exists so lookups render (the catalog fetch later enriches label/SLA/dept).
  const raw = String(doc?.intent ?? "").toUpperCase().trim()
  if (raw) { ensureIntent(raw); return raw as IntentId }
  if (INTENT_IDS.indexOf(meta?.intent_id) >= 0) return meta.intent_id
  if (BE_INTENT_TO_CONSOLE[raw]) return BE_INTENT_TO_CONSOLE[raw]
  return "service_intent" // last resort
}

function asText(v: any): string {
  if (typeof v === "string") return v
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" · ")
  if (v && typeof v === "object") return asText(v.text ?? v.quote ?? v.message ?? "")
  return ""
}

/**
 * Action-item docs carry supporting `evidence` inline — an array of { author, message } entries.
 * IMPORTANT: only the `User` (customer) entries are verbatim transcript quotes. The `Assistant`
 * entries are Vini's REASONING/justification for the item (e.g. "…so he needs a service advisor",
 * third-person) — NOT a spoken agent line, and frequently absent from the actual call transcript.
 * So we tag customer quotes as role "customer" and the AI's notes as role "ai" (rationale), and the
 * UI presents them separately — never as a two-party verbatim transcript. Returns [] when not an array.
 */
function evidenceTurns(v: any): { role: string; text: string }[] {
  if (!Array.isArray(v)) return []
  return v
    .map((e: any) => ({
      role: /assistant|agent|\bbot\b|\bai\b|vini/i.test(String(e?.author ?? e?.role ?? "")) ? "ai" : "customer",
      text: String(e?.message ?? e?.text ?? e?.quote ?? asText(e)).trim(),
    }))
    .filter((t) => t.text)
}

// Backend resolution/incorrect reasonCode → our UI reason keys (reverse of be-client's maps), so
// resolved/incorrect items loaded back from the DB show the right reason and land in the right tab.
const RESOLVE_CODE_TO_UI: Record<string, string> = {
  APPOINTMENT_BOOKED: "appointment_booked", INFO_PROVIDED: "info_provided",
  UNREACHABLE: "customer_unreachable", DO_NOT_CONTACT: "dnc", OTHER: "other",
}
const INCORRECT_CODE_TO_UI: Record<string, string> = {
  MISCLASSIFIED_INTENT: "wrong_intent", NOT_APPLICABLE: "not_a_task",
  DUPLICATE_ENTRY: "duplicate_of_existing", SPAM_OR_TEST_CALL: "spam_or_test", OTHER: "other",
}

export function mapBeItem(doc: any): ActionItem {
  const meta = (doc && doc.meta) || {}
  const customer = (doc && doc.customer) || {}
  const ch = meta.source_channel ?? meta.source_type ?? (meta.callSid ? "call" : undefined)
  const channel: Channel = CHANNELS.indexOf(ch) >= 0 ? ch : "call"
  // Persisted outcome (from a console resolve/mark-incorrect): meta.resolution.{status,reasonCode,…}.
  const resolution = (meta && meta.resolution) || null
  const resStatus = resolution?.status ? String(resolution.status).toUpperCase() : null
  const isIncorrect = resStatus === "INCORRECT" || meta.status === "incorrect" || doc?.is_active === false
  // Check INCORRECT before is_completed — mark-incorrect ALSO sets is_completed:true, so an incorrect
  // item would otherwise be mis-bucketed as "completed".
  const status: ActionItemStatus = isIncorrect
    ? "incorrect"
    : doc?.is_completed
      ? "completed"
      : "pending"
  const createdAt = doc?.createdAt ?? doc?.created_at ?? meta.created_at ?? new Date().toISOString()
  const rawAssignee = doc?.assigned_to ?? meta.assignee_user_id
  const assignee = rawAssignee && rawAssignee !== "SYSTEM" ? String(rawAssignee) : undefined

  return {
    action_item_id: String(doc?._id ?? doc?.id ?? meta.action_item_id ?? ""),
    customer_id: String(meta.customer_id ?? customer.customer_id ?? doc?.lead_id ?? ""),
    lead_id: doc?.lead_id ?? meta.lead_id ?? undefined,
    customer_name: customer.name ?? meta.customer_name ?? undefined,
    source_channel: channel,
    intent_id: resolveIntent(doc, meta),
    is_primary_intent_of_source: meta.is_primary_intent_of_source ?? true,
    intent_recap: meta.intent_recap || asText(doc?.summary) || asText(doc?.description) || "",
    source_message: meta.source_message || asText(doc?.evidence) || asText(doc?.description) || "",
    // Inline transcript turns (from `evidence`) — the drawer renders these when no full
    // call report / conversation thread is fetchable for the item.
    evidence_turns: evidenceTurns(doc?.evidence),
    created_at: createdAt,
    created_by_ai: meta.created_by_ai ?? true,
    status,
    assignee_user_id: assignee,
    closed_at: resolution?.resolvedAt ?? doc?.completedAt ?? meta.closed_at ?? undefined,
    resolution_note: resolution?.note ?? meta.resolution_note ?? undefined,
    resolution_type: (!isIncorrect && resolution?.reasonCode ? RESOLVE_CODE_TO_UI[resolution.reasonCode] : undefined) ?? meta.resolution_type ?? undefined,
    incorrect_reason: (isIncorrect && resolution?.reasonCode ? INCORRECT_CODE_TO_UI[resolution.reasonCode] : undefined) ?? meta.incorrect_reason ?? undefined,
    repeat_caller_count: Number(meta.repeat_caller_count ?? 0),
    last_observed_at: meta.last_observed_at ?? doc?.updatedAt ?? createdAt,
    escalation_reason: meta.escalation_reason ?? (doc?.time_sensitive ? "aged_past_sla" : undefined),
    // Source linkage — wire "Listen"/"Transcript" to the call + conversation.
    source_call_id: meta.callSid ?? meta.call_id ?? meta.callId ?? undefined,
    source_conversation_id: meta.conversationId ?? meta.conversation_id ?? meta.source_conversation_id ?? undefined,
  }
}

/** CUSTOMERS-style lookup ({ id: { name, phone } }) from the BE response's inline customer data. */
export function customersFromBe(docs: any[]): Record<string, { name: string; phone: string }> {
  const out: Record<string, { name: string; phone: string }> = {}
  for (const d of docs || []) {
    const c = d?.customer || {}
    const id = String(d?.meta?.customer_id ?? c.customer_id ?? d?.lead_id ?? "")
    if (!id) continue
    out[id] = {
      name: c.name ?? d?.meta?.customer_name ?? "Customer",
      phone: c.mobile ?? (Array.isArray(c.emails) ? c.emails[0] : "") ?? "",
    }
  }
  return out
}

/** USERS-style lookup ({ id: { name, initials } }) for real assignees (skips "SYSTEM"/auto). */
export function usersFromBe(docs: any[]): Record<string, { name: string; initials: string }> {
  const out: Record<string, { name: string; initials: string }> = {}
  for (const d of docs || []) {
    const id = d?.assigned_to
    if (!id || id === "SYSTEM") continue
    const name = d?.assignee_name ?? d?.meta?.assignee_name ?? String(id)
    const parts = String(name).trim().split(/\s+/).filter(Boolean)
    const initials = (parts.length ? (parts[0][0] + (parts[1]?.[0] ?? "")) : "–").toUpperCase()
    out[String(id)] = { name, initials }
  }
  return out
}

/**
 * Normalize a conversational-ai-backend end-call report (GET /conversation/vapi/
 * end-call-report-by-id) into the fields the Call/Conversation drawer renders.
 * Defensive: tolerates missing nesting.
 */
export function normalizeCallReport(raw: any) {
  const cd = raw?.callDetails ?? {}
  const rep = raw?.report ?? {}
  const ovTop = rep?.overview ?? {} // appointmentScheduled / callbackScheduled / callOutcome / appointmentDetails
  const ov = ovTop?.overall ?? {} // customerIntent / sentiment / aiResponseQuality
  const start = cd.startedAt ? Date.parse(cd.startedAt) : NaN
  const end = cd.endedAt ? Date.parse(cd.endedAt) : NaN
  const durationSec =
    Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 1000)) : null

  // Key Highlights / Call Summary — `report.summary` is the bullet array shown in the prod drawer.
  const summaryPoints: string[] = Array.isArray(rep.summary)
    ? rep.summary.map(asText).filter(Boolean)
    : rep.summary
      ? [asText(rep.summary)]
      : Array.isArray(rep.SummarySMS)
        ? rep.SummarySMS.map(asText).filter(Boolean)
        : []
  const actionItems: string[] = Array.isArray(rep.actionItems)
    ? rep.actionItems.map(asText).filter(Boolean)
    : rep.actionItems
      ? [asText(rep.actionItems)]
      : []

  // AI Performance Analysis (report.overview.overall.aiResponseQuality).
  const q = ov?.aiResponseQuality ?? {}
  const aiQuality = {
    score: q.score ?? null, // "8.5"
    relevanceClarity: q?.metrics?.responseRelevanceAndClarity ?? null, // "9"
    metrics: q?.metrics ?? null,
    didWell: Array.isArray(q.whatAiDidBetter) ? q.whatAiDidBetter.filter(Boolean) : [],
    improve: Array.isArray(q.whatAiCouldHaveDoneBetter) ? q.whatAiCouldHaveDoneBetter.filter(Boolean) : [],
  }

  // Appointment (report.overview.*).
  const appointment = {
    // BE sends 'Yes'/'No' (or sometimes boolean) — only "Yes"/true counts as scheduled.
    scheduled: ovTop.appointmentScheduled === true || ovTop.appointmentScheduled === "Yes",
    callbackScheduled: !!ovTop.callbackScheduled,
    type: ovTop.appointmentType || null,
    details: Array.isArray(ovTop.appointmentDetails) ? ovTop.appointmentDetails.map(asText).filter(Boolean) : [],
  }

  // Timestamped turns — raw `callDetails.messages` carry secondsFromStart + absolute `time`
  // (formattedMessages drop the timing). `time` powers the SMS scroll-to-creation marker.
  const messages = (Array.isArray(cd.messages) ? cd.messages : [])
    .filter((m: any) => m?.role && m.role !== "system")
    .map((m: any) => ({
      role: m.role === "bot" || m.role === "assistant" ? "agent" : "customer",
      text: asText(m.message ?? m.content),
      atSec: typeof m.secondsFromStart === "number" ? m.secondsFromStart : null,
      atMs: typeof m.time === "number" ? m.time : null,
    }))
    .filter((m: any) => m.text)

  return {
    callId: raw?.callId ?? cd.callId ?? "",
    title: asText(rep.title) || null,
    createdAt: raw?.createdAt ?? cd.startedAt ?? null,
    recordingUrl: cd.recordingUrl ?? null,
    durationSec,
    transcript: cd.transcript ?? "", // "AI: …\nCustomer: …" fallback
    messages,
    summaryPoints,
    summaryText: summaryPoints.join(" "),
    analysisSummary: asText(cd?.analysis?.summary) || "", // prose "Call Summary" (separate from highlights)
    actionItems,
    customerName: rep?.customerDetails?.name ?? cd.name ?? null,
    customerMobile: rep?.customerDetails?.mobile ?? cd.mobile ?? null,
    outcome: ovTop.callOutcome ?? rep?.Outcome ?? rep?.outcome ?? null,
    queryResolved: rep?.queryResolved ?? null,
    customerIntent: ov.customerIntent ?? null,
    sentiment: ov.sentiment ?? null,
    sentimentScore: ov.sentimentScore ?? null,
    aiQuality,
    appointment,
    aiScore: rep?.aiScore?.totalScore ?? null,
    callScore: rep?.callScore ?? null,
    endedReason: cd.endedReason ?? null,
  }
}
