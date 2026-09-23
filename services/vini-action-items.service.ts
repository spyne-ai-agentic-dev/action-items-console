/**
 * Action Items API surface for the pilot design.
 *
 * Ported from the native branch (spyne-console-microfrontends,
 * RELEASE-RETCONVAI-5053-appointments-action-items-native). The native version
 * went through CentralAPIHandler. This app is an iframe, so scope comes from
 * the embed URL instead: env picks the base URL, token is the bearer.
 *
 * Every write hits the same endpoint, method and parameter shape the legacy
 * iframe already calls in components/max-2/sales/console-v2/action-items/
 * be-client.ts. No new write is added here.
 */
import { apiBaseForEnv } from '@/components/max-2/sales/console-v2/action-items/be-scope';

import {
  VINI_INCORRECT_REASON_CODE,
  VINI_RESOLVE_REASON_CODE,
  ViniActionItemMetricsApiResponse,
  ViniActionItemsApiResponse,
  ViniActionItemsConfigResponse,
  ViniActionItemsDepartment,
  ViniDealerIntentConfigEntry,
  ViniIncorrectReason,
  ViniIntentCatalogEntry,
  ViniResolutionType,
  ViniUserListApiResponse,
} from '@/components/vini-action-items/vini-action-items-data';

export interface ViniEmbedScope {
  env: string;
  token: string;
  enterpriseId: string;
  teamId: string;
}

let scope: ViniEmbedScope = { env: 'prod', token: '', enterpriseId: '', teamId: '' };

