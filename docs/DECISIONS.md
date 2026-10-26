# Decisions & Open Questions

Running record. Add to it whenever something is settled or a new question appears.
Never delete an entry — move it between sections and note the date.

---

## Settled

| # | Decision | Date |
|---|---|---|
| 1 | ~~`main` is production. All work happens on feature branches.~~ **Retired 2026-09-01.** The no-touch-main rule is no longer in effect. `main` is edited directly. Short-lived branches still used for non-trivial changes for review/revert hygiene, but not required. Rule was in place while `main` was serving active weekly payroll; that is no longer the case. | 2026-09-01 |
| 2 | Hours are span-based: `span − max(mandatoryBreak, actualGap)`. Confirmed correct against the code. Not to be replaced with pair-sum. | [DATE] |
| 2a | The mandatory break is a per-entity user setting with per-day overrides, not a framework rule. Confirmed intended policy, not a defect. The three reference weeks stand unchanged. | [DATE] |
| 3 | Rest-interval and overtime validation are out of scope. Do not implement. | [DATE] |
| 4 | Rounded Final is **not** a whole number. Only Cash is whole-dollar. Deposit carries cents. | [DATE] |
| 5 | Ledger reports five measures: Actual, Deposit, Cash, Paid, Delta. | [DATE] |
| 6 | Zero-hour rows are retained in all outputs. Departure is an `active = false` roster flag. | [DATE] |
| 7 | Change log is a non-linear panel with per-entry revert, not a linear undo stack. Session-scoped, cleared on new batch with a warning. | [DATE] |
| 8 | Shift merging affects display and shift counting only, never paid hours — hours are span-based regardless. | [DATE] |
| 9 | Flags render as one-line previews with a "show more" expander. | [DATE] |
| 10 | A payment type carries behavior (columns, rounding, fixed-amount source, color), not just a label. | [DATE] |
| 11 | **No payroll data persists.** `localStorage` may hold API credentials and UI preferences only. Never roster, wages, punches or figures. Always empty of payroll data on first load. | [DATE] |
| 12 | No payroll figures, employee names, wages or real data may appear in any tracked file. Real values live in `docs/REFERENCE_WEEKS.md`, which is gitignored. The repository is public. | [DATE] |
| 13 | The settings file is the only persistence mechanism. Roster, aliases, rates, methods and thresholds all live there. Anything needing to survive between weeks becomes a settings field. | [DATE] |
| 48 | **No H:MM column on the payroll report** (FC-00065), combined or per entity, Excel or PDF; amends #41. The owner: "the column you created on this report for H:MM - i don't want that on this report." Money reads `$#,##0.00` everywhere, on files and screens, with the sign first (-$0.17, +$0.13): "those commas improve legibility, they are necessary". | 2026-10-26 |
| 47 | **Hours read in words where there is room** (FC-00064): "12 Hours 34 Minutes", "8 Hours 0 Minutes", "1 Hour 1 Minute", with the decimal pay uses. A scheduled shift on the review tab shows its length, start to end with no break taken out. | 2026-10-26 |
| 46 | **One OCR progress bar for the whole run** (FC-00063), above all entities, showing the entity being read and those waiting next. | 2026-10-26 |
| 45 | **The image sort screen uses clear Timecard / EasyClocking / Unsure toggles** (FC-00062); a moved image glides to its group and is outlined. Unsure chosen by hand waits for a decision before OCR. | 2026-10-26 |
| 44 | **v3 is its own repository and link** (`SKG53/Schedule-PayrollCalculator-v3`, `https://skg53.github.io/Schedule-PayrollCalculator-v3/`), holding FC-00049 to FC-00061. The v2 repository and link stay at FC-00048 so payroll can run on v2 while v3 is checked. Both sites share one browser origin, so the Gemini key and screen preferences are shared; no payroll data is stored in either. The owner: "we will call this entire rework, v3". | 2026-10-26 |
| 43 | **Pay rounds half-cents the way Excel does** (FC-00061): half a cent goes away from zero, so the screen, the PDF and the recalculated Excel agree to the cent, and Cash to the dollar. A half-cent edge case can move a pay by one cent and a cash payment by $1 compared with the earlier tool. | 2026-10-26 |
| 42 | **Excel files are live math** (FC-00060): the payroll report's Hours come from an Hours sheet (one row per punch day with real times), pay and totals are formulas, and the Stats and Labor Cost sheets are formulas too. Editing a punch in Excel flows through to the pay. Timecards carry real dates and times. | 2026-10-26 |
| 41 | **One Exports panel** (FC-00059): one card per report with Excel and PDF buttons and a preview in the export's own format; the combined payroll report stays, and each entity also has its own report with the same headers and formatting; the owner picks which entities go on the combined report; batch download stays. Hours print as decimal and H:MM side by side. | 2026-10-26 |
| 40 | **A person's orange dot stays until every row of theirs is approved or left out** (FC-00057), and comes back when a row becomes unapproved. Times changed by hand are blue. "Approve all" stays, behind a confirmation. The owner: "keep the approve all button. but add a confirmation dialog box". | 2026-10-26 |
| 39 | **An employee ID is never issued twice** (FC-00056). New people get the next number after the highest ever issued for the entity; the settings file carries that number, so a removed person's number is not reused. A new person needs a first name; a blank last name uses the entity's name. | 2026-10-26 |
| 38 | **The Mixed box shows what each image is before OCR** (FC-00055): a folder or zip dropped on it is sorted by looking at each image and previewed as thumbnails with their type, the same check the week drop uses. | 2026-10-26 |
| 37 | **Every day of the pay week shows on each person's review tab** (FC-00057), with that day's hours and the week's total in H:MM and decimal; a day with no punches can take a hand-entered row. | 2026-10-26 |
| 36 | **Images are typed by looking at them, never by file type** (FC-00053). The owner: "File type will not be enough for image type. You will have to view the image and decide. Bc it might change." The week folder is dropped once; subfolders map to entities; the owner checks the sort before OCR. The Mixed / Auto-Classify box stays. | 2026-10-19 |
| 35 | **Semi-monthly flat pay** (FC-00052): an amount per half-month, paid in the run whose Sun–Sat week around the Monday run date holds the 1st or the 15th, $0 otherwise; the owner confirms each run. Its labor cost is amount × 24 ÷ 52 per week. | 2026-10-19 |
| 34 | **Punctuality is information, never a penalty** (FC-00051). Late 1–5 min yellow, over 5 red; clock-out more than 1 min off the end yellow up to 10, red after; early clock-ins are counted, never flagged. Stats show counts next to every percent. | 2026-10-19 |
| 33 | **Exports: the Payroll report (Excel, PDF), the Timecards Excel, the Settings file and the Snapshot** (FC-00050). The other reports were removed from the screen. Names print FIRST LAST by default. The owner: "Default name style should just be First Name and Last Name in all caps, yes." | 2026-10-19 |
| 32 | **A payroll export stops on rows that would not be paid** (FC-00049, amends FC-00023 for this one case): every unapproved row with punches in the pay week is approved or left out first. Every other warning still never stops an export. Hours read as h:mm on screen; pay and files stay decimal. | 2026-10-13 |
| 31 | **A new person is added by the owner, from the review tab** (FC-00048). Rows that match nobody are grouped by the name OCR read; "Add as new employee" (or "+ New employee…" in a row's dropdown) creates the person and moves the rows. Nobody is created until the owner clicks. "(orphan)" no longer prints. A person with hours and no rate is red and listed before export; the export stop is a later card. | 2026-10-12 |
| 30 | **Archived people are never matched automatically** (FC-00047). A card name that matches only an archived person goes to Unrecognized with "Matches archived" and a Reactivate button. A spelling the owner matches by hand is saved to that person and exported, except when it would move another row read the same way. | 2026-10-12 |
| 29 | **No master settings file; the owner's latest exported settings file is the roster** (amends #19). It can be loaded first (Schedules tab) or late (Payroll tab), and either order must give the same pay. Permanent IDs match first; people the tool made itself match by name, alternate spelling, former name or a unique first name of an active person, and show "ID pending" until a file is loaded (FC-00046, FC-00047). The owner: "an ID number is supposed to be a unique identifier." | 2026-10-12 |
| 28 | **Names on exports are a printing choice** (FC-00045): As saved, FIRST LAST or FIRST (with last initial added when two would print alike), one choice for all exports or one per export, kept in the Tool Settings sheet and the snapshot. IDs and saved names never change; the settings file and reviewed timecards always print saved names. | 2026-10-12 |
| 27 | **The settings file's spelling of a name is the saved spelling** (FC-00044). Other capitals or punctuation from a schedule or timecard only find the person; they never re-write the saved name. A later settings file, or a rename in the tool, changes it. | 2026-10-12 |
| 26 | **One Downloads list with the owner's file names** (FC-00040). One line per export with format ticks; files are named `<labels>_<MMDDtoMMDD>_…` (labels default Nirvana / Zion / Hefner, editable, kept in the settings file); download one by one or as one zip; status warns but never blocks. The accountant file is a disabled placeholder until its format is agreed. The owner: "Exports should just have multiple formatting options… individual files… or all in one big zip." | 2026-10-12 |
| 25 | **A settings file is previewed before it is applied** (FC-00038). The preview is the real importer run on a copy of the session; nothing changes until Apply; red rows (ID clash, duplicate ID, refused alias, unknown entity) must be skipped or decided first; hand edits the file would overwrite are marked. Rows for an entity not loaded yet wait in the session (and the snapshot) and are offered through the same preview when it appears. The owner: "you show the user what is actually going to be uploaded from that settings file before you actually do it… you cannot unimport something." | 2026-10-12 |
| 24 | **Rows are merged and split only by hand** (FC-00043). Same employee, same or back-to-back dates, at most 3 pairs, no overlapping punches; filed under the earliest clock-in; values never change and edited boxes stay edited. No gap limit — the preview shows gaps and hours and the owner decides. The owner: "if I let the AI decide, it's definitely going to mess something up somewhere." | 2026-10-12 |
| 23 | **Reviewer edits are tracked per box; a re-read never overwrites** (amends #15). Each date/time box keeps its own OCR value; a pair is manual when its In or Out box is edited (or the row's date was corrected), and only manual pairs replace overlapping OCR pairs. A row re-read shows the new value under each box with Current \| Re-read (Current by default) and changes nothing until Apply. The owner: "Any box that is manually edited retains its manually edited value regardless of where it goes"; "put the values from the rereading underneath the current values and give an individual toggle on each box." FC-00042. | 2026-10-12 |
| 22 | **Week-over-week compares against last week's snapshot only, by permanent ID** (FC-00041). Informational, never blocks an export. Owner-level settings (swing thresholds; later file labels) live in a **Tool Settings** sheet of the settings file and in session state. The owner: "just make it reliant on the snapshot… I want to see them in the system as I use it and then correct them." | 2026-10-12 |
| 21 | **A session snapshot is the second user-held file** (amends #13). One JSON file holds the whole session (every screen, edit, approval, setting and the change history) and reopens it exactly. Images are referenced by SHA-256 with a small thumbnail, never stored in full, and re-attached by content. The file lives only where the owner saves it; nothing is stored online or in browser storage; the API key is never in it. The settings file stays the source of identity and rates between weeks. The owner: "upload that snapshot and everything will just repopulate every screen." FC-00037. | 2026-10-12 |
| 20 | **Big actions are undoable as a whole; single changes revert one line at a time** (extends #7). A checkpoint (full in-memory copy, images referenced not copied) is taken before every big action; the last 10 are kept, in memory only. Undo puts everything back to just before the action and first lists what else would be lost. Remove entity asks first. No Ctrl+Z, no redo. The owner: "I think you need to have a way to click undo." FC-00039. | 2026-10-12 |
| 19 | **Employee IDs are permanent; the master settings file owns them** (was Open #16). Each person has one ID and one canonical name (full first + full last, or full first + last initial). Aliases, other cases and punctuation resolve to that ID; new people continue after the highest ID ever issued; departed people stay in the file as inactive so their ID is never reused; load order never changes an ID. The owner: "set names with ids once, and let that persevere from here forward. any new employees will continue from there. any aliases, will just attach to this new permanent employee ID." FC-00036. | 2026-10-07 |
| 18 | **Active unchecked = left out of this week's preview and exports** (amends #6). The same checkbox still keeps the person off the next schedule. Every preview and export names who was left out; hours or pay on a left-out person is a red warning. The owner: "if I uncheck the blue check mark on that last screen… that name and all of its data doesn't show up on the final export, even in the preview." FC-00035. | 2026-10-07 |
| 17 | **Excel exports carry live formulas.** Derived pay, split, totals and grand totals are formulas with the tool's value cached; editing an input in Excel recalculates. The owner: "I keep getting excels with just copy pasted values and so if I change something, the totals … don't update." FC-00033. | 2026-10-07 |
| 16 | **Week filter stays; it is never silent** (was Open #17). Only the loaded schedule's week is paid; excluded punch days are listed on the Payroll tab, in the preview and in every export toast; a schedule without dates warns that the filter is off. The owner: "I'm only looking to calculate time in the week of the schedule that is uploaded. However dropping it without notification … is bad." FC-00032. | 2026-10-07 |
| 15 | **Reviewer edits are final; MN supersedes overlapping OCR** (was Open #11). Editing a time/date on an OCR row makes it MN; an approved MN pair replaces any overlapping TC/EC pair for the same employee+date; non-overlapping pairs add. The owner: "when I change it it should be my changed time that is retained … I am the final verification." FC-00029. | 2026-10-07 |
| 14 | **The tool has no authentication by design.** It is public framework holding no payroll data — everything arrives by upload and leaves by download, so there is nothing to gate. Do not add a login, password, or access gate. The original plain-text gate was removed in full in Phase 0 (BUILD_SPEC §9B.1); the retired password is burned and must never be reused. | 2026-08-03 |

---

## Open — needs the owner

| # | Question | Blocking |
|---|---|---|
| 1 | Shift merge threshold. 90 min proposed for auto-merge, 4 h for auto-separate, gray band flags for manual decision. | Phase 4 |
| 2 | Does merging ever change paid hours? Assumption is no — hours stay the sum of worked pairs. | Phase 4 |
| 3 | Should `Contract Check` become a real stored payment method, retiring the manual export-time override? | Phase 4/5 |
| 4 | Date field target format. MM/DD/YY assumed. | Phase 4 |
| 5 | Where does the flat-rate employee's paid amount come from? Settings shows `Flat Amount = 0`. | Phase 1 |
| 6 | What are the valid values for `Deposit Typed As` besides `whole`? | Phase 1 |
| 7 | Is the lighter cash-column fill on NIRVANA 11TH (`BDD7EE` vs `9DC3E6` elsewhere) intentional? Consistent across three weeks. | Phase 5 |
| 8 | Delta alert band — proposed value in `docs/REFERENCE_WEEKS.md`. | Phase 5 |
| 9 | Do ZION and HEFNER share NIRVANA 11TH's store hours and 3-staff minimum? | Phase 6 |
| 10 | OCR confidence threshold for the low-confidence flag. | Phase 4 |

---

## Open — raised by the baseline survey

| # | Question | Blocking |
|---|---|---|
| 11 | ~~Implement the MN overlap-supersede rule, or leave merging additive?~~ **Settled 2026-10-07 → Settled #15 (FC-00029).** It changes paid hours either way. Span formula currently caps the damage. | Phase 4 |
| 12 | The OCR prompt sends the full roster and every employee's scheduled shifts to Google as disambiguation anchors. Keep, reduce, or remove? Removing will degrade name matching. | Phase 4 |
| 13 | Overstaffing thresholds are hardcoded at ≥4 before 4:30 PM and ≥5 after, which do not match the documented 3-staff minimum. What are the correct values, and per entity? | Phase 6 |
| 14 | Eleven exports exist, not six. Which need the deck treatment beyond Combined? | Phase 5 |
| 16 | ~~**Employee identity across weeks.**~~ **Settled 2026-10-07 → Settled #19 (FC-00036).** IDs are minted per session in the order names are first seen, so they shift between weeks unless the settings file is imported before the schedule; importing a settings file after a schedule can relabel one employee's record as another (an ID collision is treated as a rename); schedule names resolve by canonical name only, so a name kept as an alias mints a fresh, empty record. Raised 2026-10-07 — proposal with the owner. | Phase 1 |
| 17 | ~~**Week filter visibility.**~~ **Settled 2026-10-07 → Settled #16 (FC-00032).** Approved punches dated outside the loaded schedule's seven dates are dropped from payroll with no warning on the Payroll tab. Surface a count / list, or keep silent? Raised 2026-10-07. | Phase 4 |

---

## Answered by the baseline survey

| # | Question | Answer |
|---|---|---|
| 1 | What break rule does the code apply? | `span − max(mandatoryBreak, actualGap)`. Mandatory is a floor and a user setting. Intended behavior. |
| 2 | How many exports exist? | Eleven, across seventeen buttons. |
| 3 | Does anything persist across refresh? | `localStorage`: API key and model preferences. `sessionStorage`: a dead login flag. No payroll data. |
| 4 | How do MN rows interact with TC/EC? | Was purely additive. Since FC-00029 (2026-10-07): MN supersedes overlapping TC/EC; see Settled #15. |

---

## Closed — resolved, kept for history

| # | Item | Resolution |
|---|---|---|
| 1 | An employee appeared in intake for a week he was recorded as absent, with punches within 1–2 minutes of a colleague's. | Not a duplicate. He moved to evenings and rides in with that colleague. |
| 2 | Two similar names at one entity sharing a rate and pay method; one week's hours assigned to the wrong one. | Two distinct people. One has since left. Records were genuinely indistinguishable — a roster-level problem, not a matching bug. |
| 3 | Departed employees persisting on schedules and in settings. | Root cause is the absence of an active/inactive flag. Addressed in BUILD_SPEC §2. |
