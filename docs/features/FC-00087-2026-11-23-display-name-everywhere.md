# FC-00087 — Display Name everywhere

**Date:** 2026-11-23 · **Slice:** M · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
Each person gets one **Display Name** (set on the Employee Register by FC-00086, one per person, the same at every entity). The tool shows it wherever a person's name is shown. Matching does not change.

1. **One helper.** `displayNameOf(entId, name)` gives the person's Display Name when one is set, else exactly the name shown today. It finds the person the way pay does (own name, former name, alias, unique first name) and never creates an ID.
2. **Shown on screens:**
   - Payroll tab: the summary cards, the Weekly Actuals grid, the Time Card Data and Payroll Calculation tables, the short-week panel, the one-rate panel, the bonus panel, the out-of-week notice, the Stats table and the Labor Cost lines.
   - Actuals Intake: each person's tab, the person's heading and the approve buttons; the "not approved" check before an export.
   - Week over week.
3. **Printed on files:**
   - The payroll report (preview, Excel and PDF), every per-entity report, the Hours, Stats and Labor Cost sheets and the manager report. A Display Name prints exactly as typed, whatever the "Names on exports" setting; people without one print as the setting says, as today.
4. **Not changed:**
   - The accountant file: Accountant Name, else the saved name, as today.
   - The Employee Register tab and the register file (FC-00086).
   - The schedule tab's own names.
   - The reviewed-timecards file (Excel and its PDF record), the settings file and the snapshot's data: they keep the name the tool matches by.
   - Warnings that ask the owner to fix something ("Rate missing: …") keep the matching name, so the person can be found.
5. **Keys unchanged.** IDs, `wKey`, aliases, former names and every file lookup ignore the Display Name. Renaming from a name cell still renames the matching name.
6. **Nobody has a Display Name:** every screen and file is the same as today.

## Why
The owner, 2026-11-23: "Yes Display Name should cover every entity / Yes to the other / Accountant Name is only for the Accountant file". Earlier the same day: "I also want a Display Name field. Full Name, Display Name, Accountant Name (which is only relevant for those marked Deposit or Deposit + Cash".

## Where in UI
Payroll tab, Actuals Intake, Exports (payroll report, per-entity reports), week over week.

## Touches
Name display on the Payroll tab, Actuals Intake and week over week; the export name formatter (`_makeNameFormatter`); the Labor Cost sheet's lines. Read-only use of `rec.display_name` (written by FC-00086).

## Risk
Low. Display only. The guards: with no Display Name every file is cell-for-cell the same; pay, keys, the accountant file and the files the tool reads back do not change when one is set.

## Reversibility
One revert commit. The Display Name stays on the records (FC-00086) and simply stops showing.

## Definition of Done
1. With a Display Name set, it shows on every screen and file listed in What 2–3, at every entity of that person.
2. With none set, every screen and file is identical to today.
3. Pay, IDs, keys, the accountant file and the reviewed-timecards file are unchanged when one is set; that file re-imports and matches the same person.
4. The snapshot reopens with the Display Names.
5. Real data: pay identical on all real weeks; the Nov 8–14 snapshot's payroll report is identical with no Display Names, and shows two set ones with pay and the accountant file unchanged.

## Out of scope
- Setting the Display Name (FC-00086, Register tab).
- Matching timecards or schedules by the Display Name.

## Assumptions
- A Display Name is printed as typed on every export, not upper-cased or shortened by the "Names on exports" setting (FIRST LAST would turn "Cora C" back into "CORA C").
- A record of the person without its own copy of the Display Name uses the one on another record with the same TNG ID.
- The click-to-rename name cell shows the Display Name; its tooltip names the matching name, and renaming changes the matching name.

## Open questions
None.

**Approved:** the owner, 2026-11-23: "Yes build everythign as fast as possible".

## Tests
`tests/fc00087_display_name_everywhere.test.js`:
- the helper (set, blank, unknown, another case, another record of the same person);
- no Display Names: payroll report Excel and PDF identical;
- with one: report Excel shows it, every other cell the same, pay and keys unchanged; printed as typed under every name setting; PDF;
- accountant file unchanged;
- screens: name cells keep the matching name for renaming, summary cards, grid and tables, Stats, short week, rate and bonus panels, the out-of-week notice;
- Actuals Intake tabs show it and keep the key; the reviewed-timecards Excel keeps the matching name and re-imports to the same person;
- snapshot keeps it.

## As built (2026-11-23)
- **Helpers:** `displayNameForRecord(rec)` and `displayNameOf(entId, name, fallback)` next to `_savedNameFor`. A blank or spaces-only value counts as not set.
- **Exports:** `_makeNameFormatter(key, namesByEnt)` returns the Display Name as typed when set, else what `_makeSavedNameFormatter` (the FC-00045 formatter, body unchanged) prints. This covers the payroll report screen preview, Excel and PDF, every per-entity report, the manager report and the Hours and Stats sheets. The Labor Cost sheet's Outside / Flat / Semi-monthly lines use `displayNameOf`.
- **Screens:**
  - `inlineEditableNameHtml` shows it on the Payroll tab (Weekly Actuals, Time Card Data, Payroll Calculation) and Actuals Intake; the schedule screen keeps its text. `data-name` keeps the matching name, so renaming and every click action use it; the tooltip adds "matches timecards as <name>" when the two differ.
  - Payroll summary cards (`renderPayrollInfoChips` now takes the entity id; looks the person up by the schedule name when there is one), Stats table, Labor Cost lines, short-week panel, one-rate panel, bonus panel, the out-of-week notice, the "not approved" check before an export, Actuals Intake person tabs, heading and approve buttons, week over week.
- **Left as they are:** the accountant file; the Register tab and register file; the schedule tab; the reviewed-timecards Excel and its PDF record (both carry the matching name the tool reads back); warnings that ask for a fix ("Rate missing", "Active unchecked with hours", semi-monthly notes).
- **Checked on the real data (private, not committed):**
  - six real weeks: pay identical to the base build, snapshot reopen exact, report and accountant formulas 0 bad, tie-out OK;
  - the Nov 8–14 snapshot with no Display Names: the payroll report Excel is cell-for-cell the base build's (4 sheets), the PDF and the preview identical, pay identical;
  - with two Display Names set: only those people's name cells changed in the report (Excel, PDF, preview), pay unchanged, the accountant file identical, the snapshot reopens with them, and the reviewed-timecards file re-imports all its rows to the same people with the same pay;
  - in the browser: the Payroll tab and the report preview show them, no page errors.
