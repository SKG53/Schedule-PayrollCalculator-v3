# FC-00052 — Labor cost by day and hour; semi-monthly flat pay

**Date:** 2026-10-19 · **Slice:** L · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. **A Labor Cost view per entity:**
   - cost per day: hours, people, $ and $/hour;
   - a 24 × 7 grid of cost and headcount by hour of day;
   - scheduled vs actual cost per day.

   It shows on a **Labor Cost** sub-tab of the Payroll tab and as a **Labor Cost** sheet in the Combined payroll Excel.
2. **A new pay type, "Semi-monthly".** The person is paid a fixed amount twice a month. The tool decides whether this run pays them, the owner confirms, and their cost is spread evenly across every week.

## Why
- **The owner wants to see what labor costs:** "how much each hour or minute is costing me… each day at each entity."
- **One salaried person is paid twice a month,** in the run whose week contains the 1st or the 15th, and $0 otherwise. Today the owner sets that by hand each week as a flat amount, and her cost appears only in the weeks she is paid. The owner: "The amount does not currently change but it might later if we give her a promotion… The calculation to get the cost per day makes sense."

## Where in UI
- **Payroll tab:**
  - a new **Labor Cost** sub-tab;
  - a "Semi-monthly" option in Payroll Calculation's Hourly / Flat toggle, with an "Amount per half-month" input and a "Paid this run" tick.
- **Combined payroll Excel:** a new **Labor Cost** sheet after Stats.
- **Settings file:** Type "Semi-monthly" with the amount in the Flat column.

## Touches
roster, settings, payroll, display, exports

## Risk
Medium.
- The cost view is read-only.
- Semi-monthly is a new pay type, and it changes what a person is paid in a given week. The tick is pre-set by the rule, and the owner confirms it.

## Reversibility
Fully reversible via one revert commit. In the tool, changing the type or the tick is an ordinary change with Revert.

## Definition of Done
1. **Cost per day:** for each entity and each day, the hours, people, $ and $/hour.
   - Each person's paid Actual is spread across their days in proportion to the minutes worked. The week's total therefore equals the payroll Actual to the cent; minutes × rate alone would drift, because pay rounds hours first.
   - Cash rounding cents are excluded, as on the payroll Actual.
   - A shift belongs to the day it starts, as pay does.
2. **Cost by hour of day:** a 24 × 7 grid for each entity, with $ and headcount in each cell.
   - Each worked minute is costed at the person's rate and placed at its clock hour; minutes after midnight land in the next day's early hours.
   - The grid's total equals the cost-per-day total.
   - It uses the same layout as the Schedules tab calendar.
3. **Scheduled vs actual per day:**
   - scheduled hours × each person's rate;
   - next to it the actual cost and the $ variance;
   - flat and semi-monthly people excluded from both sides, so the variance is the hourly manager number.
4. **Semi-monthly pay:**
   - The settings file stores Type "Semi-monthly" and the amount per half-month.
   - **Paid this run** is pre-ticked when the Sun–Sat week after the pay week (the week of the Monday run) contains the 1st or the 15th of a month; otherwise it is unticked. The owner can change the tick.
   - Ticked: pay = the amount, in the person's pay method. Unticked: pay = $0, and the row stays (zero-hour rows are kept, Decision #6).
   - Checked against history: the runs of Aug 31, Sep 14, Sep 28, Oct 12 and Nov 2 are paid; the runs of Sep 7, Oct 5 and Oct 19 are not.
5. **Semi-monthly cost:**
   - weekly cost = amount × 24 ÷ 52;
   - daily cost = weekly cost ÷ 7;
   - shown as a fixed line under each entity's cost per day, not in the hourly grid, because the person does not clock in;
   - the Labor Cost total states it separately from the hourly cost.
6. **A changed amount** applies from the week it is entered; earlier weeks are untouched, since each week is its own session.
7. **The Labor Cost sheet in the Combined Excel** mirrors the screen, with the entity order and colors of the payroll sheet.
8. **Pay is identical.** On five real weeks plus Oct 4–10:
   - pay is identical to the live version for everyone except the semi-monthly person;
   - the semi-monthly person's pay matches what the owner paid that week;
   - the cost-per-day total equals the payroll Actual to the cent for every entity;
   - the private harness checks the hour grid against figures computed by hand.

