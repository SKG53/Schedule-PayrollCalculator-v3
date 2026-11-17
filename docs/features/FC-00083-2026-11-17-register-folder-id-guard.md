# FC-00083 — The register folder: no TNG ID issued twice on any computer

**Date:** 2026-11-17 · **Slice:** M · **Risk:** Medium · **Status:** drafting · **Affected entities:** All

## What
1. **One Register folder.**
   - The Employee Register files live in one folder: `Payroll Tool\Registers` on OneDrive, so every computer sees the same files.
   - The owner picks the folder once per browser; Chrome asks for permission.
2. **On load,**
   - the tool reads every `Employee_Register_….xlsx` in the folder;
   - it takes the highest TNG ID ever issued across all of them;
   - it offers the newest register.
   - Picking an older one warns, and new IDs still start above the folder's highest.
3. **On save,** the new register is written into the same folder, not into Downloads. Older registers are never overwritten.
4. **Without the folder** (another browser, or permission not given):
   - the per-browser warning stays;
   - the tool also warns when the register's week is more than one week older than the schedule week being run ("Is there a newer register?").
   - Adding a new person, which issues a new TNG ID, asks for confirmation in that case.
5. The Employee Register tab shows where the highest ID came from: the folder, or this browser only.

## Why
The owner, 2026-11-17, on the register guard working in one browser only: "How can you fix this?" A TNG ID must never be issued twice (FC-00078). Today an older register loaded on another computer could issue an ID again.

## Where in UI
- Loading and saving the register (folder pick, newest offered).
- The Employee Register tab (source of the highest ID).

## Touches
register load and save, TNG ID issuing

## Risk
Medium.
- The File System Access API works in Chrome and Edge only; other browsers use the fallback in 4.
- A register saved outside the folder is invisible to the check. The tool saves only into the folder once one is set.

## Reversibility
One revert commit. The register files themselves do not change format.

## Definition of Done
1. With two registers in the folder, loading the older one warns. A person added afterwards gets the folder's highest ID + 1.
2. A new browser with the folder picked gives the same result.
3. Without the folder, a register more than a week older than the schedule week warns, and a new ID needs confirmation.
4. Saving writes a new dated file into the folder and never overwrites an older one.

## Out of scope
- Several people editing the register at the same time (one owner).
- Bonus weeks, bonus rows, page headings and the accountant check (FC-00082).

## Assumptions
- The owner runs payroll in Chrome on computers that sync the Payroll Tool folder through OneDrive.

## Open questions
None.

## Tests
`tests/fc00083_register_folder.test.js`:
- highest ID across the folder;
- older-file warning;
- new ID above the folder's highest;
- save into the folder without overwriting;
- the fallback's age warning and its confirmation on a new ID (the folder API stubbed).

## Slice
M

## Affected entities
All
