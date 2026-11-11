# FC-00070 — Deposit people paid 1.5× over 40 hours

**Date:** 2026-11-11 · **Slice:** M · **Risk:** High · **Status:** done · **Affected entities:** All

## What
1. A person whose pay method is **Deposit** (Deposit only, hourly, not Flat) is paid **1.5×** for the hours over **40** in the entity's week.
2. Pay = rate × (hours + ½ × hours over 40), rounded like every other pay (the employee's rounding digits, then cents; FC-00061). `row.otPaidH` holds the hours over 40 that were paid at 1.5×.
3. **Hours stay the total worked.** Actual Total and Deposit rise with the pay; Cash totals do not change.
4. A day from outside the pay week paid in this run (FC-00066) is straight time and never counts toward the 40 hours; in Excel its hours are taken off before the 40 (`MAX(0,ROUND(Hours−outside−40,2))`).
5. Cash, Deposit + Cash, Contract Check, Executive PR (FC-00072) and Flat or semi-monthly people stay straight time.
6. The payroll report (combined and per entity; Excel, PDF and the preview) has an **Over time** column right after Hours, with a subtotal and grand total. In Excel the Over time cell of a Deposit row is `MAX(0,ROUND(Hours−40,2))` and Actual Total is `ROUND((Hours+0.5×Over time)×Rate,2)`, so editing hours in the workbook moves both.
7. The Payroll Calculation table shows "N.NN over 40 at 1.5×" under the hours of such a person; the 40h+ flag reads "40h+ (Deposit — overtime paid at 1.5×)".

## Why
The owner, 2026-11-09: "any hours over 40 should be listed in an overtime column" · "This also means that our export needs an over time column. only for those deposit people who go over 40 hours. usually it's going to be empty, but sometimes it might have a few hours" · "The actual and deposit columns would go up as they need to. but yes those hours should be paid at 1.5x." · "cash totals don't change. the overtime column is only relevant for the deposit folks. deposit + cash doesn't use hours for deposit so no, overtime doesn't matter"

## Where in UI
Payroll Calculation table; payroll report (Excel, PDF, preview); the flags list.

## Touches
display, exports, docs

## Risk
High: it changes pay. Limited to Deposit-only hourly people over 40 h; on the six reference weeks only one row moves in each of two weeks (that person's Deposit rises by rate × ½ × hours over 40); every other row is identical.

## Reversibility
Fully reversible via one revert commit.

## Definition of Done
1. Deposit, 42.5 h at $12 → $525.00 (40 × 12 + 2.5 × 18); Deposit rises by the same amount.
2. Cash, Deposit + Cash and Contract Check at 42.5 h are straight time; Flat is never overtime.
3. 40 h or less: unchanged.
4. Over time column on every payroll report; its Excel formulas reproduce the tool's values (LibreOffice recalculation: 0 mismatches) and follow an edited Hours cell.
5. The real-week regression shows changes only on Deposit rows over 40 h.

## Out of scope
- Overtime for Deposit + Cash, Cash or Contract Check (owner: "overtime doesn't matter" there).
- Overtime across entities (40 h counts per entity's week).
- Any warning or validation about overtime (still not validated; CLAUDE.md).

## Assumptions
- 40 h threshold (`OT_THRESHOLD`), 1.5× rate, per entity per week.
- Hours column keeps the total so the hour totals still match the Timecards.

## Open questions
None.

## Tests
`tests/fc00070_deposit_overtime.test.js`: `test_deposit_over_40_paid_time_and_half`, `test_other_methods_straight_time`, `test_at_or_under_40_unchanged`, `test_excel_over_time_column_and_formulas`, `test_overtime_formula_follows_an_edited_hour`, `test_flags_and_payroll_tab_say_overtime_paid`, `test_outside_week_day_never_counts_toward_40`, `test_layouts_without_over_time_keep_the_pay`.

## Review
Independent review fixes: outside-week days no longer count toward 40 h; report layouts without an Over time column (unused writers) write the tool's value for an overtime row instead of a straight-time formula.

## Slice
M

## Affected entities
All
