import { NextResponse } from "next/server"
import { resolveBackend, beEnvFromReq } from "@/lib/be-backend"

/**
 * LOCAL/DEV proxy → mark action item(s) RESOLVED.
 *   POST /api/action-items/resolve  body: { actionItemId: string|string[], reasonCode, note?, resolvedBy }
 *     → PUT {base}/conversation/action-items/mark-resolved  { actionItemId, isComplete:true, resolvedBy, reasonCode, note }
 *
 * ⚠️ WRITE. Bearer from .env.local; never fired by tooling — the UI (or QA) triggers it.
 * reasonCode ∈ APPOINTMENT_BOOKED | INFO_PROVIDED | UNREACHABLE | DO_NOT_CONTACT | OTHER.
 */
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const base = resolveBackend(beEnvFromReq(req)).base
  const token = resolveBackend(beEnvFromReq(req)).token
  if (!base || !token) return NextResponse.json({ error: "proxy_not_configured" }, { status: 503 })

  let b: any = {}
  try { b = await req.json() } catch {}
  if (!b?.actionItemId || !b?.reasonCode) return NextResponse.json({ error: "missing_actionItemId_or_reasonCode" }, { status: 400 })

  const payload = {
    actionItemId: b.actionItemId, // string (single) or string[] (bulk)
    isComplete: true,
    resolvedBy: b.resolvedBy || "console",
    reasonCode: b.reasonCode,
    note: b.note || "",
  }
  try {
    const res = await fetch(`${base}/conversation/action-items/mark-resolved`, {
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
