# FC-00061 — Money rounds like Excel, so the tool, its PDF and its Excel always agree

**Date:** 2026-10-26 · **Slice:** S · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
Pay, deposit and cash round the way Excel's ROUND does (half away from zero on the decimal value). A half cent is no longer lost to how the computer stores decimals.

## Why
Found while checking FC-00060 against a real week: one person's hours × rate came to an exact half cent. The tool stored it as …49999…, rounded **down**, and its screen said one cent less in Actual and **one dollar less in cash** than the Excel it wrote, which Excel recalculates on open. The owner's final file for that week (saved from Excel) has Excel's figure. With the tool's own PDF now used directly (FC-00050), the PDF and the Excel would have disagreed by a dollar.

Example (invented): 10.03 h × $16.50 = $165.495 → before $165.49, cash $165; Excel and now the tool $165.50, cash $166.

## Where in UI
Payroll Calculation figures, every payroll export, Labor Cost / cost view (they use the paid Actual).

## Touches
calculation, exports

## Risk
Medium: a pay calculation changes, by one cent (and so possibly one cash dollar) only when hours × rate lands exactly on a half cent. Every such case now equals the Excel the tool already wrote.

## Reversibility
Fully reversible via one revert of the FC-00054–61 commit.

## Definition of Done
1. `roundDeposit`, `roundCash`, hours × rate (`row.pay`) and the Deposit + Cash split use `_xround` (decimal half away from zero, 15 significant digits, as Excel).
2. A half-cent product rounds up; everything else is unchanged.
3. The real weeks: pay identical to before on every row, except exact half cents, which now equal the owner's final Excel files.
4. Every formula in the workbook equals the tool's figure (FC-00060).

## Built
- `_xround(x,d)`; `roundCash`, `roundDeposit`, `_computeBothBreakdown`, `computePayrollForEntity` (both pay lines) use it.

## Verification
- `npm test`: all pass; `tests/fc00061_money_rounds_like_excel.test.js` (2 tests).
- Eight real weeks: no row changed; the two weeks with saved snapshots now match the owner's final payroll files on every row with a rate (the half-cent row was the only difference before).
- LibreOffice recalculation of a real week's workbook matches the tool on all 1,760 formulas (12 mismatches before this card).

## Out of scope
- Whole-dollar cash rules (unchanged; only how a half is rounded).

## Assumptions
- Excel's ROUND is the reference, because the owner's final files are Excel's.

## Open questions
None.

## Tests
`tests/fc00061_money_rounds_like_excel.test.js`:
- `test_half_cent_rounds_up_like_excel`
- `test_rounding_helper`

## Slice
S

## Affected entities
All
