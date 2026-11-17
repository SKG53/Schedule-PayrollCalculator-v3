# FC-00080 — Payroll report redesign: entity blocks, Employees and Management, easier to read

**Date:** 2026-11-17 · **Slice:** M · **Risk:** Medium · **Status:** drafting · **Affected entities:** All
**Depends on:** FC-00077 (column picker), FC-00078 (Management tick, employment type), FC-00079 (Bonus)
**Reference:** the owner-reviewed sample `Payroll_1108to1114_SAMPLE_v5.pdf` (2026-11-16)

## What
1. **Top of the page:** "COMBINED PAYROLL REPORT — PERIOD 11/08/26 – 11/14/26", then one line: "Deposit paid Thu 11/19/26 | Cash and Check paid Fri 11/20/26".
2. **One block per entity.** The entity name is centered in a solid band of a darker shade of the entity's color, in white letters. There is no Entity column on the rows.
3. **Two groups in each entity:**
   - **EMPLOYEES** and **MANAGEMENT**, each heading centered with a colored rule under it.
   - A group with nobody in it this week is left out.
   - Management comes from the assignment's Management tick (FC-00078).
4. **Totals:** Employees subtotal, Management subtotal, then **ENTITY TOTAL** (both groups together). **GRAND TOTAL — ALL ENTITIES** comes at the end.
5. **Columns, in order:** Employee, Type, Method, Hours, Over time, Rate, Bonus, Total, Deposit, Check, Cash. The column picker (FC-00077) still chooses and orders them. Entity stays in the pool, unticked. Type and Bonus join the pool.
6. **Hours and Over time:** Hours is straight-time hours. Over time is a Deposit person's hours over 40, paid at 1.5×, so Hours + Over time = hours worked. (Today, Hours is the total worked.)
7. **Row order in each group:** Cash, then Contract Check, then Deposit + Cash, then Deposit. People without an employment type come first, without breaking up those with one.
8. **People paid $0 in the run are not printed.**
9. **Look:**
   - Each entity's rows share one light fill of its color, with no alternating stripes.
   - Horizontal lines only, bold names, and a rule before Total.
   - Blank cells instead of "—".
   - Subtotal rows light grey; entity total darker, between heavy rules; grand total a black band.
   - **Cash** is one highlighter-yellow column for every entity (darker yellow on subtotals and totals), so it never clashes with an entity color.
   - 10.5 pt type on landscape Letter.
10. **Pages:** each entity's block is kept on one page. A block bigger than a page carries on with the column headings repeated.
11. **Files:**
    - The PDF prints as designed, so it no longer needs printing again from Excel.
    - The Excel has the same structure and colors, with live formulas; subtotals and totals are SUMs of their rows.
    - The on-screen preview and each entity's own report look the same.

## Why
The owner, 2026-11-16: "the file needs to very easily and clearly explain to whoever is reading it who is getting paid by what method, how much did they work, what was their rate, what is the total, what is the cash amount, and what is the deposit amount. and the totals by entity." "within each entity I think we need to have two big groups… employees… management… totals for the entire employee set as well as the entire management set… totals with both of those added together by entity." "I don't think we need the entity listed on each and every row." "the export needs a title… a period… the pay dates and the deposit dates… grand total." "I like the color groupings we had before… the cash column [needs] a color that doesn't clash." "The entity name and the headings for the different sections need to be centered." "you're missing employment type as a column… overtime hours." "the deposit plus cash and the deposit people should be the last group… the contract check should come above that."

## Where in UI
The Payroll tab's export preview, and the Exports panel's Payroll report card (combined and per entity).

## Touches
exports, display, column picker

## Risk
Medium: every printed and exported payroll report changes layout. Money and totals must not change: Total, Deposit, Check and Cash are checked on all real weeks, base against new.

## Reversibility
One revert commit.

## Definition of Done
1. This week's report matches the sample's layout, with real Management ticks.
2. Every subtotal, entity total and the grand total equals the sum of its rows. The Excel recalculates in LibreOffice with no mismatches.
3. Pay, Deposit, Check and Cash are unchanged per person on all real weeks.
4. The PDF prints without cut-off columns, each entity block on one page.
5. Unticking or moving columns in the picker still works with the groups.

## Out of scope
- The accountant file (FC-00081).
- The Timecards Excel, and the Hours, Stats and Labor Cost sheets.

## Assumptions
- Hours as in 6. The accountant file uses the same split (Regular and Overtime Hours).
- The Over time and Bonus columns stay ticked even in weeks when they are empty.

## Open questions
1. One entity per page (as the sample: three pages), or let entities run on to save paper? Default: one per page.

## Tests
`tests/fc00080_report_redesign.test.js`: groups and totals; row order; $0 rows left out; Hours/Over time split; colors (cash fill the same for every entity); PDF and Excel headings and totals; picker with groups; regress of pay per person.

## Slice
M

## Affected entities
All
