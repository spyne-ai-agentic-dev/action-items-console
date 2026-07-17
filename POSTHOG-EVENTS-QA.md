# PostHog Events — QA Verification Guide

**Purpose:** verify every analytics event fires correctly. 40 events across adoption / activation / engagement / issues.
**Branch:** `feat/posthog-instrumentation` (merged to Product14 `main`, PR #12).
**Prepared:** 2026-07-17

---

## How to watch events while testing

1. **PostHog → Activity → Live** tab — shows events in real time as you click. Best for QA.
2. Click any event row → **Properties** to confirm it carries `lifecycle`, `enterprise_id`, `team_id`, `department`, plus the event-specific props listed below.
3. **PostHog → Data Management → Events** — the full catalog of event *definitions* seen so far (add descriptions/tags here; mark core events "Verified").
4. Ground truth in code: every event is a `track('<name>', '<lifecycle>', {props})` call — grep `track(` in the repo.

**Setup for testing:** open the console in a real UAT scope (`?env=uat&enterpriseId=…&teamId=…&token=…&serviceType=sales&userId=…&userEmail=…`) against a rooftop that has past-SLA items, repeat callers, SMS items, and at least one customer with multiple items + a recording. Naming: `category:object_action`, present tense.

---

## 1 · Adoption (5) — does the team open & load the console

| Event | Description | How to reproduce (step by step) | Key properties | Trigger point |
|-------|-------------|--------------------------------|----------------|---------------|
| `console:app_load` | The console iframe mounted / opened. Fires once per load. | 1. Open the console URL (or the converse-ai tab that embeds it). | `is_iframed`, `scope_present`, `has_user_identity`, `department` | app/page.tsx mount effect |
| `console:load_duration` | The item fetch finished; carries how long it took. | 1. Load the console. 2. Wait for the queue to render. | `load_ms`, `is_slow` (>4s), `pending_count`, `completed_count`, `merged_count` | app/page.tsx fetch `.then` |
| `console:empty` | Loaded fine but the scope has zero items. | 1. Open the console for a team/department with no action items. | `department` | app/page.tsx (count 0 branch) |
| `console:scope_missing` | Opened without full scope (enterprise/team/token) — blocks real use. | 1. Open the console URL with **no** `enterpriseId`/`teamId`/`token` (e.g. bare Vercel URL). | `has_enterprise_id`, `has_team_id`, `has_token` | app/page.tsx mount effect |
| `console:department_switch` | User (or host) switched Sales ↔ Service. | 1. Click the **Service** toggle (top-right), then **Sales**. *(Also fires if the host posts `setServiceType`.)* | `from`, `to`, `changed_via` (`toggle`\|`host`) | app/page.tsx toggle onClick / host message |

---

## 2 · Activation (8) — reaching the core value

| Event | Description | How to reproduce (step by step) | Key properties | Trigger point |
|-------|-------------|--------------------------------|----------------|---------------|
| `item:open` | User selected an action item / group → right pane shows it. | 1. In the queue, click any customer/item row. | full itemProps + `group_by` | ActionItemsConsole `pickItem` |
| `call:drawer_open` | The call/conversation drawer opened for an item. | 1. Open an item. 2. Click **Listen** or **Transcript**. | itemProps + `mode` (`call`\|`conversation`) | ActionItemsConsole (sourceView effect) |
| `call:recording_play` | The call recording actually started playing (the "aha"). | 1. Open the drawer on an item with a recording. 2. Press **play** on the waveform. | `action_item_id`, `call_id`, `is_fallback_call` | CallConversationDrawer WaveformPlayer `onPlay` |
| `call:transcript_view` | User opened the Transcript tab in the drawer. | 1. In the drawer, click the **Transcript** tab. | `is_messaging`, `turn_count` | CallConversationDrawer tab onClick |
| `item:resolve` | An item was resolved with an outcome. | 1. Open an item. 2. Click **Resolve** → pick an outcome (e.g. Appointment booked) → confirm. | itemProps + `resolution_type`, `has_note`, `assignee_after`, `is_live` | ActionItemsConsole `resolveTyped` |
| `item:first_resolve` | The **first** resolve of the session (fires once) + time-to-value. | 1. Load the console fresh. 2. Resolve your first item. *(Won't fire again until reload.)* | `resolution_type`, `time_to_first_resolve_ms` | ActionItemsConsole `resolveTyped` |
| `item:assign` | An item was assigned to a rep. | 1. Open an item. 2. Click **Assign** → pick a user. | itemProps + `assignee_user_id`, `assign_success` | ActionItemsConsole `assign` |
| `item:flag_incorrect` | An item was flagged Incorrect (optionally reclassified). | 1. Open an item. 2. Click **Incorrect** → pick a reason (optionally choose a corrected intent) → confirm. | `incorrect_reason`, `is_reclassify`, `corrected_intent_id`, `original_intent_id` | ActionItemsConsole `markIncorrect` |

---

## 3 · Engagement (16) — depth of use

| Event | Description | How to reproduce (step by step) | Key properties | Trigger point |
|-------|-------------|--------------------------------|----------------|---------------|
| `queue:tab_switch` | Switched Unresolved / Resolved / Incorrect tabs. | 1. Click the **Resolved** tab, then **Incorrect**. | `tab`, `count` | ActionItemsConsole tab onClick |
| `queue:filter` | Changed a dropdown filter (Intent / Assignment / Channel). | 1. Change the **Intent** (or Assignment/Channel) dropdown to any value. | `filter_key`, `filter_value` | ActionItemsConsole `handleFiltersChange` |
| `queue:chip_toggle` | Toggled a boolean quick-chip (Repeat callers / Callbacks). | 1. Click the **Repeat callers** chip, then the **Callbacks** chip. | `chip_key`, `active` | ActionItemsConsole `handleFiltersChange` |
| `queue:clear_filters` | Cleared filters (or a change that reset 3+ at once). | 1. Apply a few filters. 2. Click **Clear**. | `cleared_count` | ActionItemsConsole `handleFiltersChange` |
| `queue:hero_metric_click` | Clicked an SLA hero tile to filter the queue. | 1. Click the **Past SLA / Unassigned / Repeat callers** number tile at the top. | `metric` + patch | ActionItemsConsole `applyQuickFilter` |
| `queue:group_by_change` | Changed the Group-by control. | 1. Change **Group by** to Intent / Assignee / None. | `group_by` | ActionItemsConsole `onGroupBy` |
| `queue:group_expand` *(see note)* | Expanded a multi-item group ("See all N"). | 1. On a group card with >1 item, click **See all N**. | `group_key`, `item_count` | *(if wired — otherwise via item:open)* |
| `queue:resolve_all` | Bulk-resolved all visible items for a customer/group. | 1. On a customer with multiple items, click **Resolve all N**. | `item_count`, `group_by` | ActionItemsConsole `resolveAll` |
| `item:restore` | Restored an Incorrect item back to the queue. | 1. Go to **Incorrect** tab. 2. Click **Restore** on an item. | `action_item_id` | ActionItemsConsole `undoIncorrect` |
| `customer:sidebar_open` | Opened the customer side drawer. | 1. Click a customer **name** in the queue/right pane. | `customer_id` | ActionItemsConsole (sidebar effect) |
| `search:perform` | Ran a search (debounced ~600ms after typing). | 1. Type a name/phone (≥2 chars) in the queue search; pause. | `query_length`, `total_matches`, `customer_matches`, `item_matches` | CategorizedSearchBox effect |
| `search:result_pick` | Clicked a search result row. | 1. Search, then click a **Customer / Intent / Action item** result. | `result_type` | ActionItemsConsole onPick* |
| `call:browse_conversations` | Opened "Browse all N conversations" in the drawer. | 1. Open a drawer where the item has no direct call. 2. Click **Browse all N conversations**. | `conversation_count`, `customer_id` | CallConversationDrawer button |
| `call:conversation_drill` | Opened a specific call/SMS from the browse list. | 1. In the browse list, click one **conversation card**. | `is_sms`, `is_this_item`, `has_recording` | CallConversationDrawer card onClick |
| `call:transcript_seek` | Clicked a transcript line to seek the audio. | 1. In the drawer, play a call → click any **transcript turn**. | `at_sec` | CallConversationDrawer `seek` |
| `sla:rules_open` | Opened the Rules (SLA) panel. | 1. Click **Rules** (next to the tabs). | — | ActionItemsConsole Rules button |
| `sla:rule_save` | An SLA rule was saved to the backend (live mode). | 1. Open Rules. 2. Change an intent's SLA value/unit. 3. Close the panel (persists). | `intent_code`, `minutes`, `department` | ActionItemsConsole `onPersistSla` (success) |

> Note: `queue:group_expand` is listed in the plan; if your build routes "See all" through `item:open` instead, you'll see `item:open` — confirm which and we can add the dedicated event.

---

## 4 · Issues (11) — friction the console observes (many need a failure to reproduce)

| Event | Description | How to reproduce (step by step) | Key properties | Trigger point |
|-------|-------------|--------------------------------|----------------|---------------|
| `console:load_fail` | Initial item fetch failed → red error screen. | 1. Open the console with a **bad/expired token** (or point at an unreachable env). | `error_message`, `department`, `load_ms` | app/page.tsx fetch `.catch` |
| `data:fetch_fail` | A backend GET returned non-OK (items / completed / user-list). | 1. Same as above, or DevTools → block the request / throttle to force a 4xx/5xx. | `endpoint`, `status_code`, `page` | be-client.ts fetch guards |
| `data:fetch_partial` | Backlog paging failed after page 1 → partial list. | 1. On a large multi-page rooftop, force a mid-pagination failure (throttle/offline after first page). | `pages_fetched`, `items_so_far` | be-client.ts (pending loop) |
| `call:report_load_fail` | The end-call report couldn't load → falls back to evidence. | 1. Open a call item whose call report 404s (stale/missing callId), **or** DevTools-block `end-call-report-by-id`. | `status_code`/`error_message`, `had_own_source`, `drilled` | CallConversationDrawer load effects |
| `call:recording_unavailable` | Report loaded but there's no recording URL (amber "no recording"). | 1. Open a call item whose report has no stored audio. | `call_id`, `is_messaging` | CallConversationDrawer load effect |
| `call:fallback_shown` | Amber banner: showing the customer's latest call, not the item's own. | 1. Open a **call-type item that has no linked call id** but the customer has other calls. | `action_item_id`, `customer_id` | CallConversationDrawer load effect |
| `data:write_unreachable` | Optimistic resolve/flag succeeded in view but the BE write failed. | 1. With the backend write endpoint blocked/offline, **Resolve** (or flag) an item → toast "Saved in view — backend not reachable". | `write_kind` (`resolve`\|`resolve_all`\|`incorrect`), `action_item_id` | ActionItemsConsole write handlers |
| `data:assign_fail` | The assignment PATCH failed. | 1. With the assignment endpoint blocked, **Assign** an item → "Could not assign". | `action_item_id`, `lead_id` | ActionItemsConsole `assign` |
| `data:sla_persist_fail` | Saving an SLA rule to the backend failed. | 1. With the dealer-intent-config endpoint blocked, edit an SLA in Rules and close → "SLA saved in view". | `intent_code`, `minutes`, `department` | ActionItemsConsole `onPersistSla` (failure) |
| `search:zero_results` | A search returned no matches. | 1. Type a query that matches nothing (e.g. "zzzzz"); pause. | `query_length` | CategorizedSearchBox effect |
| `queue:empty_after_filters` | Filters/search hid the whole queue even though pending work exists. | 1. Apply a filter combo (or search) that matches nothing while items exist. | `has_search` | ActionItemsConsole effect |

**Forcing issue events in QA:** the cleanest way to trigger the `data:*` / `call:*_fail` events without a real outage is Chrome DevTools → **Network** → right-click the request → **Block request URL** (or set **Offline**), then perform the action. Each maps to a real bug class from `QA-REVIEW` (e.g. `call:fallback_shown` ↔ A2, `data:write_unreachable` ↔ optimistic writes, `call:recording_unavailable` ↔ B6) — so once live, this Issues set is a regression monitor.

---

## Every event also carries (super-properties, auto-attached)
`lifecycle`, `env`, `enterprise_id`, `team_id`, `department`, `has_user_identity` — plus `distinct_id` (the operator's `userId`/`userEmail`) and the `enterprise` / `team` groups. **Never** present: bearer token, customer name/phone, or message text (PII-excluded by design).
