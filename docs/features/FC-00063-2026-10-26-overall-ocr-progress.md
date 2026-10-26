# FC-00063 — One OCR progress bar for the whole run, above all entities

**Date:** 2026-10-26 · **Slice:** S · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
While OCR runs, a bar at the top of Actuals Intake, above every entity, shows the whole run: images read out of all images queued, the entity being read now with its own count, the entities still waiting in order, and how many images failed. It stays at the top while scrolling. When the run ends it says "OCR finished" with the totals until closed or the next run starts.

## Why
The owner: "Since OCR is run one entity at a time, there should be a progress bar shown at the top of the page, above all the entities, that shows overall progress. otherwise, it's hard to tell that something is in progress and that the next entity will follow after the current one finished."

## Where in UI
Actuals Intake, top of the page.

## Touches
display

## Risk
Low. OCR itself is unchanged; each entity's own bar and file list stay.

## Reversibility
Fully reversible via one revert of the FC-00062–65 commit.

## Definition of Done
1. Start OCR from the week folder screen lists every entity in the order they will run, with their image counts, before the first one starts.
2. Run OCR on one entity shows the same bar for that entity; a second entity's Run OCR pressed during a run joins the list.
3. The bar counts images done (read or failed) over images queued, names the current entity and "next: …", and the failures.
4. After the run: "OCR finished · N of N images" (with failures named per entity), and a close button.

## Built
- `_ocrRun` (in memory only), `_ocrRunPlan(order)`, `_ocrRunProgress(idx,done,total,errs)`, `_ocrRunHtml`, `closeOcrRunBar`.

## Verification
- `npm test`.
- Real browser with a real week folder of three entities (OCR stubbed): the bar names the entity being read and the ones next, walks through them in order, ends with "OCR finished"; scrolled far down, the bar stays at the top; no page errors.

## Out of scope
- Running entities in parallel (they still run one at a time).

## Assumptions
None.

## Open questions
None.

## Tests
`tests/fc00063_ocr_progress.test.js`:
- `test_bar_walks_through_the_entities_in_order`
- `test_bar_survives_redraws_and_sits_above_the_entities`
- `test_single_entity_run_and_a_second_one_joins`
- `test_entities_that_never_start_are_named`

## Slice
S

## Affected entities
All
