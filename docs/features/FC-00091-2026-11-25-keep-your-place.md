# FC-00091 — The screen never jumps and boxes never lose what you are typing

**Date:** 2026-11-25 · **Slice:** M · **Risk:** Low · **Status:** done · **Affected entities:** All

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

## As built (2026-11-25)
- **One helper.** `_keepPlace(host, draw)` runs a redraw and puts back, in this order: folded parts (`_kpDetailsSave`/`_kpDetailsRestore`: by the first box inside, else class and place), scroll boxes inside host (`_kpScrollSave`/`_kpScrollRestore`: by id, else tag, class and place; the offsets are noted by a `scroll` listener, `_kpNoteScroll`, because reading them before a redraw made the browser lay out the whole screen first), the page (`window.scrollTo` only when it moved), then the cursor (`_kpRestore`). `_kpWrap(host, again)` is the one-line form for a render function; a redraw inside one already running is left to the outer one (`_kpStack`).
- **Finding a box again:** `_kpKey` / `_kpFind`: its id, else tag, type, name, `data-rbox`, `data-where` and handlers (`oninput`, `onchange`, `onblur`, `onclick`, `onkeydown`, which carry the record id), plus its place among boxes like it. A box that is gone is not focused; nothing throws.
- **Which box gets the cursor:** `_kpHold` notes the key or mouse press being handled (Tab, Shift+Tab, mouse press; cleared when that press is done). Tab: the box the browser was moving to, worked out on the screen as it was before the redraw. Mouse press on a box the redraw replaced: that box, caret at the end. Mouse press on empty space: none. Otherwise the same box, with its caret and selection. When the box is drawn by a second redraw in the same press (Payroll redraws the tab, then the bonus panel), `_kpPending` places it then.
- **Typed, not saved:** when the redraw does not come from the box itself (`window.event`), its typed value is put back and a `change` is sent when the box is left without another change.
- **Covered (the audit: every function that sets a large container's innerHTML in answer to the owner):**
  - Schedules: `renderScheduleContent`, `renderTable` (host: the Schedules tab).
  - Actuals Intake: `renderIntake`, `refreshReviewTable` (after FC-00054's own refocus; adds tick boxes and lists), `renderOcrFileList`.
  - Payroll: `renderPayroll` (host: the Payroll tab), `renderPayrollEntityContent` (Time Card Data, Payroll Calculation, Stats, Labor Cost, paid without a schedule, short week and one-rate panels), `renderBonusPanel`, `renderFc00013PreviewPanel` (export preview and report columns), `renderDownloadsPanel` (Exports, accountant card and notes), `renderWowPanel`.
  - Employee Register: `renderRegister` (search, filters, every row box, entity lists, Add employee, paid without a schedule).
  - Whole screen: `_rerenderAll` (Undo, snapshot, settings Apply).
  - Dialogs: `renderHistoryPanel`, `_renderStageOverlay` (settings-file check), `_renderNewEmp`, `_renderPayGate`, `_renderWeekDrop` (week-folder sort; keeps its own panel scroll and "Images read at once" box).
  - Left as they are (no boxes, or redrawn only inside a covered one): `renderUndoBar`, `renderEntityTabBar`, `renderSettingsFirstBar`, `renderPayrollEntityTabBar`, `renderInfoBar`, `renderFlags`, `renderCalendar`, `renderStatsTable`, `renderLaborCostPanel`, the payroll grids, `_renderOcrRunBar` (keeps its own box), the merge preview and break-change dialogs (drawn once when opened).
- **Cursor pulled back:** `setWage`, `setFlatAmount`, `setSplitDepositForRow` and `setRowBreakOverride` re-focused the box just left on a timer, which took the cursor back from the box Tab or a click had moved to. Removed; the helper keeps the cursor in the box after Enter.
- **Browser check on the real snapshots (private):** `tests/browser/fc00091_keep_your_place.pw.js`, 45 checks. This week: Schedules 3/3, Actuals Intake 7/7, Payroll 22/22, Employee Register 13/13 pass (before this card: 7 of 45 passed; the Register 0 of 13). Last week's: all pass, 2 skipped (nobody paid without a schedule). Opening this week's snapshot still gives the expected deposit, cash, contract check and 41 TNG IDs; no page errors. Two checks pass because the box is gone after the change (a review row moved to another person; History's Revert line) and the page stays put.
- **Speed:** the Register's redraw per letter typed is about 58 ms (42 ms before); Payroll and Actuals Intake within a few ms of before.
- Pay identical on every reference week (regress and tie checks). Tests: 688 of 688 pass.
