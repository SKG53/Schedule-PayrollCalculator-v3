# FC-00094 — Show the person's TNG ID next to the entity Employee ID on Actuals Intake and the Payroll tab

**Date:** 2026-11-25 · **Slice:** S · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
1. **Actuals Intake.** The review table's Employee ID cell shows two lines: the person's TNG ID on top (for example `TNG00014`), the entity's Employee ID under it, smaller and grey (for example `EMP_ALP_00001`). The column heading reads "TNG ID" with "Employee ID" under it. A row that matches nobody still shows "—".
2. **Payroll tab.** The same two lines and heading in every table that shows an Employee ID: Weekly Actuals (Hours view), Time Card Data, Payroll Calculation, and the "Paid without a schedule" table (FC-00089). The summary cards show no ID today and stay as they are.
3. **Not numbered yet.** A person without a TNG ID shows "TNG pending" (amber, italic). Looking never hands out a number (FC-00088) and never creates a record.
4. **One person at two entities** shows the same TNG ID on each entity's rows, each with that entity's own Employee ID.

## Why
Every person has one TNG ID (the person, the whole group, never reused) and one Employee ID per entity (the "Former ID" on the Employee Register). On 2026-11-23 the owner saw an entity Employee ID on Actuals Intake and asked "the employee ID is wrong, right?". It was right, but the person-level ID was nowhere on the screen. The owner, 2026-11-25: "Build all of them".

## Where in UI
Actuals Intake: the review table under each entity. Payroll tab: Weekly Actuals (Hours), Time Card Data, Payroll Calculation, Paid without a schedule.

## Touches
`tngIdText` (new), `_idsCellHtml` (new), `IDS_HEAD` (new), `renderReviewTableHtml`, `renderPayrollGrid`, `renderTimeCardData`, `renderPayrollCalc`, `_nsPayrollSectionHtml`, CSS (`.ids-tng`, `.ids-emp`, `.ids-sub`).

## Risk
Low. Display only. The TNG ID is looked up with `_resolveRecordNoMint` (the same person pay uses, never creating anyone); the Employee ID text is exactly what the cell showed before ("ID pending" included). No file changes.

## Reversibility
One revert commit.

## Definition of Done
1. An Actuals Intake row and a Payroll tab row show the TNG ID over the Employee ID.
2. A person with no TNG ID shows "TNG pending"; rendering the screens numbers nobody and creates no record.
3. A person linked at two entities shows the same TNG ID on both entities' rows.
4. Pay unchanged: full test suite, real-week regression and tie-out.
5. No export file changes.

## Out of scope
The Schedules tab's Employee ID column; the summary cards; the Employee Register (it already shows the TNG ID); every export file.

## Assumptions
- "Payroll tab" includes the Weekly Actuals grid, which also shows the Employee ID; its Cost view shows the rate instead and is unchanged.
- The heading is "TNG ID" with a small "Employee ID" under it, to keep the column narrow.

## Open questions
None.

**Approved:** the owner, 2026-11-25: "Build all of them".

## Tests
`tests/fc00094_tng_id_on_intake_and_payroll.test.js`.

## As built (2026-11-25)
- `tngIdText(entId, name)`: the record found by `_resolveRecordNoMint`; its `tng`, else "TNG pending"; '' when the name is nobody. Never calls `assignTngIds`, never calls `ensureRosterRecord`.
- `_idsCellHtml(entId, name, empIdText)`: `<span class="ids-tng">` (class `ids-pending` when not numbered) over `<span class="ids-emp">`. The Employee ID text is still `_empIdText`, unchanged ("ID pending" before a register is loaded).
- `IDS_HEAD`: the heading "TNG ID" over a small "Employee ID" (`.ids-sub`).
- Used in `renderReviewTableHtml` (cell class `emp-id-cell ids-cell`, the duplicate-name flag still after it), `renderPayrollGrid` (Hours view), `renderTimeCardData`, `renderPayrollCalc` and `_nsPayrollSectionHtml`. The Cost view, the summary cards, the Schedules tab and every export are unchanged.
- **Checked in the browser on the real Nov 15–21 snapshot (private):** deposit, cash and contract check as expected; 41 people with TNG IDs. Actuals Intake: every matched row's cell shows a TNG ID and the Employee ID. Payroll tab, all three entities: every ID cell shows a TNG ID and the Employee ID. A person at two entities shows the same TNG ID on both entities' rows. An invented person added without a number shows "TNG pending" in the Paid-without-a-schedule table and nobody was numbered. No page errors.
- Real-week regression: 6 weeks, 0 pay differences; tie-out: 0 bad.
- Tests: 672 of 672 pass.
