/**
 * Action Items — data model + seed (vini-product Console Action Items v3.1),
 * tuned to the reference UI's counts (3 breaching · 6 unassigned · 1 repeat
 * caller · 13 unresolved). Relative timestamps so SLA states stay correct
 * regardless of the current date.
 */

export const NOW_ISO = new Date().toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

export type Channel = "call" | "sms" | "chat" | "email" | "hitl_takeover" | "hitl_warm_transfer";
export type Dept = "sales" | "service" | "both" | "compliance";
export type IntentId =
  | "pricing_quote" | "recall_response" | "callback_request" | "status_update"
  | "appointment_inquiry" | "service_intent" | "vehicle_inquiry" | "trade_in_inquiry"
  | "complaint" | "sms_takeover" | "specific_salesperson" | "compliance_alert"
  | "no_show" | "general_info";
export type ActionItemStatus = "pending" | "completed" | "incorrect";
export type IncorrectReason = "wrong_intent" | "not_a_task" | "customer_did_not_say_this" | "duplicate_of_existing" | "other";
export type ResolutionType = "appointment_booked" | "info_provided" | "customer_unreachable" | "dnc" | "other";

export interface IntentMeta { id: IntentId; display_name: string; dept: Dept; typical_resolution: string; sla_hours: number; live?: boolean; }

export interface ActionItem {
  action_item_id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  lead_id?: string; // BE lead id — needed by the assignment API
  source_channel: Channel;
  intent_id: IntentId;
  is_primary_intent_of_source: boolean;
  intent_recap: string;
  source_message: string;
  created_at: string;
  created_by_ai: boolean;
  status: ActionItemStatus;
  assignee_user_id?: string;
  closed_at?: string;
  resolution_note?: string;
  resolution_type?: ResolutionType;
  incorrect_reason?: IncorrectReason;
  repeat_caller_count: number;
  last_observed_at: string;
  escalation_reason?: "aged_past_sla" | "repeat_caller_threshold" | "compliance_flagged";
  // Source linkage (from the backend): the originating call + conversation for this item.
  source_call_id?: string;
  source_conversation_id?: string;
  // Inline transcript excerpt (from the doc's `evidence`) — rendered by the drawer when no
  // full call report / conversation thread is fetchable.
  evidence_turns?: { role: string; text: string }[];
  // Authoritative per-item department from the backend's own `service_type` field (sales|service|
  // parts). Several intent codes (CUSTOM, ScheduleAppointment, RequestCallback, …) are shared across
  // departments, so the intent code alone CANNOT determine department — deptOf() prefers this field.
  department?: Dept;
}

export const INTENT_TAXONOMY: Record<IntentId, IntentMeta> = {
  pricing_quote: { id: "pricing_quote", display_name: "Pricing or quote", dept: "both", typical_resolution: "Adviser to call back with quote", sla_hours: 24 },
  recall_response: { id: "recall_response", display_name: "Recall inquiry", dept: "service", typical_resolution: "VIN-verify + book appointment", sla_hours: 4 },
  callback_request: { id: "callback_request", display_name: "Callback request", dept: "both", typical_resolution: "Rep calls back within SLA", sla_hours: 4 },
  status_update: { id: "status_update", display_name: "Status update", dept: "service", typical_resolution: "Look up RO, reply with status", sla_hours: 8 },
  appointment_inquiry: { id: "appointment_inquiry", display_name: "Appointment", dept: "both", typical_resolution: "Confirm slot, book", sla_hours: 24 },
  service_intent: { id: "service_intent", display_name: "Service intent", dept: "service", typical_resolution: "Reach out, qualify, book", sla_hours: 24 },
  vehicle_inquiry: { id: "vehicle_inquiry", display_name: "Vehicle inquiry", dept: "sales", typical_resolution: "Adviser engagement", sla_hours: 24 },
  trade_in_inquiry: { id: "trade_in_inquiry", display_name: "Trade-in inquiry", dept: "sales", typical_resolution: "Trade desk to provide offer", sla_hours: 24 },
  complaint: { id: "complaint", display_name: "Complaint", dept: "both", typical_resolution: "Manager to handle", sla_hours: 4 },
  sms_takeover: { id: "sms_takeover", display_name: "SMS takeover", dept: "both", typical_resolution: "Human continues thread", sla_hours: 4 },
  specific_salesperson: { id: "specific_salesperson", display_name: "Named adviser", dept: "sales", typical_resolution: "Route to named adviser", sla_hours: 24 },
  compliance_alert: { id: "compliance_alert", display_name: "Compliance alert", dept: "compliance", typical_resolution: "Compliance officer review", sla_hours: 4 },
  no_show: { id: "no_show", display_name: "No-show", dept: "service", typical_resolution: "BDC follows up to reschedule", sla_hours: 8 },
  general_info: { id: "general_info", display_name: "General info", dept: "both", typical_resolution: "Closes in-call unless unresolved", sla_hours: 48 },
};

