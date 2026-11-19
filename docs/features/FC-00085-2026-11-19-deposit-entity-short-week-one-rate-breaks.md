# FC-00085 — Deposit Entity; short-week deposit check; accountant file blocks when incomplete; one rate per person; breaks per person; TNG IDs on the snapshot

**Date:** 2026-11-19 · **Slice:** L · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What

### Part 1: Deposit Entity
Some people work at one entity but are paid by deposit from another. Today the accountant file always lists them under the entity they work at.

1. **The setting.** Each person gets a **Deposit Entity** on the Employee Register tab. It defaults to the entity they work at. The owner changes it for anyone whose deposit comes from another entity.
2. **What moves.** Only the deposit moves: Deposit pay, the deposit part of Deposit + Cash, and any bonus paid by deposit. Cash and contract checks stay with the entity they work at.
3. **Accountant file.** Grouped by Deposit Entity. The accountant sees each entity and the people it pays, nothing else. There is no extra column: the accountant never sees where a person works.
   - Example: Avery Atest works at Alpha Test, Deposit Entity Beta Test, deposit $500. She is listed under Beta Test, and Beta Test's Gross Total includes the $500.
4. **Payroll report (internal).** Still grouped by the entity people work at, as now, with a new **Deposit Entity** column. It is blank when it is the same entity, so only the differences show.
5. **Our check.** Each Deposit Entity's Gross Total on the accountant file ties to the deposits that entity pays this week. Shown on the Accountant file card, as today.
6. **Labor cost and stats** stay with the entity where the work happened.
7. **Saved in the register** as a new column, Deposit Entity. The unused "Accountant Section" value, where one exists, becomes the Deposit Entity when an older file is loaded.

### Part 2: Short-week check for Deposit + Cash
A Deposit + Cash person has a set deposit. When hours × rate comes to less than that deposit, the tool today quietly lowers the deposit to the hours pay.

8. **A flag** on the Payroll tab: "Hours pay $X (H h × $R) is $D less than the set deposit of $S."
   - Example: Bram Btest, 30 h × $14 = $420.00, set deposit $500.00: "$80.00 less".
9. **The owner's choice, for this week only:**
   - **Pay the deposit:** deposit = the set deposit, cash $0. The total is the set deposit.
   - **Pay the hours:** deposit = the hours pay, cash $0.
10. **Until the owner chooses:** the row pays by the hours, as today, and counts in a reminder on the Payroll tab ("N short-week deposits not yet decided"). The choice is kept with the run (Undo, History, snapshot), not in the register.

### Part 3: The accountant file is not written until it is complete
11. The Accountant file (Excel and PDF) is not written while any of these is open, and the card lists what is missing:
    - the Deposit pay date is not set;
    - someone on the file has no Employment Type;
    - someone paid by the hour has no rate;
    - a short-week deposit (Part 2) is not decided.
    Today these only warn.

### Part 4: One rate per person
12. **One hourly rate per person** (same TNG ID) across every entity they work at. Changing it at any entity changes it at all of them, in one Undo step.
13. **Files that disagree:** if a loaded register or snapshot has two different rates for the same person, the tool changes nothing on its own. It flags the person on the Register tab and the Payroll tab, and the owner picks the right rate once.
14. Pay method, flat amounts and the deposit amount stay per entity, as today.

### Part 5: Breaks per person
15. **On the Payroll tab,** under each person: a **Breaks** line with the punched break per day (e.g. "0:00 · 0:32 · OFF · 0:00 …") and the week's total.
16. **A flag on every shift with no punched break,** whatever its length: a day with punches and no time punched out between them. Shown in that day's cell and counted on the person's line ("3 shifts with no break").
17. Display only: pay does not change.

### Part 6: TNG IDs on the snapshot
18. Saving the Snapshot hands out TNG IDs to anyone without one, as saving the register does. So the register and the snapshot saved in the same session always carry the same numbers.

