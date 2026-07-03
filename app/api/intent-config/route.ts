import { NextResponse } from "next/server"
import { resolveBackend, beEnvFromReq } from "@/lib/be-backend"

/**
 * LOCAL/DEV proxy → Dealer Intent Config (per-rooftop intent overrides: custom SLA + enabled). GET-only here.
 *   GET /api/intent-config?enterpriseId=&teamId=&serviceType=&isEnabled=   → list
 *   GET /api/intent-config?enterpriseId=&teamId=&intentCode=SERVICE_...     → single
 * Upstream: GET {base}/conversation/dealer-intent-config[?…] | /:ent/:team/:code. Bearer + default scope from .env.local.
 * (Writes — POST/PUT/PATCH upsert/disable — intentionally NOT implemented here; pending discussion.)
 */
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const base = resolveBackend(beEnvFromReq(req)).base
  const token = resolveBackend(beEnvFromReq(req)).token
  if (!base || !token) return NextResponse.json({ error: "proxy_not_configured" }, { status: 503 })

  const q = new URL(req.url).searchParams
  const enterpriseId = q.get("enterpriseId") || resolveBackend(beEnvFromReq(req)).enterpriseId || ""
  const teamId = q.get("teamId") || resolveBackend(beEnvFromReq(req)).teamId || ""
  const intentCode = q.get("intentCode")

  let target: URL
  if (intentCode) {
    target = new URL(`${base}/conversation/dealer-intent-config/${encodeURIComponent(enterpriseId)}/${encodeURIComponent(teamId)}/${encodeURIComponent(intentCode)}`)
  } else {
    target = new URL(`${base}/conversation/dealer-intent-config`)
    target.searchParams.set("enterpriseId", enterpriseId)
    target.searchParams.set("teamId", teamId)
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

/**
 * Upsert a per-rooftop dealer intent override (persist custom SLA / enabled state).
 *   PUT /api/intent-config  body: { enterpriseId?, teamId?, intentCode, serviceType?, customSlaMinutes?, isEnabled?, updatedBy? }
 *     → PUT {base}/conversation/dealer-intent-config/:enterpriseId/:teamId/:intentCode
 * ⚠️ WRITE. Bearer from .env.local; never fired by tooling — the Rules panel (or QA) triggers it.
 */
export async function PUT(req: Request) {
  const base = resolveBackend(beEnvFromReq(req)).base
  const token = resolveBackend(beEnvFromReq(req)).token
  if (!base || !token) return NextResponse.json({ error: "proxy_not_configured" }, { status: 503 })

  let b: any = {}
  try { b = await req.json() } catch {}
  const enterpriseId = b?.enterpriseId || resolveBackend(beEnvFromReq(req)).enterpriseId || ""
  const teamId = b?.teamId || resolveBackend(beEnvFromReq(req)).teamId || ""
  const intentCode = b?.intentCode
  if (!intentCode) return NextResponse.json({ error: "missing_intentCode" }, { status: 400 })

  const payload: Record<string, unknown> = { updatedBy: b?.updatedBy || "console" }
  if (b?.serviceType) payload.serviceType = b.serviceType
  if (b?.customSlaMinutes != null) payload.customSlaMinutes = b.customSlaMinutes
  if (b?.isEnabled != null) payload.isEnabled = b.isEnabled

  const target = `${base}/conversation/dealer-intent-config/${encodeURIComponent(enterpriseId)}/${encodeURIComponent(teamId)}/${encodeURIComponent(intentCode)}`
  try {
    const res = await fetch(target, {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      cache: "no-store",
    })
    const text = await res.text()
    return new NextResponse(text || "{}", { status: res.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
  } catch (e: any) {
    return NextResponse.json({ error: "upstream_unreachable", detail: String(e?.message || e) }, { status: 502 })
  }
}
