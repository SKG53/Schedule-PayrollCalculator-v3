# FC-00074 — The accountant's weekly file, from the tool

**Date:** 2026-11-11 · **Slice:** M · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. A new export card, **Accountant file** (Excel, in the batch by default), file `<stem>_AccountantFile.xlsx`. It asks about unapproved rows first, like the payroll report.
2. The layout is the accountant's own: one sheet "Sheet2"; row 1 "Pay Period" `mm-dd-yy to mm-dd-yy` and "Pay date" (the deposit pay date, `mm-dd-yy`); then one section per accountant section (gold title row across B–J, e.g. ALPHA VENTURES), header Employee ID · Employee Name · EMPLOYMENT TYPE · Hours · Over time · Pay Rate · Salary · Gross Total · Notes, and hidden P–R (Overtime rate `=+G*1.5`, Regular Amount `=+E*G`, Overtime Amount `=+P*F`); Gross Total `=+H+Q+R`; two blank rows between sections; banded rows (`MOD(ROW(),2)=0`); the accountant's column widths, Calibri 11 and number formats; Employee ID left blank as theirs is.
3. Who is on it: everyone paid this run by deposit — Deposit (Hours up to 40, Over time, Pay Rate), Deposit + Cash (Salary = the deposit part, no hours or rate), Executive PR (Salary = the weekly amount) and Flat Deposit (Salary = the amount). Cash and Contract Check people and inactive people are not.
4. Names, types, notes and sections are each person's accountant details (FC-00073); without an accountant name the saved name is used, without a type W2 (and the card says so).
5. Sections: the accountant's section names and order are remembered in Tool Settings ("Accountant file · sections", e.g. `ALP=ALPHA VENTURES; BET=BETA VENTURES`, written when their file is loaded); otherwise "<first word of the entity> VENTURES". Rows follow the loaded accountant file's order, new people after; otherwise A–Z.
6. When the accountant's file was loaded, its bonus block is written after the sections exactly as it was.
7. The card says what to look at: deposit pay date not set, accountant's file not loaded, differences, employment type not set, rate missing, Executive PR without an amount. The panel under the cards lists the file's rows with editable accountant name, type, section and note.

## Why
The owner, 2026-11-09: "I want this file to be generated from that tool … I just wanted to look like what the accountant uploads so that the accountant knows what's incoming. and recognizes it. I just want that to be output from the tool so I don't have to go in there manually type things in." · "The accountant's file only has a very select amount of employees. only the ones that have deposit checked next to them in our tool."

## Where in UI
Exports (card and Accountant file panel).

## Touches
exports, settings, display

## Risk
Medium: a document sent to the accountant every week. Its total equals the report's TOTAL WITH EXECUTIVE PR deposits; verified on a real week (figures in the local reference notes only).

## Reversibility
Fully reversible via one revert commit.

## Definition of Done
1. Layout matches the accountant's file (values, formulas, hidden columns, merges, banding, bonus block).
2. Formulas recalculated by LibreOffice give the cached values (0 mismatches on a real week).
3. On a real week each section's total equals the accountant's own file, apart from the overtime FC-00070 now pays.

## Out of scope
- The bonus framework (undecided).
- Protecting the sheet with the accountant's password.
- Spare blank rows under each section.

## Assumptions
- The portal accepts any Excel file; the layout is for recognition.

## Open questions
None.

## Tests
`tests/fc00074_accountant_file.test.js`: `test_only_deposit_people_by_section`, `test_layout_like_the_accountants`, `test_order_and_bonus_follow_their_file`, `test_card_batch_and_status`, `test_no_deposit_people_no_file`.

## Slice
M

## Affected entities
All