## Why
The owner, 2026-11-19:
- On the accountant's sections: "We might not always put employees at the accountant under the entity they work for. Need an option to choose which entity for deposit too" · "It's specifically Deposit Entity. The cash amount usually comes from the Entity they are under" · "The Accountant file doesn't need the employee separated by actual entity vs deposit entity anyways. The accountant file only has the entity and employees under to get paid. Only we internally have the differences between entity belonging to and deposit entity"
- On a short week: "i want to have the option to see that the finalized amount is less than the expectde salaried amount. Then decide what i want to do."
- On rates: "Remove the option for two different rates at two different entities. Not right now"
- On breaks: "I think we probably need a clearer way to see breaks per employee … it's easy to lose the break time visually" · "I need a flag on any shift without a break honestly. not just 6h+"
- On the accountant file: from the Nov 19 review, the file could be written with missing employment types and no deposit date.

## Where in UI
- Employee Register tab: Deposit Entity column; the rate flag.
- Payroll tab: short-week flag and choice, the reminder, the Breaks line and the no-break flags, the rate flag.
- Exports tab: the Accountant file card's list of what is missing.
- Payroll report: the Deposit Entity column.
- Accountant file: sections by Deposit Entity.

## Touches
roster records, register file (save and load), payroll rows, Deposit + Cash breakdown, the payroll report (screen, Excel, PDF), the accountant file and its self-check and tie-out, snapshot, Payroll tab rendering

## Risk
Medium. Part 1 moves deposits between the accountant file's sections and Part 4 changes how rates are stored. The guards:
- pay is unchanged on all 6 real weeks and the Nov 8–14 snapshot (nobody has a Deposit Entity, no rate conflicts unless real data has them; any found are listed, not changed);
- the accountant file checks out on its own and ties per Deposit Entity;
- the register and the snapshot round-trip every new field exactly.

## Reversibility
One revert commit. An older version ignores the Deposit Entity column (the accountant file goes back to the work entity) and reads rates per entity again.

## Definition of Done
1. **Deposit Entity:** a person with another Deposit Entity is listed under it on the accountant file; that entity's Gross Total includes their deposit and ties; the work entity's does not. Their cash stays on the work entity. The payroll report shows the column only where it differs.
2. **Short week:** the flag appears exactly when hours pay < set deposit; each choice gives the stated deposit, cash and total; the reminder counts undecided rows; Undo and the snapshot keep the choice.
3. **Accountant file:** not written while any listed item is open; written as before once all are set.
4. **One rate:** changing a linked person's rate at one entity changes it at every entity, one Undo; a file with two rates for one person flags it and changes nothing until the owner picks.
5. **Breaks:** each day's punched break and the week's total show; every shift with no punched break is flagged, at any length.
6. **Snapshot:** saving it gives TNG IDs to anyone without one; the register saved after it carries the same numbers.
7. **Pay:** unchanged on all real weeks.

## Out of scope
- Overtime across two entities (later).
- Overtime for Cash and Deposit + Cash people (later).
- Different rates at different entities.
- Deducting breaks that were not punched.

## Assumptions
- A bonus paid by deposit follows the Deposit Entity.
- Contract checks stay with the work entity.
- "No punched break" means one punch-in and one punch-out for the day, with no time punched out between them.
- When a short-week choice is "Pay the deposit", the week-over-week check treats the deposit as the pay.

## Open questions
None.

**Approved:** the owner, 2026-11-19: "Write everything please".

## Tests
`tests/fc00085_deposit_entity_short_week_rate_breaks.test.js`:
- Deposit Entity: accountant sections, gross and tie per entity, payroll report column, register round trip, an old Accountant Section value read as the Deposit Entity;
- short week: flag threshold, both choices, the reminder, Undo, snapshot;
- accountant file blocked for each missing item, written once complete;
- one rate: change at one entity carries to all, one Undo; conflicting file flagged, nothing changed;
- breaks: per-day minutes, weekly total, flag on a short shift with no break and none on a shift with a punched break;
- snapshot save issues TNG IDs; register saved after it has the same numbers.

