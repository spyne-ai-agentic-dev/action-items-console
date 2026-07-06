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
- The action-items backend has no department field, so the queue is filtered **client-side**
  (intent → department).

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

## 7. Features & notes

- Full console: queue, source drawer (call transcript + proxied audio, SMS view, evidence excerpt —
  customer verbatim vs "Why Vini flagged this"), resolve/assign/incorrect+reclassify writes,
  resolved-tab filters, source links on closed items.
- Intent-catalog / extraction-config / dealer-intent-config are **UAT-only** today (404 on prod;
  handled gracefully).
- Resolved/Incorrect tabs show items acted on **in-session** (queue fetch requests pending items).
- `mark-incorrect` sends `isComplete:true` — confirm with backend whether flagged should bucket
  distinctly from completed.
