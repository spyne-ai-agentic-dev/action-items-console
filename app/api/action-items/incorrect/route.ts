import { NextResponse } from "next/server"
import { resolveBackend, beEnvFromReq } from "@/lib/be-backend"

/**
 * LOCAL/DEV proxy → mark action item(s) INCORRECT.
 *   POST /api/action-items/incorrect  body: { actionItemId: string|string[], reasonCode, note?, resolvedBy }
 *     → PUT {base}/conversation/action-items/mark-incorrect  { actionItemId, isComplete:true, resolvedBy, reasonCode, note }
 *
 * ⚠️ WRITE. Bearer from .env.local; never fired by tooling — the UI (or QA) triggers it.
 * reasonCode ∈ MISCLASSIFIED_INTENT | DUPLICATE_ENTRY | NOT_APPLICABLE | SPAM_OR_TEST_CALL | OTHER.
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
    actionItemId: b.actionItemId,
    isComplete: true,
    resolvedBy: b.resolvedBy || "console",
    reasonCode: b.reasonCode,
    note: b.note || "",
    // NOTE: the mark-incorrect DTO is strict — extra fields 400. The reclassified intent rides
    // in `note`; do NOT add correctedIntentCode here until the BE whitelists it.
  }
  try {
    const res = await fetch(`${base}/conversation/action-items/mark-incorrect`, {
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