export const DEPT_BADGE: Record<Dept, string> = {
  sales: "spyne-badge-info", service: "spyne-badge-success", both: "spyne-badge-neutral", compliance: "spyne-badge-error",
};

export const DEPT_LABEL: Record<Dept, string> = {
  sales: "Sales", service: "Service", both: "Sales + Service", compliance: "Compliance",
};

/** Resolution types in display order (the Resolve picker + resolved badges). */
export const RESOLUTION_TYPES: { value: ResolutionType; label: string; glyph: string }[] = [
  { value: "appointment_booked", label: "Appointment booked", glyph: "event_available" },
  { value: "info_provided", label: "Info provided", glyph: "info" },
  { value: "customer_unreachable", label: "Customer unreachable", glyph: "phone_missed" },
  { value: "dnc", label: "DNC", glyph: "do_not_disturb_on" },
  { value: "other", label: "Other", glyph: "more_horiz" },
];

export const RESOLUTION_TYPE_LABEL: Record<ResolutionType, string> =
  Object.fromEntries(RESOLUTION_TYPES.map((r) => [r.value, r.label])) as Record<ResolutionType, string>;

export const RESOLUTION_TYPE_GLYPH: Record<ResolutionType, string> =
  Object.fromEntries(RESOLUTION_TYPES.map((r) => [r.value, r.glyph])) as Record<ResolutionType, string>;

export const CHANNEL_META: Record<Channel, { label: string; symbol: string }> = {
  call: { label: "Call", symbol: "call" },
  sms: { label: "SMS", symbol: "sms" },
  chat: { label: "Chat", symbol: "chat" },
  email: { label: "Email", symbol: "mail" },
  hitl_takeover: { label: "Human takeover", symbol: "support_agent" },
  hitl_warm_transfer: { label: "Warm transfer", symbol: "swap_calls" },
};

export const CUSTOMERS: Record<string, { name: string; phone: string }> = {
  "c-gary-wise": { name: "Gary Wise", phone: "(949) 555-0123" },
  "c-daniela-ruiz": { name: "Daniela Ruiz", phone: "(949) 555-0149" },
  "c-amir-mehta": { name: "Amir Mehta", phone: "(949) 555-0188" },
  "c-jenna-clarke": { name: "Jenna Clarke", phone: "(949) 555-0204" },
  "c-rob-stearns": { name: "Rob Stearns", phone: "(949) 555-0231" },
  "c-lauren-ng": { name: "Lauren Ng", phone: "(949) 555-0307" },
  "c-marco-torres": { name: "Marco Torres", phone: "(949) 555-0412" },
  "c-sara-kapoor": { name: "Sara Kapoor", phone: "(949) 555-0521" },
  "c-tom-wallace": { name: "Tom Wallace", phone: "(949) 555-0633" },
  "c-elise-park": { name: "Elise Park", phone: "(949) 555-0717" },
};

export const USERS: Record<string, { name: string; initials: string }> = {
  "u-anya": { name: "Anya Kim", initials: "AK" },
  "u-lane": { name: "Lane Becker", initials: "LB" },
  "u-marcus": { name: "Marcus Reid", initials: "MR" },
  "u-priya": { name: "Priya Shah", initials: "PS" },
  "u-david": { name: "David Park", initials: "DP" },
  vini_agent: { name: "Vini (AI)", initials: "AI" },
};

export const CURRENT_USER_ID = "u-priya";

