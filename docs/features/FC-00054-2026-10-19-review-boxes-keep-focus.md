# FC-00054 — Typing a date (or any box) on the review tab never kicks you out

**Date:** 2026-10-19 · **Slice:** S · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
On the Actuals Intake review table, a date can be typed in one go (e.g. `10` `15` `2026`) without losing the cursor, clicking from one box to another lands in the box clicked the first time, and typed shorthand such as `500p` means 5:00 PM.

## Why
The owner: "when i enter a date in a manual row … it always kicks me out of the box after the first number and i have to reclick and retype the full number again."

Reproduced in a real browser on a new manual row:
1. **The first click into the date box was lost.** Leaving the time box saved it and redrew the table, so the date box under the mouse was replaced.
2. **After one digit, the cursor was gone again.** The browser reports a date box as "changed" on every digit and the tool saved and redrew on "changed". Typing `1` in the month saved **January** (2026-01-11).

Found while testing: typing `500p` saved **5:00 AM** — the a/p after bare digits was dropped.

## Where in UI
Actuals Intake → the review table: the date box and the time boxes.

## Touches
intake, display

## Risk
Low. When a value is saved changes; what is saved does not (except the a/p fix, which saves what was typed).

## Reversibility
Fully reversible via one revert of the FC-00054–61 commit.

## Definition of Done
1. **When a date is saved.** On leaving the box (Tab, click elsewhere, Enter), never on a digit. The calendar picker still works; its date saves when the box is left.
2. **No redraw under a mouse press.** A save made while the mouse button is down waits for the click to land; then the table redraws and the cursor goes to the box that was clicked (same row, same box). Tab moves the cursor the same way.
3. **No half-typed dates.** Typing `10152026` stores 2026-10-15, with nothing saved on the way.
4. **Typed a/p counts:** `500p` = 5:00 PM, `5p` = 5:00 PM, `1130a` = 11:30 AM, `12a` = 12:00 AM; `845`, `1715`, `9:01 AM` read as before.
5. Undo, History and approval as today: a saved date un-approves an approved row as any edit does.
6. Pay unchanged on the real weeks.

## Built
- Date box: `oninput` keeps the light update, `onblur` commits (`commitDateInput(…, event)`), Enter blurs; no `onchange`.
- Every review box carries `data-rbox="<row id>|<field>"`. `refreshReviewTable` waits while `_ptrDown` (document mousedown/mouseup listeners) and redraws on mouseup; it restores the cursor to the box being moved to (`relatedTarget` of the blur, `_refocusKey`) or the box that has it, with the caret position.
- `from12h`: a trailing `A`/`AM`/`P`/`PM` after bare digits is applied.

## Verification
- `npm test`: all pass; `tests/fc00054_review_boxes_keep_focus.test.js` (6 tests).
- Real browser (Chromium) on a real week: new manual row, one click on the date, type `10152026` → 2026-10-15 (the old code saved 2026-10-11); click In 1, type `900a`, click Out 1, type `500p` → 09:00 and 17:00. In Chrome the first Tab after the year moves within the date box's own fields; the next Tab leaves it (browser behavior).

## Out of scope
- Replacing the date box with a text box.

## Assumptions
None.

## Open questions
None.

## Tests
`tests/fc00054_review_boxes_keep_focus.test.js`:
- `test_date_box_saves_on_leave_not_on_change`
- `test_enter_saves_the_date`
- `test_redraw_after_leaving_a_box_is_deferred_and_keeps_the_clicked_box`
- `test_no_partial_date_saved_while_typing`
- `test_typed_am_pm_shorthand_is_kept`
- `test_reimport_keeps_approved_rows_without_punches` (FC-00057)
- `test_unchanged_box_leaves_no_refocus_key_behind`

## Slice
S

## Affected entities
All

## Independent review fixes (2026-10-26)
- Leaving a box without changing it no longer leaves a "move here" note behind that later pulls the cursor into a time box with its text selected. The note lasts only for the redraw it was made for.
- A held redraw (waiting for the mouse button) also runs after a drag ends, a pointer is cancelled or the window loses focus, not only on mouse-up.
