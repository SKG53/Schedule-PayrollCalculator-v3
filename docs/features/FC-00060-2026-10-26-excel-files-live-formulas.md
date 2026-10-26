# FC-00060 — Every Excel is a math sheet: Hours from the punches, Stats and Labor Cost as formulas, real times in the Timecards

**Date:** 2026-10-26 · **Slice:** L · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. The payroll workbook gets an **Hours** sheet: one row per person per paid day with the punches as real Excel times and formulas for span, worked, break and hours. The report's **Hours** are sums of that sheet, so changing a punch time recalculates hours, pay, deposit, cash and every total.
2. The **Stats** and **Labor Cost** sheets are formulas: totals, percents, averages, costs, $ / hour and variance.
3. The **Timecards Excel** holds real dates and times (they print as before and re-import the same) and a **Punched Hours** formula per row.

## Why
The owner: "Make sure any outputted excels actually have formulas and not just text numbers. if i change values in that excel, numbers should update dynamically. it's just a math sheet ultimately."

Checked on the real files: pay, deposit, cash, final and diff were formulas (FC-00033), but Hours were typed-in numbers, the Hours / Rounded Final / Diff subtotals were blank, the Stats and Labor Cost sheets had no formulas (and some minutes were text), and the Timecards Excel stored every date and time as text with no hours.

## Where in UI
Exported files only.

## Touches
exports

## Risk
Medium. The files change shape (a new sheet; Stats laid out one number per column). Pay figures are the same, and every formula is checked to give the tool's own number.

## Reversibility
Fully reversible via one revert of the FC-00054–61 commit.

## Definition of Done
1. **Hours sheet:** Entity, Employee, Date, Day; per punch pair In, Out (Excel times) and "+1" (the pair starts the next calendar day: overnight chains); Break min (min) (the entity minimum) and Break set (min) (a per-day override); Span, Worked, Break, Hours as formulas: Break = Break set if given (capped at the span), else the larger of the minimum and the gap; Hours = Span − Break. Only paid punches appear (approved rows, after your edits replaced overlapping card readings, inside the pay week, people not ignored).
2. **Report Hours** = `ROUND(SUM('Hours'!<that person's days>),2)`; flat people and people with no punches keep their values.
3. **Stats sheet:** Employee, Rate, Expected, Worked, Worked %, Days worked (scheduled), Late days, Late %, Late >5 min days, Late min, Avg late, Early days, Early min, Avg early, Early max, Early cost, Stayed-late days, Stayed-late min, Stayed-late cost, Break expected, Break actual, Over 40 h, Other hours days, Missed days. Percents, averages, costs and Over 40 h are formulas; the entity total row sums, takes the max, counts people over 40.
4. **Labor Cost sheet:** day values as allocated; Week = SUM of the days; a "Hours (hourly people)" row; $ / hour = actual ÷ hourly hours; Variance = actual − scheduled; Labor cost this week = cost + flat + semi-monthly lines. The hour-of-day grid stays values.
5. **Timecards Excel:** Date a real date (`yyyy-mm-dd`), times real times (`h:mm AM/PM`), Punched Hours = sum of the row's pairs (over midnight included). Old files (text times) still import; new files import with real SheetJS exactly as written.
6. **Every formula in every workbook equals the tool's cached value**, and does again when recalculated from scratch.

## Built
- `_writeHoursDetailSheet(ewb,data)` returns each person's range; `_exportExcel('combined')` writes the Hours formulas into the report.
- `_writeStatsSheet` with `STATS_XL_HEADERS`; `_writeLaborCostSheet` formulas; `_writeActualsIntakeSheet` real values and the Punched Hours formula; `_isoToExcelDate`.
- Early and stayed-late costs round half-up to the cent (`_r2half`) so the screen and the sheet agree.

## Verification
- `npm test`: all pass; `tests/fc00060_live_formulas.test.js` (5 tests) and the FC-00033 tests now follow formulas across sheets (`tests/xl-helpers.js` evaluator), including "move a clock-out one hour → the grand total moves by one hour of pay".
- Eight real weeks: zero formula mismatches in any sheet; Timecards text identical as printed.
- LibreOffice: a real week's workbooks (combined, one entity, Timecards) with every stored result removed, recalculated: 1,760 formulas, all equal to the tool.

## Out of scope
- Re-deciding in Excel which punch wins when an edit overlaps a card reading (the tool decides; the Hours sheet holds the paid punches).
- Formulas for the hour-of-day grid.

## Assumptions
- A punch typed into an empty pair column of the Hours sheet is not counted (each row's formulas cover the pairs it was written with).

## Open questions
None.

## Tests
`tests/fc00060_live_formulas.test.js`:
- `test_every_formula_in_the_payroll_workbook_agrees`
- `test_hours_sheet_follows_the_day_rule`
- `test_changing_the_break_minimum_recalculates`
- `test_stats_and_labor_cost_are_formulas`
- `test_timecards_excel_real_times_and_hours`

## Slice
L — sub-slices: Hours sheet; Stats; Labor Cost; Timecards.

## Affected entities
All
