/**
 * Types, formatters and API mapping for the VINI Action Items page.
 *
 * Ported from the iframe app (action-items-console) with one hard difference:
 * NOTHING here is seeded. The iframe shipped a bundled ACTION_ITEMS mock, a
 * hardcoded INTENT_TAXONOMY with invented SLA hours, and CUSTOMERS / USERS
 * lookup maps full of made-up names and phone numbers. None of that is
 * carried over. Every item, every intent label and every SLA minute on this
 * page comes from a live endpoint, or the element renders a locked state.
 */

export type ViniActionItemsDepartment = 'sales' | 'service';

/** What the page is mounted as. Reception shares the route, per the old page. */
export type ViniActionItemsMode = 'sales' | 'service' | 'reception';

export type ViniActionItemChannel =
  | 'call'
  | 'sms'
  | 'chat'
  | 'email'
  | 'hitl_takeover'
  | 'hitl_warm_transfer';

/**
 * Department an intent belongs to.
 *
 * `both` is a real value the intent catalog returns, and it is load-bearing.
 * See `matchesDepartment` below before changing anything about it.
 */
export type ViniIntentDept = 'sales' | 'service' | 'both' | 'compliance';

export type ViniActionItemStatus = 'pending' | 'completed' | 'incorrect';

export type ViniResolutionType =
  | 'appointment_booked'
  | 'info_provided'
  | 'customer_unreachable'
  | 'dnc'
  | 'other';

export type ViniIncorrectReason =
  | 'wrong_intent'
  | 'not_a_task'
  | 'customer_did_not_say_this'
  | 'duplicate_of_existing'
  | 'other';

export interface ViniEvidenceTurn {
  /** `customer` is a verbatim quote. `ai` is Vini's rationale, not a spoken line. */
  role: 'customer' | 'ai';
  text: string;
}

export interface ViniActionItem {
  actionItemId: string;
  customerId: string;
  /** Only ever what the API returned. Never derived from an id slug. */
  customerName?: string;
  customerPhone?: string;
  /** The assignment API keys on the lead, not the action item. */
  leadId?: string;
  channel: ViniActionItemChannel;
  /** Live backend intent code, e.g. SERVICE_REQUEST_CALLBACK. */
  intentCode: string;
  whatNeedsDoing: string;
  sourceMessage: string;
  evidenceTurns: ViniEvidenceTurn[];
  createdAt: string;
  /** The promised time, when the backend set one. */
  dueDate?: string;
  createdByAi: boolean;
  status: ViniActionItemStatus;
  assigneeUserId?: string;
  assigneeName?: string;
  closedAt?: string;
  resolutionNote?: string;
  resolutionType?: ViniResolutionType;
  incorrectReason?: ViniIncorrectReason;
  /** Set only by an in-session reclassify, so the record shows the change. */
  originalIntentCode?: string;
  repeatCallerCount: number;
  lastObservedAt: string;
  sourceCallId?: string;
  sourceConversationId?: string;
}

/** One entry of the live intent taxonomy. Built from the catalog, never seeded. */
export interface ViniIntentMeta {
  intentCode: string;
  displayName: string;
  dept: ViniIntentDept;
  /** From the catalog default, overridden by the rooftop's dealer-intent-config. */
  slaMinutes: number;
  /** True when the rooftop overrode the catalog default. */
  slaIsRooftopOverride: boolean;
  timeSensitive?: boolean;
}

export type ViniIntentTaxonomy = Record<string, ViniIntentMeta>;

export interface ViniActionItemsUser {
  userId: string;
  name: string;
  initials: string;
  email?: string;
}

/* ── The department match, which Sumit owns ──────────────────────── */

/**
 * Whether an item belongs to the department the page is scoped to.
 *
 * THIS IS A KNOWN, DELIBERATE DEFECT, NOT AN OVERSIGHT. The iframe app used
 * strict equality (`deptOf(item) !== filters.dept`), so an intent whose dept
 * is `both` matches neither Sales nor Service and is invisible in both tabs.
 * Six of the fourteen intents the old app bundled were `both`, including
 * pricing quote, callback request, appointment and complaint.
 *
 * It is not fixed here because widening the match moves Sales counts too, and
 * that is a product call Sumit has to make, not a call this port can make
 * quietly. See eng-spec-action-items-native.md, "The department match".
 *
 * What this port does change: the behaviour is now in one named place instead
 * of inlined in a filter, and `VINI_DEPT_MATCH_IS_STRICT` documents it. The UI
 * also never lets an item fall out of every view. `reopenWouldHide` below is
 * the guard, and the Unresolved header states the hidden count out loud rather
 * than silently shrinking the list.
 */
