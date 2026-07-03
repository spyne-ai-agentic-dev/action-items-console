# Action Items Console — Standalone (iframe + BE)

A self-contained Next.js app that renders the **Action Items** queue as an **iframe target**, with
its own **backend proxies** (bearer token stays server-side). Aligned to the converse-ai merge
contract: **snake_case scope params**, a **Sales/Service department toggle**, and **env derived
from the backend base URL**.

---

## 1. URL contract

```
https://<host>/?enterprise_id=<id>&team_id=<id>
   optional: &department=sales|service   (also set by the in-app toggle)
   optional: &userId=<id>&userEmail=<email>   (acting BDC, recorded on writes)
```

| Param | Required | Meaning |
|---|---|---|
| `enterprise_id` | **yes** | Dealer enterprise to load *(camelCase `enterpriseId` also accepted)*. |
| `team_id` | **yes** | Team/rooftop to load *(camelCase `teamId` also accepted)*. |
| `department` | no (default `sales`) | Initial department; the **Sales / Service toggle** drives it after load. |
| `userId`, `userEmail` | no | Acting BDC — recorded as resolver/assignee on writes. |

**Env is NOT in the URL.** It's derived server-side from the backend base URL (below).

---

## 2. Environment (server-derived, converse-ai `getIframeEnv` contract)

`lib/be-backend.ts → getIframeEnv()` reads `process.env.APP_BACKEND_BASEURL` (or `BACKEND_BASEURL`):

| Base URL contains | env |
|---|---|
| `uat-api.spyne.xyz` | `uat` |
| `beta-api.spyne.xyz` | `stag` |
| `api.spyne.ai` | `prod` |

One backend base + one bearer powers the deployment:
```
APP_BACKEND_BASEURL = https://uat-api.spyne.xyz     # → env = uat
AI_BEARER_TOKEN     = <bearer for that backend>
ENTERPRISE_ID / TEAM_ID = optional defaults
```
*(Legacy per-env vars — `UAT_AI_BEARER_TOKEN`, `PROD_AI_API_BASE_URL`, … — are still honored as a fallback, keyed by the derived env.)*

---

## 3. Department toggle

- **Sales | Service** segmented toggle, top-right. **Default: Sales.**
- Switching → **shows a loading state → re-fetches → renders that department's view.**
- The action-items backend has no department field, so the queue is filtered **client-side**
  (intent → department); the `department` param is still carried to the proxy for the merge target
  (which can forward it server-side if its API supports it).

---

## 4. Backend proxies (same-origin, no CORS, token server-side)

`GET /api/action-items` · `/api/call-report` · `/api/call-recording` (streams audio) ·
`/api/conversations` · `/api/users` · `/api/intent-catalog` · `/api/extraction-config` ·
`/api/intent-config` · `POST /api/action-items/resolve` · `/api/action-items/incorrect` ·
`PATCH /api/assign` · `PUT /api/intent-config`. All attach the bearer for the derived env and
forward to `conversational-ai-backend`.

---

## 5. Setup & run

```bash
cp .env.example .env.local     # set APP_BACKEND_BASEURL + AI_BEARER_TOKEN
npm install
npm run dev                    # http://localhost:3000/?enterprise_id=…&team_id=…
```
Node ≥ 18.17 · Next 16 (App Router) · React 19 · Tailwind v4.

---

## 6. Deploy (Vercel)

Set project env vars, then **redeploy** (Vercel injects env only into new builds):

| Name | Example |
|---|---|
| `APP_BACKEND_BASEURL` | `https://uat-api.spyne.xyz` *(defines env)* |
| `AI_BEARER_TOKEN` | *(bearer for that backend)* |
| `ENTERPRISE_ID` / `TEAM_ID` | *(optional default rooftop)* |

Embed:
```html
<iframe src="https://<host>/?enterprise_id=…&team_id=…&department=sales"
        style="border:0;width:100%;height:100%" allow="clipboard-write"></iframe>
```

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
