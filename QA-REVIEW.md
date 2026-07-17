# Action Items Console — QA Review: Issues, Fixes, Repro Steps & Screenshots

**Branch under review:** `fix/action-items-bugs` (merged to Product14 `main`)
**Prepared:** 2026-07-17
**For:** QA — reproduce each item, verify the fix, attach a screenshot, mark Pass/Fail.

---

## How to test
Open the console in a real UAT scope:
```
https://<console-host>/?env=uat&token=<bearer>&enterpriseId=<ent>&teamId=<team>&serviceType=sales
```
- `serviceType` = `sales` | `service` (canonical department param).
- Use a rooftop with: past-SLA items, a repeat caller, SMS items, resolved/incorrect items, and a customer with multiple items + a call recording.
- Most fixes are already **live**, so "reproduce" = confirm the buggy behaviour no longer happens (each item lists the expected fixed result).

## Screenshot convention
Each item has a **Screenshot ref** — the screen + element to capture and a filename. Save captures under `screenshots/<ID>.png` (e.g. `screenshots/A1.png`) next to this file and they'll render inline where referenced. These are **internal QA screenshots** (UAT data is fine here — this is not an external release note).

**Legend:** 🔴 High · 🟠 Medium · 🟡 Low/hardening · Status: Ready for QA unless noted.

---

# A · Latest audit — wrong-entity / stale-state (priority)

### A1 🔴 Customer drawer showed the same name for everyone
- **What was wrong:** the right-side customer drawer always showed one name (e.g. the first customer) no matter which customer you clicked; phone/items were correct.
- **Root cause:** name read via a `find()` over ALL items instead of the clicked customer.
- **Fix:** name + phone now read from the clicked customer's own items. *(commit 85ec778)*
- **Steps to reproduce / verify:**
  1. Open the console, **Unresolved** tab.
  2. In the queue, click **Customer A** → note the drawer header name + phone.
  3. Close, click **Customer B** → header must now show **B's** name + phone.
  4. Repeat for 3–4 different customers.
- **Expected (fixed):** the drawer header name + phone always match the clicked row.
- **Screenshot ref:** `screenshots/A1.png` — customer drawer **header** (name + phone) alongside the clicked queue row.

### A2 🔴 Listen/Transcript could play a different call
- **What was wrong:** the drawer could show a *different* call's recording/transcript/summary than the item came from.
- **Root cause:** when the item's own call id failed to load, it silently fell back to the customer's most recent call.
- **Fix:** fallback runs only when the item has no call id at all, and shows an **amber banner**; an item with a real id that fails shows its evidence excerpt instead. *(commit 5784d7f)*
- **Steps to reproduce / verify:**
  1. Open an item that **has a recording** → click **Listen**.
  2. Confirm the recording/transcript is for **this** item's customer, and **no amber banner** shows.
  3. Open a call-type item with **no linked call** → the amber "may not be this item's call" banner appears.
- **Expected (fixed):** transcript/recording always belongs to the same customer; fallback is clearly labelled.
- **Screenshot ref:** `screenshots/A2.png` — drawer showing the **amber fallback banner** (and one of a normal call with no banner).

### A3 🟠 "Browse all conversations" → clicking a call did nothing
- **Root cause:** the report fetch keyed off the item, not the clicked call.
- **Fix:** drilling into a call now fetches that call's report. *(commit 5784d7f)*
- **Steps to reproduce / verify:**
  1. Open a customer's call drawer → click **Browse all N conversations**.
  2. Click a **different** call in the list → its recording/transcript/summary loads.
  3. Click **Back**, pick another → it updates.
- **Expected (fixed):** each drilled call loads its own report.
- **Screenshot ref:** `screenshots/A3.png` — the browse-conversations list + a drilled call's loaded detail.

### A4 🟠 Sales item resolved against Service conversations
- **Root cause:** conversation lookup defaulted to the global `service` department.
- **Fix:** lookup uses the item's own department. *(commit 5784d7f)*
- **Steps to reproduce / verify:**
  1. On a **Sales** item, open the drawer → confirm the call/conversations are sales-side.
  2. Repeat on a **Service** item.
- **Expected (fixed):** conversations match the item's department.
- **Screenshot ref:** `screenshots/A4.png` — drawer on a Sales item showing sales conversations.

### A5 🟠 Item appeared twice / inflated repeat-caller count
- **Root cause:** paged fetch had no dedup; a row shifting between pages was fetched twice.
- **Fix:** items de-duplicated by id across pages. *(commit 5784d7f)*
- **Steps to reproduce / verify:**
  1. On a large multi-page rooftop, scroll the full queue.
  2. Confirm no duplicate rows; repeat-caller counts look sane.
