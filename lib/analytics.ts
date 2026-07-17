/**
 * PostHog analytics — a thin, safe wrapper for the Action Items console.
 *
 * Design constraints (see POSTHOG-PLAN.md):
 *  - The console runs as a CROSS-ORIGIN IFRAME → no third-party cookies. We use
 *    `persistence: 'localStorage'` and identify EXPLICITLY from the URL params
 *    (the bearer token carries no user identity).
 *  - Analytics is OFF unless NEXT_PUBLIC_POSTHOG_KEY is set — every export below
 *    no-ops safely when disabled, so the app behaves identically without a key.
 *  - Naming: `category:object_action`, snake_case, present tense. Every event also
 *    carries a `lifecycle` property so the dashboards filter cleanly.
 *  - PII: NEVER pass the bearer token, customer name/phone, or message content.
 *    Send ids, booleans, lengths, and durations only.
 */
import posthog from "posthog-js"

export type Lifecycle = "adoption" | "activation" | "engagement" | "issue"

let enabled = false
let started = false

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest"

/** Initialize PostHog once, client-side, iframe-safe. No-op without a key or on the server. */
export function initAnalytics(): void {
  if (started) return
  if (typeof window === "undefined") return
  if (!KEY) return // analytics disabled — safe no-op
  started = true
  posthog.init(KEY, {
    api_host: HOST,
    ui_host: (process.env.NEXT_PUBLIC_POSTHOG_REGION || "us").toLowerCase() === "eu"
      ? "https://eu.posthog.com"
      : "https://us.posthog.com",
    persistence: "localStorage", // cross-origin iframe → avoid third-party cookies entirely
    cross_subdomain_cookie: false,
    autocapture: false, // curated events only — the console is a dense dashboard
    capture_pageview: true,
    capture_pageleave: true,
    // eslint-disable-next-line camelcase
    person_profiles: "identified_only",
  })
  enabled = true
}

/** Identify the operator + attach group analytics. Call once scope is known. Safe when disabled. */
export function identifyOperator(scope: {
  userId?: string
  userEmail?: string
  enterpriseId?: string
  teamId?: string
}): void {
  if (!enabled) return
  const distinctId = scope.userId || scope.userEmail
  if (distinctId) {
    posthog.identify(distinctId, scope.userEmail ? { email: scope.userEmail } : undefined)
  }
  if (scope.enterpriseId) posthog.group("enterprise", scope.enterpriseId)
  if (scope.teamId) posthog.group("team", scope.teamId)
}

/** Register scope as super-properties so every event carries it. Re-call when department changes. */
export function registerScope(scope: {
  env?: string
  enterpriseId?: string
  teamId?: string
  department?: string
  hasUserIdentity?: boolean
}): void {
  if (!enabled) return
  posthog.register({
    env: scope.env,
    enterprise_id: scope.enterpriseId,
    team_id: scope.teamId,
    department: scope.department,
    has_user_identity: scope.hasUserIdentity,
  })
}

/** Capture an event. Injects `lifecycle`. Safe no-op when analytics is disabled. */
export function track(event: string, lifecycle: Lifecycle, props: Record<string, unknown> = {}): void {
  if (!enabled) return
  posthog.capture(event, { lifecycle, ...props })
}

/** True when analytics is active (a key is set and init ran). */
export function analyticsEnabled(): boolean {
  return enabled
}
