# Action Items Console — Features & How It Works

A self-contained **Next.js** app that renders the dealer **Action Items** queue as an **iframe
target** inside the Spyne console. Vini (AI) reads every call/SMS/chat, extracts what a human still
needs to do, and this console is where BDC agents triage, resolve, assign, and flag those items —
with the source call recording + transcript one click away.

The browser talks to the Spyne backend **directly**; there is **no server-side proxy and no
server-side secret**. Everything it needs (`env`, `token`, `enterpriseId`, `teamId`) is passed by the
host on the **iframe URL**.

---

## 1. Setup & embedding

### URL contract
```
https://<host>/?env=<uat|stag|prod>&enterpriseId=<id>&teamId=<id>&token=<bearer>
   optional: &serviceType=sales|service   ·   &userId=<id>&userEmail=<email>
```

| Param | Required | Meaning |
|---|---|---|
| `env` | **yes** | `uat` \| `stag` \| `prod` — selects the backend base URL *(alias `environment`)*. |
| `enterpriseId` | **yes** | Dealer enterprise to load *(snake_case `enterprise_id` also accepted)*. |
| `teamId` | **yes** | Team / rooftop to load *(snake_case `team_id` also accepted)*. |
| `token` | **yes** | Bearer for the backend, injected by the host *(alias `bearerToken`)*. |
| `serviceType` | no (default `sales`) | Initial department — **canonical param, matches the real converse-ai host URL** (e.g. `.../action-items?enterprise_id=…&team_id=…&serviceType=service`). `department` is accepted as a read-only legacy alias. |
| `userId`, `userEmail` | no | Acting BDC — recorded as resolver / assignee on writes. |

`app/page.tsx` reads these into `window.__AI_SCOPE__`; every backend call derives from it. The
in-app Sales/Service toggle **writes `serviceType` back to the URL** on every switch (dropping any
legacy `department=`), so the current view is always a shareable, deep-linkable URL — e.g. for an
email/SMS template that needs to land a rep directly on the Service tab.

### Environment → backend base URL
| `env` | Base URL |
|---|---|
| `uat` | `https://uat-api.spyne.xyz` |
| `stag` | `https://beta-api.spyne.xyz` |
| `prod` | `https://api.spyne.ai` |

Missing `env` defaults to `prod`. The bearer is attached client-side on every request.

### Run & deploy
```bash
npm install && npm run dev
# open http://localhost:3000/?env=uat&enterpriseId=<id>&teamId=<id>&token=<bearer>
```
Node ≥ 18.17 · Next 16 (App Router) · React 19 · Tailwind v4. **No `.env` / Vercel env vars** —
scope is entirely URL-driven. Embed:
```html
<iframe src="https://<host>/?env=prod&enterpriseId=…&teamId=…&token=…&serviceType=sales"
        style="border:0;width:100%;height:100%" allow="clipboard-write"></iframe>
```

---

## 2. Architecture (how data flows)

- **Direct backend calls** — `be-client.ts` calls `conversational-ai-backend` at `apiBaseForEnv(env)`
  with `Authorization: Bearer <token>`. No `/api/*` business proxy.
- **Only server route** — `GET /api/call-recording?url=<s3-url>`: a token-free, same-origin shim that
  pipes S3 audio bytes to the waveform player (the S3 recording host sends no CORS header). Holds no
  secret, calls no business API, SSRF-guarded to `*.amazonaws.com`.
- **Live-data merge** — on load, live customers, assignable users, and the intent catalog/SLAs are
  merged into the in-memory maps so names, initials, phones, intent labels and SLAs resolve correctly.
- **Read-only / capability flags** — the embed runs read-only; the write actions (resolve / assign /
  incorrect / SLA) are enabled via capability flags, so the same component powers both the embed and
  a full internal build.

---

## 3. Feature reference

### 3.1 Department toggle (Sales / Service)
Segmented toggle, top-right (default **Sales**). Action items have no department field server-side, so
scoping is applied **client-side** (intent → department) and covers the **whole board**: the queue,
the tab counts + lists, and the top-bar metrics all reflect only the selected department. Switching
shows a loading state, re-fetches, and renders that department's view.

### 3.2 SLA hero + top-bar metrics
A hero banner answers the one question that matters — **"Past SLA now: N items breaching"** — in green
when clear, red when breaching. Beside it: **Unassigned**, **Repeat callers**, **Cleared today**. Each
metric is **click-to-filter** (e.g. clicking the hero filters the queue to past-SLA items). All counts
are department-scoped.

### 3.3 Tabs — Unresolved / Resolved / Incorrect
Three tabs with live, department-scoped counts. **Unresolved** = the working queue; **Resolved** =
items closed in-session (with resolution type + filters); **Incorrect** = items flagged as
mis-created (excluded from the closure rate, undoable).

### 3.4 Search (categorized)
A single search box (`CategorizedSearchBox`) whose dropdown groups matches under **Customers ·
Intents · Action items**, with matched substrings highlighted. Picking a result jumps to and
highlights that item/customer/intent and clears any filter that would hide it.

### 3.5 Filters & quick chips
- **Group by**: Customer · Intent · Assignee · None (flat).
- **Intent**: any live intent in the queue.
- **Assignment**: All · Assigned · Unassigned.
- **Channel**: Call · SMS · Chat · Email.
- **Quick chips** (one-click triage): Past SLA · At risk · Unassigned · Repeat callers · Created
  today · Created yesterday · Callbacks. A "Clear" appears when any filter is active.