- **Expected (fixed):** no duplicates.
- **Screenshot ref:** `screenshots/A5.png` — queue with the group/total count header.

### A6 🟠 One-time contact mislabelled an N-time repeat caller
- **Root cause:** repeat count counted raw items, not distinct conversations.
- **Fix:** counts distinct conversations/calls per customer. *(commit 5784d7f)*
- **Steps to reproduce / verify:**
  1. Find a customer whose several items came from **one** call/email → badge should read **×1**.
  2. Find a customer with genuinely separate calls → badge shows the true count.
- **Expected (fixed):** ×N reflects distinct outreaches.
- **Screenshot ref:** `screenshots/A6.png` — a queue card showing the repeat-caller **×N** badge.

### A7 🟡 Panel could keep a previous item's/customer's state
- **Fix:** both drawers remount per item/customer (keyed by id). *(commit 5784d7f)*
- **Steps to reproduce / verify:**
  1. Rapidly open different customers, then different items, in succession.
  2. Confirm no content from the previous one carries over.
- **Screenshot ref:** `screenshots/A7.png` — two drawers side-by-side (before/after switching).

### A8 🟡 Searching a customer not in the queue selected the wrong one
- **Fix:** search candidates come from the scoped queue items. *(commit 5784d7f)*
- **Steps to reproduce / verify:**
  1. In queue search, type a name/phone.
  2. Click a result → the exact customer is selected.
- **Screenshot ref:** `screenshots/A8.png` — search dropdown + the selected customer in the right pane.

### A9 🟡 Customer name/phone degraded to "Customer"/blank
- **Fix:** merge-fill instead of last-write-wins. *(commit 5784d7f)*
- **Steps to reproduce / verify:**
  1. Load, refresh, switch depts and back.
  2. Confirm names/phones stay populated.
- **Screenshot ref:** `screenshots/A9.png` — queue showing populated customer names after a refresh.

### A10 🟡 "View full customer profile" button did nothing
- **Root cause:** linked to a route that doesn't exist inside the iframe.
- **Fix:** removed the non-working CTA. *(commit f831665)*
- **Steps to reproduce / verify:**
  1. Open the customer drawer → scroll to the footer.
- **Expected (fixed):** there is **no** "View full customer profile" button.
- **Screenshot ref:** `screenshots/A10.png` — customer drawer **footer** (no CTA).

### A11 🟠 Customer drawer count didn't match the queue (showed all departments)
- **What was wrong:** for a customer with items in both Sales and Service, the customer drawer showed e.g. **8 open items** while the Sales queue showed **3** for the same customer.
- **Root cause:** the drawer counted/listed the customer's items across **all** departments; the queue is department-scoped.
- **Fix:** the drawer's open/resolved/repeat sets are now scoped to the active department (matches the queue). *(commit e378263)*
- **Steps to reproduce / verify:**
  1. On the **Sales** tab, find a customer who has both Sales and Service items.
  2. Note the queue card count (e.g. "3 items").
  3. Open that customer's drawer → the **OPEN ITEMS** stat and list must show the **same 3**, not a larger all-department number.
  4. Switch to **Service** and repeat — the drawer now reflects the Service count.
- **Expected (fixed):** drawer count = the queue count for the active department.
- **Screenshot ref:** `screenshots/A11.png` — the drawer **OPEN ITEMS** stat next to the queue card count for the same customer.

---

# B · Earlier batches

### B1 🔴 Resolved/Incorrect disappeared after refresh / dept switch
- **Fix:** Resolved/Incorrect read from the DB. *(commits a634003, 0211b31)*
- **Steps to reproduce / verify:**
  1. Resolve an item → **refresh** → it's still under **Resolved**.
  2. Flag one **Incorrect** → refresh → still under Incorrect.
  3. Switch Sales↔Service and back → both persist.
- **Screenshot ref:** `screenshots/B1.png` — Resolved tab after a refresh showing the resolved item.

