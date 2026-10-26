# FC-00058 — Weekly Actuals: switch between Hours and Cost

**Date:** 2026-10-26 · **Slice:** S · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
The Weekly Actuals table on the Payroll tab has an **Hours | Cost** switch. Cost shows, for every person and day, what the day cost in wages and what the schedule said it would cost, with the person's rate, day totals at the bottom and the week on the right. The entity tabs switch it per entity as usual.

## Why
The owner: "I also want to see an alternate tab on that weekly actuals table area. This alternate view should show the cost per hour, using the rates from below the table. And since i can flip through entities here, i can easily see the cals by entity and schedule."

Read as dollars per day cell (hours × the rate on the Payroll Calculation table), scheduled vs actual.

## Where in UI
Payroll tab → Weekly Actuals heading → Hours | Cost.

## Touches
display

## Risk
Low. Display only; pay never changes.

## Reversibility
Fully reversible via one revert of the FC-00054–61 commit.

## Definition of Done
1. **Actual cost per day:** the person's paid Actual spread over their days by minutes worked, in whole cents (the Labor Cost allocation, FC-00052), so a row adds up to the person's Actual.
2. **Scheduled cost per day (hourly people):** (shift hours − the entity's break) × rate; the difference shows "over" in red or "under" in green.
3. **Flat pay:** with hours, spread like hourly; without hours, in the week column; semi-monthly: its weekly cost spread evenly over the seven days. Their rate reads flat / semi-monthly; no rate reads "no rate".
4. **Totals:** a Total row per day and for the week; the week total equals the Labor Cost tab's total, each day equals the Labor Cost day.
5. The choice is a display preference in the browser (no payroll data).

## Built
- `entityCostGrid(idx)`, `renderPayrollCostGrid`, `payrollGridView()` / `setPayrollGridView()` (preference `pv26_grid_view`).

## Verification
- `npm test`: all pass; `tests/fc00058_cost_view.test.js` (4 tests).
- Real browser on a real week: the cost week total equals the Labor Cost total to the cent.

## Out of scope
- Cost in the export files (the Labor Cost sheet already has it).

## Assumptions
- "Cost per hour" means the cost of each day cell (hours × rate), not a $/hour figure; $/hour per day stays on the Labor Cost tab.

## Open questions
None.

## Tests
`tests/fc00058_cost_view.test.js`:
- `test_person_cost_adds_up_to_their_actual`
- `test_scheduled_cost_is_shift_minus_break_times_rate`
- `test_totals_tie_to_labor_cost`
- `test_switch_shows_cost_table_display_only`

## Slice
S

## Affected entities
All
