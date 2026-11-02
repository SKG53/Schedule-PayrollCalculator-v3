# FC-00066 — Pay a day from outside the pay week (final pay, late cards) without moving its date

**Date:** 2026-11-02 · **Slice:** M · **Risk:** High · **Status:** drafting · **Affected entities:** All

## What
1. **"Pay in this run" on rows outside the pay week.** On a person's review tab, each row under *Outside this pay week* gets a toggle **Pay in this run**. Turned on, the row keeps its **real date** and its hours and pay count in this run.
   - It works for a day after the week (final pay, e.g. someone's last shift is the Sunday after the pay week) and a day before it (a card that turned up late for an earlier week).
   - The row must be approved like any other row; the FC-00049 export check treats an unapproved row with the toggle on as a pay-week row.
2. **Files show the true date.** The Hours sheet lists the row on its own date with an **Outside pay week** mark; the payroll report's Hours, pay and totals include it through the same formulas. The Timecards Excel keeps the real date and adds the mark in Flags. Stats (punctuality vs schedule) skip the row, since it has no shift in this week's schedule. Labor Cost lists it on its own line under the week, labelled with its date.
3. **The settings file remembers what was paid early or late.** Each row paid this way is written to a new settings-file section **Paid outside the pay week**: employee ID, date, punches, hours, and the run it was paid in (e.g. `10/25–10/31`).
4. **The next run cannot pay it again.** When a row comes in (OCR or manual) for the same employee ID and date, and overlaps the punches already paid, the tool leaves it out automatically and shows on that row and at the top of the person's tab: *Paid in the 10/25–10/31 run · not paid again*. The reviewer can undo that with one click (e.g. the earlier payment was only part of the day); undoing is logged.
   - Entries older than 60 days drop out of the settings file on export.
5. **Final pay label.** When a person with a row paid this way is also set inactive in the same run, their report row reads **NAME (final pay)**.

## Why
The owner, 2026-11-02: an employee's last shift was on the Sunday after the pay week, and the business paid all of it in that week's run. "Bc the tool is specifically scoped to handle only the current week, I had to put the punches on saturday to count this week. open to thoughts on how to correct this moving forward."
Moving the date makes the Timecards Excel (the owner's punch record) show a shift that did not happen, puts it in the Stats and Labor Cost of the wrong day, and nothing stops the real-dated card from being paid again the next week. The same problem arises in reverse when a card for an earlier week arrives late.

## Where in UI
Actuals Intake → person's review tab → *Outside this pay week* rows. Payroll tab and exports (Hours sheet, report, Timecards Excel, Labor Cost). Settings file (export and import).

## Touches
intake review, payroll calculation, export (Hours, Report, Timecards, Labor Cost, Stats), settings file format, snapshot

## Risk
High. It changes which rows are paid and adds a settings-file section that blocks rows in later weeks. Mitigations: the toggle is off by default; a blocked row is shown, never hidden; one-click undo; every change is logged and undoable (FC-00039).

## Reversibility
Fully reversible via one revert. Settings files written with the new section load in an older tool version with the section ignored.

## Definition of Done
1. With the toggle off, pay is identical to the current tool on the 5 reference weeks.
2. A row dated after the week, toggled on and approved, adds its hours and pay to this run; the Hours sheet shows its real date with the mark; LibreOffice recalculation from scratch matches the tool (0 mismatches).
3. The same for a row dated before the week.
4. The exported settings file lists the row under *Paid outside the pay week*; importing it into the next run and loading a matching row leaves that row out with the message, and the report does not pay it.
5. Undo on a blocked row pays it and is logged.
6. A non-matching row (same person, other date, or same date without overlapping punches) is not blocked.
7. An inactive person with a row paid this way shows *(final pay)* on the report.
8. Stats exclude the row; Labor Cost lists it on its own dated line; the Timecards Excel keeps its real date.

## Out of scope
- Paying a whole other week; this is for single days.
- Changing the pay-week scope of the tool otherwise.

## Assumptions
- A blocked match is the same employee ID and date with overlapping punches (any overlap).
- 60 days is long enough to keep the record in the settings file.

## Open questions
1. Should a toggled row also need a short reason typed in (e.g. "final pay"), shown on the Hours sheet?
2. Is 60 days the right time to keep the record, or keep it until the owner clears it?

## Tests
`tests/fc00066_pay_outside_week.test.js` (invented names and values only):
- `test_toggle_off_pay_unchanged`
- `test_after_week_row_paid_with_real_date`
- `test_before_week_row_paid_with_real_date`
- `test_unapproved_toggled_row_stops_export`
- `test_settings_file_round_trips_paid_outside_rows`
- `test_next_run_blocks_matching_row_and_says_why`
- `test_undo_block_pays_and_logs`
- `test_non_matching_rows_not_blocked`
- `test_final_pay_label_when_inactive`
- `test_stats_skip_and_labor_cost_dated_line`

## Slice
M

## Affected entities
All
