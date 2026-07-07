# Action Items Console — Standalone (iframe, direct-to-backend)

A self-contained Next.js app that renders the **Action Items** queue as an **iframe target**. The
browser calls the Spyne backend **directly** — there is no server-side API proxy and no server-side
secret. All scope (**env, token, enterpriseId, teamId**) is passed by the host on the **iframe URL**.
A **Sales/Service department toggle** filters the queue client-side.

> **v2 — proxy removed.** The previous version routed every call through same-origin `/api/*` proxies
> that attached a server-side bearer. That wrapper is gone: the host now injects the bearer via the
> URL and the browser talks to the backend directly (the Spyne API allows CORS). The **only**
> remaining server route is `/api/call-recording`, a token-free same-origin shim that pipes S3 audio
> bytes to the waveform player because the S3 recording host sends no CORS header.

---

## 1. URL contract

```
https://<host>/?env=<uat|stag|prod>&enterpriseId=<id>&teamId=<id>&token=<bearer>
   optional: &department=sales|service   (also set by the in-app toggle)
   optional: &userId=<id>&userEmail=<email>   (acting BDC, recorded on writes)
```

| Param | Required | Meaning |
|---|---|---|
| `env` | **yes** | `uat` \| `stag` \| `prod` — selects the backend base URL *(alias `environment`)*. |
| `enterpriseId` | **yes** | Dealer enterprise to load *(snake_case `enterprise_id` also accepted)*. |
| `teamId` | **yes** | Team/rooftop to load *(snake_case `team_id` also accepted)*. |
| `token` | **yes** | Bearer for the backend, injected by the host *(alias `bearerToken`)*. |
| `department` | no (default `sales`) | Initial department; the **Sales / Service toggle** drives it after load. |
| `userId`, `userEmail` | no | Acting BDC — recorded as resolver/assignee on writes. |

**Everything is on the URL.** There is no server-side env and no server-side token.

---

## 2. Environment (from the URL `env` param)

`app/page.tsx` reads `env` off the URL into `window.__AI_SCOPE__`; `be-scope.ts → apiBaseForEnv(env)`
maps it to the backend base the browser calls directly:

| `env` | Base URL |
|---|---|
| `uat` | `https://uat-api.spyne.xyz` |
| `stag` | `https://beta-api.spyne.xyz` |
| `prod` | `https://api.spyne.ai` |

Missing `env` defaults to `prod`. The bearer (`token`) is attached client-side on every request.

---

## 3. Department toggle

- **Sales | Service** segmented toggle, top-right. **Default: Sales.**
- Switching → **shows a loading state → re-fetches → renders that department's view.**
- The action-items backend has no department field, so scoping is applied **client-side**
  (intent → department) and covers the **whole board**: the **queue list**, the
  **Unresolved / Resolved / Incorrect tab counts + lists**, and the **top-bar metrics** all reflect
  only the selected department (e.g. Sales 27 vs Service 46 — not the 100-item total).

---

## 4. Backend calls (direct from the browser)

All data calls go straight to `conversational-ai-backend` at `apiBaseForEnv(env)`, with
`Authorization: Bearer <token>` from the URL — see `be-client.ts`:

`GET /conversation/action-items` · `/conversation/vapi/end-call-report-by-id` ·
`/conversation/customers/conversations` · `/console/v1/user/get-user-list` ·
`/conversation/intent-catalog` · `/conversation/action-items/config` ·
`/conversation/dealer-intent-config` · `PUT /conversation/action-items/mark-resolved` ·
`/conversation/action-items/mark-incorrect` · `/conversation/dealer-intent-config/...` ·
`PATCH /leads/dealer/v1/assignment`.

**Only** `GET /api/call-recording?url=<s3-url>` remains server-side: a token-free same-origin shim
that pipes S3 audio bytes to WaveSurfer (the S3 recording host sends no CORS header). It holds no
secret and touches no business API.

---

## 5. Setup & run

```bash
npm install
npm run dev
# open http://localhost:3000/?env=uat&enterpriseId=<id>&teamId=<id>&token=<bearer>
```
Node ≥ 18.17 · Next 16 (App Router) · React 19 · Tailwind v4. No `.env` required.