### 3.6 Manager / My queue
Scope toggle: **Manager** (all items) vs **My queue** (only the acting user's items). Applies
consistently across all three tabs.

### 3.7 Queue (left pane)
The filtered items, **sorted worst-SLA-first** by burn ratio. Grouped by the active Group-by key
(customer/intent/assignee) or flat. Group rows show the worst item's recap, item count, past-SLA
badge, expand to list members, and offer **Resolve all** for the group's visible items. Selecting a
group/item drives the right pane.

### 3.8 Open items (right pane) + actions
For the selected group/item, each `ItemCard` shows:
- **What needs doing** (the AI recap headline).
- **Source** — the exact **Customer** and **Agent** verbatim from the call, with **Listen** and
  **Transcript** buttons that open the source drawer.
- **Rail** — Created, Assignee, and an **activity trail** (logged by Vini/agent → assigned → resolved
  / flagged).
- **Actions**:
  - **Resolve** — pick a resolution type: *Appointment booked · Info provided · Customer unreachable ·
    DNC · Other*. The resolver is recorded (`resolvedBy`) and stored as the assignee.
  - **Assign** — pick from the live user list (`PATCH /leads/dealer/v1/assignment`).
  - **Mark incorrect** — pick a reason (*Wrong intent · Not a task · Customer didn't say this ·
    Duplicate · Other*) and optionally **reclassify** to the correct intent.
  - **Resolve all** — bulk-resolve the visible items.
  - Writes are optimistic with an honest toast if the backend write isn't reachable.

### 3.9 SLA engine
Each intent has an **SLA (hours)**. An item is **Past SLA** when its age ≥ the intent SLA, and
**At risk** when its burn ratio (age ÷ SLA) ≥ 0.75. Burn ratio drives queue sort and the hero count.
Live per-rooftop SLA overrides come from `dealer-intent-config` and are merged on load.

### 3.10 Source drawer — Call & Conversation
Opening **Listen** or **Transcript** resolves the item's **real call** (tries `callSid` →
`conversationId` → the customer's most recent call for call items), then shows:
- **Recording** — a waveform player (streamed via the same-origin audio shim). Transcript turns are
  **click-to-seek**, and the playing turn auto-scrolls/highlights.
- **Tabs** — Highlights · Customer · Summary · Appointment · Transcript (scroll-spy synced), plus the
  copyable **Call ID**.
- **SMS / chat** — for messaging items, the message thread is shown (no audio), auto-scrolled to the
  point the action item was created.
- **Browse all conversations** — optional list of the customer's other calls/threads to drill into.
- **Diagnostics** — if the backend returns no `recordingUrl`, an explicit "no recording returned"
  note (with the callId); if the report can't load, the actual error is surfaced.
- **No-transcript fallback** — the **Note** on top + the action-item **Details** as a vertical
  key/value list (Customer · Channel · Intent · Created · Status · Assignee), plus the captured
  Customer + Agent verbatim.

### 3.11 Rules panel
Opened from **Rules** on the tabs row:
- **Auto-create by channel** — per-channel toggles for which channels auto-create items *(session-only
  today; no backend endpoint yet)*.
- **Intent routing & SLA** — per-intent SLA editing in minutes / hours / days. Edits update the board
  live and **persist to `dealer-intent-config`** on any close (Done / ✕ / backdrop / Esc), with a
  "Saving…" state and confirmation toast. **Reset SLAs** restores defaults.

### 3.12 Customer sidebar
A focused right-side drawer for one customer: open/resolved/repeat-caller stats, their **open items**
as compact rows, a **Recent resolved** mini-list, and a link to the full profile — without leaving the
queue.

### 3.13 Create action item
A "Create action item" modal (non-read-only builds) to mint a valid action item manually and add it
to the board.

### 3.14 Acting BDC
Passed via the URL (`userId` / `userEmail`); whoever resolves an item is recorded as the resolver and
stored as its assignee.

---

## 4. Backend endpoints used
`GET /conversation/action-items` · `/conversation/vapi/end-call-report-by-id` ·
`/conversation/customers/conversations` · `/console/v1/user/get-user-list` ·
`/conversation/intent-catalog` · `/conversation/action-items/config` ·
`/conversation/dealer-intent-config` · `PUT /conversation/action-items/mark-resolved` ·
`/conversation/action-items/mark-incorrect` · `PUT /conversation/dealer-intent-config/{ent}/{team}/{code}` ·
`PATCH /leads/dealer/v1/assignment`. Audio: `GET /api/call-recording?url=` (same-origin shim).

---

## 5. Notes & known gaps
- **Auto-create by channel** is session-only — no backend route for channel routing yet.
- Intent-catalog / extraction-config / dealer-intent-config are **UAT-only** today (404 on prod;
  handled gracefully).
- Resolved / Incorrect tabs show items acted on **in-session** (the queue fetch requests pending items).
- `mark-incorrect` and `mark-resolved` require a **non-empty `note`** and `resolvedBy` (the console
  supplies defaults) — an empty note returns `400`.
- After changing code/config, **redeploy** so the embedded iframe serves the latest build (a stale
  build is the usual reason a fix "doesn't show" on the deployed console).

---

## 6. Changelog (latest release)
- **Removed the Vercel API proxy wrapper** — direct browser → backend; scope entirely from the iframe
  URL; no server-side secrets (only the token-free audio shim remains).
- **Sales / Service** toggle scopes the whole board (queue + tabs + top bar).
- **Compact layout** — Acting-as removed; Rules + Manager/My queue on the tabs row; search + all
  filters on one line; top section ~30% so the queue/detail panes get the height.
- **Fixes** — non-empty `note` on resolve/incorrect (was failing silently); SLA persistence on any
  Rules-panel close; recording player (absolute shim URL, was rejected as "No recording available");
  drawer robustness (real-call resolution + diagnostics + Note/Details fallback + Customer/Agent
  verbatim).
