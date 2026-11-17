# FC-00083 — The Employee Register holds employees only; Tool Settings is its own file; the register week check

**Date:** 2026-11-17 · **Slice:** M · **Risk:** Medium · **Status:** drafting · **Affected entities:** All

## What
Files are still loaded by hand and each week stays in its own folder. There are three files, each with one job.

1. **Employee Register** (`…_EmployeeRegister.xlsx`), saved every week and loaded to start the next. It holds employees only:
   - **Payroll Settings:** one row per person per entity. TNG ID, name, aliases, employment type, rate, pay method, Deposit + Cash split, flat or salary amount, Active, Management, accountant name and standing note.
   - **People:** one row per person, for reading.
   - **Bonuses** (was "This Week"): every bonus with its week, and its end week for a recurring one. A bonus still counts only in its own weeks (FC-00082).
   - **Paid Days:** the days already paid in an earlier run (FC-00066), so they are never paid twice.
   - **Register Info:**
     - the week it is for, and the save time;
     - the highest TNG ID issued, and the highest former employee ID per entity;
     - each entity's fixed code.
     These are about who people are, so they stay with the register.
2. **Tool Settings** (`TNG_ToolSettings_<date>.xlsx`), its own file, saved only when a setting changes. It holds the report's columns, the week-over-week warning levels, the file labels and how names print. It has its own card on Exports and loads with the same Load button (the tool tells the two files apart). Loading the register never changes a tool setting, and loading Tool Settings never changes an employee.
3. **Snapshot**, unchanged: the whole tool exactly as it was when the week's payroll was finished. Every screen, the employees, the tool settings, the timecards and the reviews. Opening one brings all of it back.

**Older files still load.** A settings or register file from before this card has employees and Tool Settings in one file; loading it applies both, as today.

**Register week check (no TNG ID issued twice):**
4. When a register is loaded, its week is compared with the week of the schedules loaded.
   - The same week, or the week right before: fine.
   - Older: a plain warning names both weeks, e.g. "This register is from the week of 10/25/26; you are running the week of 11/15/26. Load the register saved with last week's payroll."
   - Newer than the schedules: a warning too.
   - If the schedules come in after the register, the check runs then.
5. After an older register was loaded anyway, adding a new person asks for confirmation before a TNG ID is issued. The confirmation names the highest ID known.
6. Opening any snapshot also records its highest TNG ID. That raises the highest ID known in this browser.
7. The Employee Register tab shows the register's week, its highest TNG ID, and ✓ (last week's) or ⚠ (older).

## Why
The owner, 2026-11-17:
- "Employee Register file shouldn't have tool settings, only the employee's payroll settings like rate, type, etc right?"
- "The bonuses makes sense. to be part of employee register"
- "the snapshot is a fully inclusive snapshot like now. It loads literally the entire tool as it was when i finished a prior week's payroll."
- On files: "I want to continue storing and uploading registers, settings, etc." The tool has no folder access, and a TNG ID must never be issued twice (FC-00078).

## Where in UI
- The Exports cards: Employee Register; Tool Settings (new); Snapshot.
- The Load button.
- The Employee Register tab.
- Adding a new person.

## Touches
register file, tool settings file, load, snapshot open, TNG ID issuing

## Risk
Medium. Moving rows between files must lose nothing. The guards:
- a register saved and loaded back gives the same employees, bonuses, paid days, IDs and codes;
- a Tool Settings file saved and loaded back gives the same settings;
- an older combined file still loads both;
- pay is unchanged on all real weeks.

## Reversibility
One revert commit. The older version still reads the new register's Payroll Settings sheet.

## Definition of Done
1. **Register:** the new register file contains no tool setting. It round-trips employees, bonuses (with weeks), paid days, the highest IDs and the entity codes.
2. **Tool Settings:** the file contains no employee and round-trips every setting.
3. **Older files:** last week's real settings file loads fully, employees and settings.
4. **Week check:** last week's register with this week's schedules gives no warning. An older one warns, whichever is loaded first. A new TNG ID after it needs confirmation.
5. **Snapshot:** opening a later snapshot raises the highest TNG ID.
6. **Pay:** unchanged on all real weeks.

## Out of scope
- Reading other weeks' folders (no folder access).
- Overtime for cash-paid people (later).

## Assumptions
- Entity codes and the highest IDs belong with the register because they decide employee IDs.
- Entity colors stay in the snapshot, as today.

## Open questions
None.

## Tests
`tests/fc00083_register_split_and_week_check.test.js`:
- register round trip, with no setting in it;
- Tool Settings round trip, with no employee in it;
- an older combined file;
- telling the files apart on load;
- the week check in both load orders;
- confirmation on a new ID;
- a snapshot raising the highest ID;
- the Register tab's line.

## Slice
M

## Affected entities
All