## Built
- **Cost per day.** `entityLaborCost(idx)` spreads each person's paid Actual over their days by billable minutes, in whole cents (`_allocCents`, largest remainder).
  - Flat people with hours are spread the same way.
  - Flat people with no hours are a fixed line.
  - The hour grid spreads each day's cost over the punched minutes by clock hour. Saturday-night minutes after midnight go to a "Sun (next week)" column.
  - The screen is `renderLaborCostPanel`; the Excel sheet is `_writeLaborCostSheet`, with a cost grid and a headcount grid.
- **Semi-monthly** is a flat amount plus two new stores, both kept in snapshots, undo and re-keying:
  - `semiMonthly` (id → true);
  - `semiPaid` (id → the owner's tick).

  The rest of the wiring:
  - **Rule.** `semiRunInfo(ent)` is the rule: run = the Monday after the pay week's Saturday, and the week checked is Sat+1 … Sat+7. An entity without schedule dates uses the session's pay week.
  - **Hand choice.** The owner's tick is stored with its run date (`{runIso, paid}`) and counts only for that run. An independent review caught a choice carrying into next week through the snapshot.
  - **Status.** The Downloads status names a semi-monthly pay set by hand, or one that has no run date.
  - **Pay.** `_applySemi` sets the pay (the amount or $0) wherever a flat row is built.
  - **Screen.** Payroll Calculation has a Semi-monthly type button, the amount per half-month, the "Paid this run" tick and the reason.
  - **Settings file.** Type "Semi-monthly" with the amount in the Flat column, round-tripped.
- **Totals line.** The screen states "Hourly and flat = payroll Actual without semi-monthly pay", then the semi-monthly cost and the week's labor cost.

## Verification
- `npm test`: all pass, including `tests/fc00052_labor_cost.test.js` (12 tests). The rule is checked against eight real run dates.
- **One real week:**
  - each entity's hourly-and-flat cost equals its payroll Actual to the cent;
  - with the paid semi-monthly amount added, the three entities equal the week's final payroll Actual to the cent;
  - the hour grid equals the day totals.
- **Real browser:** the Labor Cost tab and the Semi-monthly controls render with no errors.

## Out of scope
- Employer taxes, benefits and overhead (cost here is wages only).
- Budgets or targets.
- Coverage rules.

## Assumptions
- The run date is the Monday after the pay week's Saturday. The tool never reads the computer's clock for this.
- Semi-monthly people are flat-paid and don't clock in. If one does clock in, the punches show in the stats but don't change the pay.
- $/hour per day = day cost ÷ day hours, hourly people only.

## Open questions
None.

## Tests
`tests/fc00052_labor_cost.test.js`:
- `test_day_cost_ties_to_payroll_actual_to_the_cent`
- `test_overnight_minutes_land_in_next_day_early_hours`
- `test_hour_grid_total_equals_day_total`
- `test_scheduled_vs_actual_hourly_only`
- `test_semi_monthly_paid_when_run_week_has_1st_or_15th`
- `test_semi_monthly_history_runs`
- `test_semi_monthly_tick_override_and_zero_row_kept`
- `test_semi_monthly_cost_24_over_52`
- `test_semi_monthly_in_settings_file_round_trip`
- `test_labor_cost_sheet_in_combined_excel`
- `test_pay_identical_except_semi_monthly`
- `test_semi_monthly_type_button`
- `test_paid_this_run_choice_never_carries_to_next_week`
- `test_semi_monthly_without_dates_uses_session_week_and_is_named`

## Slice
L

## Affected entities
All

## Changed later (FC-00058, FC-00060, owner's edits of 2026-10-26)
- The **Labor Cost sheet** is now formulas: the Week column sums the days, $ / hour = actual ÷ hourly hours (a new "Hours (hourly people)" row), Variance = actual − scheduled, and the week's labor cost adds the flat and semi-monthly lines.
- The Weekly Actuals table on the Payroll tab can show **Cost** instead of Hours (FC-00058), per person per day, with the same allocation as this card, so it ties to Labor Cost.
