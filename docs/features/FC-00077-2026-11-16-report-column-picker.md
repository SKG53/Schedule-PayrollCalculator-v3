# FC-00077 — Choose and order the payroll report's columns on the export preview

**Date:** 2026-11-16 · **Slice:** M · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. Above the export preview's table, a row of chips shows every column the payroll report can have, in the report's order. Each chip has a checkbox (include or leave out) and can be dragged to a new place. **Reset** goes back to the standard columns and order.
2. The pool (22 columns): Entity, Employee, Method, Hours, Over time, Rate, Actual Total, Deposit, Contract Check, Cash, Rounded Final, Diff, and ten more the tool already works out: Mode (Hourly / Flat / Semi-monthly), H:MM, Break, Scheduled Hours, Hours vs Schedule, Avg In vs Schedule, Avg Out vs Schedule (minutes, + = late), Accountant Name, Employment Type, Pay Date (the deposit date, the cash date, or both for Deposit + Cash).
3. Default: the ten standard columns ticked in today's order; Rounded Final, Diff and the ten new ones unticked. Employee is always on.
4. The preview, the PDF and the Excel show exactly the ticked columns, in the chips' order. The combined report and each entity's report use the same columns.
5. **Excel formulas keep working.** A column a ticked formula reads is written too, as a hidden column: Hours, Over time and Rate for Actual Total; Actual Total for Deposit, Contract Check and Cash; Deposit and Cash for Rounded Final; Rounded Final and Actual Total for Diff; Hours for H:MM; Hours and Scheduled Hours for Hours vs Schedule. The chip bar names the columns that will be hidden in the Excel. The PDF leaves them out.
6. **Contract Check** shows whenever it is ticked (before: only when someone on the report was paid that way). Left out, a contract check is counted under Deposit, the same in the preview, the PDF and the Excel.
7. Subtotal and total labels sit in the first ticked column that has no total (Employee at the latest) and span to the next total column.
8. The choice is one Tool Setting, "Payroll report · Columns", saved in the settings file as words a person can read and edit: every column in order, a left-out one marked "(off)". Unticked columns keep their place. Every change is one History line and undoable; the snapshot carries it.
9. Replaces FC-00071's "Include Rounded Final and Diff columns" box on the Payroll report card, which now says how many columns are on and where to choose them. A settings file or snapshot from before still ticks or unticks Rounded Final and Diff.

## Why
The owner, 2026-11-16: "in this export preview - i want to see all the available columns that we CAN include. Each of these columns can be individually selected, ignored, or included. In this view itself… i also want to be able to drag them around to reorder them if i so wish." Approved with every extra column in the pool, unticked by default.

## Where in UI
Payroll tab: the export preview (chip bar) and the Exports panel's Payroll report card (note).

## Touches
exports, display, settings

## Risk
Medium: every payroll report's layout now comes from the setting. Pay and totals are unchanged (six real weeks, base vs new); with the standard columns this week's Excel matches the file made before the change cell for cell.

## Reversibility
Fully reversible via one revert commit. Settings files written with the new row are read by older versions as an unknown label (ignored).

## Definition of Done
1. The chip bar shows all 22 columns; ticking, unticking and dragging change the preview at once; Employee cannot be unticked.
2. The preview, PDF and Excel headers are the ticked columns in order, for the combined and per-entity reports.
3. With formula inputs unticked, the Excel keeps them as hidden columns and every formula recalculates to the tool's values (checked in LibreOffice).
4. The setting round-trips through the settings file and the snapshot; each change is undoable.
5. With the standard columns, pay, totals and the Excel's cells are unchanged.

## Out of scope
- Separate column choices per entity report.
- The accountant file, the Timecards Excel and the Hours, Stats and Labor Cost sheets.
- Touch (phone) dragging.

## Assumptions
- One column setup for every payroll report (the per-entity reports use "the same columns, colors and totals as the combined report").
- New columns are values, except H:MM and Hours vs Schedule, which are formulas off the row's Hours.

## Open questions
None.

## Tests
`tests/fc00077_report_column_picker.test.js`: `test_default_pool_order_and_employee_locked`, `test_untick_and_move_follow_in_preview_pdf_and_excel`, `test_excel_keeps_formula_inputs_as_hidden_columns`, `test_contract_left_out_counts_under_deposit_everywhere`, `test_extra_columns_values_formulas_and_totals`, `test_total_labels_move_to_the_first_text_column`, `test_choice_saved_in_settings_snapshot_and_undoable`, `test_chip_bar_and_drag_to_move`, `test_per_entity_report_uses_the_same_columns`, `test_snapshot_from_before_the_picker_keeps_final_and_diff`. FC-00071's tests updated (`test_contract_column_follows_its_tick`, `test_exports_card_points_to_the_preview`).

## Slice
M

## Affected entities
All
