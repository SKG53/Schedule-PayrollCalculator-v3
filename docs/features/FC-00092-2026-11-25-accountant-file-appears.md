# FC-00092 — Choose who appears on the accountant file: Auto, Always or Never

**Date:** 2026-11-25 · **Slice:** S/M · **Risk:** Low · **Status:** approved · **Affected entities:** All

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
