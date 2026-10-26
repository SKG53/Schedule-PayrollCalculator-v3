# FC-00057 — Review tab: every day of the week with hours, a dot until fully approved, blue for hand edits, Approve all asks

**Date:** 2026-10-26 · **Slice:** M · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
On Actuals Intake, each person's tab shows all seven days of the pay week, each day with its hours, and the week's hours in the person's bar (h:mm with the decimal). Every person with a row not yet approved has an orange dot. Every value changed or typed by hand is blue, and stays blue through the Timecards Excel. The entity-level **Approve all** asks first.

## Why
The owner:
- "you should always show all days in that billing period on their specific tab. The days they don't work, there should be no clock times, but the days should be there. So the view is standardized."
- "can you show daily and weekly totals for hours as a preview for each person as well?"
- "Every employee needs to have an orange dot next to their name, until they are manually fully approved. Not just low confidence on OCR ones… human review is required for 100% of timecards."
- "manually changing any clock times should make that box become blue."
- On Approve all: "keep the approve all button. but add a confirmation dialog box."

Before: only days with rows were listed; no hours on the review tab; the dot showed only for flagged unapproved rows; edited boxes were a pale blue on OCR rows only and lost the marking through the Timecards Excel; Approve all approved an entity in one click.

## Where in UI
Actuals Intake → the employee tabs and the review table.

## Touches
intake, display, exports (Timecards Excel column)

## Risk
Medium: the review table's layout changes; the hours shown come from the payroll math. Pay is untouched (the payroll actuals builder was split out unchanged and checked on real weeks).

## Reversibility
Fully reversible via one revert of the FC-00054–61 commit.

## Definition of Done
1. **Every day:** Sun–Sat of the loaded schedule's week (no schedule: the Sun–Sat week most rows fall in). Each day has a header with the date, the shift ("Scheduled: …" or OFF), and its rows; a day with none says "No punches · + Add punches" (a manual row for that person and date). Rows outside the week come last under "Outside this pay week · not paid this week".
2. **Hours:** per day "approved" (what payroll pays now) and, when rows are waiting, "once approved"; per week the same in the person's bar. Same rule as payroll (span − the larger of the break minimum and the gap; your edits replace overlapping card readings).
3. **Dot:** on a person's tab while any of their rows is neither approved nor left out (flagged or not); none for "Ignore Time Cards" people; on Unrecognized too. It comes back whenever an edit un-approves a row.
4. **Blue:** every OCR box changed by hand ("Changed by hand — OCR read …") and every filled box of a hand-typed row ("Typed by hand"); stronger blue than before. The Timecards Excel carries what OCR read for each box ("OCR Values" column), so a re-import keeps the marking and the same boxes count as manual entries.
5. **Approve all** (entity) asks: "Approve all N rows for <entity> without checking them one by one?"; Cancel approves nothing.
6. Looking at a tab never creates a roster record (hours are computed for that person's rows only).
7. A re-imported row approved with no punches ("did not work") stays approved.
8. Pay identical on the real weeks.

## Built
- `_actualDaysFromRows` split out of `syncActualsFromReview` (unchanged math); `_intakeHours(idx,personKey)` runs `computePayrollForEntity` on the person's approved rows and on all their rows and puts the real actuals back.
- `_reviewWeekIsos`, `_dayHeadHtml`, `_weekHoursHtml`, `addManualRowForDay`, `_addedNewOffSchedule`.
- `_boxByHand` / `_boxByHandTitle`; CSS `box-edited` #BFDBFE / #2563EB; legend entries for blue and the dot.
- Timecards Excel "OCR Values" column, read back in `_ingestActualsIntakeRows`.

## Verification
- `npm test`: all pass; `tests/fc00057_review_days_hours.test.js` (11 tests).
- Eight real weeks (Aug 9 – Oct 17): pay identical to before, undo and snapshot round-trips exact.
- Real browser on a real week: 7 day headers per person, week hours, dot appears on un-approve and goes on approve; Timecards Excel round trip through real SheetJS: every row and every blue box back.

## Out of scope
- Changing the approval rules themselves.

## Assumptions
- "Billing period" = the schedule's Sun–Sat week.

## Open questions
None.

## Tests
`tests/fc00057_review_days_hours.test.js`:
- `test_every_day_of_the_week_is_shown`
- `test_day_and_week_hours_match_payroll`
- `test_pending_hours_shown_until_approved`
- `test_hours_view_never_changes_payroll`
- `test_dot_on_every_unapproved_row_until_fully_approved`
- `test_blue_on_edited_and_hand_typed_boxes`
- `test_blue_survives_the_timecards_excel`
- `test_approve_all_asks_first`
- `test_rows_outside_the_week_are_listed_last`
- `test_no_schedule_week_from_the_rows`
- `test_looking_at_a_tab_never_creates_a_person`

## Slice
M

## Affected entities
All
