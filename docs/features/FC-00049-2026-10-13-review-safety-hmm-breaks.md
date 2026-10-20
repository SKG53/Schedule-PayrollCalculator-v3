# FC-00049 — Unapproved rows stop the payroll export; hours as h:mm; break minutes in every day cell

**Date:** 2026-10-13 · **Slice:** M · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. **Unapproved rows stop the payroll export.** Exporting payroll while any timecard row in the pay week is unapproved opens a list of those rows. For each one the owner chooses **Approve** or **Leave out**. The export continues only once every row is decided.
2. **Hours as hours:minutes on every screen:** e.g. `7:59 (7.98)`. A switch offers h:mm, decimal or both. Pay math and export files are unchanged.
3. **Break minutes in every day cell** of the Payroll tab's weekly grid, e.g. `5:14P–8:32P · 9:00P–1:00A · break 0:28`. When the entity's minimum break was used instead of the actual gap, the cell says `break 0:30 min.`.

## Why
- **Unapproved rows.** On a real week, editing a time un-approved one row, as designed. The export then left that day out: 7.30 h was not paid. The only signal was one line in the Downloads status, which never stops an export (FC-00023). An unpaid shift is the most expensive silent failure the tool has.
- **h:mm.** The owner reads hours as hours:minutes, and the handwritten Hefner totals are h:mm. Decimal hours on screen make every comparison a mental conversion.
- **Break minutes.** Break time shows only on the Time Card Data sub-tab, as decimal hours. Checking a day means switching tabs and converting.

## Where in UI
- **Payroll tab and Downloads:**
  - every payroll export (Combined Excel and PDF, the Downloads list, and the existing buttons) first opens the **"Not approved"** list when there is anything on it;
  - the Downloads status line names the rows too.
- **Review tab:** a row left out shows a grey "Left out of pay" tag and an **Undo leave out** link.
- **Header, Settings:** "Hours shown as: h:mm (decimal) / h:mm / decimal".
- **Payroll tab weekly grid:** each worked day cell gains a break line.

## Touches
intake, exports, display

## Risk
Medium.
- It adds a stop to export, which reverses FC-00023 for this one case.
- It changes how hours read on every screen. Pay math is not touched.

## Reversibility
Fully reversible via one revert commit. In the tool:
- Approve and Leave out are ordinary row changes, kept in History with Revert.
- The display switch changes nothing in the data.

## Definition of Done
1. **What triggers the stop:** a payroll export, while any review row in the schedule week is not approved and not left out. Rows for an ignored employee ("Ignore Time Cards") and rows outside the week do not count, because they are not paid anyway.
2. **The list**, one line per row: `<entity> · <name> · <day date> · <in–out pairs> · <h:mm> won't be paid`. Each line has **Approve** and **Leave out** buttons. **Approve all** and **Cancel** sit at the bottom.
   - Approve uses the normal approve action. A row with "needs review" flags is approved as the owner chose.
   - A row the tool cannot approve (a missing clock-in or clock-out, or a re-read waiting) shows the reason and a **Go to row** link instead of Approve. The owner fixes it there, or leaves it out.
   - Once every line is decided, the export runs. Cancel exports nothing.
3. **Leave out** marks the row. It is not paid and it does not ask again. The review tab shows "Left out of pay" on the row, and Undo leave out returns it to unapproved. The Combined Excel lists left-out rows in a "Left out" note under the entity's totals, so the record shows what was excluded.
4. **Editing an approved time still un-approves the row**, unchanged. The stop is what now catches that row before it costs a shift.
5. **Exports that never stop:**
   - the Timecards Excel and PDF, which already carry unapproved rows, marked;
   - the settings file;
   - the snapshot;
   - the schedule exports.

   FC-00023 still holds for every other warning (duplicates, flags, missing rate).
6. **h:mm on every screen that shows hours:** payroll grid, Time Card Data, Payroll Calculation, the all-entity preview, the schedule's weekly chips and the review row totals.
   - The h:mm is the worked minutes rounded to the nearest minute.
   - The decimal in brackets is the value pay uses, unchanged.
   - Default: both. The choice is a display preference kept in the browser; this is allowed by Decision #11 because it holds no payroll data.
7. **Exports keep decimal hours,** unchanged.
8. **The break line in each worked day cell** shows the break counted for pay as h:mm, plus a word for where it came from:

   | Source | Example |
   |---|---|
   | Actual gap between pairs | `break 0:28` |
   | The entity minimum, because it is longer than the gap | `break 0:30 min.` |
   | The owner's per-day override | `break 0:20 set` |

   A day with one pair and no minimum shows no break line.