/** Cumulative metrics for the manager strip (point-in-time mock). */
export const CLEARED_TODAY = 11;
export const RESOLVED_TOTAL = 192;

export const ACTION_ITEMS: ActionItem[] = [
  { action_item_id: "ai-001", customer_id: "c-gary-wise", source_channel: "call", intent_id: "status_update", is_primary_intent_of_source: true, intent_recap: "The customer wants a status update on the GLC service repair.", source_message: "Hey, any update on my GLC service? It's been a few days and I haven't heard back.", created_at: hoursAgo(30), created_by_ai: true, status: "pending", repeat_caller_count: 5, last_observed_at: hoursAgo(2), escalation_reason: "repeat_caller_threshold" },
  { action_item_id: "ai-002", customer_id: "c-daniela-ruiz", source_channel: "sms", intent_id: "pricing_quote", is_primary_intent_of_source: true, intent_recap: "The customer is asking for a lease quote on a 2025 C 300.", source_message: "Hola, looking for a quote on a 2025 C 300 lease, and is my current C 300 affected by the airbag recall?", created_at: hoursAgo(4.4), created_by_ai: true, status: "pending", assignee_user_id: "u-lane", repeat_caller_count: 0, last_observed_at: hoursAgo(4.4) },
  { action_item_id: "ai-003", customer_id: "c-daniela-ruiz", source_channel: "sms", intent_id: "recall_response", is_primary_intent_of_source: false, intent_recap: "The customer wants to confirm whether their current vehicle is affected by the airbag recall.", source_message: "Hola, looking for a quote on a 2025 C 300 lease, and is my current C 300 affected by the airbag recall?", created_at: hoursAgo(6), created_by_ai: true, status: "pending", assignee_user_id: "u-priya", repeat_caller_count: 0, last_observed_at: hoursAgo(6) },
  { action_item_id: "ai-004", customer_id: "c-amir-mehta", source_channel: "email", intent_id: "vehicle_inquiry", is_primary_intent_of_source: true, intent_recap: "The customer is shopping for a GLE 450 and wants to know current inventory.", source_message: "Shopping for a GLE 450 — what's in stock? Also want a trade number on my 2020 Q5 and a ballpark on a 36-mo lease.", created_at: hoursAgo(7.5), created_by_ai: true, status: "pending", repeat_caller_count: 0, last_observed_at: hoursAgo(7.5) },
  { action_item_id: "ai-005", customer_id: "c-amir-mehta", source_channel: "email", intent_id: "trade_in_inquiry", is_primary_intent_of_source: false, intent_recap: "The customer wants a trade valuation on their 2020 Audi Q5.", source_message: "Shopping for a GLE 450 — what's in stock? Also want a trade number on my 2020 Q5 and a ballpark on a 36-mo lease.", created_at: hoursAgo(7.5), created_by_ai: true, status: "pending", repeat_caller_count: 0, last_observed_at: hoursAgo(7.5) },
  { action_item_id: "ai-006", customer_id: "c-amir-mehta", source_channel: "email", intent_id: "pricing_quote", is_primary_intent_of_source: false, intent_recap: "The customer is asking for a ballpark on a 36-month lease.", source_message: "Shopping for a GLE 450 — what's in stock? Also want a trade number on my 2020 Q5 and a ballpark on a 36-mo lease.", created_at: hoursAgo(7.5), created_by_ai: true, status: "pending", repeat_caller_count: 0, last_observed_at: hoursAgo(7.5) },
  { action_item_id: "ai-007", customer_id: "c-jenna-clarke", source_channel: "hitl_warm_transfer", intent_id: "recall_response", is_primary_intent_of_source: true, intent_recap: "Customer's 2020 E 350 has an open airbag recall; advisor booked Tuesday 10 AM.", source_message: "Got the recall notice on my E 350 — already booked Tuesday. Can you also add a brake fluid check?", created_at: hoursAgo(2), created_by_ai: true, status: "pending", assignee_user_id: "u-priya", repeat_caller_count: 0, last_observed_at: hoursAgo(2) },
  { action_item_id: "ai-008", customer_id: "c-jenna-clarke", source_channel: "hitl_warm_transfer", intent_id: "service_intent", is_primary_intent_of_source: false, intent_recap: "Add brake fluid inspection to the customer's recall appointment.", source_message: "Got the recall notice on my E 350 — already booked Tuesday. Can you also add a brake fluid check?", created_at: hoursAgo(2), created_by_ai: true, status: "pending", repeat_caller_count: 0, last_observed_at: hoursAgo(2) },
  { action_item_id: "ai-009", customer_id: "c-rob-stearns", source_channel: "call", intent_id: "no_show", is_primary_intent_of_source: true, intent_recap: "The customer missed their 9 AM appointment and needs to reschedule.", source_message: "Sorry I missed the 9 AM — can we reschedule for later this week?", created_at: hoursAgo(30), created_by_ai: false, status: "pending", assignee_user_id: "u-marcus", repeat_caller_count: 0, last_observed_at: hoursAgo(30), escalation_reason: "aged_past_sla" },
  { action_item_id: "ai-010", customer_id: "c-lauren-ng", source_channel: "chat", intent_id: "callback_request", is_primary_intent_of_source: true, intent_recap: "The customer wants a callback this afternoon about a GLC 300 lease.", source_message: "Can someone call me this afternoon about the GLC 300 lease?", created_at: hoursAgo(3.47), created_by_ai: true, status: "pending", assignee_user_id: "u-david", repeat_caller_count: 0, last_observed_at: hoursAgo(3.47) },
  { action_item_id: "ai-011", customer_id: "c-marco-torres", source_channel: "call", intent_id: "specific_salesperson", is_primary_intent_of_source: true, intent_recap: "Customer is asking for David Park specifically — wants to discuss an upgrade.", source_message: "Is David Park available? I want to talk to him about upgrading my lease.", created_at: hoursAgo(5.75), created_by_ai: true, status: "pending", assignee_user_id: "u-david", repeat_caller_count: 0, last_observed_at: hoursAgo(5.75) },
  { action_item_id: "ai-012", customer_id: "c-sara-kapoor", source_channel: "hitl_takeover", intent_id: "appointment_inquiry", is_primary_intent_of_source: false, intent_recap: "The customer wants to move their lease-end inspection to Friday morning.", source_message: "Can we move my lease-end inspection to Friday morning instead?", created_at: hoursAgo(1), created_by_ai: true, status: "pending", assignee_user_id: "u-marcus", repeat_caller_count: 0, last_observed_at: hoursAgo(1) },
  { action_item_id: "ai-013", customer_id: "c-tom-wallace", source_channel: "call", intent_id: "compliance_alert", is_primary_intent_of_source: true, intent_recap: "Customer requested DNC and opt-out from all marketing — compliance team review required.", source_message: "Take me off all marketing — do not call or text me again.", created_at: hoursAgo(0.4), created_by_ai: true, status: "pending", repeat_caller_count: 0, last_observed_at: hoursAgo(0.4), escalation_reason: "compliance_flagged" },
  // Resolved
  { action_item_id: "ai-100", customer_id: "c-elise-park", source_channel: "email", intent_id: "pricing_quote", is_primary_intent_of_source: true, intent_recap: "Customer requested an itemized 60k-mile service estimate on their S 580.", source_message: "Can I get an itemized 60k-mile service estimate for my S 580?", created_at: hoursAgo(78), created_by_ai: true, status: "completed", assignee_user_id: "u-priya", closed_at: hoursAgo(70), resolution_type: "info_provided", resolution_note: "Sent itemized estimate via email; customer reviewing before booking.", repeat_caller_count: 0, last_observed_at: hoursAgo(78) },
  { action_item_id: "ai-101", customer_id: "c-gary-wise", source_channel: "call", intent_id: "appointment_inquiry", is_primary_intent_of_source: false, intent_recap: "Customer wanted to book the GLC for the service appointment.", source_message: "I'd like to book my GLC in for the service.", created_at: hoursAgo(120), created_by_ai: true, status: "completed", assignee_user_id: "u-priya", closed_at: hoursAgo(115), resolution_type: "appointment_booked", resolution_note: "Booked for the 12th at 11 AM, confirmation sent via SMS.", repeat_caller_count: 0, last_observed_at: hoursAgo(120) },
  { action_item_id: "ai-102", customer_id: "c-marco-torres", source_channel: "call", intent_id: "status_update", is_primary_intent_of_source: false, intent_recap: "Customer asked about status of last service visit.", source_message: "What's the status on my last service visit?", created_at: hoursAgo(96), created_by_ai: true, status: "completed", assignee_user_id: "vini_agent", closed_at: hoursAgo(95), resolution_type: "info_provided", resolution_note: "Auto-resolved by Vini: pulled latest RO and SMS'd the customer.", repeat_caller_count: 0, last_observed_at: hoursAgo(96) },
];

