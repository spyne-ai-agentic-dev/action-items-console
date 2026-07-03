import { resolveBackend, beEnvFromReq } from "@/lib/be-backend"

/**
 * LOCAL/DEV proxy → call recording audio, streamed SAME-ORIGIN so the waveform player can fetch
 * the bytes without CORS (the S3 / LiveKit recording hosts don't allow cross-origin fetch from
 * the embed, which made WaveSurfer error out with "Audio not present" even when a recording existed).
 *
 *   GET /api/call-recording?callId=...  →  resolves the fresh recordingUrl from the end-call report,
 *                                          then streams the audio (forwarding Range for seeking).
 *
 * The presigned S3 URL (with its AWS credentials) stays server-side — the client only ever sees
 * this same-origin path. GET-only / read-only.
 */
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { base, token } = resolveBackend(beEnvFromReq(req))
  if (!base) return new Response("proxy_not_configured", { status: 503 })
  const callId = new URL(req.url).searchParams.get("callId")
  if (!callId) return new Response("missing_callId", { status: 400 })

  // 1. Resolve the fresh recording URL from the end-call report (keeps the presigned URL off the client).
  let recordingUrl: string | null = null
  try {
    const rr = await fetch(`${base}/conversation/vapi/end-call-report-by-id?callId=${encodeURIComponent(callId)}`, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    })
    if (rr.ok) {
      const j: any = await rr.json()
      recordingUrl = j?.callDetails?.recordingUrl ?? j?.callDetails?.stereoRecordingUrl ?? null
    }
  } catch (e: any) {
    return new Response(`report_unreachable: ${String(e?.message || e)}`, { status: 502 })
  }
  if (!recordingUrl) return new Response("no_recording", { status: 404 })

  // 2. Stream the audio, forwarding Range so the player can seek. Same-origin → no CORS on the client.
  const range = req.headers.get("range")
  let upstream: Response
  try {
    upstream = await fetch(recordingUrl, { headers: range ? { Range: range } : {}, cache: "no-store" })
  } catch (e: any) {
    return new Response(`recording_unreachable: ${String(e?.message || e)}`, { status: 502 })
  }

  const headers = new Headers()
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "audio/mpeg")
  headers.set("Accept-Ranges", "bytes")
  const cl = upstream.headers.get("Content-Length")
  if (cl) headers.set("Content-Length", cl)
  const cr = upstream.headers.get("Content-Range")
  if (cr) headers.set("Content-Range", cr)
  headers.set("Cache-Control", "private, max-age=300")
  return new Response(upstream.body, { status: upstream.status, headers })
}