9. **Pay is identical.** On five real weeks plus Oct 4–10, every pay figure and every export cell is identical to the live version, apart from the new "Left out" note when a row is left out. Undo and snapshot round-trips are exact.

## Built
- **The export gate.** `unpaidReviewRows()` lists every review row in the pay week that is not approved and not left out. `_payrollGateOk(cont)` runs before every payroll export (`_exportExcel`, `_exportPdf`, `buildSelectedDownloads`); the Downloads capture asks once for the whole download.
  - The overlay `#payGateOverlay` has Approve, Leave out, Approve all and Cancel, plus **Go to row** for a row the tool cannot approve.
  - When the last row is decided, the waiting export runs.
- **Rows that never stop an export:**
  - rows with no punches at all (EasyClocking "did not work" lines), found on every real week;
  - rows of an ignored employee;
  - rows outside the week.
- **Leave out.** `leftOut` on the row, set by `setRowLeftOut()`.
  - It is logged as `reviewLeftOut`, with Revert in History.
  - Approving the row clears it.
  - The review tab shows "Left out of pay" with Undo.
  - The Timecards Excel writes "Left out" in the Approved column, and import reads it back.
  - The payroll report prints a "Left out of pay: …" note under the entity's subtotal, in Excel and PDF.
- **Hours on screen.** The hours formatter is `fmtHrs` (`fmtH` stays the schedule calendar's clock-time formatter), with `fmtHmm` and `_chipHours`. The setting is in Settings → "Hours shown as" (`pv26_hours_fmt`, a browser preference). It covers:
  - the payroll grid, weekly column and chips;
  - Time Card Data and Payroll Calculation;
  - the week-filter banner and the schedule chips and hours cells.

  The all-entity preview mirrors the export file, so it stays decimal. Review rows show no hour totals, so nothing there changes.
- **Break line.** `dayBreakLine(day)` under each worked day cell: the gap, "min." when the entity minimum was used, "set" for an override.
- **Folded in from the FC-00046/47/48 review:**
  - a rename saves the old spelling as an alternate spelling;
  - a settings file without an Employee ID column counts as loaded;
  - the export status names unconfirmed people paid off the schedule;
  - the red rate cell uses the export status rule;
  - the Downloads status is computed once per render.
- **Also:** a site icon, so the page no longer logs a favicon 404.
- **An independent review found:**
  - the editable copy's exports were not stopped;
  - people with Active unchecked were listed although they are not paid;
  - Approve all would pay an unrecognized name.

  All three are fixed: these rows show "Name matches nobody" with Go to row, and Approve all skips them. Editing a time on a left-out row also asks again.

## Verification
- `npm test`: all pass. The new `tests/fc00049_review_safety.test.js` has 21 tests. fc00023, fc00032 and fc00040 were updated to the new stop and wording.
- **Five real weeks:**
  - no row stops the export;
  - pay and every export cell are identical to the live version;
  - undo and snapshot round-trips are exact.
- **Real browser (Chromium) with a real week:**
  - one unapproved row opened the list;
  - Leave out ran the Downloads;
  - the grid shows h:mm with the decimal;
  - no JavaScript errors.

## Out of scope
- Punctuality flags and stats (card 4).
- Changing the "edit un-approves" rule.
- h:mm inside the export files.

## Assumptions
- **Only the payroll exports stop**, not the Timecards Excel, which is the readable record of every row including unapproved ones.
- Leave out is remembered on the row, in the snapshot and in the Timecards Excel, so it is asked once per row, not once per export.
- The setting's labels are as written above.
- "min." and "set" are the cell's words for minimum and override.

## Open questions
None.

## Tests
`tests/fc00049_review_safety.test.js`:
- `test_unapproved_row_stops_payroll_export`
- `test_approve_from_list_then_export_runs`
- `test_leave_out_not_paid_and_not_asked_again`
- `test_undo_leave_out_returns_row_to_unapproved`
- `test_ignored_and_out_of_week_rows_never_stop`
- `test_timecards_settings_snapshot_exports_never_stop`
- `test_left_out_note_on_combined_excel`
- `test_hmm_display_both_hmm_decimal`
- `test_hmm_rounds_minutes_pay_value_unchanged`
- `test_break_line_gap_minimum_override`
- `test_pay_identical_with_display_switch`

Real-week check: five weeks plus Oct 4–10, pay and export cells identical; undo and snapshot round-trips exact.

## Slice
M

## Affected entities
All