---

## 6. Deploy (Vercel)

No environment variables needed — scope is entirely URL-driven. Just deploy and embed:

```html
<iframe src="https://<host>/?env=prod&enterpriseId=…&teamId=…&token=…&department=sales"
        style="border:0;width:100%;height:100%" allow="clipboard-write"></iframe>
```

The host is responsible for injecting a valid `token` (and `env`/`enterpriseId`/`teamId`) on the URL.

---

## 7. Layout

Compact top so the Queue / Open-items panes get the vertical space:

- **No "Acting as" selector** (the acting BDC still comes from the iframe URL `userId`/`userEmail`).
- **Rules** + **Manager / My queue** live on the **tabs row** (with Unresolved / Resolved / Incorrect).
- **Search + Group by + Intent + Assignment + Channel** all on **one line** (search narrowed);
  quick-filter chips on a second line.
- Tighter section gaps + compact SLA hero → the top section is ~30% of the page.

---

## 8. Source drawer (call & conversation)

Opening **Listen** / **Transcript** resolves the item's **real call** — it tries the item's own call
id (`callSid`) → its conversation id → (for call items) the customer's most recent call — so it lands
on the actual call instead of a snippet. Then:

- **Recording**: plays via the same-origin audio shim when `callDetails.recordingUrl` exists. The shim
  URL is **absolute** (`https://<host>/api/call-recording?url=…`) so WaveSurfer accepts it
  (it rejects relative URLs as "No recording available").
- **No recording / no report**: instead of a silent dead end, the drawer surfaces an explicit
  diagnostic — *"No recording returned by the backend … recordingUrl is empty"* (report loaded, no
  audio) or *"Couldn't load the full call report …"* with the error (report unreachable).
- **No-transcript fallback**: shows the **Note** on top + the action-item **Details** in a vertical
  key/value list (Customer · Channel · Intent · Created · Status · Assignee) — no more bare
  "No transcript on file".

The **Open Items rows** show the exact **Customer + Agent verbatim** (from the item's evidence turns).

---

## 9. Writes & persistence

- **Resolve / Mark-incorrect** send a **non-empty `note`** and `resolvedBy` — the backend DTO rejects
  an empty `note` (`400 "note should not be empty"`), which previously made flagging/resolving fail
  silently ("backend flag not reachable").
- **Intent SLA**: editing an SLA in the **Rules** panel persists to `dealer-intent-config` on **any
  close** (Done / ✕ / backdrop / Esc) with a *Saving…* state and a confirmation toast — not just on
  input blur.
- **Assign** → `PATCH /leads/dealer/v1/assignment` directly.

---

## 10. Notes & known gaps

- **Auto-create by channel** toggles in the Rules panel are **session-only** — there is no backend
  endpoint for channel routing yet, so they don't persist across reload.
- Intent-catalog / extraction-config / dealer-intent-config are **UAT-only** today (404 on prod;
  handled gracefully).
- Resolved/Incorrect tabs show items acted on **in-session** (the queue fetch requests pending items).
- `mark-incorrect` sends `isComplete:true` — confirm with backend whether flagged should bucket
  distinctly from completed.
- After changing env vars or deploying, **redeploy** so the embedded iframe serves the latest build
  (a stale build is the usual reason a fix "doesn't show" on the deployed console).

---

## 11. Changelog (this release)

- **Removed the Vercel API proxy wrapper** — the browser calls the Spyne backend directly; scope
  (`env`/`token`/`enterpriseId`/`teamId`) comes entirely from the iframe URL. No server-side secrets.
  Only `/api/call-recording` (token-free audio shim) remains.
- **Sales / Service** toggle now scopes the whole board (queue + tabs + top bar).
- **Compact layout** (Acting-as removed; Rules + Manager/My queue on the tabs row; one-line filters).
- **Fixed** silent resolve/incorrect failures (non-empty `note`), SLA persistence (save on close),
  the recording player (absolute shim URL), and the drawer (robust call resolution + diagnostics +
  Note/Details fallback + Customer/Agent verbatim).
