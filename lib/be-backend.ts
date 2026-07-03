/**
 * Server-side backend resolver for the Action Items proxies.
 *
 * Picks the base URL + bearer + default scope by environment so UAT and prod creds coexist
 * (no overwriting). The env comes from the embed (`?env=uat|stag|prod`, default prod).
 * Each `*_*` set falls back to the PROD_* set when unset, so partial config still works.
 *
 * .env.local keys:
 *   PROD_AI_API_BASE_URL / PROD_AI_BEARER_TOKEN / PROD_ENTERPRISE_ID / PROD_TEAM_ID
 *   UAT_AI_API_BASE_URL  / UAT_AI_BEARER_TOKEN  / UAT_ENTERPRISE_ID  / UAT_TEAM_ID
 *   STAG_AI_API_BASE_URL / STAG_AI_BEARER_TOKEN / STAG_ENTERPRISE_ID / STAG_TEAM_ID   (optional)
 */
export type BackendConfig = {
  env: string
  base?: string
  token?: string
  enterpriseId?: string
  teamId?: string
}

/** Reads `env` from the request query (defaults to "prod"). */
export function beEnvFromReq(req: Request): string {
  return (new URL(req.url).searchParams.get("env") || "prod").toLowerCase()
}

/** Resolves base/token/scope for the given env, falling back to PROD_* per field. */
export function resolveBackend(env?: string | null): BackendConfig {
  const e = (env || "prod").toLowerCase()
  const prefix = e === "uat" ? "UAT" : e === "stag" ? "STAG" : "PROD"
  const pick = (suffix: string) => process.env[`${prefix}_${suffix}`] || process.env[`PROD_${suffix}`]
  return {
    env: e,
    base: pick("AI_API_BASE_URL"),
    token: pick("AI_BEARER_TOKEN"),
    enterpriseId: pick("ENTERPRISE_ID"),
    teamId: pick("TEAM_ID"),
  }
}
