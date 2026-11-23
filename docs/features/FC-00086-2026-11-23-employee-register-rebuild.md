# FC-00086 — Employee Register rebuild: one row per person, everything editable, Full Name and Display Name, entities as a multi-select, Add employee, themed look

**Date:** 2026-11-23 · **Slice:** L · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What

### Part 1: The look
1. The Employee Register tab matches the Payroll tab: the same section cards, table header (grey #E8E8E4, bold), row hover, styled inputs and dropdowns, the same buttons and small pills.
2. The Excel, PDF and CSV buttons look like the buttons on the export cards (Excel green).
3. The "Same person at two entities?" box and its Link buttons use the same theme.

### Part 2: One row per person
4. **One main row per person** (one TNG ID). A record with no TNG ID yet is its own row and shows "pending" in the TNG ID column. Showing the register never hands out TNG IDs; saving does, as today.
5. **Main row:** TNG ID (read-only), Full Name, Display Name, Accountant Name, Type (W2 / 1099), Rate, Active (Yes / No), Standing Note, Entity.
   - **Accountant Name** shows only when one of the person's records pays Deposit or Deposit + Cash. It is used only on the accountant file.
   - **Rate** is one per person, as FC-00085: changing it changes every entity, one Undo.
   - **Entity** is a multi-select of every entity (see Part 4).
6. **Sub-rows, one per entity record,** always shown, one compact line each: Former ID (read-only), Pay Method (Cash / Deposit / Deposit + Cash / Contract Check), Pay (Hourly / Flat / Semi-monthly), Flat or salary amount (Flat and Semi-monthly only), Deposit Amount (Deposit + Cash only), Deposit Entity (Deposit and Deposit + Cash only), Mgmt tick, Active at this entity.
   - Example: Avery Atest, TNG00001, works at Alpha Test (Deposit, Hourly) and Beta Test (Cash, Hourly): one main row, two sub-rows.

### Part 3: Everything editable
7. Every field is editable except TNG ID and Former ID. Fixed lists are dropdowns; money is a number box.
8. Every edit goes through History and Undo, as edits on the Payroll tab do.

### Part 4: Entity as a multi-select
9. **Ticking an entity** adds the person there: a new record at that entity under the same TNG ID, with the person's rate copied. Someone who already had an inactive record there is made active again instead.
10. **Unticking an entity** asks first: "Make <name> inactive at <entity>? Their history there is kept." On Yes the record at that entity is made inactive; nothing is deleted.
11. The last active entity cannot be unticked (make the person inactive with Active instead).

### Part 5: Full Name and Display Name
12. **Full Name** and **Display Name** belong to the person: one value each, kept on every entity record of the person, through History ("Full Name", "Display Name").
13. A blank Display Name shows the saved name as its placeholder. Nothing is filled in for anyone automatically. Name matching (schedules, timecards) does not change, and the saved names are not renamed.
14. Other screens and reports keep showing names as today; FC-00087 uses the Display Name there.
15. **Register file:** two new last columns, Full Name and Display Name, written and read back exactly. The load preview lists them. The register's People sheet, PDF and CSV show them too.

### Part 6: Add employee
16. An **Add employee** line on the register: entity, first name, last name, pay method, pay (Hourly / Flat / Semi-monthly), rate or amount, Mgmt. The person gets the next ID at that entity, as a new employee does today.

### Part 7: Paid without a schedule
17. The register's **Paid without a schedule** view is the register filtered to people paid Flat or Semi-monthly, with this week's FC-00084 controls: keep, change, "Not paid this week", the reminder.
18. No separate list to fill in: anyone already in the register who is paid a flat amount shows there.
19. The Payroll tab does not change (FC-00089).

### Part 8: Kept as today
20. Search, entity filter, Active / Inactive filter, the header counts ("N people · M entity records"), same-person suggestions, the rate conflict panel and the register week line.

## Why
The owner, 2026-11-23:
- "All of these fields need to be editable. Drop Downs where needed… Except TNG ID, Former ID. I also want a Display Name field. Full Name, Display Name, Accountant Name (which is only relevant for those marked Deposit or Deposit + Cash"
- "Paid without a schedule. It would just be a subset of the full employee register… Do I really have to add each person?"
- "Yes Display Name should cover every entity, Yes to the other, Accountant Name is only for the Accountant file"
- "The layout and look of Employee Register tab is older… can you fix that? ALso, the export buttons… should match the theme"
- "Make it editable, but give a popup warning if it is tried to be changed. This will become relevant at a later time"
- "Entity should also be a multi select i think"
- "Subrows is fine, need to see it to relaly know"

## Where in UI
- Employee Register tab: the whole tab.
- Register file: two new columns; the load preview.

## Touches
Register tab rendering, roster records (two new person fields), register file (save, load, preview), People sheet, register PDF and CSV, History labels.

## Risk
Medium. The register tab is rewritten, but it reuses the existing setters for every field. Guards:
- pay is unchanged on all real weeks and the Nov 8–14 snapshot;
- the accountant file still ties;
- the register file round-trips every field, the two new ones included;
- showing the register gives out no TNG IDs.

## Reversibility
One revert commit. An older version ignores the two new columns.

## Definition of Done
1. One main row per TNG ID, one sub-row per entity record; a record without a TNG ID is its own row with "pending".
2. Every listed field edits through History with one Undo; TNG ID and Former ID cannot be edited.
3. Ticking an entity adds a linked record with the person's rate; unticking asks, then makes that record inactive; the last active entity cannot be unticked.
4. Full Name and Display Name are kept on every record of the person and round-trip through the register file.
5. Add employee creates a person with the given pay settings.
6. The Paid-without-a-schedule view lists exactly the Flat and Semi-monthly people, with the FC-00084 weekly controls.
7. The tab looks like the Payroll tab.
8. Pay unchanged on all real weeks.

## Out of scope
- Showing the Display Name on other screens and reports (FC-00087).
- TNG ID numbering (FC-00088).
- The Payroll tab (FC-00089).

## Assumptions
- Accountant Name is one per person on this tab; saving it writes it to every record of the person (each record still carries it in the file, as today).
- Active on the main row is Yes when the person is active at any entity; setting it No makes every record inactive, Yes makes them all active.
- A new entity record copies the person's rate, employment type, standing note, Full Name, Display Name and Accountant Name; pay method starts as Deposit, Hourly.
- Unticking an entity is the same as making the person inactive there; the register's Active / Inactive filter shows people by their main-row Active.
- The CSV and PDF exports of the register give out TNG IDs before writing, as they did before this card (they used to do it while building the rows).

## Open questions
None.

**Approved:** the owner, 2026-11-23: "Yes build everythign as fast as possible".

## Tests
`tests/fc00086_register_rebuild.test.js`:
- one row per person with sub-rows; a record without a TNG ID on its own with "pending"; showing the register gives out no IDs;
- each field edits through History and Undo;
- entity tick adds a linked record with the rate; untick asks, makes inactive; last entity refused;
- Full Name and Display Name on every record, History labels, register file round trip, preview labels;
- Add employee;
- the Paid-without-a-schedule view lists Flat and Semi-monthly people with the weekly controls.

## As built (2026-11-23)
- **Rows:** `registerPeople()` groups `registerRows()` by TNG ID (`r.tng || 'rec:' + id`, so unnumbered records never collapse into one person). `registerRows()` no longer calls `assignTngIds()`; the CSV and PDF exports call it themselves, as before. A person with no TNG ID shows "pending".
- **Main row:** Full Name, Display Name, Accountant Name (only when a record pays Deposit or Deposit + Cash), Type, Rate (`regSetRate`: every hourly record, one Undo), Active (`setPersonActive`: every record), Standing Note, Entity (a `<details>` multi-select). Person fields go through `setPersonField(id, field, value)` (`full_name`, `display_name`, `acct_name`, `acct_type`, `acct_note`), written to every record of the person in one Undo step. A blank name shows the saved name as its placeholder.
- **Entity lines:** entity and code, the saved name when it differs from the main row's, Former ID, Pay Method (`regSetMethod`), Pay (`regSetPay`: back to Hourly takes the person's rate), weekly or half-month amount (`regSetFlat`), Deposit Amount (`regSetDeposit`), Deposit Entity (`regSetDepEnt`), Mgmt (`regSetMgmt`), pills for "No schedule" and "Inactive here", and Unlink when the person has more than one record.
- **Entity multi-select:** `regToggleEntity(id, entityId, on)`. Ticking reuses an existing record at that entity (reactivated, or linked with `linkSamePerson` if it has the same name), or makes a new one (next ID at that entity, `addedNew`) and links it; names, employment type, note, accountant name and the rate are copied; one Undo. Unticking asks ("Make <name> inactive at <entity>?") and makes that record inactive; the last active entity is refused with an alert.
- **Names:** record fields `full_name`, `display_name` through `rosterFieldSet` (History "Full Name", "Display Name"); `_setRecordName` sets one record (the register file). Register file columns Full Name and Display Name after Deposit Entity; the load preview lists them; People sheet, PDF and CSV carry them.
- **Add employee:** `regAddEmployee(entIdx, first, last, {method, pay, amount, deposit, mgmt})`. Hourly goes through `addNewEmployee` (now also takes `deposit` and `mgmt`); Flat and Semi-monthly through `addNoSchedPerson` (now also takes `semi`).
- **Paid without a schedule:** `registerFlatRows()`: the visible register's Flat and Semi-monthly records. A "No schedule" tick (`regSetNoSched`) puts an existing person on the FC-00084 weekly check (keep, change, Not paid this week); people not ticked show their amount and method only.
- **Look:** `.reg-card` sections, `#E8E8E4` headers, row hover, styled inputs and dropdowns (`.reg-sel`, `.reg-txt`, `.reg-num`), pills, Excel green like the export cards, the same-person box with an amber edge and `btn` buttons. The week line is amber when the register may be older (`_tngFreshRisk()` when present).
- **Real data:** pay identical on all 6 real weeks (0 diffs, snapshot reopen exact); formulas and accountant tie-out clean; the register file from the Nov 8–14 snapshot round-trips with 0 differing rows and the same pay; opening the Register tab hands out no TNG IDs.
