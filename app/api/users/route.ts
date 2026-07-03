import { NextResponse } from "next/server"
import { resolveBackend, beEnvFromReq } from "@/lib/be-backend"

/**
 * LOCAL/DEV proxy → Spyne user list for assignment.
 *   GET /api/users?enterpriseId=&teamId=
 *     → GET {base}/console/v1/user/get-user-list?enterpriseId=&teamIds=["<teamId>"]&page=1&batchSize=100&onlyActive=true
 * Bearer + default scope from .env.local. No CORS, token stays server-side. GET-only here.
 */
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const base = resolveBackend(beEnvFromReq(req)).base
  const token = resolveBackend(beEnvFromReq(req)).token
  if (!base || !token) return NextResponse.json({ error: "proxy_not_configured" }, { status: 503 })

  const q = new URL(req.url).searchParams
  const enterpriseId = q.get("enterpriseId") || resolveBackend(beEnvFromReq(req)).enterpriseId || ""
  const teamId = q.get("teamId") || resolveBackend(beEnvFromReq(req)).teamId || ""

  const target = new URL(`${base}/console/v1/user/get-user-list`)
  target.searchParams.set("enterpriseId", enterpriseId)
  target.searchParams.set("teamIds", JSON.stringify([teamId]))
  target.searchParams.set("page", "1")
  target.searchParams.set("batchSize", "100")
  target.searchParams.set("onlyActive", "true")

  try {
    const res = await fetch(target.toString(), {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    const text = await res.text()
    return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
  } catch (e: any) {
    return NextResponse.json({ error: "upstream_unreachable", detail: String(e?.message || e) }, { status: 502 })
  }
}