/* ── Helpers ─────────────────────────────────────────────────────── */

const NOW_MS = Date.now();

export function ageMinutes(item: ActionItem): number {
  return Math.floor((NOW_MS - new Date(item.created_at).getTime()) / 60000);
}

export function ageLabel(mins: number): string {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) { const r = mins % 60; return r > 0 ? `${h}h ${r}m ago` : `${h}h ago`; }
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : `${Math.floor(d / 7)}w ago`;
}

export function isPastSla(item: ActionItem): boolean {
  if (item.status !== "pending") return false;
  return ageMinutes(item) >= (INTENT_TAXONOMY[item.intent_id]?.sla_hours ?? 24) * 60;
}

export function slaBurnRatio(item: ActionItem): number {
  const slaMins = Math.max(1, (INTENT_TAXONOMY[item.intent_id]?.sla_hours ?? 24) * 60);
  return ageMinutes(item) / slaMins;
}

/**
 * Phone search: digits-only comparison that ignores formatting AND the +1/1 country code on
 * either side — "2162022537" matches "+1 216-202-2537", and "12162022537" matches too. Requires
 * ≥4 query digits so short numeric queries (SLA hours, item ids) don't match every phone.
 */
export function phoneMatchesQuery(phone: string | undefined, query: string): boolean {
  const digits = (s: string) => String(s || "").replace(/\D+/g, "");
  const strip1 = (s: string) => (s.length === 11 && s.startsWith("1") ? s.slice(1) : s);
  const qd = strip1(digits(query));
  if (qd.length < 4) return false;
  const pd = strip1(digits(phone ?? ""));
  return pd.length > 0 && pd.includes(qd);
}

