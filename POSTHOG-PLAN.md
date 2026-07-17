# PostHog Instrumentation — Event Taxonomy, Implementation Plan & Dashboards

**Product:** Action Items Console (Next.js 16 iframe embed inside converse-ai / console.spyne.ai)
**Scope:** Frontend (`posthog-js`) event tracking + Backend (`posthog-node`) event logging, a governed event schema, and dashboards for user journeys + errors/issues.
**Prepared:** 2026-07-17

---

## 1. Goals — the four questions we want the data to answer

| Bucket | Question | Example decision it drives |
|--------|----------|----------------------------|
| **Adoption** | Which rooftops/teams/users actually *open* the console, and how often? | Which dealers to onboard / chase; is the iframe even loading for a team? |
| **Activation** | Do users reach the core value — open an item, listen to the call, and **resolve** it? | Is the product "working" for a new team, or do they bounce before first resolve? |
| **Engagement** | How deeply do active users work the queue (filters, search, SLA rules, bulk resolve, repeat visits)? | Which features earn their keep; where power-users live. |
| **Issues** | What breaks or creates friction *that the console can observe* — fetch failures, missing recordings, fallback calls, data-quality gaps? | Prioritise BE fixes; catch a broken rooftop before the customer reports it. |

Every event carries a `lifecycle` property (`adoption` \| `activation` \| `engagement` \| `issue`) so each dashboard is a clean filter, **and** a functional `category:object_action` name so the taxonomy stays filterable.

---

## 2. Architectural constraints (these shape every choice below)

1. **Cross-origin iframe.** The console runs inside a host on a different origin. Third-party cookies are blocked/partitioned in Safari/Firefox/Chrome → **do not rely on cookies for identity**. We identify explicitly from URL params instead.
2. **Identity arrives via the URL** (`userId`, `userEmail`, `enterpriseId`, `teamId`, `department`, `env`) — read once in [app/page.tsx](app/page.tsx:48). The bearer `token` is also in the URL — **it must never become an event property**.
3. **No user identity in the token** → resolves default `resolvedBy` to `"console"` when `userId`/`userEmail` are absent. Missing identity is itself a tracked data-quality issue.
4. **Optimistic writes.** Resolve/flag/assign update local state first, then fire a best-effort BE write ([ActionItemsConsole.jsx](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L280)). So "user resolved an item" (FE) and "BE persisted it" (FE reachability + BE event) are **different facts** — we capture both.
5. **`readOnly` embed today** — the page passes `readOnly`; confirm which write actions are actually enabled in prod before wiring their events.

---

## 3. Naming & schema convention (adopt repo-wide)

Per PostHog's best-practices page:

- **Format:** `category:object_action` — lowercase, **snake_case**, **present tense** verbs (`resolve`, `open`, `fail` — not `resolved`/`opened`).
- **Properties:** `object_adjective` (`sla_overdue_minutes`), booleans `is_/has_` (`is_past_sla`, `has_call_id`), time `_ms`/`_at`.
- **Never interpolate dynamic values into event/property names** (no `item_<id>_resolved`) — it explodes the taxonomy.
- Categories we use: `console`, `queue`, `item`, `call`, `search`, `sla`, `customer`, `data`.

> PostHog's docs contain a minor naming conflict (one page shows past-tense). We follow the dedicated **best-practices** page (present tense, `category:object_action`) and enforce it via a tiny `capture()` wrapper (§7).

---

## 4. Identity & groups model

Set once at init in [app/page.tsx](app/page.tsx), and re-register `department` on toggle:

```ts
// distinct_id: prefer the stable userId; fall back to email; else stay anonymous
if (userId || userEmail) {
  posthog.identify(userId || userEmail, { email: userEmail || undefined })
}
// group analytics — roll adoption up per dealer group and per team
if (enterpriseId) posthog.group('enterprise', enterpriseId)
if (teamId)       posthog.group('team', teamId)
// scope on every event
posthog.register({ env, enterprise_id: enterpriseId, team_id: teamId, department })
```

