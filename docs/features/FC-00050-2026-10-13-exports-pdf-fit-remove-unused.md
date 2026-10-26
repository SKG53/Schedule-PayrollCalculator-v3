# FC-00050 — Payroll PDF fits the page; unused reports removed; names print FIRST LAST by default

**Date:** 2026-10-13 · **Slice:** M · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
1. **The payroll PDF fits the page.** It prints on one page width in landscape and carries the same rows, totals and colors as the payroll sheet of the Combined Excel, so it can be exported straight from the tool.
2. **Unused reports are removed.** The tool keeps four payroll-side files: the Payroll report (Excel and PDF), the Reviewed timecards Excel, the Settings file and the Snapshot.
3. **Names print FIRST LAST in capitals by default** (e.g. `AVERY STONE`). The choice stays switchable (FC-00045).

## Why
- **The PDF runs off the page.** The payroll PDF's ten columns add up to 810 pt, but a landscape letter page is 792 pt wide before margins. So the owner prints the PDF from Excel instead of from the tool.
- **Most reports go unused.** The owner uses the Payroll report, the Timecards Excel, the Settings file and the Snapshot. The rest of the reports are noise on a screen he works through every week. The owner: "yes, get rid of those reports" · "get rid of the accountant file until I have that figured out" · "I want the PDF size properly so I can directly export it from the tool."
- **The Timecards Excel stays.** The owner: "That serves as an actual database record of time clock."
- **FIRST LAST default.** The owner: "Default name style should just be First Name and Last Name in all caps, yes." 

## Where in UI
- **Payroll tab, Downloads:** the list becomes Payroll report (Excel, PDF), Reviewed timecards (Excel), Settings and Snapshot.
- **Payroll tab:** the old export buttons block above the settings section is removed.
- **Names on exports** defaults to FIRST LAST.

## Touches
exports, display

## Risk
Low.
- Removing reports deletes code paths but touches no pay math.
- The PDF change is layout only.
- The name default changes printed names only. IDs, saved names and pay never change (FC-00045).

## Reversibility
Fully reversible via one revert commit.

## Definition of Done
1. **Payroll PDF layout:**
   - landscape letter;
   - every column fits inside the margins, scaled to the page width;
   - no column is cut or wrapped onto a second page width.
   - Long names wrap inside their cell rather than widening the table.
2. **Payroll PDF content:**
   - the same columns, rows, order, entity colors, subtotals and grand totals as the payroll sheet of the Combined Excel;
   - the same title and pay period;
   - every money figure equal to the Excel's to the cent.
3. **Page breaks:** an entity block that fits on a page is not split across pages, and the header row repeats on each page.
4. **Removed:**
   - Cash-only report;
   - Deposit-only report;
   - Time Card Data report;
   - Payroll Calculation report;
   - Full report;
   - the Manager schedule report;
   - the "Accountant file" placeholder;
   - the old export buttons block on the Payroll tab;
   - the Reviewed timecards PDF.

   The Time Card Data and Payroll Calculation **screens** stay; only their export files go. The owner: "don't need time card data file." Its break minutes and OT flag move into the Stats tab of the Combined Excel (card 4).
5. **Kept:**
   - Payroll report, Excel and PDF;
   - Reviewed timecards, Excel;
   - Settings file;
   - Snapshot;
   - the Employee Schedule export on the Schedules tab, which is a schedule, not a payroll report.
6. **Names on exports:**
   - the default is FIRST LAST for a new session;
   - a choice saved in a settings file or snapshot still wins;
   - with one report left that prints names by choice, Per export shows a choice only on the Payroll report line; the Timecards export keeps saved names as before.
7. **Old files load cleanly.** Settings files and snapshots that name a removed report (a format tick, a file label or a name choice) load without error, and the entries are ignored.
8. **Five real weeks plus Oct 4–10:**
   - the Payroll Excel and the Timecards Excel are cell-identical to the live version, names aside: with As saved selected they are fully identical;
   - the new PDF's figures equal the Excel's.

## Built
- **PDF layout.** `_exportPdf` scales the Excel column proportions to the page width between 30 pt margins, and long cells wrap.
  - Row heights are estimated with the table's own font and padding, so pages break between entity blocks.
  - Each page is one `autoTable` call with the header, so the header repeats on every page.
  - A block taller than a page still splits, with the header repeated.
- **Downloads** lists Payroll report (Excel, PDF), Reviewed timecards (Excel), Settings and Snapshot.
- **Buttons removed:**
  - the per-report export buttons on the Payroll tab;
  - Export Manager Report on the Schedules tab;
  - Export Actuals (.pdf) on Actuals Intake.

  The old writers stay in the code with no button, so their tests still guard the shared math.
- **Names.** `exportNameMode` defaults to FIRST LAST. A choice in a settings file or snapshot wins.
  - The per-export choice exists only for the payroll report.
  - Old files naming removed reports load, and those entries are ignored.
  - Older tests that check saved spellings load with `loadApp({ savedNames: true })`.

## Verification
- `npm test`: all pass, including `tests/fc00050_exports_trim_pdf.test.js` (7 tests). fc00040 and fc00045 were updated.
- **Real browser (Chromium, real jsPDF) on a real week:**
  - the payroll PDF is one landscape letter page;
  - all text sits inside the margins;
  - the figures equal the Combined Excel.
- **Five real weeks:** the payroll sheet is identical to the live version with As saved names.

## Out of scope
- The accountant file format (it comes back as its own card once agreed).
- Changes to the Combined Excel's own layout.

## Assumptions
- "Fits the page" means landscape letter, one page wide, any number of pages long.
- The Reviewed timecards PDF goes, because the Timecards Excel is the record.
- The Manager schedule report goes; the posted employee schedules are made outside the tool.

## Open questions
None.

## Tests
`tests/fc00050_exports_trim_pdf.test.js`:
- `test_payroll_pdf_columns_fit_landscape_letter`
- `test_payroll_pdf_figures_equal_combined_excel`
- `test_header_repeats_entity_block_not_split`
- `test_removed_reports_absent_from_downloads_and_payroll_tab`
- `test_kept_exports_unchanged`
- `test_names_default_first_last_saved_choice_wins`
- `test_old_settings_and_snapshot_with_removed_kinds_load`

Real browser: the payroll PDF is printed with real jsPDF and checked visually at 100 %.

## Slice
M

## Affected entities
All

## Changed later (FC-00059, owner's edits of 2026-10-26)
The owner preferred the per-report **Excel / PDF buttons** to the Downloads checklist: "the buttons for excel or pDF with report heading and name, etc. is way easier than the old looking downloads section". FC-00059 replaces the Downloads list with one **Exports** panel:
- one card per report with its own Excel and PDF buttons (the trimmed list of this card is kept: Payroll report, Reviewed timecards, Settings file, Snapshot — the removed reports stay removed);
- the combined payroll report covers the entities ticked on its card, and every entity has its own payroll report card;
- several files at once: "In batch" ticks on each card, then one zip or separate files;
- the Settings export button moved from the settings section onto the Settings file card.

The PDF fit, the FIRST LAST default and the removed reports of this card are unchanged. The payroll report gains an **H:MM** column and totals on Hours, H:MM, Rounded Final and Diff (FC-00059); its PDF columns are scaled to the page width as built here.
