# FC-00059 — One Exports panel: Excel / PDF buttons per report, entity choice, one report per entity, one preview

**Date:** 2026-10-26 · **Slice:** L · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. **One place for every export:** a card per report, each with its own **Excel** and **PDF** buttons that download at once (title, description and file name on the card).
2. **Choose entities:** the combined payroll report covers the entities ticked on its card.
3. **One report per entity:** every entity has its own payroll report card with the same columns, colors and totals (e.g. a store whose payroll is sent separately).
4. **Several at once:** "In batch" ticks on the cards, then **Download batch as files** or **as one zip**.
5. **One preview:** the All-entity preview and the Combined export preview are merged into one **Export preview** in the export's format, which can show the combined report or one entity's.
6. **H:MM beside Hours** in the payroll report (Excel, PDF, preview), and every number column totalled.

## Why
The owner:
- "All entity preview - final export and combined export preview seem to be repeated info. Can you combine this into one preview? the export preview is the right format".
- "I want an option to choose which entities I want on the export… I need to start sending OKC exports separately. So i need a comprehensive report, just like now, that has all of them on one. but then i also need a separate table just for hefner with column headers and the same formatting. just with it's own ability to export."
- "We need to have one cohesive place for all exports… I don't want to choose radio buttons and then have one button to download everything or nothing. That feature to download a bunch of reports at once is cool but the buttons for excel or PDF with report heading and name, etc. is way easier".
- "anywhere time calcs are shown, can you find a way to show two different variants… HH:MM… and decimal hours".

## Where in UI
Payroll tab: the Export preview (bottom) and the **Exports** panel below it. The Wage / Payroll Calculation Settings section keeps **Import Settings**; its export moved onto the Settings file card.

## Touches
exports, display

## Risk
Medium. Export files gain a column and totals; a report can now cover some entities only. Pay math is untouched.

## Reversibility
Fully reversible via one revert of the FC-00054–61 commit.

## Definition of Done
1. **Cards:** Payroll report — combined (entity ticks, names choice when "Per export"), Payroll report — <each entity>, Reviewed timecards (Excel), Settings file (Excel, "Include per-day breaks", also used by Import), Snapshot (Save snapshot). Each shows its file names, its ✓ / ⚠ status and its buttons.
2. **A report for some entities** lists only those entities; its grand total is theirs; its title says "PAYROLL REPORT — <ENTITY>, …" (all ticked: "COMBINED PAYROLL REPORT"); its file is named after those entities' labels (`Hefner_<MMDDtoMMDD>_AllEmployeesPayroll.xlsx`). The Excel's Hours, Stats and Labor Cost sheets cover the same entities.
3. **The unapproved-row stop** (FC-00049) asks only about the entities of the report being exported; the waiting export runs after the last decision.
4. **Batch:** ticked files of every card, as separate files or one zip; per-entity cards are not in the batch until ticked.
5. **Preview:** the export's columns and totals, the left-out note, the not-in-this-export banners, "Make editable copy"; a person paid off the schedule whom nobody confirmed is flagged in red on screen only (as the old all-entity preview did with "(orphan)"); a chooser shows the combined or one entity's report. The old All-entity preview is gone.
6. **Payroll report columns:** Entity, Employee, Method, Hours, **H:MM**, Rate, Actual Total, Deposit, Cash, Rounded Final, Diff. H:MM is a formula over Hours (to the minute). Subtotals and the grand total add Hours, H:MM, Actual, Deposit, Cash, Rounded Final and Diff, as formulas. The PDF scales the 11 columns to the page width (FC-00050); the editable copy's PDF too.
7. Every cell that existed before is unchanged on the real weeks (only the new column and the new totals differ).

## Built
- `DOWNLOADS` rebuilt in place by `_syncDownloads()` (per-entity cards `payroll:<id>`), `combinedScopeIds`, `setCombinedEntity` (`_combinedOff`, in the snapshot), `exportCardNow(key,fmt)`, `_buildFiles(list,cont)`; `_exportScope` / `_withExportScope` filter `_collectExportData`; `unpaidReviewRows(scope)` and `_payGateScope`.
- `_fileStem(ids)`, `_reportTitle(kind)`.
- `COMBINED_HEADERS`, `COMBINED_COLS`, `COMBINED_XL_WIDTHS`, `xlHmm`, `_fxHmmCell`; totals `{hmmOf}` / `{signed}`.
- `_fc13PreviewModel` (scope from the preview chooser `setPreviewKey`), note rows, unconfirmed flag; `renderAllEntityPreview` clears its host (old builder kept as `_allEntityPreviewHtml`, no caller).
- The settings name label for the payroll report stays "Names on exports · Payroll report" so older settings files still load.

## Verification
- `npm test`: all pass; `tests/fc00059_exports_panel.test.js` (8 tests); older export tests updated to the new column positions by name.
- Eight real weeks: every existing cell of the payroll report identical; the only differences are the H:MM column and the new totals (Hours, Rounded Final, Diff).
- Real browser with real ExcelJS / jsPDF on a real week: combined and one-entity Excel and PDF, Timecards, Settings written; LibreOffice recalculated every formula (values removed first) and matched the tool.

## Out of scope
- New report kinds; the removed reports stay removed (FC-00050).

## Assumptions
- "OKC" = one entity's own report; any entity can be exported alone.
- Save snapshot stays in the header too; Export Actuals stays on Actuals Intake beside Import Actuals.

## Open questions
None.

## Tests
`tests/fc00059_exports_panel.test.js`:
- `test_cards_with_excel_and_pdf_buttons_one_place`
- `test_entity_report_has_only_that_entity`
- `test_combined_report_for_ticked_entities`
- `test_entity_pdf_fits_and_has_only_that_entity`
- `test_stop_asks_only_about_the_exported_entity`
- `test_batch_zip_with_entity_reports`
- `test_one_preview_in_export_format`
- `test_preview_flags_unconfirmed_off_schedule_person`
- `test_overlapping_card_exports_leave_no_scope_behind`
- `test_entity_export_asks_only_about_its_own_break`
- `test_same_file_names_get_a_number`
- `test_old_ten_column_copy_from_a_snapshot_is_upgraded` (in fc00024)

## Slice
L — sub-slices: cards and batch; entity scope; preview merge; H:MM and totals.

## Affected entities
All

## Independent review fixes (2026-10-26)
- Exports run one at a time. Two quick card clicks used to overlap, and the second put back the first one's entity scope, so every screen stayed on one entity until reload.
- A one-entity export asks only about that entity's unconfirmed break. Its notes (punch days outside the week, Active unchecked) and its card status cover only that entity.
- Two files with the same name in one batch (two entities with the same file label) get _2 instead of overwriting each other in the zip.
- An editable copy saved in a snapshot before the H:MM column existed is upgraded on load, so Rate and the money columns land where they belong.
- "Include per-day breaks" is beside Import again as well as on the Settings file card. Both boxes are one setting.
- Not changed, by design: the H:MM column shows the decimal Hours that pay uses. Three rows of 7.33 h show 7:20 each and total 21:59, which matches the 21.99 h paid.

## Changed later
- FC-00065 (2026-10-26): the H:MM column is removed from the payroll report (combined and per entity, Excel, PDF, preview); the owner hid it on every report. Money text reads `$1,234.56` / `-$0.17`, and total labels span Entity–Method.
