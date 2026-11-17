# FC-00078 — Employee Register and TNG employee IDs

**Date:** 2026-11-17 · **Slice:** L · **Risk:** High · **Status:** drafting · **Affected entities:** All

## What
1. **One ID per person, group-wide:** `TNG` + five digits (`TNG00001`). The tool alone issues IDs. An ID is never typed by hand, never changed and never reused. Nobody is ever deleted: a person who leaves is marked inactive and keeps the ID.
2. **Person and assignment.** The *person* holds the TNG ID, name, aliases, employment type (W2 / 1099) and a standing note. An *assignment* is one per entity the person works at. It holds rate, pay method, Deposit + Cash split, flat or salary amount, active/inactive, a **Management** tick, and the accountant name. A person working at two entities is one TNG ID with two assignments.
3. **Moving to TNG IDs.** On the first load, every `EMP_…` ID gets a TNG ID, numbered in old-ID order: entity, then number. The old ID stays on the record as **Former ID**, so older files still link up. Where two old IDs look like the same person at two entities, a confirm screen lists each pair (e.g. the same name with an old ID at Nirvana 11th and at Zion). They are merged into one person only for the pairs the owner ticks.
4. **Fixed entity codes.** Each entity gets a 3-letter code that the owner sets once. It must be unique and never changes when the entity is renamed. This replaces today's guess from the name, where every "Nirvana…" would be N11 and every "Zion…" ZIO.
5. **Executive PR is retired as a pay method.** Today's Executive PR people become **Deposit** with a flat weekly salary. Each is ticked Management or not person by person, as the owner says; a salaried person can be an employee.
6. **The settings file becomes the Employee Register file**, with these sheets:
   - **People**: one row per person.
   - **Assignments**: one row per person per entity.
   - **This Week**: this run's one-off bonuses and pay dates.
   - **Tool Settings**.
   - **Register Info**: the week it is for, the save time, and the highest TNG ID ever issued.
   
   It is still the file loaded at the start of each week. Older settings files still load, and are moved over as in 3.
7. **Stamp and warning.** The tool remembers the newest register it has loaded or saved, in this browser. It warns plainly before loading an older one, so an old file can never hand out an ID twice.
8. **Employee Register tab.**
   - Every person with their assignments underneath.
   - Search, an entity filter, and active / inactive / all (inactive people greyed, never hidden by default from "all").
   - Downloads: **Excel** (the same file that loads back next week), **PDF** (printable, grouped by entity or by person) and **CSV** (a flat list for any other system).
9. Every change is one History line and undoable; the snapshot carries the register.

## Why
The owner, 2026-11-16: "we're also bringing in all of the other employees from the accountant file… the employee ID is an unchangeable absolutely unique [ID]… unique to the entire Nirvana group enterprise… any historical data or current data or future data for a specific employee is very specifically related only to that employee." "Really the employee IDS need to be separated away from the entity… TNG and then zeros and then a number." "does the settings file now need to turn into an employee register file?" Only the owner edits it ("I will be the only one"). "the employee register itself does need to be viewable and I want to be able to download it as an Excel and as a pdf."

## Where in UI
A new Employee Register tab; the Payroll Settings columns (TNG ID, Management); the settings file load/save (now "Employee Register"); a one-time move screen.

## Touches
identity, settings file, roster, snapshot, exports

## Risk
High. Every pay store is keyed by employee ID, so a wrong merge or re-key would move one person's rate or pay to another. Two guards: the move is shown before it applies, and each pair is merged only on the owner's tick. Pay must be unchanged on every real week, checked base against new.

## Reversibility
One revert commit restores the code. A register file saved by the new version keeps each person's Former ID, so the old version can still read the Assignments sheet's rates.

## Definition of Done
1. Loading this week's settings file gives every person a TNG ID with a Former ID. The same file loaded twice gives the same IDs.
2. Pay, hours and every total are unchanged on all real weeks (base against new).
3. A ticked pair becomes one person with two assignments. An unticked pair stays two people.
4. An ID is never reused: after people are made inactive, or an older file is loaded, the next new person still gets the highest-ever ID + 1. The older file shows the warning.
5. The register round-trips Excel → tool → Excel unchanged. The PDF and CSV list everyone.
6. No employee ID appears on the payroll report or the accountant file.

## Out of scope
- Sharing or multi-user editing (one owner; the file is passed week to week).
- Adding up hours across entities for overtime (the accountant decides; see Open questions).
- Bonuses (FC-00079) and the new report and accountant file layouts (FC-00080, FC-00081).

## Assumptions
- Employment type and the standing note belong to the person. Pay and the Management tick belong to each entity assignment.
- Everyone starts as Employee; Management is ticked per assignment.

## Open questions
1. Which two-entity pairs are the same person: answered on the move screen.
2. For the accountant: when one person works at two of the group's entities in a week, do their hours combine for overtime? Today they are counted per entity. The TNG ID makes either possible later.

## Tests
`tests/fc00078_employee_register.test.js`: ID format and minting; move from EMP to TNG, deterministic; Former ID kept; pair merge on and off; high-water after inactive and after an older file; older-file warning; register Excel round trip; PDF and CSV contents; Executive PR moved to Deposit + flat; pay unchanged (regress).

## Slice
L

## Affected entities
All
