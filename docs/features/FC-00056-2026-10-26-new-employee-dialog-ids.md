# FC-00056 — New employee: first and last name, the permanent ID shown first, never a reused number

**Date:** 2026-10-26 · **Slice:** M · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
A **New employee** dialog asks for the first and last name, shows the permanent ID the person will get, and takes an optional wage and pay method. It opens from **+ New employee** in the employee tab bar, from "+ New employee…" in a row's Employee list, and from "Add as new employee" on Unrecognized. The new person gets their own tab at once and is written to the next settings file. IDs continue after the highest number ever issued for the entity, which the settings file now carries.

## Why
The owner: "if there's a new employee, they just get left in 'unrecognized'. Can i have an option … like 'Create New Employee' and when chosen, gives me the option to set their name? It should ask me for their full name, first and last, and assign them to a unique ID. bc at the end, the settings file will include this new employee, with their relevant settings."

Before: a one-box browser prompt filled with the card's spelling, no ID shown. And the ID counter continued after the highest ID **in the loaded file**, so a number issued once and later missing from a file could be handed out again — it happened: the Oct 11–17 settings file gave a new person a number that had been issued (and abandoned) before.

## Where in UI
Actuals Intake → employee tab bar (**+ New employee**), the Employee dropdown, Unrecognized → the New employee dialog. Settings file → Tool Settings sheet.

## Touches
roster, settings, intake, display

## Risk
Medium. IDs are permanent; the numbering rule changes (only ever upward).

## Reversibility
Fully reversible via one revert of the FC-00054–61 commit. A settings file written by this version loads in the older one (the extra Tool Settings rows are ignored).

## Definition of Done
1. **Name:** First name (required) and Last name. Blank last name → the entity's file label (house rule "<First> Hefner"). A word typed all lower-case is capitalised. Preview: "Saved as: … · ID EMP_XXX_NNNNN".
2. **Refused with the reason shown:** no first name; a name that already exists (pick them instead); an archived person (Reactivate instead); a negative or non-number wage.
3. **Create** (one undo step): the person with the next ID, marked added this week; the row it came from moves to them; the card's spelling is kept as an alternate spelling; the wage and pay method set the usual way (History). Their tab opens with the whole week (FC-00057) even before a row exists.
4. **Never a reused ID:** the settings file's Tool Settings sheet carries "Highest employee ID issued · <CODE>" per entity (the higher of the file's own record and the highest ID in the roster). Loading a file raises the counter to it before anyone is renumbered (tool settings are read first). New IDs and the renumbering of people made before the file loaded both continue after it.
5. **Settings export** includes everyone added this week, even with no punches yet.
6. No settings file loaded yet: the ID shown is marked as confirmed when last week's file is loaded (FC-00046 "ID pending").

## Built
- `openNewEmployeeDialog`, `#newEmpOverlay`, `createNewEmployeeFromDialog` → `addNewEmployee(entIdx,name,fromSpelling,{rate,method,spelling,rowId})`.
- `newEmployeeFullName`, `previewNextEmployeeId`, `_idHighWater`, Tool Settings label `Highest employee ID issued · <CODE>` read in `_ingestToolSettings` (raises `_fileIdMax` and `_empIdSeq`), which now runs before `_ingestPayrollSettings`.
- Settings export: `fromFile || addedNew`.

## Verification
- `npm test`: all pass; `tests/fc00056_new_employee_dialog.test.js` (8 tests); FC-00048's dropdown test updated to the dialog.
- Real browser: the dialog filled from the card spelling, ID shown, created.

## Out of scope
- Renumbering anyone who already has an ID.

## Assumptions
- Pay method choices in the dialog: Cash, Deposit, Contract Check (Deposit + Cash needs a deposit amount: set on the Payroll tab).

## Open questions
None.

## Tests
`tests/fc00056_new_employee_dialog.test.js`:
- `test_dialog_asks_first_and_last_and_shows_the_id`
- `test_blank_last_name_uses_the_entity_name`
- `test_create_from_a_row_moves_the_row_and_keeps_the_card_spelling`
- `test_never_reuses_an_issued_id`
- `test_settings_file_carries_the_person_and_the_highest_id`
- `test_duplicate_and_archived_refused`
- `test_new_person_gets_a_tab_before_any_row`
- `test_late_settings_import_respects_the_highest_id`
- `test_preview_shows_the_id_the_person_will_get`
- `test_undo_after_settings_export_does_not_reissue_the_id`

## Slice
M

## Affected entities
All

## Independent review fixes (2026-10-26)
- When the typed name was already looked up this session (it has a provisional record), the dialog shows that record's ID, which is the one Create keeps, instead of the next new number.
- An ID written to a settings file is never issued again, even after Undo removes that person. Undo still takes the person back.
