/**
 * Minimal SAME-ORIGIN audio streaming shim for the waveform player.
 *
 * This is NOT a backend API wrapper: it holds NO token, calls NO business API, and knows nothing
 * about env / enterprise / team. It exists for one reason — the S3 recording host returns no
 * Access-Control-Allow-Origin header, so WaveSurfer (which fetches the bytes to draw the waveform)
 * is blocked by CORS when reading S3 directly from the browser.
 *
 * The browser fetches the presigned recordingUrl directly from the (CORS-enabled) call-report API,
 * then hands that URL to this shim, which pipes the bytes same-origin (forwarding Range for seeking).
 *
 *   GET /api/call-recording?url=<presigned S3 url>
 *
 * SSRF guard: only streams from Spyne's recording hosts (*.amazonaws.com over https).
 */
export const dynamic = "force-dynamic"

const ALLOWED_HOST = /(^|\.)amazonaws\.com$/i

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url")
  if (!raw) return new Response("missing_url", { status: 400 })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return new Response("bad_url", { status: 400 })
  }
  if (target.protocol !== "https:" || !ALLOWED_HOST.test(target.hostname)) {
    return new Response("host_not_allowed", { status: 403 })
  }

  // Stream the audio, forwarding Range so the player can seek. Same-origin → no CORS on the client.
  const range = req.headers.get("range")
  let upstream: Response
  try {
    upstream = await fetch(target.toString(), { headers: range ? { Range: range } : {}, cache: "no-store" })
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
