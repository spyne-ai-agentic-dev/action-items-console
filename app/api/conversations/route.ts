import { NextResponse } from "next/server"
import { resolveBackend, beEnvFromReq } from "@/lib/be-backend"

/**
 * LOCAL/DEV proxy → conversational-ai-backend customer conversations.
 *   GET /api/conversations?customerId=...[&department=service]
 *     → GET {base}/conversation/customers/conversations?customer_id=...&enterprise_id=...&team_id=...&department=...
 * Bearer + enterprise/team scope come from .env.local. No CORS, token stays server-side.
 */
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const base = resolveBackend(beEnvFromReq(req)).base
  const token = resolveBackend(beEnvFromReq(req)).token
  if (!base || !token) return NextResponse.json({ error: "proxy_not_configured" }, { status: 503 })

  const q = new URL(req.url).searchParams
  const customerId = q.get("customerId") || q.get("customer_id")
  if (!customerId) return NextResponse.json({ error: "missing_customerId" }, { status: 400 })

  const target = new URL(`${base}/conversation/customers/conversations`)
  target.searchParams.set("customer_id", customerId)
  target.searchParams.set("enterprise_id", q.get("enterpriseId") || resolveBackend(beEnvFromReq(req)).enterpriseId || "")
  target.searchParams.set("team_id", q.get("teamId") || resolveBackend(beEnvFromReq(req)).teamId || "")
  target.searchParams.set("department", q.get("department") || "service")
  target.searchParams.set("page", q.get("page") || "1")
  target.searchParams.set("page_size", q.get("page_size") || "10")

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
