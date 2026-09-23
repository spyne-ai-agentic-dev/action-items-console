/**
 * Pilot gate for the new Action Alerts design (RETCONVAI-5053).
 *
 * A pilot rooftop on Service gets the new design. Every other rooftop, and
 * every Sales and Reception view, gets today's page unchanged. The lists stay
 * empty until Sumit sends the advisory council team_ids.
 */
export const PILOT_TEAM_IDS: Record<"uat" | "prod", string[]> = {
  uat: [],
  prod: [],
}

/** `stag` has no list of its own, it reads the UAT one. */
export function isPilot(teamId: string, env: string): boolean {
  if (!teamId) return false
  const key = env === "prod" ? "prod" : env === "uat" || env === "stag" ? "uat" : null
  if (!key) return false
  return PILOT_TEAM_IDS[key].includes(teamId)
}
