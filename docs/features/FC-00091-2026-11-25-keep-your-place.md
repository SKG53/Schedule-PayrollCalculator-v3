# FC-00091 — The screen never jumps and boxes never lose what you are typing

**Date:** 2026-11-25 · **Slice:** M · **Risk:** Low · **Status:** approved · **Affected entities:** All

## What
Most screens are redrawn whole after every change. The redraw threw away the box being typed in and put the page, or the scroll box inside it, back at the top. Now every redraw keeps the owner's place:

1. **The page stays put.** Saving a box (Enter, Tab or a click elsewhere), ticking a box, picking from a list or pressing a button that redraws leaves the page, and every scroll box on it (the Employee Register list, the payroll and review tables, the dialogs), exactly where it was.
2. **The cursor stays where the owner put it.**
   - Typing in a search box: every letter goes in; the box never lets go of the cursor.
   - Enter: saves; the cursor stays in the same box, at the same place.
   - Tab / Shift+Tab: saves; the cursor goes to the next (previous) box.
   - Click on another box: saves; the clicked box has the cursor.
   - Click on empty space: saves; the cursor leaves the box.
   - A box that is gone after the change (a row moved to another person) is simply not focused.
3. **Folded parts stay open or closed** as the owner left them (a person's entity list on the Register, the sections of the settings-file check, the accountant notes).
4. **What is typed and not saved yet stays** when something else redraws the screen (an OCR run finishing, for example); leaving the box saves it, as before.
5. **The whole tool:** Schedules, Actuals Intake (review tables, image list), Payroll (entity content, paid without a schedule, bonuses, export preview, Exports, Since last week), Employee Register, History, the settings-file check, New employee, "Not approved — these rows won't be paid", and the week-folder sort screen.

## Why
The owner, 2026-11-23/25: "everytime i click or hit enter anywehre on any box, the whole scroll resets to the top. need to fix that", "i am not able to type more than 1-2 letters in this box without it kicking me out" (the Employee Register search box), "everything is kicking me out", and "check the whole tool for the jumping thing".

## Where in UI
Every tab and dialog listed above.

## Touches
New: `_keepPlace(host, draw)` and `_kpWrap(host, again)` (one shared helper) with `_kpSave`, `_kpRestore`, `_kpKey`, `_kpFind`, `_kpNoteScroll`, `_kpHold`. Wired into: `renderRegister`, `renderPayroll`, `renderPayrollEntityContent`, `renderBonusPanel`, `renderFc00013PreviewPanel`, `renderDownloadsPanel`, `renderWowPanel`, `renderIntake`, `renderOcrFileList`, `refreshReviewTable`, `renderTable`, `renderScheduleContent`, `_rerenderAll`, `renderHistoryPanel`, `_renderStageOverlay`, `_renderNewEmp`, `_renderPayGate`, `_renderWeekDrop`. `setWage`, `setFlatAmount`, `setSplitDepositForRow` and `setRowBreakOverride` no longer pull the cursor back to the box just left.

## Risk
Low. Pay is not involved: the helper only reads and sets scroll, focus and selection. What each box saves, and when, is unchanged.

## Reversibility
One revert commit.

## Definition of Done
1. On every tab, with the page scrolled down: Enter, Tab, a click on another box, a choice from a list and a tick leave the page and every scroll box where they were.
2. The Register search takes every letter typed, slow or fast, and keeps the cursor.
3. Enter keeps the cursor in the box; Tab and Shift+Tab move it to the next or previous box; a click gives it to the clicked box; a click on empty space leaves the box.
4. A box that no longer exists after the change does not break anything.
5. Unit tests for scroll, focus and caret, Tab, click, a missing box, folded parts; a browser check per tab on the real snapshot.
6. Pay identical on every reference week.

## Out of scope
What any box saves or when. The Actuals Intake review boxes keep FC-00054's Enter (saves and leaves the box).

## Assumptions
- Enter keeps the cursor in the box that was saved (the review boxes keep their own rule, above).
- No debounce: each letter redraws the Register and the cursor is put back in the same moment.
- The repository has no dependencies and jsdom is not installed, so the helper's unit tests run in the repository's node harness with a small DOM of their own; the browser check is a Playwright script beside the tests (not part of `npm test`).

## Open questions
None.

**Approved:** the owner, 2026-11-25: "Build all of them".

## Tests
`tests/fc00091_keep_your_place.test.js`; browser check `tests/browser/fc00091_keep_your_place.pw.js` (`SNAP=<snapshot.json> node tests/browser/fc00091_keep_your_place.pw.js`).