### B2 🔴 Count reverted on refresh after resolving
- **Fix:** pending fetch paginates the full backlog. *(commit 1be01c5)*
- **Steps to reproduce / verify:**
  1. Resolve several items → note the count drops.
  2. **Refresh** → count stays reduced (doesn't bounce back).
- **Screenshot ref:** `screenshots/B2.png` — Unresolved tab count before/after refresh.

### B3 🟠 Separate deep-links for Sales/Service
- **Fix:** `serviceType` is the canonical URL param; toggle writes it back. *(commits 7b1ab1b, 6c4130c)*
- **Steps to reproduce / verify:**
  1. Load `?serviceType=service` → Service tab active.
  2. Toggle to Sales → URL updates to `serviceType=sales`.
  3. Deep-link both.
- **Screenshot ref:** `screenshots/B3.png` — address bar + active tab for each department.

### B4 🟠 Service tab showed Sales items (and vice-versa)
- **Fix:** per-item department from `service_type`. *(commits 6c4130c, fd6585b)*
- **Steps to reproduce / verify:**
  1. In **Service**, spot-check items are all service.
  2. In **Sales**, all sales. No bleed.
- **Screenshot ref:** `screenshots/B4.png` — Service queue with intent/department badges.

### B5 🟠 Address bar didn't sync with the toggle (iframe)
- **Fix:** postMessage bridge; **host must apply `HOST-INTEGRATION.md`**. *(commits 21fd29e, d3177b4)* — **Status: Blocked on host**
- **Steps to reproduce / verify:**
  1. With the host patch applied, toggle the tab → parent address bar updates.
  2. Without it, the iframe still works but the address bar won't change (browser boundary).
- **Screenshot ref:** `screenshots/B5.png` — host address bar before/after toggle (once host patched).

### B6 🟠 "No recording available" when a recording existed
- **Fix:** recording URL made absolute via the same-origin proxy. *(commit 747e4e7)*
- **Steps to reproduce / verify:**
  1. Open an item with a recording → click **Listen** → it plays.
- **Screenshot ref:** `screenshots/B6.png` — drawer waveform player playing.

### B7 🟠 SMS/chat items not showing / mis-channelled
- **Fix:** SMS channel classification fixed. *(commit fd6585b)*
- **Steps to reproduce / verify:**
  1. Set **Channel = SMS** → SMS items appear with the message thread.
- **Screenshot ref:** `screenshots/B7.png` — queue filtered to Channel=SMS + an SMS drawer thread.

### B8 🟠 Queue not ordered by urgency
- **Fix:** sort by longest SLA breach first (absolute overdue). *(commit fd6585b)*
- **Steps to reproduce / verify:**
  1. Confirm the top of the queue is the most-overdue customer.
- **Screenshot ref:** `screenshots/B8.png` — queue top showing the longest-overdue item first.

### B9 🟠 Couldn't search by phone number
- **Fix:** phone search (ignores formatting + country code). *(commit fd6585b)*
- **Steps to reproduce / verify:**
  1. Search `2162022537` → finds `+1 216-202-2537`.
- **Screenshot ref:** `screenshots/B9.png` — search box with a phone query + matching result.

### B10 🟠 Callbacks chip missed items; Listen wrongly disabled
- **Fix:** Callbacks chip matches all callback intents; Listen enabled when a call is resolvable. *(commit 115b07e)*
- **Steps to reproduce / verify:**
  1. Click the **Callbacks** chip → all callback-type items appear.
  2. On an item with a call, **Listen** is enabled.
- **Screenshot ref:** `screenshots/B10.png` — Callbacks chip active + an item with Listen enabled.

### B11 🟡 "At-risk" tagging/filter removed (product call)
- **Fix:** removed At-risk chip + filter. *(commit c2811d3)*
- **Steps to reproduce / verify:** confirm no **At-risk** chip anywhere.
- **Screenshot ref:** `screenshots/B11.png` — the quick-chip row (no At-risk).

### B12 🟡 Manager/My-queue toggle removed
- **Fix:** removed the scope toggle. *(commit fd6585b)*
- **Steps to reproduce / verify:** confirm no Manager/My-queue toggle.
- **Screenshot ref:** `screenshots/B12.png` — header row (no toggle).

### B13 🟡 Resolver identity for auto-assign
- **Fix:** resolver taken from session identity (`userId`/`userEmail`). *(commit fd6585b)*
- **Steps to reproduce / verify:**
  1. Resolve an item → the acting user is recorded as owner/assignee.
- **Screenshot ref:** `screenshots/B13.png` — resolved item showing "Action taken by <user>".

---

# C · Deferred (need product/backend input — no fix to verify)

| ID | Note | Screenshot ref |
|----|------|----------------|
| **C1** | `customer_id` can fall back to `lead_id`; same person under different lead ids may split. Needs BE confirmation. | `screenshots/C1.png` — two cards for one person (if observed) |
| **C2** | "Repeat caller" is a same-session proxy (distinct loaded conversations), not a lifetime count. Confirm acceptable or add a BE count. | `screenshots/C2.png` — ×N badge for context |
| **C3** | Host↔iframe URL sync requires converse-ai to apply `HOST-INTEGRATION.md`. Host-team action. | `screenshots/C3.png` — host address bar |

---

## Verification status (engineering)
- `tsc --noEmit`: clean · dev server compiles with no console errors · pure-logic eval (repeat-caller counting, pagination dedup) passes.
- Live end-to-end (A2–A6, B1–B7) requires a real UAT scope — please verify on UAT and attach screenshots per the refs above.
