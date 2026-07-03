import { NextResponse } from "next/server"
import { resolveBackend, beEnvFromReq } from "@/lib/be-backend"

/**
 * LOCAL/DEV proxy → Intent Catalog (master intent list + SLA/metadata). GET-only here.
 *   GET /api/intent-catalog?serviceType=&isEnabled=            → list
 *   GET /api/intent-catalog?intentCode=SERVICE_REQUEST_CALLBACK → single
 * Upstream: GET {base}/conversation/intent-catalog[/:intentCode]. Bearer from .env.local.
 */
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const base = resolveBackend(beEnvFromReq(req)).base
  const token = resolveBackend(beEnvFromReq(req)).token
  if (!base || !token) return NextResponse.json({ error: "proxy_not_configured" }, { status: 503 })

  const q = new URL(req.url).searchParams
  const intentCode = q.get("intentCode")

  let target: URL
  if (intentCode) {
    target = new URL(`${base}/conversation/intent-catalog/${encodeURIComponent(intentCode)}`)
  } else {
    target = new URL(`${base}/conversation/intent-catalog`)
    const serviceType = q.get("serviceType")
    const isEnabled = q.get("isEnabled")
    if (serviceType) target.searchParams.set("serviceType", serviceType)
    if (isEnabled != null) target.searchParams.set("isEnabled", isEnabled)
  }

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
