# FC-00094 — Show the person's TNG ID next to the entity Employee ID on Actuals Intake and the Payroll tab

**Date:** 2026-11-25 · **Slice:** S · **Risk:** Low · **Status:** approved · **Affected entities:** All

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
