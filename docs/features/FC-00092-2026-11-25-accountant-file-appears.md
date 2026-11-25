# FC-00092 — Choose who appears on the accountant file: Auto, Always or Never

**Date:** 2026-11-25 · **Slice:** S/M · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
A new per-person setting on the Employee Register: **On accountant file: Auto / Always / Never**.

1. **Auto** (the default, and what every person has today): the person is on the accountant file when they are paid by deposit this week, exactly as now. Nothing changes for anyone left on Auto.
2. **Always**: the person is on the accountant file even when their deposit this week is $0, with their Accountant Name, Employment Type and Standing Note, at $0.00, in the section of their Deposit Entity. This covers:
   - someone paid without a schedule who is ticked "Not paid this week" (FC-00084);
   - an hourly person with no hours this week (not on the schedule, no punches);
   - someone paid only in cash, or inactive (a former employee the accountant still lists).
   Example: Nora Ntest, Flat $480 by deposit at Beta Test, ticked "Not paid this week", set to Always: the accountant file lists her under BETA TEST at Gross Total $0.00. A person who already has a line is not listed twice.
3. **Never**: the person is never on the accountant file, even with a deposit. The Accountant file card's check says so plainly instead of failing, for example "✓ Alpha Test: Gross Total $X matches this week's payroll deposits $Y, less $Z not on the accountant file (Never: Zed Ztest)".
4. **One value per person**, kept on every entity record of the person, like Accountant Name, Employment Type and Standing Note. A dropdown on the person's main row of the Employee Register tab. Changes go through History and Undo ("On accountant file").
5. **The Employee Register file** keeps it in a new column, **On Accountant File**, added at the end of the Payroll Settings sheet (blank = Auto). An older register without the column loads as Auto. The Snapshot keeps it with the person.
6. **The accountant file** (Excel and PDF) honors it; the subtotals and totals include the $0 lines (their amounts are $0, so the totals do not change).
7. **The export preview** gets an "Accountant file" choice in its Show dropdown, so the file can be checked on screen before it is written, with a line naming anyone left off by Never.
8. **The payroll report and pay are unchanged.**

## Why
A person ticked "Not paid this week" (FC-00084), or anyone else with a $0 deposit, drops off the accountant file. The owner needs some $0 people listed: one is temporarily not paid and must still appear at $0, and a former employee was listed at $0 last week. The owner, 2026-11-25: "We might need a toggle for 'Appears' or not on the various files, right?"

## Where in UI
- Employee Register tab: a new "On accountant file" column on each person's main row (Auto / Always / Never).
- Exports: the Accountant file card's check; the export preview's Show dropdown ("Accountant file").

## Touches
`_acctData`, `_acctLine` (unchanged for Auto), `_acctSpec`, `acctTieOut`, `_acctCardHtml`, the export preview (`_fc13PreviewModel`, `renderFc00013PreviewPanel`), `setPersonField` / `PERSON_FIELDS`, `_applyRecordMirror`, `PAYROLL_SETTINGS_HEADERS`, `_gatherPayrollSettingsRows`, `_ingestPayrollSettings`, `registerRows`, `registerPeople`, `renderRegister`, History labels, the settings-import preview fields.

## Risk
Low. Pay is not involved. Auto (everyone today) gives the same file as before.

## Reversibility
One revert commit. A register saved with the new column still loads in the older tool (an unknown column is ignored).

## Definition of Done
1. Auto: the accountant file is exactly as before.
2. Always: a flat person ticked "Not paid this week" and an hourly person with no hours appear at $0.00, with their name, type and note, in their Deposit Entity's section; nobody appears twice; totals unchanged.
3. Never: a deposit person is left off; the card's check shows the excluded deposit and does not fail.
4. The setting round-trips through the register Excel; an older register without the column loads as Auto.
5. Pay identical on the real weeks; the browser shows the real week's not-paid flat person at $0.00 with Always.

## Out of scope
The same choice for other files (the payroll report, cash, deposit-only); a per-week override.

## Assumptions
- Always adds a $0 line only when the person has no line on the file already (one line per person).
- The $0 line goes to the Deposit Entity of the person's first active entity record (the first record when none is active).
- Never lists the person's deposit on the card only; nothing about it is printed on the file.

## Open questions
None.

**Approved:** the owner, 2026-11-25: "Build all of them".

## Tests
`tests/fc00092_accountant_file_appears.test.js`.

## As built (2026-11-25)
- Record field `acct_file` ('Always' or 'Never'; Auto = no value), written to every record of the person by `setPersonField` (one Undo step, History "On accountant file"). `linkSamePerson` and ticking a new entity carry it. The register's main row has the dropdown after Type; Always also shows the Accountant Name box for someone not paid by deposit.
- `_acctData()`: Never people are left out and their would-be lines kept in `data.never`; an Always person with no line gets one $0 line (from their row this week, or from their record when they are not in this week's payroll, the first active record first) in their Deposit Entity's section. Auto goes through the unchanged `_acctLine`.
- The $0 line's Gross Total is written as $0.00 (Excel format `$#,##0.00`, formula `ROUND(Salary+Bonus,2)`), the rest blank; subtotals and totals are unchanged; the file's own check passes.
- `acctTieOut` lists every Deposit Entity with a line or a Never deposit; the card says "✓ ENTITY: Gross Total $G matches this week's payroll deposits $P, less $N not on the accountant file (Never: names)".
- Export preview: Show "Accountant file" draws the file from `_acctSpec` and `_reportModel` (no column chips, no editable copy) with a line naming anyone left off by Never.
- Register file: On Accountant File is the last Payroll Settings column; an older file without it leaves everyone on Auto. The People sheet, PDF and CSV of the register are unchanged.
- **Checked in the browser on the real Nov 15–21 snapshot (private):** the one flat person paid without a schedule and ticked "Not paid this week" was off the file; set to Always on the register, he appears in his Deposit Entity's Management section at $0.00 with his accountant name, type and note. The deposit, cash and contract check totals and the accountant file's Gross Total are the same before and after (and equal the expected figures for that week); check and tie-out pass; 41 TNG IDs. Never on a deposit person: the card names the excluded deposit and every line is ✓. Excel and PDF written. No page errors.
- Real-data regression: pay identical on 6 weeks (0 differences); accountant formulas and tie-out all good.
- Tests: 672 of 672 pass (7 new; header offsets moved in the FC-00073, FC-00078 and FC-00086 tests).
