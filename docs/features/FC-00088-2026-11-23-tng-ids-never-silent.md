# FC-00088 — TNG IDs are never handed out by looking, and never silently a second time

**Date:** 2026-11-23 · **Slice:** S · **Risk:** Low · **Status:** approved · **Affected entities:** All

## What
1. **Looking hands out nothing.** Opening or redrawing the Employee Register tab no longer gives anyone a TNG ID. A person without one shows "pending". Numbers are handed out only when a file is written: the Employee Register, the Snapshot, or the register's PDF or CSV.
2. **An older file in a browser that has numbered people before.** When nobody in the open file has a TNG ID but this browser has numbered people before, the tool:
   - shows on the Register tab: "⚠ Nobody here has a TNG ID yet, but this browser has numbered people before (up to TNG00039). Load your latest Employee Register so everyone keeps their own number.";
   - asks before handing out numbers: OK gives them new numbers after the highest known; **Cancel numbers nobody**. Asked once per opened file.
3. A file that already has numbers is never asked about: a new hire simply gets the next number.
4. The people count on the Register tab counts a person without a number once (it counted all of them as one).

## Why
On 2026-11-23 the owner's first numbering went well (TNG00001–TNG00039). The dry run found the risk: reopening the old Nov 8–14 snapshot in the same browser and looking at the Register tab silently numbered everyone again as TNG00040–TNG00078. Loading the saved register gives the right numbers back, but nothing warned. The owner, 2026-11-23: "Yes build everythign as fast as possible".

## Where in UI
Employee Register tab (the line under the filters; the "pending" TNG cell); the question when a file is saved.

## Touches
`registerRows`, `_okToIssueTngIds`, `_registerWeekLine`, `exportRegisterCsv`, `exportRegisterPdf`, `openSnapshotData`, `applyStagedSettings`.

## Risk
Low. Pay is not involved. Numbering on save is unchanged for a browser that has never numbered anyone, and for files that already carry numbers.

## Reversibility
One revert commit.

## Definition of Done
1. Viewing the register numbers nobody.
2. The first save in a fresh browser numbers everyone without a question.
3. A file with no numbers, in a browser that numbered before: warning line shown; asked once; Cancel numbers nobody; OK numbers from the next number; a newly opened file is asked again.
4. A numbered file plus a new hire: no question; the new hire gets the next number.
5. The register's PDF and CSV number people before writing.

## Out of scope
Changing how numbers are chosen.

## Assumptions
- "This browser has numbered people before" is the browser's remembered highest number (FC-00083), above 0.

## Open questions
None.

**Approved:** the owner, 2026-11-23: "Yes build everythign as fast as possible".

## Tests
`tests/fc00088_tng_ids_never_silent.test.js`.