export const VINI_DEPT_MATCH_IS_STRICT = true;

export const matchesDepartment = (
  itemDept: ViniIntentDept,
  department: ViniActionItemsDepartment
): boolean => {
  if (VINI_DEPT_MATCH_IS_STRICT) return itemDept === department;
  // The widened reading, kept next to the strict one so the diff is one flag.
  return itemDept === department || itemDept === 'both';
};

/** True when the department match would hide this item from the open queue. */
export const reopenWouldHide = (
  item: ViniActionItem,
  taxonomy: ViniIntentTaxonomy,
  department: ViniActionItemsDepartment
): boolean => !matchesDepartment(deptOf(item, taxonomy), department);

/* ── Resolution + flag vocabularies (UI copy, mapped to backend enums) ── */

export const VINI_RESOLUTION_TYPES: {
  value: ViniResolutionType;
  label: string;
}[] = [
  { value: 'appointment_booked', label: 'Appointment booked' },
  { value: 'info_provided', label: 'Info provided' },
  { value: 'customer_unreachable', label: 'Customer unreachable' },
  { value: 'dnc', label: 'Do not contact' },
  { value: 'other', label: 'Other' },
];

export const VINI_RESOLUTION_TYPE_LABEL: Record<ViniResolutionType, string> =
  Object.fromEntries(
    VINI_RESOLUTION_TYPES.map((r) => [r.value, r.label])
  ) as Record<ViniResolutionType, string>;

export const VINI_INCORRECT_REASONS: {
  value: ViniIncorrectReason;
  label: string;
}[] = [
  { value: 'wrong_intent', label: 'Wrong intent' },
  { value: 'not_a_task', label: 'Not a task' },
  { value: 'customer_did_not_say_this', label: 'Customer did not say this' },
  { value: 'duplicate_of_existing', label: 'Duplicate of existing' },
  { value: 'other', label: 'Other' },
];

export const VINI_INCORRECT_REASON_LABEL: Record<ViniIncorrectReason, string> =
  Object.fromEntries(
    VINI_INCORRECT_REASONS.map((r) => [r.value, r.label])
  ) as Record<ViniIncorrectReason, string>;

/** UI resolution type to the backend's ActionItemResolvedReasonCode enum. */
export const VINI_RESOLVE_REASON_CODE: Record<ViniResolutionType, string> = {
  appointment_booked: 'APPOINTMENT_BOOKED',
  info_provided: 'INFO_PROVIDED',
  customer_unreachable: 'UNREACHABLE',
  dnc: 'DO_NOT_CONTACT',
  other: 'OTHER',
};

/** UI flag reason to the backend's ActionItemIncorrectReasonCode enum. */
export const VINI_INCORRECT_REASON_CODE: Record<ViniIncorrectReason, string> = {
  wrong_intent: 'MISCLASSIFIED_INTENT',
  customer_did_not_say_this: 'MISCLASSIFIED_INTENT',
  not_a_task: 'NOT_APPLICABLE',
  duplicate_of_existing: 'DUPLICATE_ENTRY',
  spam_or_test: 'SPAM_OR_TEST_CALL',
  other: 'OTHER',
} as Record<ViniIncorrectReason, string>;

export const VINI_CHANNEL_LABEL: Record<ViniActionItemChannel, string> = {
  call: 'Call',
  sms: 'SMS',
  chat: 'Chat',
  email: 'Email',
  hitl_takeover: 'Human takeover',
  hitl_warm_transfer: 'Warm transfer',
};

export const VINI_DEPT_LABEL: Record<ViniIntentDept, string> = {
  sales: 'Sales',
  service: 'Service',
  both: 'Sales + Service',
  compliance: 'Compliance',
};

/* ── Helpers ─────────────────────────────────────────────────────── */

