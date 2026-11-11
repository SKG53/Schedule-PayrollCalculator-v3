# FC-00075 — Load the accountant's file and check both sides

**Date:** 2026-11-11 · **Slice:** M · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. "Load the accountant's file…" on the Accountant file panel reads their xlsx (any sheet layout with an "Employee Name" header per section; the used range may start after A1).
2. It reads the pay period, the pay date, each section and its rows (name, type, hours, over time, rate, salary, note; spare rows skipped) and the bonus block (kept to write back, FC-00074).
3. It **takes** the deposit pay date (unless the owner set it by hand this run), the section names and order (Tool Settings), each matched person's accountant spelling and employment type, and the note of a person who never had one.
4. Matching is exact and never guessed: within the section, a person whose saved accountant name equals the row, else whose saved name or alias does. Anyone else is asked once: "who is this?" with every person of every entity (a likely one preselected), **Add as Executive PR** (creates the person, Flat, with the accountant's weekly amount, type and note) or **Leave off our file this week**. A person chosen from another entity is filed under that section (Accountant Section). The answer is saved with the person, so next week's file matches by itself.
5. It lists every difference: pay period, pay date, an unknown section, each unmatched row, each person on their file not on ours (inactive, paid Cash or Contract Check, or not paid this week), pay rate, salary or weekly amount, employment type, hours and over time (when their file has hours), notes (with "Use theirs" and "Use all the accountant's notes"), and each person on ours not on theirs ("added at the end of the section"). "✓ The accountant's file matches ours" when there is nothing.
6. One Undo step reverts the load (the file, the pay date, sections, spellings, types and notes it took); the loaded file is kept in the snapshot; Clear forgets it.

## Why
The owner, 2026-11-09: "I want to be able to upload the file the account[ant] gives me each [week] just to verify that him and I are on the same page. then the tool should intake that file, verify that everything matches as needed, and then outputs our file." · "The match should match entirely."

## Where in UI
Exports → Accountant file panel.

## Touches
exports, settings, roster, display

## Risk
Medium: a wrong match would put a person on the wrong line of the accountant's file; matches are exact or confirmed by the owner, and every difference is listed.

## Reversibility
Fully reversible via one revert commit.

## Definition of Done
1. A real accountant download loads: every section and row, the pay date and the bonus block.
2. After the owner's answers the remaining items are exactly the real differences.
3. Undo, snapshot and Clear behave as above.

## Out of scope
- Writing anything into the accountant's own file.
- Fuzzy auto-matching without the owner.

## Assumptions
- Section names identify entities by their first word until the owner's file sets them.

## Open questions
None.

## Tests
`tests/fc00075_accountant_upload.test.js`: `test_parse_reads_sections_rows_and_bonus`, `test_apply_takes_pay_date_types_names_and_first_notes`, `test_unmatched_rows_asked_once_and_remembered`, `test_add_as_executive_pr_and_cross_section`, `test_differences_listed`, `test_period_pay_date_and_hours_checked`, `test_status_snapshot_and_clear`.

## Slice
M

## Affected entities
All
