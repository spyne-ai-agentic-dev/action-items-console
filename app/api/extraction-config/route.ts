import { NextResponse } from "next/server"
import { resolveBackend, beEnvFromReq } from "@/lib/be-backend"

/**
 * LOCAL/DEV proxy → public Action-Item extraction config (canonical intents + system prompt).
 *   GET /api/extraction-config?department=sales|service&languageCode=en
 * Upstream (PUBLIC, no auth): GET {base}/conversation/action-items/config?department&languageCode.
 * We still forward the env bearer if present. GET-only.
 */
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const base = resolveBackend(beEnvFromReq(req)).base
  if (!base) return NextResponse.json({ error: "proxy_not_configured" }, { status: 503 })

  const q = new URL(req.url).searchParams
  const target = new URL(`${base}/conversation/action-items/config`)
  target.searchParams.set("department", q.get("department") || "sales")
  if (q.get("languageCode")) target.searchParams.set("languageCode", q.get("languageCode") as string)

  const token = resolveBackend(beEnvFromReq(req)).token
  try {
    const res = await fetch(target.toString(), {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    })
    const text = await res.text()
    return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
  } catch (e: any) {
    return NextResponse.json({ error: "upstream_unreachable", detail: String(e?.message || e) }, { status: 502 })
  }
}
