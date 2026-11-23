# FC-00089 — People paid without a schedule on the Payroll tab

**Date:** 2026-11-23 · **Slice:** S/M · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
People paid without a schedule (FC-00084: Management, deposit-only people and anyone else paid a weekly amount who is on no schedule) are today edited only on the Employee Register tab. On the Payroll tab they appear only as a read-only line in the export preview. This card puts them on the Payroll tab, per entity, with the same controls as the Register tab.

1. **A "Paid without a schedule" table on each entity's Payroll tab**, above the Time Card Data / Payroll Calculation tabs, one row per person of that entity, with the same controls as on the Register tab:
   - **This week** — the amount (number box), starting at last week's amount;
   - **Keep** (same as last week), shown while the amount is not yet checked;
   - **Not paid this week**;
   - **Pay Method** dropdown (Deposit, Cash, Deposit + Cash, Contract Check), and the **Deposit part** box for Deposit + Cash;
   - **Mgmt** and **Active** ticks;
   - the **Status** ("Same as last week ($X): keep or change", "Kept", "Changed from $X", "Not paid this week", "New this week", "Inactive: not paid") and what the row **pays** (deposit and cash).
   - Example: Avery Atest at Alpha Test, Deposit, last week $500: the row shows $500 in the box, "Keep", and "Pays $500.00 deposit".
2. **Counted with the entity's people.** The employee count on the entity's Payroll tab pill and in the header ("N employees in the system") includes them.
3. **A summary card each** at the top of the entity, next to the scheduled people's cards, showing "Flat · $X" instead of hours, or "Not paid this week" / "Inactive: not paid".
4. **The reminder** ("N people paid without a schedule not yet checked this week") on the Payroll tab now says the amounts can be kept or changed on the Payroll tab or on the Employee Register tab, and names the entities. Keeping or changing on the Payroll tab clears it exactly as on the Register tab.
5. **Every change goes through History and Undo**, labelled as made on the Payroll tab. The Register tab shows the same state, because both tabs use the same functions and the same record.
6. **Pay, the payroll report and the accountant file are unchanged** for the same choices: the Payroll tab only adds a second place to make them.

## Why
The owner, 2026-11-23: "The management people and the deposit people - shouldn't they also show up on the Payroll tab to be edited, values set, etc.? Not just on the employee register?"

## Where in UI
- Payroll tab, each entity: the entity tab pill count, the header count, the summary cards, the reminder, and the new "Paid without a schedule" table.

## Touches
Payroll tab rendering (`renderPayrollEntityTabBar`, `renderPayrollEntityContent`); the FC-00084 setters take an optional screen for History. Nothing in pay, exports, the register file or the snapshot.

## Risk
Low. Display and a second place to call the existing FC-00084 setters. Guards: pay identical on the six real weeks and the Nov 8–14 snapshot; the same change made on either tab gives the same record, the same pay and the same History entry type.

## Reversibility
One revert commit. Nothing new is stored.

## Definition of Done
1. Each entity's Payroll tab lists that entity's people paid without a schedule (and only those not on this week's schedule or actuals), with the controls above.
2. Changing the amount, Keep, Not paid this week, Pay Method, Deposit part, Mgmt or Active on the Payroll tab changes the same record as the Register tab, through History, one Undo each.
3. The entity pill and the header count include them; each has a summary card showing "Flat · $X" or "Not paid this week".
4. The reminder shows on the Payroll tab, names the entities, and clears when each is kept or changed there.
5. Pay, the payroll report and the accountant file are identical to making the same choices on the Register tab.

## Out of scope
- Adding a person paid without a schedule from the Payroll tab (stays on the Register tab, where FC-00086 rebuilds it).
- Display names (FC-00087): names show as they do today.
- Moving them into the Payroll Calculation table itself.

## Assumptions
- A person paid without a schedule who is on this week's schedule or has punches is paid from the schedule and stays in the normal rows, as today; they are not listed twice.
- Inactive people are listed and counted, as scheduled people are counted whether active or not.
- The Payroll tab table has no "+ Add person" form; adding stays on the Register tab.

## Open questions
None.

**Approved:** the owner, 2026-11-23: "Yes build everythign as fast as possible".

## Tests
`tests/fc00089_noschedule_on_payroll_tab.test.js`:
- the table lists only the entity's people not on the schedule, with every control;
- each control changes the same record as the Register tab, through History, screen payroll, one Undo;
- counts in the pill and header; a summary card each, "Flat · $X" and "Not paid this week";
- the reminder on the Payroll tab, cleared by Keep and by a changed amount on the Payroll tab;
- pay, payroll report rows and the accountant file identical whichever tab made the change.

## As built (2026-11-23)
- **Who is listed:** `noSchedOnPayroll(ent)`: the entity's records with Paid Without Schedule ticked that are not on this week's schedule and have no punches (the same test `getFlatWageRows` uses, so nobody is listed twice). Inactive and not-paid people stay listed.
- **The table:** `_nsPayrollSectionHtml(ent)`, "Paid without a schedule · N", on each entity's Payroll tab above the Time Card Data / Payroll Calculation tabs. Columns: Name, Employee ID, Active, This week, Pay Method, Deposit part (Deposit + Cash), Mgmt, Pays, Status, then Keep and Not paid this week. Shown only when the entity has someone to list.
  - **Pays** (`_nsPaysText`) comes from the row `getFlatWageRows` pays this week (`_nsPayRow`) through `computePayBreakdown`, e.g. "$425.00 deposit", "$275 cash", "$400.00 deposit + $240 cash"; "Not paid this week" or "Not paid (inactive)".
- **One source of truth:** every control calls the FC-00084 setters. `setNoSchedAmount`, `keepNoSched` and `setNoSchedSkip` take an optional screen (default register), so History shows "payroll" for a change made on the Payroll tab. Pay method, deposit part and Active already log as payroll; Mgmt calls `setManagement(…, 'payroll')`. The Register tab's renderers are unchanged.
- **Counts:** `_payrollEmpCount(ent)` (schedule + listed people) in the entity tab pill (`renderPayrollEntityTabBar`) and the header "N employees in the system". The "No schedule loaded" note still looks at the schedule only.
- **Cards:** `_nsPayrollCards` / `_nsPayrollChipsHtml`, one card per listed person after the scheduled people's cards: "Flat · $X" with "not checked yet", "kept", "changed this week" or "new this week" under it; "Not paid this week" or "Inactive: not paid", greyed.
- **Reminder:** `_nsPayrollReminderHtml()` replaces `_nsReminderHtml(true)` on the Payroll tab: the same count, the entities ("(Alpha Test 2, Beta Test 1)") and both places to decide, with a link to the register. Keep, a changed amount or Not paid this week on the Payroll tab clears it, as on the Register tab.
- **Pay:** unchanged. `getFlatWageRows` still pays them; nothing new is stored.
- **Checked on the real Nov 8–14 snapshot (private, not committed):** start totals match the week's actual totals; two invented people added (one Deposit with Mgmt at one entity, one Cash at another): the total rose by exactly their two amounts, deposit by the first, cash by the second, the accountant file by the deposit only. Changing the first amount on the Payroll tab and ticking Not paid this week for the second: the report total is the start plus the new amount, cash back to the start, contract checks unchanged; the accountant file rose by exactly the new amount, checks out and ties per entity; History shows both changes as payroll; the Register tab shows the new amount and the tick. Browser pass with the real page: no page errors.
- **Six real weeks:** pay identical to the base build, snapshot reopen exact, report and accountant formulas 0 bad, tie-out OK.