/** Set once by the page from the iframe URL, before any call. */
export const setViniEmbedScope = (next: ViniEmbedScope) => {
  scope = next;
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** HTTP status attached to a rejection, when it has one. */
export const statusOf = (error: unknown): number | undefined => {
  const record = error as { status?: number; response?: { status?: number } };
  return record?.status ?? record?.response?.status;
};

const baseUrl = () => apiBaseForEnv(scope.env || 'prod');

const headers = (json = false): Record<string, string> => ({
  Accept: 'application/json',
  ...(scope.token ? { Authorization: `Bearer ${scope.token}` } : {}),
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

const withQuery = (path: string, query: Record<string, unknown> = {}) => {
  const url = new URL(`${baseUrl()}${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const getJson = async (path: string, query?: Record<string, unknown>) => {
  const res = await fetch(withQuery(path, query), { headers: headers(), cache: 'no-store' });
  if (!res.ok) throw new HttpError(res.status, `GET ${path} → ${res.status}`);
  return res.json();
};

const send = async (
  method: 'PUT' | 'PATCH',
  path: string,
  body: unknown,
  query?: Record<string, unknown>
) => {
  const res = await fetch(withQuery(path, query), {
    method,
    headers: headers(true),
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new HttpError(res.status, `${method} ${path} → ${res.status}`);
};

/** Some endpoints wrap the payload in `data`, some do not. */
const unwrap = <T>(response: unknown): T =>
  ((response as { data?: unknown })?.data ?? response) as T;

/* ── Rows ────────────────────────────────────────────────────────── */

/** The open queue. The endpoint only answers isCompleted=false. */
export const fetchViniActionItemsAPI = async (params: {
  enterpriseId: string;
  teamId: string;
  limit?: number;
}): Promise<ViniActionItemsApiResponse> => {
  const body = ((await getJson('/conversation/action-items', {
    enterpriseId: params.enterpriseId,
    teamId: params.teamId,
    isCompleted: false,
    groupByCustomer: false,
    limit: params.limit ?? 100,
  })) ?? {}) as ViniActionItemsApiResponse;
  if (!Array.isArray(body.data)) {
    throw new Error('Action items response had no data array');
  }
  return body;
};

/* ── Tiles ───────────────────────────────────────────────────────── */

/**
 * The KPI tiles. Live on UAT only as of 17-Sep, production answers 404. The
 * caller treats a 404 as locked, never as zero.
 */
export const fetchViniActionItemMetricsAPI = async (params: {
  enterpriseId: string;
  teamId: string;
  department: ViniActionItemsDepartment;
}): Promise<ViniActionItemMetricsApiResponse> => {
  const body = unwrap<ViniActionItemMetricsApiResponse>(
    await getJson('/conversation/service-metrics/action-item', {
      enterpriseId: params.enterpriseId,
      teamId: params.teamId,
      agentLine: params.department,
    })
  );
  if (!body || typeof body !== 'object' || !body.metrics) {
    throw new Error('Action item metrics response was empty or malformed');
  }
  return body;
};

/* ── The live intent taxonomy ────────────────────────────────────── */

export const fetchViniIntentCatalogAPI = async (): Promise<ViniIntentCatalogEntry[]> => {
  const body = unwrap<ViniIntentCatalogEntry[]>(await getJson('/conversation/intent-catalog'));
  return Array.isArray(body) ? body : [];
};

export const fetchViniDealerIntentConfigAPI = async (params: {
  enterpriseId: string;
  teamId: string;
}): Promise<ViniDealerIntentConfigEntry[]> => {
  const body = unwrap<ViniDealerIntentConfigEntry[]>(
    await getJson('/conversation/dealer-intent-config', {
      enterpriseId: params.enterpriseId,
      teamId: params.teamId,
    })
  );
  return Array.isArray(body) ? body : [];
};

export const fetchViniActionItemsConfigAPI = async (
  department: ViniActionItemsDepartment
): Promise<ViniActionItemsConfigResponse | null> =>
  unwrap<ViniActionItemsConfigResponse>(
    await getJson('/conversation/action-items/config', { department })
  ) ?? null;

/* ── Assignable advisors ─────────────────────────────────────────── */

export const fetchViniActionItemUsersAPI = async (params: {
  enterpriseId: string;
  teamId: string;
}): Promise<ViniUserListApiResponse> =>
  ((await getJson('/console/v1/user/get-user-list', {
    enterpriseId: params.enterpriseId,
    teamIds: JSON.stringify([params.teamId]),
    page: 1,
    batchSize: 100,
    onlyActive: true,
  })) ?? {}) as ViniUserListApiResponse;

/* ── Writes, all on the legacy iframe's endpoints ────────────────── */

/** PUT mark-resolved. `note` is required by the DTO, so it never goes empty. */
export const resolveViniActionItemsAPI = async (params: {
  actionItemId: string | string[];
  resolutionType: ViniResolutionType;
  note?: string;
  resolvedBy?: string;
}): Promise<void> =>
  send('PUT', '/conversation/action-items/mark-resolved', {
    actionItemId: params.actionItemId,
    isComplete: true,
    resolvedBy: params.resolvedBy || 'console',
    reasonCode: VINI_RESOLVE_REASON_CODE[params.resolutionType] || 'OTHER',
    note: params.note?.trim() || 'Resolved from the console',
  });

/** PUT mark-incorrect. The DTO is strict, so a reclassified intent rides in `note`. */
export const markViniActionItemsIncorrectAPI = async (params: {
  actionItemId: string | string[];
  reason: ViniIncorrectReason;
  note?: string;
  resolvedBy?: string;
}): Promise<void> =>
  send('PUT', '/conversation/action-items/mark-incorrect', {
    actionItemId: params.actionItemId,
    isComplete: true,
    resolvedBy: params.resolvedBy || 'console',
    reasonCode: VINI_INCORRECT_REASON_CODE[params.reason] || 'OTHER',
    note: params.note?.trim() || 'Flagged incorrect from the console',
  });

/** PATCH assignment. Same query-param shape as the legacy be-client. */
export const assignViniActionItemAPI = async (params: {
  leadId: string;
  userId: string;
}): Promise<void> =>
  send('PATCH', '/leads/dealer/v1/assignment', {}, {
    lead_id: params.leadId,
    action: 'assign',
    user_id: params.userId,
  });

/** PUT a rooftop SLA override from the Rules panel. */
export const upsertViniDealerIntentConfigAPI = async (params: {
  enterpriseId: string;
  teamId: string;
  intentCode: string;
  serviceType?: string;
  customSlaMinutes?: number;
  isEnabled?: boolean;
  updatedBy?: string;
}): Promise<void> => {
  const payload: Record<string, unknown> = { updatedBy: params.updatedBy || 'console' };
  if (params.serviceType) payload.serviceType = params.serviceType;
  if (params.customSlaMinutes != null) payload.customSlaMinutes = params.customSlaMinutes;
  if (params.isEnabled != null) payload.isEnabled = params.isEnabled;

  await send(
    'PUT',
    `/conversation/dealer-intent-config/` +
      `${encodeURIComponent(params.enterpriseId)}/` +
      `${encodeURIComponent(params.teamId)}/` +
      `${encodeURIComponent(params.intentCode)}`,
    payload
  );
};

/* ── Source call and conversation ────────────────────────────────── */

export const fetchViniCallReportAPI = async (callId: string): Promise<unknown> => {
  if (!callId) throw new Error('No call id on this item');
  return getJson('/conversation/vapi/end-call-report-by-id', { callId });
};

export const fetchViniCustomerConversationsAPI = async (params: {
  customerId: string;
  enterpriseId: string;
  teamId: string;
  department: ViniActionItemsDepartment;
}): Promise<{ conversations: unknown[]; summary: unknown }> => {
  const body = unwrap<{ conversations?: unknown[]; summary?: unknown }>(
    await getJson('/conversation/customers/conversations', {
      customer_id: params.customerId,
      enterprise_id: params.enterpriseId,
      team_id: params.teamId,
      department: params.department,
      page: 1,
      page_size: 10,
    })
  );
  return {
    conversations: Array.isArray(body?.conversations) ? body.conversations : [],
    summary: body?.summary ?? null,
  };
};
