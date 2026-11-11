# FC-00073 — Pay dates and each person's accountant details

**Date:** 2026-11-11 · **Slice:** S · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. Each run has two pay dates:
   - **Deposit** (Deposit, the deposit part of Deposit + Cash, Executive PR): taken from the accountant's file (FC-00075); "not set" until then.
   - **Cash and Contract Check**: the Friday after the pay week (a Sunday–Saturday week pays the Friday six days after it ends).
2. Both can be changed by hand on the Accountant file panel (Exports). A change first shows a warning naming what the date is for ("This is the day the accountant pays every deposit … Change it only if the accountant changed it." / "This is the day Cash and Contract Check are paid: the Friday after the pay week. Change it only if pay day really moves."); Cancel keeps the date. Clearing the cash date goes back to the Friday.
3. The dates are kept in session.toolSettings under the run's week ("payDate:deposit|<week start>"), so Undo, History ("Pay date · Deposit · week of mm/dd/yy") and the snapshot carry them; they are **not** written to the settings file (a date belongs to one week) and a new week starts without them.
4. The payroll report prints them under the title: "Pay dates · Deposit: Thu 08/20/26 · Cash and Contract Check: Fri 08/21/26" (Excel in the row under the title that was blank, PDF, preview).
5. Each person has an **Accountant Name**, **Employment Type** (W2 / 1099), **Accountant Section** (only when the accountant files them under another entity's section) and **Accountant Note**, kept on the roster record and in four new Payroll Settings columns. Edited in the Accountant file panel; the settings import shows them in its preview. A blank Accountant Note cell counts as "cleared" (so the accountant's note is not taken again).

## Why
The owner, 2026-11-09 to 11-11: "pay date will come from the accountant's files" · "Pay Date for everyone else who is contract check or cash should be the friday following the pay period." · "the pay date should be editable. I doubt I'll change it, but I want the option, with a pop up warning of its importance" · names on the accountant's file must match exactly.

## Where in UI
Exports → Accountant file panel; payroll report header.

## Touches
settings, exports, display, roster

## Risk
Medium: new settings-file columns (the importer reads by header name, so old files load unchanged).

## Reversibility
Fully reversible via one revert commit; the extra settings columns are ignored by the old tool.

## Definition of Done
1. Friday date computed; deposit date blank until set; both changeable only after the warning.
2. Dates on the report; not in the settings file; in the snapshot; undoable.
3. The four accountant columns round-trip through the settings file.

## Out of scope
- A pay-date calendar or holidays.

## Assumptions
- "Friday following the pay period" = the first Friday after the week's last day.

## Open questions
None.

## Tests
`tests/fc00073_pay_dates_accountant_fields.test.js`: `test_cash_date_is_friday_after_week`, `test_change_date_warns_first`, `test_pay_dates_on_the_report`, `test_pay_dates_in_snapshot_not_in_settings_file`, `test_dates_belong_to_their_week`, `test_accountant_fields_round_trip_in_settings_file`.

## Slice
S

## Affected entities
All
