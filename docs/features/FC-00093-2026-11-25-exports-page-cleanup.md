# FC-00093 — Exports page: simpler accountant card, Refresh on every card, aligned layout, editable file names

**Date:** 2026-11-25 · **Slice:** M · **Risk:** Low · **Status:** approved · **Affected entities:** All

## What
1. **Accountant file card, simpler.**
   - No pay date pickers on the card. The Deposit and the Cash and Contract Check pay dates are set in one place: a "Pay dates" bar at the top of the Payroll tab (same warning before a change, same storage, same Undo and History as FC-00073).
   - No "Notes for the accountant this week" section. Standing notes per person stay; they come from the Employee Register.
   - No list of individual checks. The card shows the same single status as every other card: "✓ Ready", or "⚠ Not ready: <one short reason>" (for example "Not ready: 2 deposit people have no employment type — fix on the Employee Register"). More than one reason: the rest fold under "N more".
   - What stops the file being written (`acctBlockers`, the self-check) is unchanged. Only how it is shown changes.
2. **One source of truth for pay dates.** The payroll report, the accountant file and the report's Pay Date column all read the same dates and print a date that is not set the same way: "(date not set)". The payroll report cards also say "Deposit pay date not set — set it on the Payroll tab" when someone in the report is paid by deposit and the date is missing (a warning only; it never stops a download).
3. **Refresh on every card.** A "Refresh" button rebuilds that card from the tool's current data (the list of cards, its file name, its status) without reloading the page, and says what it found.
4. **Aligned layout.** Every card has the same rows in the same order: heading, one-line description, options (only where the card has some), file name, buttons, in batch, status. A CSS grid lines each row up across the cards on a line, so headings, text, file names and buttons sit at the same height.
5. **Editable file names.** Every card has a text box with its file name, filled with the standard name (`downloadFileNames` / `_fileStem`, and FC-00090's `_stemFileName` names for the Employee Register and Tool Settings). The extension is shown after the box and cannot be changed. An edit is for that week only (kept with the run's week in the tool's state and in the snapshot, not in either settings file); "Reset" returns to the standard name. The card's buttons, Download batch (files and zip) and the Employee Register tab's own buttons use the edited name.
6. **Plain descriptions.** Each card's description is short and in the same order: what the file is · who it is for · when it is ready.

## Why
The owner, 2026-11-25: "The accountant file export card doesn't need deposit pay date and the other pay date selectable down there. should be in other parts of the tool already. Does not need notes for accountant section either. Don't need all the individual checks either. Just ready like all the others." and "I think all the exports need a 'Refresh' button to make sure they can be refreshed if tool changes are made. Sometimes they are not ready. Also, they should be aligned properly. All the headings, all the paragraph text, All the file names (which should be editable but with defaults), all the buttons, etc. Also the paragraph text can be organized better?"

Also found on 2026-11-25: the payroll report said "Deposit paid (date not set)" while the accountant file said "Deposit paid Fri 11/27/26". Both files read the same stored date at the moment they are written, so the report was almost certainly written before the date was set on the accountant card, and nothing on the report's card said so.

## Where in UI
Payroll tab (new Pay dates bar at the top); Exports panel (every card).

## Touches
`_syncDownloads`, `_downloadsHtmlInner`, `downloadFileNames`, `_buildFilesNow`, `_stemFileName`, `downloadStatus`, `_acctStatusReasons`, `_acctCardHtml`, `acctBlockers` (wording only), `payDates` consumers (`_payDatesLine`, `_acctDatesLine`, `_rowPayDateText`), `setPayDateByHand`, `renderPayrollEntityContent`, `_toolSettingLabel`.

## Risk
Low. Pay is not involved. The accountant file's blocking rules are unchanged. File names change only when the owner types one.

## Reversibility
One revert commit. Edited names are tool-state keys (`fileName:<card>|<week>`) that an older tool ignores.

## Definition of Done
1. The accountant card has no date inputs, no notes section and no list of checks; it shows one Ready / Not ready line.
2. The Payroll tab sets both pay dates (with the warning); the payroll report and the accountant file print the same dates, and the same words when one is not set.
3. Every card has a Refresh button that rebuilds its file name and status from current data.
4. Every card has the same rows in the same order, lined up by a CSS grid.
5. Every card's file name is editable with the default prefilled; the edit is used by the card and by Download batch; Reset restores the default; the edit belongs to the week and is in the snapshot.
6. Pay is identical (real-data regression and tie-out).

## Out of scope
- Changing what blocks the accountant file, or what any status checks.
- Editing the zip's own name.

## Assumptions
- "Set elsewhere" means the Payroll tab: the dates were only on the Accountant file card, so they move to a bar at the top of the Payroll tab.
- A week note set earlier (an older snapshot) still prints on the accountant file; it can no longer be added on the card.
- "Ready like all the others": every card's status becomes "✓ Ready" or "⚠ Not ready: <first reason>", with the rest folded underneath.

## Open questions
None.

**Approved:** the owner, 2026-11-25: "Build all of them".

## Tests
`tests/fc00093_exports_page_cleanup.test.js`.
