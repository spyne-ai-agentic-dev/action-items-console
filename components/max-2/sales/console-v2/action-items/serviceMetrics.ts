/**
 * Service-metrics twin for the SLA hero (RETCONVAI-5066).
 *
 * Behind NEXT_PUBLIC_SERVICE_METRICS_OLD_VIEW ('on' enables), for Service only: the four
 * hero numbers (Past SLA / Unassigned / Repeat callers / Cleared today) read the SAME
 * `GET /conversation/service-metrics/action-item` endpoint the new Service Overview and the
 * native Action Items page read, instead of being counted client-side off the loaded item
 * page. Copied call shape from spyne-ai-agentic-dev/overview (branch aws-prod):
 *   - src/lib/service-metrics-api.ts (fetchServiceMetric, metricValue)
 *   - src/components/action-item/use-vini-action-items.ts (two calls: window=mtd for the
 *     row metrics, a second window=today call ONLY for the Cleared-today number — one
 *     call cannot carry two windows)
 *
 * Deliberately NOT swapped: the row list itself. `metrics.*` on this endpoint is a set of
 * counts, not the console's item shape — its own list rows (action-item-metrics list, when
 * requested) carry no lead_id/customer_id/intent/channel/createdAt, which the grouped
 * queue view and the assignment write (PATCH /leads/dealer/v1/assignment, keyed on
 * lead_id, falling back to customer_id) depend on. Swapping the list would leave "Assign"
 * silently not writing to the backend for Service. See the coordinator note in the final
 * reply for this — a human call, not something this file can safely default to.
 *
 * A number this endpoint marks unavailable (or does not send at all) resolves to `null` —
 * never a fabricated 0 — and the caller hides that tile (data layer rule: no number with no
 * trustworthy source).
 */
import { getEmbedScope, apiBaseForEnv } from "./be-scope"

export interface ServiceMetric {
  available: boolean
  value: number | null
  unit?: string
  anchor?: string
  definition?: string
  caveat?: string
  locked?: { requires: string; reason: string }
  /** Present once the backend ships coverage-gated blocks (mirrors ov-prod's availability.ts). */
  reason?: string
  coverageFrom?: string
}

export interface ActionItemMetricsResponse {
  window?: { from: string; to: string; timezone: string; grain: string }
  definitionVersion?: string
  metrics?: {
    openNow?: ServiceMetric
    pastSla?: ServiceMetric
    cleared?: ServiceMetric
    unassigned?: ServiceMetric
    repeatCallers?: ServiceMetric
  }
  notes?: string[]
}

/** `true` only when the window fully sits inside the metric's own coverage (mirrors
 *  overview/src/lib/availability.ts's coversWindow — forward-compat with a coverageFrom
 *  this endpoint does not send today). */
function coversWindow(metric: ServiceMetric | undefined | null, windowFrom?: string | null): boolean {
  if (!metric?.coverageFrom || !windowFrom) return true
  const from = Date.parse(windowFrom)
  const cov = Date.parse(metric.coverageFrom)
  if (Number.isNaN(from) || Number.isNaN(cov)) return true
  return from >= cov
}

/** The one place "can this number be shown" lives (mirrors overview/src/lib/service-metrics-api.ts). */
export function metricValue(metric: ServiceMetric | undefined | null, windowFrom?: string | null): number | null {
  return metric && metric.available === true && typeof metric.value === "number" && coversWindow(metric, windowFrom)
    ? metric.value
    : null
}

const CLIENT_TIMEOUT_MS = 25_000

/** One retry on a 5xx or network/timeout failure, then null — same contract as ov-prod's
 *  fetchServiceMetric, so a slow/down endpoint hides its own tiles quietly. */
export async function fetchActionItemServiceMetrics(
  window: "mtd" | "today" = "mtd"
): Promise<ActionItemMetricsResponse | null> {
  const scope = getEmbedScope()
  if (!scope) return null

  const url = new URL(`${apiBaseForEnv(scope.env)}/conversation/service-metrics/action-item`)
  url.searchParams.set("enterpriseId", scope.enterpriseId)
  url.searchParams.set("teamId", scope.teamId)
  url.searchParams.set("agentLine", "service")
  url.searchParams.set("window", window)

  const attempt = async (): Promise<{ ok: true; data: ActionItemMetricsResponse } | { ok: false; retryable: boolean }> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)
    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${scope.token}`, Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      })
      if (!res.ok) return { ok: false, retryable: res.status >= 500 }
      const body = await res.json()
      return { ok: true, data: (body?.data ?? body) as ActionItemMetricsResponse }
    } catch {
      return { ok: false, retryable: true }
    } finally {
      clearTimeout(timer)
    }
  }

  const first = await attempt()
  if (first.ok) return first.data
  if (!first.retryable) return null
  const second = await attempt()
  return second.ok ? second.data : null
}

export interface ServiceMetricsHero {
  breaching: number | null
  unassigned: number | null
  repeatCallers: number | null
  clearedToday: number | null
}

/**
 * The SLA hero's four numbers, all from the twin endpoint. `window=mtd` backs Past SLA,
 * Unassigned and Repeat callers (live/backlog counts, not really month-scoped, but `mtd` is
 * the same default window every other consumer of this endpoint uses). `window=today` is
 * the only source for Cleared today — see use-vini-action-items.ts's own UI-3 comment.
 */
export async function fetchServiceMetricsHero(): Promise<ServiceMetricsHero> {
  const [main, today] = await Promise.all([
    fetchActionItemServiceMetrics("mtd"),
    fetchActionItemServiceMetrics("today"),
  ])
  return {
    breaching: metricValue(main?.metrics?.pastSla, main?.window?.from),
    unassigned: metricValue(main?.metrics?.unassigned, main?.window?.from),
    repeatCallers: metricValue(main?.metrics?.repeatCallers, main?.window?.from),
    clearedToday: metricValue(today?.metrics?.cleared, today?.window?.from),
  }
}