- **Groups:** `enterprise` (rooftop group / dealer) and `team`. Enables "N enterprises active this week", per-dealer funnels.
- **`has_user_identity`** super-prop (`!!userId || !!userEmail`) so we can see how much traffic is anonymous.
- **Never** `$set` phone/customer name; email is on the *operator* (our user), which is acceptable as a person property — but keep it out of event names and out of any URL that leaves our origin.

---

## 5. Event catalog

Hook points are `file:line`. `FE` = `posthog-js`, `BE` = `posthog-node` (separate service). A shared `itemProps(item)` serializer (§7) supplies the item fields; only event-specific props are listed.

### 5.1 Adoption

| Event | When | Key properties | Hook |
|-------|------|----------------|------|
| `console:app_load` | App/iframe mounts | `is_iframed`, `scope_present`, `has_user_identity`, `department` | [page.tsx:94](app/page.tsx#L94) |
| `console:load_duration` | Item fetch settles | `load_ms`, `pending_count`, `completed_count`, `is_slow` | [page.tsx:118](app/page.tsx#L118) |
| `console:load_fail` *(also issue)* | Initial fetch rejects (red screen) | `error_message`, `department` | [page.tsx:129](app/page.tsx#L129) |
| `console:scope_missing` *(blocks use)* | Opened without enterprise/team/token | `has_enterprise_id`, `has_team_id`, `has_token` | [page.tsx:144](app/page.tsx#L144), [be-client.ts:39](components/max-2/sales/console-v2/action-items/be-client.ts#L39) |
| `console:empty` | Loaded OK but zero items | `department`, `scope_label` | [page.tsx:174](app/page.tsx#L174) |
| `console:department_view` | Dept active on load | `department`, `changed_via:"initial"` | [page.tsx:62](app/page.tsx#L62) |
| `console:department_switch` | Sales/Service toggle | `from`, `to`, `changed_via:"toggle"\|"host"` | [page.tsx:153](app/page.tsx#L153), [page.tsx:97](app/page.tsx#L97) |

### 5.2 Activation

| Event | When | Key properties | Hook |
|-------|------|----------------|------|
| `item:open` | Item/group selected → right pane | `queue_position`, `groupBy`, `is_past_sla`, `sla_overdue_minutes` | [ActionItemsConsole.jsx:480](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L480) |
| `call:drawer_open` | Listen/Transcript opens drawer | `mode`, `can_listen`, `has_call_id`, `has_conversation_id` | [ActionItemsConsole.jsx:537](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L537) |
| `call:recording_play` *(aha)* | Recording actually plays | `is_fallback_call`, `is_messaging`, `recording_present` | [CallConversationDrawer.jsx:447](components/max-2/sales/console-v2/action-items/CallConversationDrawer.jsx#L447) |
| `call:transcript_view` | Transcript tab/section viewed | `turn_count`, `is_messaging` | [CallConversationDrawer.jsx:458](components/max-2/sales/console-v2/action-items/CallConversationDrawer.jsx#L458) |
| `item:resolve` *(core value)* | Resolve confirmed | `resolution_type`, `has_note`, `is_past_sla`, `assignee_after`, `is_live` | [ActionItemsConsole.jsx:281](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L281) · **+BE** |
| `item:first_resolve` | First resolve of session (guard once) | `time_to_first_resolve_ms` + itemProps | same hook |
| `item:assign` | Assign confirmed | `assignee_user_id`, `assign_success` | [ActionItemsConsole.jsx:332](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L332) · **+BE** |
| `item:create` | Create-modal submit | `intent_id`, `source_channel`, `is_new_customer` | [CreateActionItemModal.jsx](components/max-2/sales/console-v2/action-items/CreateActionItemModal.jsx) |

**Timing:** `time_to_first_resolve_ms` (load → first resolve), `drawer_open→play latency`, `report_load_ms`.

### 5.3 Engagement

| Event | When | Key properties | Hook |
|-------|------|----------------|------|
| `queue:tab_switch` | Unresolved/Resolved/Incorrect | `tab`, `count` | [ActionItemsConsole.jsx:423](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L423) |
| `queue:filter` | Intent/assignment/channel change | `filter_key`, `filter_value` | [ActionItemsConsole.jsx:686](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L686) |
| `queue:chip_toggle` | Quick chips (Past SLA, Unassigned, Repeat, Callbacks…) | `chip_key`, `active` | [ActionItemsConsole.jsx:656](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L656) |
| `queue:hero_metric_click` | SLA hero tile → filter | `metric`, `value` | [ActionItemsConsole.jsx:594](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L594) |
| `queue:group_by_change` | Group-by control | `group_by`, `group_count` | [ActionItemsConsole.jsx:453](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L453) |
| `queue:group_expand` | "See all N" | `group_key`, `item_count` | [ActionItemsConsole.jsx:848](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L848) |
| `queue:resolve_all` | Bulk resolve | `item_count`, `group_by` | [ActionItemsConsole.jsx:300](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L300) · **+BE** |
| `search:perform` | Query typed (debounced) | `query_length`, `total_matches`, `customer_matches`, `item_matches` | [CategorizedSearchBox.jsx:184](components/max-2/sales/console-v2/action-items/CategorizedSearchBox.jsx#L184) |
| `search:result_pick` | Result row clicked | `result_type`, `filters_cleared` | [CategorizedSearchBox.jsx:162](components/max-2/sales/console-v2/action-items/CategorizedSearchBox.jsx#L162) |
| `customer:sidebar_open` | Customer drawer opens | `open_count`, `resolved_count`, `repeat_count` | [ActionItemsConsole.jsx:775](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L775) |
| `call:browse_conversations` | "Browse all N conversations" | `conversation_count` | [CallConversationDrawer.jsx:424](components/max-2/sales/console-v2/action-items/CallConversationDrawer.jsx#L424) |
| `call:conversation_drill` | Opens a specific call/SMS from list | `is_sms`, `is_this_item` | [CallConversationDrawer.jsx:308](components/max-2/sales/console-v2/action-items/CallConversationDrawer.jsx#L308) |
| `call:transcript_seek` | Click a turn to seek audio | `at_sec` | [CallConversationDrawer.jsx:109](components/max-2/sales/console-v2/action-items/CallConversationDrawer.jsx#L109) |
| `sla:rules_open` | Rules panel opens | — | [ActionItemsConsole.jsx:435](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L435) |
| `sla:rule_edit` | Per-intent SLA changed | `intent_id`, `sla_minutes`, `unit` | [ActionItemsConsole.jsx:1438](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L1438) |
| `sla:rules_save` | Panel closes, persists edits | `edited_count`, `persist_success` | [ActionItemsConsole.jsx:1464](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L1464) · **+BE** |
| `item:restore` | Incorrect → back to queue | `intent_id` | [ActionItemsConsole.jsx:331](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L331) |

### 5.4 Issues (friction the console can observe)

| Event | Signal | Key properties | Hook |
|-------|--------|----------------|------|
| `data:fetch_fail` | GET action-items non-OK (pending/completed/users) | `status_code`, `endpoint`, `page` | [be-client.ts:59](components/max-2/sales/console-v2/action-items/be-client.ts#L59), [:115](components/max-2/sales/console-v2/action-items/be-client.ts#L115), [:145](components/max-2/sales/console-v2/action-items/be-client.ts#L145) |
| `data:fetch_partial` | Backlog page >1 failed → partial list | `pages_fetched`, `items_so_far` | [be-client.ts:60](components/max-2/sales/console-v2/action-items/be-client.ts#L60) |
| `call:report_load_fail` | End-call report failed → evidence fallback | `status_code`, `had_own_source` | [CallConversationDrawer.jsx:214](components/max-2/sales/console-v2/action-items/CallConversationDrawer.jsx#L214) |
| `call:recording_unavailable` | Report OK but no `recordingUrl` | `is_messaging` | [CallConversationDrawer.jsx:448](components/max-2/sales/console-v2/action-items/CallConversationDrawer.jsx#L448) |
| `call:fallback_shown` | Amber banner — customer's latest call, not the item's | `customer_id` | [CallConversationDrawer.jsx:339](components/max-2/sales/console-v2/action-items/CallConversationDrawer.jsx#L339) |
| `call:no_transcript` | Empty transcript/conversation | `is_messaging` | [CallConversationDrawer.jsx:84](components/max-2/sales/console-v2/action-items/CallConversationDrawer.jsx#L84) |
| `data:write_unreachable` | Optimistic resolve/flag BE write failed | `write_kind`, `count`, `resolution_type` | [ActionItemsConsole.jsx:294](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L294), [:329](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L329) · **+BE** |
| `data:assign_fail` | Assign PATCH failed | `status_code`, `lead_id` | [ActionItemsConsole.jsx:339](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L339) · **+BE** |
| `data:sla_persist_fail` | dealer-intent-config PUT failed | `intent_code`, `minutes` | [ActionItemsConsole.jsx:567](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L567) · **+BE** |
| `search:zero_results` | Query typed, no matches | `query_length` | [CategorizedSearchBox.jsx:207](components/max-2/sales/console-v2/action-items/CategorizedSearchBox.jsx#L207) |
| `queue:empty_after_filters` | "No items match these filters" | `active_filters` | [ActionItemsConsole.jsx:469](components/max-2/sales/console-v2/action-items/ActionItemsConsole.jsx#L469) |
| `data:quality_missing_call_id` | Item has no call/conversation id (Listen disabled) | `has_call_id`, `has_conversation_id` | derive on `item:open` |
| `data:quality_missing_customer` | Name fell back to slug/"Customer" | `customer_id` | [be-mapper.ts:108](components/max-2/sales/console-v2/action-items/be-mapper.ts#L108) |
| `data:quality_no_user_identity` | No `userId`/`userEmail` → resolver logged as "console" | `has_user_id`, `has_user_email` | [page.tsx:52](app/page.tsx#L52) |

> These `data:quality_*` events map **directly onto the QA-REVIEW issues** (A2 fallback call, A9 name degradation, B6 recording, B13 identity) — so the Issues dashboard becomes a live regression monitor for the very bugs we just fixed.

### 5.5 Backend events (`posthog-node`, conversational-ai-backend)

Server-side truth for the four writes — fire in the API handlers, using the **same `distinctId` = `userId`** the FE uses so events stitch to one person. Set `$process_person_profile: false` for pure system events.

| BE event | Handler | Properties |
|----------|---------|------------|
| `item:resolve` (server) | mark-resolved | `action_item_id`, `reason_code`, `resolved_by`, `note_defaulted`, `enterprise_id`, `team_id` |
| `item:mark_incorrect` (server) | mark-incorrect | `action_item_id`, `reason_code`, `corrected_intent_id` |
| `item:assign` (server) | assignment | `lead_id`, `user_id`, `trigger:"manual"\|"resolve_auto_assign"` |
| `sla:config_update` (server) | dealer-intent-config | `intent_code`, `custom_sla_minutes`, `service_type` |
| `api:error` | any 4xx/5xx in these handlers | `endpoint`, `status_code`, `enterprise_id` |

---

## 6. Implementation plan (phased)

### Phase 0 — Project & decisions (blocks everything)
- Create/confirm the PostHog **project**; note **region** (US → `us.i.posthog.com`, EU → `eu.i.posthog.com`).
- Grab `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`.
- Decisions (see §11): autocapture on/off, wizard vs manual, one project for FE+BE vs split, PII sign-off.

### Phase 1 — SDK install (iframe-safe)
1. `npm install posthog-js`.
2. **Reverse proxy** via `next.config` rewrites (`/ingest` → PostHog) so ad-blockers don't drop events and ingestion is same-origin as the iframe.
3. Init with iframe-safe persistence + explicit identify/group (§4, §8). **Autocapture recommended OFF** — curated events only (this is an analytics-serious internal tool; autocapture would be noisy inside a dense dashboard).
4. Verify events land in PostHog **Activity** from a real embedded session in Safari + Chrome (validate the cookie/partition behaviour empirically).

### Phase 2 — Adoption + Activation events (highest value first)
- Wire `console:*`, `item:open`, `call:drawer_open`, `call:recording_play`, `item:resolve` (+ `first_resolve` timing).
- This alone answers "is the console loading and are teams resolving?" — ship and watch for a week.

### Phase 3 — Engagement + Issues events
- Wire the `queue:*`, `search:*`, `sla:*`, `customer:*` engagement set and the full `data:*` / `call:*` issue set.
- Add `res.status` capture inside the four `be-client.ts` writers + readers so issue events carry real status codes (they currently collapse to `res.ok`).

### Phase 4 — Backend events (`posthog-node`)
- Add `posthog-node` to conversational-ai-backend; capture the §5.5 set in the write handlers; **`await client.shutdown()`** on process exit / per-request flush in serverless.

### Phase 5 — Schema governance
- In Data Management: add **descriptions + tags** (`adoption`/`activation`/`engagement`/`issue`) to every event, mark the core funnel events **Verified**, hide any stray autocapture.

### Phase 6 — Dashboards + alerts (§9, §10)
- Build the 3 dashboards (via MCP or UI) and wire the alerts.

---

## 7. Config & helper snippets

**Reverse proxy — `next.config.mjs`:**
```js
async rewrites() {
  return [
    { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
    { source: '/ingest/:path*',        destination: 'https://us.i.posthog.com/:path*' },
  ]
}
```

**Init — `instrumentation-client.ts` (iframe-safe):**
```ts
import posthog from 'posthog-js'
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: '/ingest',              // same-origin proxy → resolves against the iframe origin
  ui_host: 'https://us.posthog.com',
  persistence: 'localStorage',      // NO third-party cookies in a cross-origin iframe
  cross_subdomain_cookie: false,
  autocapture: false,               // curated events only
  capture_pageview: true,
  defaults: '2026-05-30',
})
```

**Identify/group** — in [app/page.tsx](app/page.tsx) once params are read (§4).

**Typed capture wrapper** (enforces naming + injects `lifecycle` + `itemProps`):
```ts
// lib/analytics.ts
import posthog from 'posthog-js'
type Lifecycle = 'adoption' | 'activation' | 'engagement' | 'issue'
export function track(event: string, lifecycle: Lifecycle, props: Record<string, unknown> = {}) {
  posthog.capture(event, { lifecycle, ...props })
}
export function itemProps(i: ActionItem) {
  return {
    action_item_id: i.action_item_id, customer_id: i.customer_id,
    intent_id: i.intent_id, source_channel: i.source_channel,
    department: deptOf(i), is_past_sla: isPastSla(i),
    sla_overdue_minutes: slaOverdueMinutes(i), assignee_user_id: i.assignee_user_id,
    repeat_caller_count: i.repeat_caller_count,
    has_call_id: !!i.source_call_id, has_conversation_id: !!i.source_conversation_id,
    // NEVER: source_message, intent_recap, customer name/phone (customer PII)
  }
}
```

**Backend — `posthog-node`:**
```ts
import { PostHog } from 'posthog-node'
const ph = new PostHog(process.env.POSTHOG_PROJECT_TOKEN!, { host: 'https://us.i.posthog.com' })
ph.capture({ distinctId: userId, event: 'item:resolve', properties: { /* … */, $process_person_profile: true } })
await ph.shutdown() // flush before exit
```

---

## 8. Dashboards (deliverable #3)

Three dashboards. Build via the **PostHog MCP** (prompts below) or the UI. All insights filter by the `lifecycle` property and break down by `enterprise`/`team` groups.

### Dashboard A — Adoption & Activation (the journey)
| Insight | Type | Definition |
|---------|------|-----------|
| Weekly active enterprises / teams | Trends (unique groups) | `console:app_load`, breakdown by `enterprise` group |
| DAU/WAU operators | Trends (unique users) | `console:app_load`, unique `distinct_id` |
| **Activation funnel** | Funnel | `console:app_load` → `item:open` → `call:recording_play` → `item:resolve` |
| Time to first resolve | Trends (avg) | `item:first_resolve.time_to_first_resolve_ms` (p50/p90) |
| New team → activated | Funnel (by group) | first `console:app_load` → first `item:resolve`, breakdown by `enterprise` |
| Anonymous traffic share | Trends | `console:app_load` split by `has_user_identity` |
| Department split | Trends | `console:department_view` breakdown by `department` |

### Dashboard B — Engagement & feature usage
| Insight | Type | Definition |
|---------|------|-----------|
| Resolves per active user | Trends (formula) | `item:resolve` ÷ unique users |
| Feature adoption | Trends | `queue:filter`, `search:perform`, `sla:rule_edit`, `queue:resolve_all`, `customer:sidebar_open` |
| **User journeys / paths** | Paths | starting at `console:app_load` — see how users flow to resolve vs. drop |
| Retention | Retention | returning `console:app_load` week over week, by `enterprise` |
| Bulk vs single resolve | Trends | `queue:resolve_all` vs `item:resolve` |
| SLA rule tuning | Trends | `sla:rules_save.edited_count` by `enterprise` |
| Quick-chip usage | Trends | `queue:chip_toggle` breakdown by `chip_key` |

### Dashboard C — Issues & errors (live regression monitor)
| Insight | Type | Definition |
|---------|------|-----------|
| Error rate | Trends (formula) | `data:fetch_fail` ÷ `console:app_load` |
| Errors by status code | Trends | `data:fetch_fail` breakdown by `status_code` |
| Recording/report gaps | Trends | `call:report_load_fail`, `call:recording_unavailable`, `call:fallback_shown` |
| Write reachability | Trends | `data:write_unreachable`, `data:assign_fail`, `data:sla_persist_fail` |
| Data-quality gaps | Trends | `data:quality_missing_call_id`, `data:quality_missing_customer`, `data:quality_no_user_identity` |
| Load performance | Trends (avg/p90) | `console:load_duration.load_ms`, `% is_slow` |
| Worst rooftops | Trends (table) | any `issue` event breakdown by `enterprise` group |

**MCP build prompts** (once the PostHog MCP is connected — §10):
- *"Create a funnel insight named 'Activation funnel' with steps `console:app_load` → `item:open` → `call:recording_play` → `item:resolve`, last 30 days, breakdown by the enterprise group. Add it to a new dashboard 'AIC — Adoption & Activation'."*
- *"Create a paths insight starting from `console:app_load` for the last 14 days and add it to 'AIC — Engagement'."*
- *"Create a trends insight of `data:fetch_fail` broken down by `status_code`, and one of `call:fallback_shown`, on a dashboard 'AIC — Issues & Errors'."*

---

## 9. Alerts (§ PostHog Alerts)
| Alert | Insight | Threshold | Channel |
|-------|---------|-----------|---------|
| Console down for a rooftop | `data:fetch_fail` (by enterprise) | > N in 1h (absolute) | Slack |
| Error-rate spike | error-rate formula | increases > 50% WoW (relative) | Slack |
| Recording gaps rising | `call:report_load_fail` + `recording_unavailable` | > N/day | Slack |
| Activation stall | `item:resolve` | drops > 30% WoW | Slack + email |
> Free tier caps at 5 alerts; alerts run on trends/funnels/SQL insights only.

---

## 10. PostHog MCP (for building/maintaining insights from chat)
- Install: `npx @posthog/wizard mcp add` (or point an MCP client at `https://mcp.posthog.com/mcp`).
- Auth: a **personal API key** with insight/dashboard/query scopes; enable "AI data processing" in org settings.
- Capability: `dashboard-create`, `insight-create-from-query`, `query-run`, `query-generate-hogql-from-question`, path/funnel/retention actor drill-downs — i.e. I can create the §8 dashboards programmatically once it's connected in this session.

---

## 11. Decisions needed before we write code
1. **PostHog project + region** (US/EU) and project token — do you have one, or should we create it?
2. **Autocapture** — recommend **off** (curated). Confirm.
3. **Wizard vs manual init** — recommend **manual** (the wizard won't set the iframe-safe persistence/proxy). OK?
4. **One project for FE + BE**, or separate? (One is simpler for cross-stitching by `distinct_id`.)
5. **PII sign-off** — operator `email` as a person property is proposed; customer name/phone/message content are **excluded**. Confirm acceptable.
6. **BE repo access** — `posthog-node` events need the conversational-ai-backend repo (not in this workspace). Who owns that change?
7. **GSD workflow** — repo CLAUDE.md asks that code changes route through a GSD command; confirm how you want the instrumentation phase tracked.

---

## 12. Privacy & governance
- Bearer `token` and customer PII (name/phone/`source_message`/`intent_recap`) are **never** sent as properties — only booleans/lengths/ids.
- Operator email lives on the person profile only; never in event names or outbound URLs.
- All events tagged with `lifecycle` + a functional category; core funnel events marked **Verified** in Data Management; the taxonomy is the contract.
