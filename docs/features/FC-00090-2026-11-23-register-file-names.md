# FC-00090 — The Employee Register's files are named like every other export

**Date:** 2026-11-23 · **Slice:** XS · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
The Excel, PDF and CSV buttons on the Employee Register tab, and the Tool Settings file, are named like every other export: `<entities>_<week>_EmployeeRegister.xlsx` (for example `Alpha_Beta_0809to0815_EmployeeRegister.xlsx`), `…_EmployeeRegister.pdf`, `…_EmployeeRegister.csv`, `…_EmployeeRegister_WithBreaks.xlsx`, `…_ToolSettings.xlsx`. These are the same names the Exports cards and Download all already give them. Before: `Employee_Register_<today's date>.xlsx` and `TNG_ToolSettings_<date>.xlsx`.

## Why
The owner, 2026-11-23: "We also need to change the name of the export on the employee register. Needs to match the naming convention of the other files".

## Where in UI
Employee Register tab: Excel, PDF and CSV buttons. Tool Settings export.

## Touches
`_stemFileName` (new), `exportPayrollSettingsExcel`, `exportRegisterCsv`, `exportRegisterPdf`, `exportToolSettingsExcel`.

## Risk
Low. Names only; loading a file does not depend on its name.

## Reversibility
One revert commit.

## Definition of Done
1. Each button's file is `<the same stem as the other exports>_EmployeeRegister.<ext>` (`_ToolSettings.xlsx` for Tool Settings).
2. The Register tab's Excel gives the same name as the Exports card.
3. With no entities, the stem is `TNG`.

## Out of scope
Changing any other file's name.

## Assumptions
- The week in the name is the open week, like the other exports (the register's own "Register for week" stamp is the same week).

## Open questions
None.

**Approved:** the owner, 2026-11-23: "Needs to match the naming convention of the other files".

## Tests
`tests/fc00090_register_file_names.test.js`.

## As built (2026-11-23)
- `_stemFileName(suffix, ext)`: `_fileStem()` + `_` + suffix (`TNG_` when there is no stem). Used by `exportPayrollSettingsExcel` (`EmployeeRegister` / `EmployeeRegister_WithBreaks`), `exportRegisterCsv`, `exportRegisterPdf` and `exportToolSettingsExcel` (`ToolSettings`).
- Checked in the browser on the real Nov 8–14 snapshot (private): the Register tab's Excel downloads `<entities>_1108to1114_EmployeeRegister.xlsx`, the same as the Exports card.
- Tests: 665 of 665 pass.
