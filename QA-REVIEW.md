# Action Items Console — QA Review: Issues & Fixes

**Branch under review:** `fix/action-items-bugs`
**Prepared:** 2026-07-17
**For:** QA team — please verify each item below and mark Pass/Fail in the last column.

---

## How to test

The console runs as an **iframe** inside converse-ai. Open it with the scope in the URL:

```
https://<console-host>/?env=uat&token=<bearerToken>&enterpriseId=<ent>&teamId=<team>&serviceType=sales
```

- `serviceType` = `sales` or `service` (this is the department; it is the **canonical** URL param — `department` is a legacy alias).
- Without a valid `token`/`enterpriseId`/`teamId` the console falls back to mock data — use a **real UAT scope** to verify data-layer fixes.
- Most fixes touch **live data**, so test against a rooftop that actually has: past-SLA items, repeat callers, SMS items, resolved/incorrect items, and at least one customer with multiple items.

**Legend:** 🔴 High · 🟠 Medium · 🟡 Low/hardening

---

## A. Latest batch — wrong-entity / stale-state audit

These came out of a systematic audit (4 parallel reviewers) for one bug class: *the wrong or stale record being shown*. Please prioritise A1–A4.

| ID | Sev | Reported symptom | Root cause | Fix | How QA verifies | Commit |
|----|-----|------------------|-----------|-----|-----------------|--------|
| **A1** | 🔴 | Right-side customer drawer always showed the **same name** (e.g. "Lucio Bruno") no matter which customer you clicked; phone/items were correct. | Drawer read the name via a `find()` over **all** items (first named item) instead of scoping to the clicked customer. | Name (and phone) now read from the clicked customer's own items. | Open the customer drawer for several different customers in the Open Items list. Header name + phone must match the row you clicked, every time. | `85ec778` |
| **A2** | 🔴 | "Listen"/"Transcript" could play a **different call** than the action item came from (wrong recording/transcript/summary). | When the item's own call id failed to load, it silently fell back to "customer's most recent call" and showed that as the item's source. | Fallback now runs **only** when the item has *no* call id at all, and shows an amber banner saying it may not be this item's call. An item with a real id that fails now shows its evidence excerpt, not an unrelated call. | Open an item that has a real recording → correct call plays, no banner. Open a call-type item with no linked call → amber banner appears. Confirm the transcript/recording shown always belongs to the same customer, and the banner is present whenever it's a "closest match". | `5784d7f` |
| **A3** | 🟠 | In the call drawer, **"Browse all conversations" → clicking a call did nothing** (or showed the previous call's details). | The report fetch keyed off the item, not the clicked call, so a drilled call never loaded. | Drilling into a call now fetches that specific call's report. | Open a customer's call drawer → "Browse all conversations" → click a different call → its recording/transcript/summary must load. Use Back and pick another → it updates. | `5784d7f` |
| **A4** | 🟠 | A **sales** item could resolve its call against **service** conversations (wrong context). | Conversation lookup defaulted to the global `service` department instead of the item's own department. | Lookup now uses the item's own department. | On a **sales** item, open the drawer and confirm the resolved call/conversations belong to the sales side (not a service call for the same customer). Repeat on a service item. | `5784d7f` |
| **A5** | 🟠 | On busy rooftops, an item could appear **twice** in the list and inflate the "Repeat callers" count. | Sequential paged fetch had no dedup; a row shifting between pages was fetched twice. | Items are de-duplicated by id across pages. | On a rooftop with a large backlog (multiple pages), scroll the full queue — no duplicate rows; repeat-caller counts look sane. | `5784d7f` |
| **A6** | 🟠 | A customer who contacted **once** but generated several action items was labelled an **N-time repeat caller** (×N badge / repeat filter). | Repeat count counted raw action items, not distinct conversations. | Now counts **distinct conversations/calls** per customer. | Find a customer whose multiple items all came from one call/email → badge should read ×1 (not ×N). A customer with genuinely separate calls should still show the true count. | `5784d7f` |
| **A7** | 🟡 | (Hardening) Rare chance a panel keeps a previous item's/customer's state. | Drawers not keyed by id. | Both drawers remount per item/customer. | Rapidly open different customers/items in succession — no stale content carries over. | `5784d7f` |
| **A8** | 🟡 | (Hardening) Searching a customer who has **no item in the current queue** selected the **wrong** customer. | Search built candidates from the global customer map, not the scoped queue. | Search candidates now come from the items actually in the queue. | In the queue search, type a name/phone; picking a result always selects that exact customer. | `5784d7f` |
| **A9** | 🟡 | (Hardening) A customer's name/phone could degrade to "Customer"/blank. | A later sparse duplicate record overwrote a good name/phone. | Merge-fill instead of overwrite. | Names/phones stay populated across refreshes and tab switches. | `5784d7f` |

---

## B. Earlier QA batches (already delivered)

| ID | Sev | Reported symptom | Fix | How QA verifies | Commit |
|----|-----|------------------|-----|-----------------|--------|
| **B1** | 🔴 | Resolved / Incorrect items **disappeared after refresh** or when switching Sales↔Service. | Resolved/Incorrect now read from the DB (completed items with a console resolution), not session state. | Resolve an item → refresh → it's still under Resolved. Flag one Incorrect → refresh → still under Incorrect. Switch depts and back → persists. | `a634003`, `0211b31` |
| **B2** | 🔴 | After resolving an item, the count **reverted to square one on refresh**. | Pending fetch now paginates the full backlog, so resolved items are correctly excluded from the true total. | Resolve several items → refresh → counts stay reduced, don't bounce back. | `1be01c5` |
| **B3** | 🟠 | Sales/Service tabs needed **separate deep-links**; department wasn't in the URL correctly. | `serviceType` is the canonical department URL param; toggle writes it back to the URL. | Load `?serviceType=service` → Service tab active. Toggle to Sales → URL updates to `serviceType=sales`. Deep-link both. | `7b1ab1b`, `6c4130c` |
| **B4** | 🟠 | **Service tab showed Sales items** (and vice-versa) — cross-department leakage. | Per-item department derived from the item's `service_type`, not the shared intent code. | In Service, every item is a service item; in Sales, every item is sales. No bleed. | `6c4130c`, `fd6585b` |
| **B5** | 🟠 | Address bar didn't sync with the Sales/Service toggle inside the iframe. | postMessage bridge added; **host must apply `HOST-INTEGRATION.md`** to forward `serviceType`. | With the host patch applied, toggling the tab updates the parent URL. *(Depends on converse-ai host change — flag if host not yet updated.)* | `21fd29e`, `d3177b4` |
| **B6** | 🟠 | "**No recording available**" even when a recording existed. | Recording URL must be absolute to satisfy the audio player; routed through the same-origin proxy. | Open an item with a recording → it plays. | `747e4e7` |
| **B7** | 🟠 | SMS/chat action items **not showing** / mis-channelled. | SMS channel classification fixed; items now appear under Channel = SMS with the thread attached. | Filter Channel = SMS → SMS items appear with their message thread. | `fd6585b` |
| **B8** | 🟠 | Queue not ordered by urgency. | Sort by **longest SLA breach first** (absolute overdue time). | Top of the queue is the most-overdue customer. | `fd6585b` |
| **B9** | 🟠 | Couldn't **search by phone number**. | Phone search added (ignores formatting and +1). | Search `2162022537` finds `+1 216-202-2537`. | `fd6585b` |
| **B10** | 🟠 | **Callbacks** quick-filter missed callback items; **Listen** button disabled despite a resolvable call. | Callbacks chip matches all real callback intents; Listen enabled when a call is resolvable. | Callbacks chip returns all callback-type items; Listen is enabled on items with a call. | `115b07e` |
| **B11** | 🟡 | "At-risk" tagging/filter confusing (product call to remove). | Removed At-risk chip + filter. | No At-risk chip anywhere. | `c2811d3` |
| **B12** | 🟡 | Manager / My-queue toggle to be removed. | Removed the scope toggle. | No Manager/My-queue toggle. | `fd6585b` |
| **B13** | 🟡 | Resolver identity for auto-assign. | Resolver taken from session identity (`userId`/`userEmail` in URL), since the token carries no user identity. | Resolving an item records the acting user as owner. | `fd6585b` |

---

## C. Known / deferred (not fixed — need product or backend input)

| ID | Note |
|----|------|
| **C1** | `customer_id` can fall back to `lead_id`; two conversations from the same person under different lead ids may split into two "customers". Depends on backend id semantics — needs BE confirmation before changing. |
| **C2** | Backend does not expose a real call-history count, so "repeat caller" is a **same-session proxy** (distinct conversations currently loaded), not a lifetime count. Confirm this is acceptable, or add a BE count. |
| **C3** | Host↔iframe URL sync (B5) requires the **converse-ai host** to apply `HOST-INTEGRATION.md`. Until then the tab works but the parent address bar won't update. |

---

## Verification status

- `tsc --noEmit`: **clean**
- Dev server compiles with **no console/runtime errors**
- Pure-logic eval (repeat-caller counting, pagination dedup): **all assertions pass**
- Live end-to-end (A2–A6) requires a **real UAT iframe scope** — please verify on UAT.