/** "SERVICE_REQUEST_CALLBACK" to "Request Callback". Label of last resort. */
export const prettyIntent = (code: string): string => {
  const words = String(code || '')
    .replace(/^(SALES|SERVICE|PARTS)_/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Action';
};

/** Backend serviceType to a dept. `parts` folds into service, as the API does. */
export const deptFromServiceType = (serviceType?: string): ViniIntentDept => {
  const value = String(serviceType || '').toLowerCase();
  if (value === 'sales') return 'sales';
  if (value === 'both' || value === 'all') return 'both';
  return 'service';
};

/**
 * Dept for an intent the catalog did not return.
 *
 * Only the code prefix is read. The old app also keyword-guessed off words
 * like "quote" and "finance", which silently invented a department for an
 * intent nobody configured. A prefix is in the code the backend sent; a
 * keyword guess is not, so it is dropped.
 */
export const deptFromIntentCode = (code: string): ViniIntentDept => {
  const prefix = String(code || '')
    .split('_')[0]
    .toLowerCase();
  if (prefix === 'sales') return 'sales';
  if (prefix === 'service' || prefix === 'parts') return 'service';
  return 'both';
};

export const intentMeta = (
  intentCode: string,
  taxonomy: ViniIntentTaxonomy
): ViniIntentMeta | undefined => taxonomy[intentCode];

export const intentLabel = (
  intentCode: string,
  taxonomy: ViniIntentTaxonomy
): string => taxonomy[intentCode]?.displayName ?? prettyIntent(intentCode);

export const deptOf = (
  item: ViniActionItem,
  taxonomy: ViniIntentTaxonomy
): ViniIntentDept =>
  taxonomy[item.intentCode]?.dept ?? deptFromIntentCode(item.intentCode);

export const ageMinutes = (iso: string, now = Date.now()): number => {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return 0;
  return Math.floor((now - parsed) / 60000);
};

export const ageLabel = (minutes: number): string => {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest > 0 ? `${hours}h ${rest}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
};

/**
 * Whether an item is past SLA.
 *
 * Returns null, not false, when no SLA is known for the intent. A missing SLA
 * is not an on-time item, and the caller renders a locked state instead of a
 * green pill. The old app defaulted the unknown case to 24 hours, which is an
 * invented number.
 */
export const isPastSla = (
  item: ViniActionItem,
  taxonomy: ViniIntentTaxonomy,
  now = Date.now()
): boolean | null => {
  if (item.status !== 'pending') return false;
  const sla = taxonomy[item.intentCode]?.slaMinutes;
  if (sla == null) return null;
  return ageMinutes(item.createdAt, now) >= sla;
};

/** Share of the SLA window burned. Null when the intent has no SLA. */
export const slaBurnRatio = (
  item: ViniActionItem,
  taxonomy: ViniIntentTaxonomy,
  now = Date.now()
): number | null => {
  const sla = taxonomy[item.intentCode]?.slaMinutes;
  if (sla == null || sla <= 0) return null;
  return ageMinutes(item.createdAt, now) / sla;
};

/** Sort weight. An unknown SLA sorts below every known one, never above. */
export const slaSortWeight = (
  item: ViniActionItem,
  taxonomy: ViniIntentTaxonomy,
  now = Date.now()
): number => slaBurnRatio(item, taxonomy, now) ?? -1;

/**
 * Queue order for the pilot. David, 22-Sep: "ranked by days", because the
 * SLA logic is not validated yet. Oldest open item first, by age alone.
 */
export const daysSortWeight = (item: ViniActionItem, now = Date.now()): number =>
  ageMinutes(item.createdAt, now);

/** "30m" / "4h" / "2d" from minutes. */
export const formatSla = (minutes?: number): string | null => {
  if (minutes == null || minutes <= 0) return null;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours >= 24 && hours % 24 === 0) return `${hours / 24}d`;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
};

/** "Jun 24, 2026 at 2:05 PM", in the viewer's own zone. */
export const formatTimestamp = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatCount = (value: number): string =>
  value.toLocaleString('en-US');

/** Which calendar bucket a timestamp falls in, relative to now. */
export const dayKeyOf = (
  iso?: string,
  now = Date.now()
): 'today' | 'yesterday' | 'older' => {
  const parsed = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(parsed)) return 'older';
  const today = new Date(now);
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  if (parsed >= startOfToday) return 'today';
  if (parsed >= startOfToday - 86_400_000) return 'yesterday';
  return 'older';
};

/**
 * Which band an open item belongs in, per decisions rows 47, 48 and 49.
 *
 * `overdue` is only ever a measured breach. An item whose intent has no known
 * SLA cannot be called overdue, so it lands in `noDeadline` with the items
 * that genuinely carry no promised time.
 */
export type ViniQueueBand = 'overdue' | 'today' | 'later' | 'noDeadline';

export const bandOf = (
  item: ViniActionItem,
  taxonomy: ViniIntentTaxonomy,
  now = Date.now()
): ViniQueueBand => {
  if (isPastSla(item, taxonomy, now) === true) return 'overdue';
  if (!item.dueDate) {
    return taxonomy[item.intentCode]?.slaMinutes == null
      ? 'noDeadline'
      : 'later';
  }
  const due = Date.parse(item.dueDate);
  if (Number.isNaN(due)) return 'noDeadline';
  return dayKeyOf(item.dueDate, now) === 'today' ? 'today' : 'later';
};

export const VINI_BAND_META: Record<
  ViniQueueBand,
  { label: string; subtitle: string }
> = {
  overdue: {
    label: 'Overdue',
    subtitle: 'Spyne promised a time and it has passed.',
  },
  today: {
    label: 'Today',
    subtitle: 'Who is expecting a call at a set time today.',
  },
  later: { label: 'Later', subtitle: 'Promised, but not due yet.' },
  noDeadline: {
    label: 'No deadline',
    subtitle: 'No promised time. Work these in a gap.',
  },
};

export const VINI_BAND_ORDER: ViniQueueBand[] = [
  'overdue',
  'today',
  'later',
  'noDeadline',
];

/* ── GET /conversation/action-items ──────────────────────────────── */

/** Raw doc shape. Every field optional: the response is not versioned. */
interface ViniActionItemApiDoc {
  _id?: string;
  id?: string;
  lead_id?: string;
  intent?: string;
  description?: unknown;
  summary?: unknown;
  evidence?: unknown;
  is_completed?: boolean;
  is_active?: boolean;
  time_sensitive?: boolean;
  assigned_to?: string;
  assignee_name?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  completedAt?: string;
  due_date?: string;
  dueDate?: string;
  customer?: {
    customer_id?: string;
    name?: string;
    mobile?: string;
    mobile_number?: string;
  };
  meta?: Record<string, unknown>;
}

export interface ViniActionItemsApiResponse {
  data?: ViniActionItemApiDoc[] | { actionItems?: ViniActionItemApiDoc[] }[];
  grouped?: boolean;
  total?: number;
}

const asText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value))
    return value.map(asText).filter(Boolean).join(' · ');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return asText(record.text ?? record.quote ?? record.message ?? '');
  }
  return '';
};

const CHANNELS: ViniActionItemChannel[] = [
  'call',
  'sms',
  'chat',
  'email',
  'hitl_takeover',
  'hitl_warm_transfer',
];

/** `SYSTEM` is the auto-assign sentinel, which means nobody owns it. */
const UNASSIGNED_SENTINEL = 'SYSTEM';

/**
 * Evidence turns. Only `User` entries are verbatim transcript quotes. The
 * `Assistant` entries are Vini's justification for raising the item, written
 * in the third person, and frequently absent from the call itself. They are
 * tagged separately so the UI never presents them as a two-party transcript.
 */
const evidenceTurns = (value: unknown): ViniEvidenceTurn[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = (entry ?? {}) as Record<string, unknown>;
      const author = String(record.author ?? record.role ?? '');
      return {
        role: /assistant|agent|\bbot\b|\bai\b|vini/i.test(author)
          ? ('ai' as const)
          : ('customer' as const),
        text: String(
          record.message ?? record.text ?? record.quote ?? asText(entry)
        ).trim(),
      };
    })
    .filter((turn) => turn.text);
};

const mapActionItemDoc = (doc: ViniActionItemApiDoc): ViniActionItem => {
  const meta = (doc.meta ?? {}) as Record<string, unknown>;
  const customer = doc.customer ?? {};

  const rawChannel = (meta.source_channel ??
    meta.source_type ??
    (meta.callSid ? 'call' : undefined)) as ViniActionItemChannel | undefined;
  const channel: ViniActionItemChannel =
    rawChannel && CHANNELS.includes(rawChannel) ? rawChannel : 'call';

  const status: ViniActionItemStatus = doc.is_completed
    ? 'completed'
    : meta.status === 'incorrect' || doc.is_active === false
      ? 'incorrect'
      : 'pending';

  const createdAt =
    doc.createdAt ??
    doc.created_at ??
    (meta.created_at as string | undefined) ??
    '';

  const rawAssignee = doc.assigned_to ?? (meta.assignee_user_id as string);
  const assigneeUserId =
    rawAssignee && rawAssignee !== UNASSIGNED_SENTINEL
      ? String(rawAssignee)
      : undefined;

  return {
    actionItemId: String(doc._id ?? doc.id ?? meta.action_item_id ?? ''),
    customerId: String(
      meta.customer_id ?? customer.customer_id ?? doc.lead_id ?? ''
    ),
    customerName:
      customer.name ?? (meta.customer_name as string | undefined) ?? undefined,
    customerPhone: customer.mobile ?? customer.mobile_number ?? undefined,
    leadId: doc.lead_id ?? (meta.lead_id as string | undefined),
    channel,
    intentCode: String(doc.intent ?? '')
      .toUpperCase()
      .trim(),
    whatNeedsDoing:
      (meta.intent_recap as string) ||
      asText(doc.summary) ||
      asText(doc.description) ||
      '',
    sourceMessage:
      (meta.source_message as string) ||
      asText(doc.evidence) ||
      asText(doc.description) ||
      '',
    evidenceTurns: evidenceTurns(doc.evidence),
    createdAt,
    dueDate: doc.due_date ?? doc.dueDate ?? undefined,
    createdByAi: (meta.created_by_ai as boolean) ?? true,
    status,
    assigneeUserId,
    assigneeName:
      doc.assignee_name ?? (meta.assignee_name as string | undefined),
    closedAt: doc.completedAt ?? (meta.closed_at as string | undefined),
    resolutionNote: meta.resolution_note as string | undefined,
    resolutionType: meta.resolution_type as ViniResolutionType | undefined,
    incorrectReason: meta.incorrect_reason as ViniIncorrectReason | undefined,
    repeatCallerCount: Number(meta.repeat_caller_count ?? 0),
    lastObservedAt:
      (meta.last_observed_at as string) ?? doc.updatedAt ?? createdAt,
    sourceCallId: (meta.callSid ?? meta.call_id ?? meta.callId) as
      | string
      | undefined,
    sourceConversationId: (meta.conversationId ??
      meta.conversation_id ??
      meta.source_conversation_id) as string | undefined,
  };
};

/** Flat `{ data: [...] }` and grouped `{ data: [{ actionItems }], grouped }`. */
export const mapViniActionItemsResponse = (
  api: ViniActionItemsApiResponse
): ViniActionItem[] => {
  const rows = Array.isArray(api?.data) ? api.data : [];
  const docs: ViniActionItemApiDoc[] = api?.grouped
    ? (rows as { actionItems?: ViniActionItemApiDoc[] }[]).flatMap(
        (group) => group?.actionItems ?? []
      )
    : (rows as ViniActionItemApiDoc[]);
  return docs.map(mapActionItemDoc).filter((item) => item.actionItemId);
};

/* ── The intent taxonomy, assembled from three live endpoints ────── */

export interface ViniIntentCatalogEntry {
  intentCode?: string;
  name?: string;
  serviceType?: string;
  defaultSlaMinutes?: number;
  isEnabled?: boolean;
}

export interface ViniDealerIntentConfigEntry {
  intentCode?: string;
  customSlaMinutes?: number;
  isEnabled?: boolean;
  serviceType?: string;
}

export interface ViniActionItemsConfigResponse {
  department?: string;
  intents?: {
    key?: string;
    displayLabel?: string;
    isTimeSensitive?: boolean;
  }[];
}

/**
 * Merge the catalog, the extraction config and the rooftop's overrides.
 *
 * Order matters. intent-catalog is the master list and the default SLA.
 * action-items/config supplies the display label and time sensitivity.
 * dealer-intent-config overrides the SLA for this rooftop only.
 *
 * An intent that appears only in the extraction config still gets an entry,
 * but with NO slaMinutes, because no endpoint told us its SLA. The UI renders
 * a locked SLA there rather than a made-up 24 hours.
 */
export const buildViniIntentTaxonomy = (args: {
  catalog: ViniIntentCatalogEntry[];
  configs: ViniActionItemsConfigResponse[];
  dealerConfig: ViniDealerIntentConfigEntry[];
}): ViniIntentTaxonomy => {
  const taxonomy: ViniIntentTaxonomy = {};

  for (const entry of args.catalog ?? []) {
    if (!entry?.intentCode) continue;
    taxonomy[entry.intentCode] = {
      intentCode: entry.intentCode,
      displayName: entry.name || prettyIntent(entry.intentCode),
      dept: deptFromServiceType(entry.serviceType),
      slaMinutes: entry.defaultSlaMinutes as number,
      slaIsRooftopOverride: false,
    };
  }

  for (const config of args.configs ?? []) {
    for (const intent of config?.intents ?? []) {
      if (!intent?.key) continue;
      const existing = taxonomy[intent.key];
      if (existing) {
        if (intent.displayLabel) existing.displayName = intent.displayLabel;
        if (intent.isTimeSensitive != null) {
          existing.timeSensitive = intent.isTimeSensitive;
        }
        continue;
      }
      taxonomy[intent.key] = {
        intentCode: intent.key,
        displayName: intent.displayLabel || prettyIntent(intent.key),
        dept: deptFromServiceType(config?.department),
        // No SLA source for this one. Left undefined on purpose.
        slaMinutes: undefined as unknown as number,
        slaIsRooftopOverride: false,
        timeSensitive: intent.isTimeSensitive,
      };
    }
  }

  for (const override of args.dealerConfig ?? []) {
    if (!override?.intentCode || override.customSlaMinutes == null) continue;
    const existing = taxonomy[override.intentCode];
    if (existing) {
      existing.slaMinutes = override.customSlaMinutes;
      existing.slaIsRooftopOverride = true;
    }
  }

  return taxonomy;
};

/** An intent code on an item that the catalog never returned. */
export const unknownIntentCodes = (
  items: ViniActionItem[],
  taxonomy: ViniIntentTaxonomy
): string[] => [
  ...new Set(
    items
      .map((item) => item.intentCode)
      .filter((code) => code && !taxonomy[code])
  ),
];

/* ── GET /conversation/service-metrics/action-item ───────────────── */

/** Every number carries its own definition, and a locked reason when absent. */
export interface ViniServiceMetric {
  available: boolean;
  value: number | null;
  unit?: string;
  anchor?: string;
  definition?: string;
  caveat?: string;
  locked?: { requires: string; reason: string };
}

export interface ViniActionItemMetricsApiResponse {
  enterpriseId?: string;
  teamId?: string;
  agentLine?: 'sales' | 'service' | 'all';
  window?: { from: string; to: string; timezone: string; grain: string };
  definitionVersion?: string;
  metrics?: {
    open?: ViniServiceMetric;
    openNow?: ViniServiceMetric;
    pastSla?: ViniServiceMetric;
    cleared?: ViniServiceMetric;
    unassigned?: ViniServiceMetric;
    repeatCallers?: ViniServiceMetric;
    callbacks?: ViniServiceMetric;
    noDeadline?: ViniServiceMetric;
    draftReady?: ViniServiceMetric;
  };
  notes?: string[];
}

export type ViniActionItemMetricKey =
  | 'open'
  | 'openNow'
  | 'pastSla'
  | 'cleared'
  | 'unassigned'
  | 'repeatCallers'
  | 'callbacks'
  | 'noDeadline'
  | 'draftReady';

export interface ViniActionItemMetrics {
  metrics: Partial<Record<ViniActionItemMetricKey, ViniServiceMetric>>;
  window?: { from: string; to: string; timezone: string; grain: string };
  definitionVersion?: string;
  notes: string[];
}

export const mapViniActionItemMetricsResponse = (
  api: ViniActionItemMetricsApiResponse
): ViniActionItemMetrics => ({
  metrics: api?.metrics ?? {},
  window: api?.window,
  definitionVersion: api?.definitionVersion,
  notes: Array.isArray(api?.notes) ? api.notes : [],
});

/**
 * Two defects are open with Om Thakare on this endpoint, confirmed 21-Sep.
 *
 * `open` is window-scoped while `pastSla` is live-state, so a card can read
 * more overdue than open. And the ClickHouse mirror keeps every row version,
 * so a count that does not take the latest version double counts.
 *
 * The UI states this on the tile instead of hiding it, and nothing here
 * depends on either being fixed.
 */
export const VINI_METRICS_WINDOW_CAVEAT =
  'Open is counted over the window, past SLA is counted live, so the two can disagree. Backend defect open with Om Thakare, 21-Sep.';

/** Whether a metric can be shown as a number at all. */
export const metricIsLive = (metric?: ViniServiceMetric): boolean =>
  !!metric && metric.available === true && metric.value != null;

/* ── GET /conversation/vapi/end-call-report-by-id ────────────────── */

export interface ViniCallReport {
  callId: string;
  recordingUrl: string | null;
  durationSec: number | null;
  transcript: string;
  messages: {
    role: 'agent' | 'customer';
    text: string;
    atSec: number | null;
  }[];
  summaryPoints: string[];
  analysisSummary: string;
  outcome: string | null;
  customerName: string | null;
}

/**
 * Normalise an end-call report to what the Listen overlay renders.
 *
 * Decision row 33 dropped the AI score from this overlay, so the score, the
 * sub-scores and the what-AI-did-well lists are not read here at all. They
 * still exist on the response; this surface simply does not show them.
 */
export const mapViniCallReport = (raw: unknown): ViniCallReport => {
  const body = (raw ?? {}) as Record<string, any>;
  const call = body.callDetails ?? {};
  const report = body.report ?? {};
  const start = call.startedAt ? Date.parse(call.startedAt) : NaN;
  const end = call.endedAt ? Date.parse(call.endedAt) : NaN;

  const summaryPoints: string[] = Array.isArray(report.summary)
    ? report.summary.map(asText).filter(Boolean)
    : report.summary
      ? [asText(report.summary)]
      : [];

  return {
    callId: String(body.callId ?? call.callId ?? ''),
    recordingUrl: call.recordingUrl ?? null,
    durationSec:
      Number.isFinite(start) && Number.isFinite(end)
        ? Math.max(0, Math.round((end - start) / 1000))
        : null,
    transcript: call.transcript ?? '',
    messages: (Array.isArray(call.messages) ? call.messages : [])
      .filter((m: any) => m?.role && m.role !== 'system')
      .map((m: any) => ({
        role:
          m.role === 'bot' || m.role === 'assistant'
            ? ('agent' as const)
            : ('customer' as const),
        text: asText(m.message ?? m.content),
        atSec:
          typeof m.secondsFromStart === 'number' ? m.secondsFromStart : null,
      }))
      .filter((m: { text: string }) => m.text),
    summaryPoints,
    analysisSummary: asText(call?.analysis?.summary) || '',
    outcome: report?.overview?.callOutcome ?? report?.Outcome ?? null,
    customerName: report?.customerDetails?.name ?? call.name ?? null,
  };
};

/* ── /console/v1/user/get-user-list ──────────────────────────────── */

export const initialsOf = (name: string): string => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
};

export interface ViniUserListApiResponse {
  data?: { activeUsers?: Record<string, unknown> };
}

export const mapViniUserListResponse = (
  api: ViniUserListApiResponse
): ViniActionItemsUser[] => {
  const active = api?.data?.activeUsers ?? {};
  return Object.values(active)
    .map((raw) => {
      const user = (raw ?? {}) as Record<string, any>;
      const name = String(
        user.user_name || user.label || user.email_id || user.user_id || ''
      );
      return {
        userId: String(user.user_id ?? ''),
        name,
        initials: initialsOf(name),
        email: user.email_id,
      };
    })
    .filter((user) => user.userId && user.name);
};

/** Assignee display name, from the API only. Never humanised from an id. */
export const assigneeLabel = (
  item: ViniActionItem,
  users: ViniActionItemsUser[]
): string | null => {
  if (!item.assigneeUserId) return null;
  if (item.assigneeName) return item.assigneeName;
  const match = users.find((user) => user.userId === item.assigneeUserId);
  return match?.name ?? null;
};

/** Customer display name, from the API only. No slug humanising. */
export const customerLabel = (item: ViniActionItem): string | null =>
  item.customerName?.trim() || null;
