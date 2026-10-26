# FC-00065 — Payroll report: no H:MM column; money with commas; subtotal labels not cut off

**Date:** 2026-10-26 · **Slice:** S · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. The payroll report (combined and per entity; Excel, PDF and the export preview) no longer has the H:MM column. Columns: Entity, Employee, Method, Hours, Rate, Actual Total, Deposit, Cash, Rounded Final, Diff (the layout before FC-00059). Hours in h:mm stay on screen and on the Hours sheet.
2. Money in the tool's PDF and preview reads like Excel: **$1,234.56** (thousands commas), **-$0.17** and **+$0.13** (sign before the dollar sign). The screens use the same text (Payroll Calculation table, Weekly Actuals cost view, Labor Cost, Stats, History, week-over-week); cash stays whole dollars ($1,234).
3. Subtotal and grand-total labels in the Excel report span the label columns, so "NIRVANA 11TH subtotal" prints in full.
4. An editable copy (FC-00024) saved in a snapshot while the report had the H:MM column loses that column on load, so its money columns land in place.

## Why
The owner: "the column you created on this report for H:MM - i don't want that on this report. I hid it when i exported the comprehensive report." On the PDF's money without thousands commas and with the sign after the dollar sign: "yes those commas improve legibility, they are necessary". The cut-off subtotal label showed on the Oct 18–24 report printed from Excel.

## Where in UI
Exports panel → Payroll reports (Excel, PDF); export preview; editable copy.

## Touches
export

## Risk
Medium. Column positions in the report change back; every formula is rebuilt from the column names and checked by the formula tests and a LibreOffice recalculation.

## Reversibility
Fully reversible via one revert of the FC-00062–65 commit.

## Definition of Done
1. No H:MM column in any payroll report file or preview; every formula recalculates to the tool's value (cached = recalculated).
2. PDF, preview and screen money text: `$#,##0.00` with sign first for negatives and signed diffs.
3. Excel subtotal / grand-total rows: the label cell spans Entity–Method.
4. Pay unchanged on the real weeks.

## Built
- `COMBINED_HEADERS`, `COMBINED_COLS`, `COMBINED_XL_WIDTHS` without H:MM; `_fmtUsd` used by `xlMoney` / `xlMoneySigned` text; label merge in the payroll writer; `_fc24Upgrade` normalizes old copies to the current columns.

## Verification
- `npm test`; LibreOffice recalculation from scratch of a real week's combined and per-entity reports: 0 mismatches; the tool's PDF is one page, without H:MM, money with commas and the sign first, total labels on one line; pay identical to live v3 on 5 real weeks.

## Out of scope
- The Hours sheet keeps its h:mm durations (it is the punch-by-punch sheet, not the report).

## Assumptions
- "This report" means the payroll report in every form (combined and per entity, Excel and PDF).

## Open questions
None.

## Tests
`tests/fc00065_report_columns_money.test.js`:
- `test_no_hmm_column_in_excel_pdf_preview`
- `test_money_text_has_commas_and_sign_first`
- `test_total_labels_span_the_label_columns`
- `test_pay_unchanged_by_the_column_change`
- `test_screen_money_reads_like_the_files`

## Slice
S

## Affected entities
All
