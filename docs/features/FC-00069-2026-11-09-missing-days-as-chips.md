# FC-00069 — "Scheduled, no approved punches" days shown as separate boxes

**Date:** 2026-11-09 · **Slice:** S · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
1. On a person's review tab, the red line lists each day in its **own small box** instead of one comma-separated sentence, with space between boxes; boxes wrap when there are many.
2. Each box shows that day's scheduled shift under the date in smaller text (e.g. *Mon Aug 10* / *8:20AM – 4:50PM*).
3. Clicking a box scrolls to that day's row on the same tab (FC-00057 lists every pay-week day) and outlines it briefly.
4. The label carries the count: *Scheduled, no approved punches · 5 days*.

## Why
The owner, 2026-11-09, on that line: "these need to be in little boxes or something. hard to even tell they were separate dats"

## Where in UI
Actuals Intake → person's review tab, the red line under the person's header.

## Touches
display

## Risk
Low. Which days are listed is unchanged (`scheduledNoPunchDays`); only how they are drawn.

## Reversibility
Fully reversible via one revert.

## Definition of Done
1. N missing days show as N separate boxes with visible gaps.
2. Each box shows the date and that day's scheduled shift.
3. Clicking a box scrolls to that day's row and outlines it.
4. The count in the label equals the number of boxes.
5. Narrow window: boxes wrap, nothing overflows.

## Built
- `.snp-chip` boxes (`data-iso`), `.snp-shift`, `scrollToReviewDay(iso)`; day header rows carry `data-iso`.

## Verification
- `npm test` (tests below; FC-00051's test updated to the new line).
- Browser: boxes render and wrap; a click scrolls to and outlines the day; no page errors.

## Out of scope
- Which days count as missing.

## Assumptions
- Showing the scheduled shift in each box is wanted (it says what was expected that day).

## Open questions
None.

## Tests
`tests/fc00069_missing_days_chips.test.js` (invented names only):
- `test_one_box_per_missing_day`
- `test_box_shows_scheduled_shift`
- `test_count_matches_boxes`
- `test_click_targets_day_row`

## Slice
S

## Affected entities
All