## As built (2026-11-19)
- **Deposit Entity:**
  - Kept on the roster record as `dep_ent` (the entity's name; blank = the entity they work at), set with `setDepositEntity(entId, name, entityName, screen)` through History.
  - Read with `getDepositEntityId`, `getDepositEntityName` and `depositElsewhere`.
  - **Register tab:** a Deposit Entity dropdown for Deposit and Deposit + Cash people ("<entity> (works here)" or another entity). Others show "—".
  - **Register file:** a new last column, Deposit Entity. Loading an older file with only an Accountant Section reads it as the Deposit Entity (`_entityFromSection`: "BETA TEST VENTURES" → Beta Test).
  - **Accountant file:** `_acctData()` groups the rows by Deposit Entity, in entity order. Self-check and tie-out per Deposit Entity.
  - **Payroll report:** a Deposit Entity column (`depEnt`), on by default but shown only when someone active is paid from another entity (`_anyDepositElsewhere`). The owner can turn it off in the column picker.
- **Short week:**
  - `shortWeekInfo(entId, name, total)` flags a Deposit + Cash person with a typed deposit whose pay before bonuses is below it.
  - `_bothFor(entId, name, total)` is now the one place a Deposit + Cash breakdown is made (export data, the Payroll tab's all-entity table, `_computePayBreakdownBase`). "Pay the deposit" builds the breakdown from the set deposit (cash $0); "Pay the hours" and undecided keep the old math.
  - The choice is the tool-setting key `swDep:<recId>|<week>` ('deposit' or 'hours'), labelled in History; not written to either file; kept in the snapshot.
  - The panel `_shortWeekHtml()` is at the top of the Payroll tab, with both buttons and "undo choice".
  - **Excel:** a row paid at the deposit writes Total as a fixed amount (not hours × rate); Deposit and Cash stay live formulas from Total.
- **Accountant file blocks:** `acctBlockers()` lists the deposit pay date, missing employment types, missing rates and undecided short weeks. `_acctCheckOrBail` refuses to write the Excel or PDF while any is open; the card shows "Not written until complete".
- **One rate per person:**
  - `_rateSiblings` / `_spreadRate`: a rate typed on the Payroll tab is copied to the person's other entity records (same TNG ID, not flat), behind one checkpoint, "Rate change (every entity)".
  - `rateConflicts()` lists people whose active records have different rates; `_rateConflictHtml()` shows them on the Register and Payroll tabs with a "Use $X" button per rate (`setPersonRate`, one checkpoint).
  - A loaded file is never changed on its own.
- **Breaks:** `punchedBreakMin(day)` (time between the first in and the last out not on the clock), `breakSummary(row)` and `_breakRowHtml(row)`: a Breaks line under each person in Weekly Actuals with each day's punched break, "0:00 no break" in red for a shift with none (any length), the person's count of shifts with no break and the week's total. Pay unchanged.
- **Snapshot:** `saveSnapshot()` and the snapshot in "Download all" call `assignTngIds()` first.
- **Checked on the real Nov 8–14 week (private, not committed):**
  - pay unchanged: 27 rows, same total to the cent;
  - two Deposit + Cash people moved to another Deposit Entity: that entity's accountant total went up by exactly their deposits, the other went down by the same, and the grand total stayed the same; every entity ties and the file checks out;
  - a short week (deposit raised above the hours pay) is flagged, blocks the accountant file until decided, and "Pay the deposit" pays the deposit with cash $0;
  - LibreOffice recalculation of the payroll report and the accountant file: 0 mismatches;
  - every shift's break shows; shifts with no punched break are flagged.
- **Six real weeks:** pay identical to the base build, snapshot reopen exact, report and accountant formulas 0 bad, tie-out OK.
