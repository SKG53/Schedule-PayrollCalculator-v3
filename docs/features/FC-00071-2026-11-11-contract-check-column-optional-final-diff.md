# FC-00071 — Contract Check column; Rounded Final and Diff optional

**Date:** 2026-11-11 · **Slice:** S · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. On the payroll report a Contract Check payment prints in its own **Contract Check** column (with subtotals and a grand total) instead of the Deposit column. The column appears only when someone on that report is paid by Contract Check.
2. **Rounded Final** and **Diff** are optional columns, **off by default**. A box on the payroll report cards in Exports, "Include Rounded Final and Diff columns", turns them on. The choice is a Tool Setting, "Payroll report · Rounded Final and Diff columns" = Include / Leave out, saved in the settings file and the snapshot, logged and undoable.
3. Column order: Entity, Employee, Method, Hours, Over time, Rate, Actual Total, Deposit, [Contract Check], Cash, [Rounded Final, Diff]. When included, Rounded Final = Deposit + Cash + Contract Check.
4. An editable copy (FC-00024) keeps the columns it was made with.
5. Pay math is unchanged: a Contract Check payment is still a deposit-type amount internally (Deposit-only report, week over week).

## Why
The owner, 2026-11-11: "Contract Check can be it's own column" · "We don't need the rounded final and diff columns anymore. They can be optional columns maybe? that we choose to include or not, but by default, not included". Contract Check is paid on the Friday cash date, not the accountant's deposit date, so it should not add into Deposit.

## Where in UI
Exports panel (payroll report cards); payroll report Excel, PDF and preview.

## Touches
exports, settings, display

## Risk
Medium: report layout changes; no pay changes. Column positions are read by name everywhere.

## Reversibility
Fully reversible via one revert commit.

## Definition of Done
1. Default headers have no Rounded Final or Diff; with Contract Check people a Contract Check column holds their pay and the Deposit column does not.
2. Turning the box on adds both columns; the setting survives the settings file round trip.
3. Every formula agrees with the tool (unit tests and LibreOffice on a real week).

## Out of scope
- The Payroll Calculation table on screen (keeps its Rounded Final and Diff).
- The unused report writers.

## Assumptions
- The Contract Check column is shown only when needed (all three Contract Check people are inactive today).

## Open questions
None.

## Tests
`tests/fc00071_report_columns.test.js`: `test_default_columns`, `test_contract_check_own_column_and_total`, `test_contract_column_only_when_needed`, `test_final_and_diff_optional_and_saved`, `test_exports_card_has_the_choice`, `test_editable_copy_keeps_its_own_columns`.

## Slice
S

## Affected entities
All
