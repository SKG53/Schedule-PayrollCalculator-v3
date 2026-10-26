# FC-00064 — Hours in words; scheduled hours beside the scheduled shift

**Date:** 2026-10-26 · **Slice:** S · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
1. Where there is room, hours read in words: **12 Hours 34 Minutes**, **8 Hours 0 Minutes**, **1 Hour 1 Minute**, followed by the decimal the pay uses: "12 Hours 34 Minutes (12.57)". This applies to the review tab's week total, each day's hours, and the out-of-week list. The "Hours shown as" setting still applies: decimal only shows only the decimal; h:mm only shows the words without the decimal.
2. In tight table and grid cells (Weekly Actuals, Time Card Data, schedule grid) the short h:mm stays, and hovering shows the hours in words.
3. Every scheduled shift shown on the review tab also shows its length: **Scheduled: 8:10AM-2:40PM · 6 Hours 30 Minutes (6.50)**. The length is the full shift, start to end, with no break taken out, as on the posted schedules.

## Why
The owner: "HH:MM should display as 'XX Hours YY Minutes' wherever space allows and is possible", "8 Hours 0 Minutes is correct. 1 Hour 1 Minute is also correct", and "if you are going to show text like 'Scheduled: <shift>' on the actuals intake page, then you have to show what the scheduled hours, minutes, and hours decimals are as well".

## Where in UI
Actuals Intake review tab (week total, day headings, scheduled shift); Payroll tab tables (hover).

## Touches
display

## Risk
Low. Display only; pay and files unchanged.

## Reversibility
Fully reversible via one revert of the FC-00062–65 commit.

## Definition of Done
1. `fmtHrsWords(h)`: rounds to the minute; "Hour"/"Minute" singular for 1; zero minutes shown; negative values read "minus …".
2. Review tab: week total and day hours in words with the decimal; scheduled shift with its length in words and decimal; OFF days read "Scheduled: OFF".
3. Table cells keep h:mm; the words are on hover.

## Built
- `fmtHrsWords`, `fmtHrsLong`, `fmtHrsCell`; `_dayHeadHtml`, `_weekHoursHtml` use them; table cells in the Payroll tab use `fmtHrsCell`.

## Verification
- `npm test`.

## Out of scope
- Excel and PDF files (the payroll report drops its H:MM column, FC-00065).

## Assumptions
- The scheduled length is the posted shift's span with no break deducted, which is how the posted schedules' "Hours" rows count it.

## Open questions
None.

## Tests
`tests/fc00064_hours_in_words.test.js`:
- `test_words_singular_and_zero_minutes`
- `test_long_form_follows_the_hours_setting`
- `test_review_tab_week_day_and_scheduled_length`
- `test_table_cells_keep_hmm_with_words_on_hover`
- `test_pay_unchanged`

## Slice
S

## Affected entities
All
