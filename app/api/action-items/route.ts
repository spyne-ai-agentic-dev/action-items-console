import { NextResponse } from "next/server"
import { resolveBackend, beEnvFromReq } from "@/lib/be-backend"

/**
 * LOCAL/DEV server-side proxy for the Action Items embed.
 *
 * Pulls live data from the conversational-ai-backend server-side, so the browser embed
 * gets real data with NO CORS and the bearer token NEVER reaches the client. Credentials
 * + default scope come from `.env.local` (git-ignored):
 *   PROD_AI_API_BASE_URL, PROD_AI_BEARER_TOKEN, PROD_ENTERPRISE_ID, PROD_TEAM_ID
 *
 * GET /api/action-items?enterpriseId=&teamId=&isCompleted=false&limit=100
 * (query overrides the env defaults). Read-only — proxies a GET only.
 */
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const base = resolveBackend(beEnvFromReq(req)).base
  const token = resolveBackend(beEnvFromReq(req)).token
  if (!base || !token) {
    return NextResponse.json(
      { error: "proxy_not_configured", detail: "Set PROD_AI_API_BASE_URL + PROD_AI_BEARER_TOKEN in .env.local" },
      { status: 503 },
    )
  }

  const q = new URL(req.url).searchParams
  const enterpriseId = q.get("enterpriseId") || resolveBackend(beEnvFromReq(req)).enterpriseId || ""
  const teamId = q.get("teamId") || resolveBackend(beEnvFromReq(req)).teamId || ""

  const target = new URL(`${base}/conversation/action-items`)
  target.searchParams.set("enterpriseId", enterpriseId)
  target.searchParams.set("teamId", teamId)
  target.searchParams.set("isCompleted", q.get("isCompleted") || "false")
  target.searchParams.set("groupByCustomer", "false")
  target.searchParams.set("limit", q.get("limit") || "100")
  // NOTE: action items carry no department field — passing `department` makes the BE filter to 0.
  // Department scoping for action items is therefore applied CLIENT-SIDE (intent→dept). Only the
  // conversations endpoint accepts a real `department` param.

  try {
    const res = await fetch(target.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    })
    const text = await res.text() // pass body through verbatim (no token in it)
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  } catch (e: any) {
    return NextResponse.json({ error: "upstream_unreachable", detail: String(e?.message || e) }, { status: 502 })
  }
}
