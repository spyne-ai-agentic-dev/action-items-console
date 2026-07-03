/**
 * Embed scope + backend base URL for the GET-only Action Items embed.
 *
 * The converse-ai iframe host sets these query params on the embed URL; the embed
 * page mirrors them onto window.__AI_SCOPE__. Read-only: used only for GET requests.
 */
export type EmbedScope = {
  env: string
  enterpriseId: string
  teamId: string
  token: string
  /** Department scope (sales|service); "all"/undefined = no department filter. */
  department?: string
}

/** Returns the embed scope when fully present, else null (→ caller falls back to mock). */
export function getEmbedScope(): EmbedScope | null {
  if (typeof window === "undefined") return null
  const s = (window as unknown as { __AI_SCOPE__?: EmbedScope }).__AI_SCOPE__
  if (!s || !s.enterpriseId || !s.teamId || !s.token) return null
  return s
}

/** Maps the iframe `env` (uat|stag|prod) to the Spyne API base — mirrors getIframeEnv() on the host. */
export function apiBaseForEnv(env: string): string {
  switch (env) {
    case "uat":
      return "https://uat-api.spyne.xyz"
    case "stag":
      return "https://beta-api.spyne.xyz"
    case "prod":
    default:
      return "https://api.spyne.ai"
  }
}
