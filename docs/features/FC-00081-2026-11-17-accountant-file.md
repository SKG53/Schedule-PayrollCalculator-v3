# FC-00081 — New accountant file: deposit people only, in our report's layout

**Date:** 2026-11-17 · **Slice:** M · **Risk:** Medium · **Status:** done · **Affected entities:** All
**Depends on:** FC-00078 (register, employment type, Management), FC-00079 (bonuses), FC-00080 (layout)
**Replaces:** FC-00074's file in the accountant's layout and FC-00075's loading of the accountant's file

## What
1. **Who is on it:** only people paid by deposit, meaning Deposit, Deposit + Cash, and salaried people paid by deposit (Management or not). Cash-only and Contract Check people are left off.
2. **Top of the page:** "ACCOUNTANT PAYROLL — PERIOD 11/08/26 – 11/14/26" and the deposit pay date.
3. **Layout:** the same as the payroll report (FC-00080). There is a centered band for each entity in its color, EMPLOYEES and MANAGEMENT groups with subtotals, an entity total, and a grand total. There are no employee IDs, and no columns for cash or checks.
4. **Columns:** Employee, Employment Type, Regular Hours, Overtime Hours, Rate, Salary, Bonus, Gross Total, Notes.
   - Employee is the person's accountant name if one is set, otherwise their name.
5. **Values by kind of row:**

   | Row | Regular Hours | Overtime Hours | Rate | Salary | Bonus | Gross Total |
   |---|---|---|---|---|---|---|
   | Deposit, hourly | up to 40 | over 40 | hourly rate | blank | deposit bonuses | Regular × Rate + Overtime × Rate × 1.5 + Bonus |
   | Deposit + Cash | blank | blank | blank | the set deposit amount | deposit bonuses | Salary + Bonus |
   | Salaried by deposit | blank | blank | blank | the weekly salary | deposit bonuses | Salary + Bonus |

   Bonuses paid in cash or by check are not on this file.
6. **Notes:** the person's standing note (FC-00078, e.g. a garnishment line), plus any note typed for this week.
7. **Ties out:** each entity's Gross Total equals the payroll report's Deposit total for that entity, to the cent. The tool shows this check when the file is made; it is not printed on the file.
8. **Downloads:** Excel and PDF, from the Exports panel's Accountant file card.
9. **Retired:** the file in the accountant's layout, "Load the accountant's file…", name matching, and the accountant-sections setting. The deposit pay date is typed by the owner, with the existing warning.

## Why
The owner, 2026-11-16: "we don't actually need to use their excel file at all… we can generate our own Excel file and just provide it to them": Name, employment type, Hours (regular and overtime "two separate columns… only relevant for deposit Employees"), Rates, "If hours and rates are not relevant then salary amount", Total ("a gross total that calculates both of those columns"), Notes, Bonus. "Those deposit plus cash people are a salaried amount." "The accountant only needs to see one isolated export that has only the deposit people… the information going to the accountant is a subset of the information that we see overall." "the accountant is simply reading this information. at the top of the accountant file should also be the pay [period] and the paid date. as well as the entity names separated out… the same layout that we have now, with the same colors."

## Where in UI
The Exports panel's Accountant file card. The accountant panel's loading and matching are removed.

## Touches
exports, pay dates, accountant fields

## Risk
Medium: this is the file the accountant pays from. The tie-out to the report's Deposit column (7) is the guard.

## Reversibility
One revert commit restores the accountant-layout file and loading.

## Definition of Done
1. This week's file lists only deposit people, by entity and group, with the columns in 4.
2. Each entity's Gross Total ties to the report's Deposit total to the cent, and the grand total too.
3. An hourly Deposit person over 40 hours shows Regular 40, Overtime the rest, and the right Gross Total, checked by hand.
4. Deposit + Cash people show their set deposit as Salary; their cash appears nowhere.
5. Excel and PDF match each other; the Excel recalculates with no mismatches.

## Out of scope
- Combining a person's hours across entities for overtime (see FC-00078 open question 2).
- Sending the file to the accountant (the owner uploads it).

## Assumptions
- One file covering every entity, a block per entity, as with the payroll report.
- A one-off note typed on the Payroll tab for the week shows in Notes alongside the standing note.

## Open questions
None.

## Tests
`tests/fc00081_accountant_file.test.js`: who is on the file; columns and values for each kind of row; overtime split; bonus by pays-by; tie-out to Deposit; Excel formulas; PDF; removed loading code paths.

## Slice
M

## Affected entities
All

## As built (2026-11-17)
- **Top:** "ACCOUNTANT PAYROLL — PERIOD 11/08/26 – 11/14/26", then "Deposit paid Thu 11/19/26".
- **Who:** Deposit, Deposit + Cash and salaried-by-deposit people ticked Active, plus anyone else with a bonus paid by deposit (on the file for that bonus only).
- **Employment Type** prints blank when not set; the Exports card names who is missing it.
- **Notes:** the standing note (prints every week) and "This week's note", typed on the Exports panel's accountant table. The week note is kept with the run (Undo, History, snapshot), not in the register.
- **Gross Total** in the Excel is a live formula: hourly `ROUND(ROUND((Regular + 1.5 × Overtime) × Rate,2) + Bonus,2)`, salaried `ROUND(Salary + Bonus,2)`. Subtotals, entity totals and the grand total are SUMs.
- **The check:** the Exports panel shows each entity's Gross Total against the payroll report's Deposit (✓ or ⚠); a mismatch also shows on the card.
- **Card:** Excel ticked in the batch by default; PDF available, not ticked by default.
- **Retired:** the file in the accountant's layout, loading and matching the accountant's file, and the "Accountant file · sections" setting. The Accountant Section column stays in the register but is no longer used. An older snapshot that carries a loaded accountant file opens without it.
- All six real weeks: every entity's Gross Total ties to Deposit, and the Excel formulas agree (also recalculated in LibreOffice).
