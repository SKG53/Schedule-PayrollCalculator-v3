# FC-00082 — Bonuses dated to their week, live bonus rows, the heading on every page, a self-contained accountant file

**Date:** 2026-11-17 · **Slice:** M · **Risk:** Medium · **Status:** drafting · **Affected entities:** All

## What
1. **Each bonus is tied to its week.**
   - Every bonus carries the week it belongs to: the run's week ID, the Sunday the schedule week starts. The bonus panel shows it ("week of 11/15/26").
   - A one-off bonus counts only in its own week: Weekly with Recurring unticked, Monthly, or Specialty.
   - A recurring Weekly bonus counts from its start week on, never before.
   - **Stop** ends a recurring bonus from the week you choose. Its end week is kept, so earlier weeks still show it. **Remove** is only for a bonus entered by mistake.
   - Reprocessing an older week, or opening an older snapshot, gives that week's bonuses only.
   - The register's This Week sheet and the snapshot carry each bonus's week (and end week).
2. **A row with a bonus stays live in the payroll report's Excel.**
   - Total = the pay formula + Bonus.
   - Deposit, Cash and Check each = their usual formula + that row's bonus paid that way, written as a fixed amount inside the formula. Cash rounds as today.
   - A punch corrected on the Hours sheet moves that person's hours, Total, Deposit and Cash, as it does on every other row.
3. **The same heading on every page.**
   - Every page carries the title, the period and the pay-dates line. This covers every PDF page and every printed Excel page.
   - It applies to the payroll report, the per-entity reports and the accountant file.
   - Each page also shows "Page x of y" at the bottom.
4. **The accountant file checks out on its own.**
   - Every row reproduces from its own columns:
     - hourly: Gross Total = Regular Hours × Rate + Overtime Hours × Rate × 1.5 + Bonus;
     - salaried: Gross Total = Salary + Bonus.
   - All its totals are inside the file and are live formulas:
     - each subtotal = its rows;
     - each entity total = its subtotals;
     - the grand total = the entity totals.
   - Nothing on it refers to our payroll report, cash, checks, envelopes or any other part of our process. Notes are only what the owner types.
   - Before writing the file, the tool runs every check above. It will not write a file that does not check out; instead it names the row or total that fails.
   - Our own check against this week's payroll deposits stays on screen only. It reads "matches this week's payroll deposits" and is correct whether or not the Check column is shown on the report.

## Why
The owner, 2026-11-17:
- "make sure a bonus amount is tied to the week ID or date to prevent any wrong date confusion"
- On live bonus rows: "Urgent fix, need this"
- "All pages need the same heading and title"
- "The accountant file needs to fully check out on its own. So the totals will be self contained in the accountant file. The accountant has no visibility into my broader payroll operations or processes"

## Where in UI
- The bonus panel (week shown; Stop and Remove).
- The payroll report's Excel and PDF, and the per-entity reports.
- The accountant file (Excel and PDF) and its panel on Exports.

## Touches
bonuses, payroll report Excel and PDF, accountant file, Exports panel

## Risk
Medium. Item 2 rewrites the money formulas on bonus rows. The guard: on every real week, plus test weeks with each kind of bonus, every formula gives the tool's figure to the cent. That is checked in the test harness and recalculated in LibreOffice.

## Reversibility
One revert commit. Bonuses saved with a week stay readable by the older version.

## Definition of Done
1. A one-off bonus shows in its own week only. A recurring bonus starts at its start week and stops after its end week. An older week reprocessed with today's register gets only its own bonuses.
2. On a bonus row, changing hours on the Hours sheet changes Total, Deposit and Cash by exactly what the tool computes. All six real weeks and the bonus test weeks show 0 formula mismatches, including in LibreOffice.
3. Every page of every payroll PDF, and every printed page of its Excel, shows the same title, period and dates line. Each page is numbered.
4. Every accountant-file row reproduces by hand from its own columns, and every total sums inside the file. A deliberately broken row stops the export with a message naming it. The file contains no word about cash, checks or the report.
5. Pay unchanged on all real weeks (base against new).

## Out of scope
- Overtime for cash-paid hourly people, and combining hours across entities (the owner: later).
- The register's highest-ID guard across computers (FC-00083).

## Assumptions
- A week ID is the schedule week's start date (Sunday), as the tool already uses for the run.
- A bonus saved before this card already carries the week it was entered (FC-00079 stored it). Any bonus without one takes the week of the register that carried it.

## Open questions
None.

## Tests
`tests/fc00082_bonus_weeks_pages_acct.test.js`:
- one-off, recurring, start and stop weeks; an older week reprocessed;
- bonus-row formulas against the tool for each method and pay-by, before and after an Hours-sheet edit;
- heading on every PDF page (report, per-entity, accountant) and the Excel print header;
- accountant row and total self-checks, and a broken row blocking the export;
- no process words on the accountant file.

## Slice
M

## Affected entities
All
