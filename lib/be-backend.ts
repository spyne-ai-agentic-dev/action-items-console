/**
 * Server-side backend resolver for the Action Items proxies.
 *
 * ENV is derived from the backend base URL (converse-ai contract) — NOT from the request/URL:
 *   APP_BACKEND_BASEURL (or BACKEND_BASEURL) → uat | stag | prod
 * A single backend base + bearer powers the deployment:
 *   APP_BACKEND_BASEURL = https://uat-api.spyne.xyz   (defines env=uat)
 *   AI_BEARER_TOKEN     = <bearer for that backend>
 *   ENTERPRISE_ID / TEAM_ID = optional defaults when the URL omits them
 *
 * Legacy per-env keys (UAT_AI_BEARER_TOKEN / PROD_AI_API_BASE_URL / …) are still honored as a
 * fallback so older .env.local files keep working, keyed by the derived env.
 */
export type BackendConfig = {
  env: "uat" | "stag" | "prod"
  base?: string
  token?: string
  enterpriseId?: string
  teamId?: string
}

/**
 * Detect the environment from the configured backend base URL (matches converse-ai's getIframeEnv):
 *   uat-api.spyne.xyz → uat · beta-api.spyne.xyz → stag · api.spyne.ai → prod  (default prod)
 */
export function getIframeEnv(): "uat" | "stag" | "prod" {
  const backendBaseUrl = process.env.APP_BACKEND_BASEURL || process.env.BACKEND_BASEURL || ""
  if (backendBaseUrl.includes("uat-api.spyne.xyz")) return "uat"
  if (backendBaseUrl.includes("beta-api.spyne.xyz")) return "stag"
  if (backendBaseUrl.includes("api.spyne.ai")) return "prod"
  return "prod"
}

/** Back-compat shim — env is now server-derived from the backend base URL, not the request. */
export function beEnvFromReq(_req?: Request): string {
  return getIframeEnv()
}

/**
 * Resolve base/token/scope. Preferred: APP_BACKEND_BASEURL + AI_BEARER_TOKEN with env derived from
 * the base URL. Falls back to the legacy per-env vars (keyed by the derived env) if those are unset.
 * The `_env` arg is ignored (kept so existing `resolveBackend(beEnvFromReq(req))` call sites compile).
 */
export function resolveBackend(_env?: string | null): BackendConfig {
  const env = getIframeEnv()
  const PREFIX = env.toUpperCase()
  const base =
    process.env.APP_BACKEND_BASEURL ||
    process.env.BACKEND_BASEURL ||
    process.env[`${PREFIX}_AI_API_BASE_URL`] ||
    process.env.PROD_AI_API_BASE_URL
  const token =
    process.env.AI_BEARER_TOKEN ||
    process.env[`${PREFIX}_AI_BEARER_TOKEN`] ||
    process.env.PROD_AI_BEARER_TOKEN
  const enterpriseId =
    process.env.ENTERPRISE_ID || process.env[`${PREFIX}_ENTERPRISE_ID`] || process.env.PROD_ENTERPRISE_ID
  const teamId = process.env.TEAM_ID || process.env[`${PREFIX}_TEAM_ID`] || process.env.PROD_TEAM_ID
  return { env, base, token, enterpriseId, teamId }
}