/**
 * ABSOLUTE minutes past the SLA deadline (negative while still inside SLA). This — not the burn
 * ratio — is the queue's priority key: an item breached for 1 week outranks one breached 5 days,
 * regardless of their SLA lengths, and a customer whose worst item is 1-week-overdue ranks above
 * a customer with several 5-day-overdue items. Inside-SLA items order by closest-to-breach.
 */
export function slaOverdueMinutes(item: ActionItem): number {
  const slaMins = Math.max(1, (INTENT_TAXONOMY[item.intent_id]?.sla_hours ?? 24) * 60);
  return ageMinutes(item) - slaMins;
}

export function deptOf(item: ActionItem): Dept {
  // Prefer the item's OWN backend service_type (authoritative, per-item) — the intent-code taxonomy
  // is a global per-code guess and several codes (CUSTOM, ScheduleAppointment, RequestCallback, …)
  // are used by both departments, which was misfiling Sales items into the Service tab and vice versa.
  return item.department ?? INTENT_TAXONOMY[item.intent_id]?.dept ?? "service";
}

/* ── Live intent catalog (UAT/prod) → merged into INTENT_TAXONOMY at runtime ─────────── */

/** "SERVICE_REQUEST_CALLBACK" / "ScheduleAppointment" → "Request Callback" / "Schedule Appointment". */
export function prettyIntent(code: string): string {
  const s = String(code || "")
    .replace(/^(SALES|SERVICE|PARTS)_/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase → words
    .replace(/[_-]+/g, " ")
    .trim().toLowerCase();
  return s.replace(/\b\w/g, (c) => c.toUpperCase()) || "Action";
}

/** Backend serviceType (sales|service|parts) → console Dept. */
export function deptFromServiceType(st?: string): Dept {
  const s = String(st || "").toLowerCase();
  return s === "sales" ? "sales" : "service"; // parts folds into service
}
/**
 * STRICT variant for per-item dept assignment (ActionItem.department): only trusts a recognized
 * value (sales|service|parts). Backend items can carry other service_type values that aren't a real
 * department (e.g. "sms" on system-generated items) — those return null so deptOf() falls back to
 * the intent-code heuristic instead of silently mis-bucketing on an unrelated field.
 */
export function deptFromServiceTypeStrict(st?: string): Dept | null {
  const s = String(st || "").toLowerCase();
  if (s === "sales") return "sales";
  if (s === "service" || s === "parts") return "service";
  return null;
}
/** Dept for an intent code: prefix first (SALES_/SERVICE_/PARTS_), else keyword-infer, else service. */
const deptFromCode = (code: string): Dept => {
  const prefix = String(code || "").split("_")[0].toLowerCase();
  if (prefix === "sales") return "sales";
  if (prefix === "service" || prefix === "parts") return "service";
  return /vehicle|test.?drive|trade|finance|showroom|quote|be.?back|lost.?lead|price|salesperson/i.test(String(code || ""))
    ? "sales" : "service";
};

/** Ensure a taxonomy entry exists for an (arbitrary, live) intent code so lookups never crash. */
export function ensureIntent(code: string): IntentMeta {
  const map = INTENT_TAXONOMY as Record<string, IntentMeta>;
  if (!map[code]) map[code] = { id: code as IntentId, display_name: prettyIntent(code), dept: deptFromCode(code), typical_resolution: "", sla_hours: 24 };
  return map[code];
}

/** Merge live catalog entries (keyed by intentCode) into INTENT_TAXONOMY (enriches stubs). */
export function mergeLiveIntents(entries: Record<string, { display_name?: string; dept?: Dept; sla_hours?: number; typical_resolution?: string }>): void {
  const map = INTENT_TAXONOMY as Record<string, IntentMeta>;
  for (const [code, m] of Object.entries(entries || {})) {
    map[code] = {
      id: code as IntentId,
      display_name: m.display_name || map[code]?.display_name || prettyIntent(code),
      dept: m.dept || map[code]?.dept || deptFromCode(code),
      typical_resolution: m.typical_resolution ?? map[code]?.typical_resolution ?? "",
      sla_hours: m.sla_hours ?? map[code]?.sla_hours ?? 24,
      live: true, // from the live catalog → the Rules panel shows these (not the mock/stub intents)
    };
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Actual creation timestamp, e.g. "Jun 24, 2026 · 2:05 PM". Empty string if unparseable. */
export function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
}

/** Compact calendar date, e.g. "Jun 24". For tight rows. */
export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Human SLA duration from hours — "30m" / "4h" / "2d" (mins→days). */
export function formatSla(hours: number): string {
  if (!hours || hours <= 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours >= 24 && hours % 24 === 0) return `${hours / 24}d`;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

/** Which calendar bucket an item was created in, relative to "now": today / yesterday / older. */
export function createdDayKey(item: ActionItem): "today" | "yesterday" | "older" {
  const now = new Date(NOW_MS);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = new Date(item.created_at).getTime();
  if (isNaN(t)) return "older";
  if (t >= startOfToday) return "today";
  if (t >= startOfToday - 86_400_000) return "yesterday";
  return "older";
}

/**
 * Fill in repeat_caller_count client-side: the backend never sends it (meta.repeat_caller_count
 * doesn't exist in real responses — it's always absent, so the field was silently stuck at 0 and
 * the "Repeat callers" filter/metric never matched anything). Counts how many of the CURRENTLY
 * LOADED items (pending + resolved + incorrect) share the same customer_id — a same-session proxy
 * for "this customer has reached out repeatedly" since the backend exposes no call-history count.
 */
export function withRepeatCallerCounts(items: ActionItem[]): ActionItem[] {
  const byCustomer = new Map<string, number>();
  for (const it of items) {
    if (!it.customer_id) continue;
    byCustomer.set(it.customer_id, (byCustomer.get(it.customer_id) ?? 0) + 1);
  }
  return items.map((it) => {
    const n = it.customer_id ? byCustomer.get(it.customer_id) ?? 1 : it.repeat_caller_count;
    return n === it.repeat_caller_count ? it : { ...it, repeat_caller_count: n };
  });
}
