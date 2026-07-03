# Action Items Console — Standalone (iframe + BE)

A self-contained Next.js app that renders the **Action Items** queue as an **iframe target**, with
**all scope driven from the URL** and its own **backend proxies** (bearer token stays server-side).
Extracted from `spyne-console` into a focused, deployable codebase — no monorepo shell/cruft.

---

## 1. URL contract (the whole scope comes from the query)

```
https://<host>/?env=<uat|prod>&enterpriseId=<id>&teamId=<id>&department=<all|sales|service>
```

| Param | Required | Meaning |
|---|---|---|
| `env` | no (default `prod`) | Which backend to hit — `uat` → `uat-api.spyne.xyz`, `prod` → `api.spyne.ai`. Picks creds server-side. |
| `enterpriseId` | **yes** | Dealer enterprise to load. |
| `teamId` | **yes** | Team/rooftop to load. |
| `department` | no (default `all`) | Scope to `sales` / `service` (or `all`). |
| `userId`, `userEmail` | no | Acting BDC — recorded as resolver/assignee on writes. |

- Change any param → the app re-fetches for the new scope (the console remounts).
- Opened with **no `enterpriseId`** (bare localhost), a slim helper builds the URL for you — the URL stays the single source of truth.
- Embedded (enterpriseId present) → renders chrome-free, ready for an `<iframe src=…>`.

**Examples**
```
/?env=uat&enterpriseId=858b283d5&teamId=cf4a30d7f3&department=sales
/?env=prod&enterpriseId=7d06f7427&teamId=9923577d07
```

---

## 2. Backend proxies (same-origin, no CORS, token server-side)

All live calls go through this app's own `/api/*` routes, which attach the bearer for the requested
`env` and forward to `conversational-ai-backend`. The browser never sees the token.

| Route | Upstream | Purpose |
|---|---|---|
| `GET /api/action-items` | `/conversation/action-items` | queue (scoped by ent/team) |
| `GET /api/call-report` | `/conversation/vapi/end-call-report-by-id` | call detail + transcript |
| `GET /api/call-recording` | (resolves report → streams S3) | audio, same-origin (fixes CORS) |
| `GET /api/conversations` | `/conversation/...` | SMS / conversation browse |
| `GET /api/users` | user list | assignable BDCs |
| `GET /api/intent-catalog`, `/api/extraction-config`, `/api/intent-config` | intent config | live taxonomy + per-rooftop SLA (UAT) |
| `POST /api/action-items/resolve` → PUT `mark-resolved` | resolve | write |
| `POST /api/action-items/incorrect` → PUT `mark-incorrect` | flag incorrect (+reclassify via note) | write |
| `PATCH /api/assign` | assignment | assign to a BDC | 
| `PUT /api/intent-config` | dealer-intent-config | per-rooftop SLA | 

Env resolution lives in [`lib/be-backend.ts`](lib/be-backend.ts): `?env=` → `UAT_*` / `PROD_*` / `STAG_*`
creds, each field falling back to `PROD_*`.

---

## 3. Setup & run

```bash
cp .env.example .env.local     # fill in PROD_/UAT_ base URLs + bearer tokens
npm install
npm run dev                    # http://localhost:3000/?env=uat&enterpriseId=…&teamId=…
```

- Node ≥ 18.17. Next 16 (App Router) · React 19 · Tailwind v4.
- `next.config.mjs` keeps `ignoreBuildErrors` / `ignoreDuringBuilds` on (deploy safety, matching the source).

---

## 4. Features (inherited from the console)

- Customer-grouped queue, SLA-burn sort, metric tiles + quick filters, department filter.
- Source drawer: call transcript + **waveform audio** (streamed via proxy), SMS "Conversation" view,
  and an evidence excerpt ("what Vini captured") when no full report exists — customer verbatim vs
  Vini's rationale shown separately (never AI reasoning mislabeled as a spoken agent line).
- Write-back: **Resolve** (type + note; resolver becomes assignee), **Flag Incorrect** with
  **reclassify** (corrected intent changes the tag; carried in the `note` the DTO accepts),
  **Assign**, per-rooftop **SLA** edit.
- **Resolved** tab filters: search · resolution type · intent · resolved-by · created/resolved date · Past-SLA.
- **Resolved / Incorrect** detail: full record + **Listen / Transcript** source links.

---

## 5. Notes / limitations

- Intent-catalog / extraction-config / dealer-intent-config are **UAT-only** today (404 on prod) —
  handled gracefully; taxonomy/SLA features light up on prod once the backend promotes them.
- Resolved / Incorrect tabs show items acted on **in-session** (the queue fetch requests pending
  items); historical load is a follow-up.
- `mark-incorrect` currently sends `isComplete:true` — confirm with backend whether flagged items
  should be bucketed distinctly from completed.

---

## 6. Deploy

Standard Next app. Set the `PROD_*` / `UAT_*` env vars in the host (e.g. Vercel project env), then
embed:

```html
<iframe src="https://<deployed-host>/?env=prod&enterpriseId=…&teamId=…&department=all"
        style="border:0;width:100%;height:100%" allow="clipboard-write" />
```
