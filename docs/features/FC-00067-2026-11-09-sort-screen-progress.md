# FC-00067 — Progress bar on the image sort screen: working, or waiting for you

**Date:** 2026-11-09 · **Slice:** S · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
1. The sort screen opens the moment the folder or zip is dropped, with a bar pinned at its top (before, nothing showed while the zip was opened and each image was checked).
2. While the tool works, the bar fills and names the step, with a count that moves: *Opening the folder or zip…*, *Checking for images already in this session · 12 of 30*, *Looking at the images · 18 of 30* with a count per entity under it (*ALPHA 8 of 8 · BETA 6 of 12 · GAMMA 4 of 10*); an image being retried is named (*retrying 1 image*).
3. When the tool is done the bar stops in one of two states: green *Ready — press Start OCR*, or amber *Waiting for you* plus what is needed (*3 images need a type (BETA)* · *1 folder needs an entity* · *an OCR run is still going* · *no Gemini key: sort by hand*) with a **Show me** button that scrolls to the first one and outlines it.
4. The **Unsure** pills in the summary row go to that entity's Unsure images.
5. The small orange list beside Cancel is now in the bar; the buttons stay where they are. Cancel while opening or checking stops it.

## Why
The owner, 2026-11-09, on the sort screen: "i need a progress bar to show for the sort process. otherwise, idk when the system is working or idling bc its waiting for me"

## Where in UI
Actuals Intake → the week-folder sort screen and the Mixed / Auto-Classify sort screen.

## Touches
display

## Risk
Low. How images are typed, fingerprinted and skipped is unchanged; only when the screen opens and what it shows.

## Reversibility
Fully reversible via one revert.

## Definition of Done
1. Dropping a zip shows the screen and the bar before any image is checked.
2. Each step shows its label and a count rising to the total; the fill matches the count.
3. Per-entity counts while looking add up to the total.
4. Nothing needed → green Ready; otherwise amber Waiting for you with each need named.
5. Show me scrolls to the first image or folder that needs a decision and outlines it.
6. A toggle changed by hand updates the bar at once.
7. No API key: Waiting for you · no Gemini key: sort by hand (no fake progress).
8. Duplicates and non-images are still skipped as before.

## Built
- `_wdOpening` / `_wdOpen` (screen open while the folder or zip is read; Cancel stops it), stages `open` → `check` (count) → `look` (`lookTotal`), `_classifyOne` marks retries.
- A Cancel button is shown while opening and checking (review fix).
- `weekDropProgress()` (state, step, counts, per-entity counts, needs), `_weekDropBarHtml()`, `weekDropShowMe(entIdx?)`; CSS `.wd-bar` (sticky), ready / waiting colors, indeterminate fill while the size is unknown.

## Verification
- `npm test` (tests below; FC-00062's summary test updated for the clickable pill).
- Browser (Chromium) with a three-entity week zip and a stubbed classifier: the bar walks open → check → look with counts, ends in Waiting for you / Ready; Show me scrolls; no page errors.

## Out of scope
- Looking at images faster or in another order (FC-00068 sets how many at once).
- Any change to OCR or its bar.

## Assumptions
- Images are looked at in parallel by the FC-00068 number (default 3, as before).

## Open questions
None.

## Tests
`tests/fc00067_sort_progress.test.js` (invented names only):
- `test_screen_opens_before_fingerprinting`
- `test_bar_steps_and_counts_rise_to_total`
- `test_per_entity_counts_add_up`
- `test_ready_state_when_nothing_needed`
- `test_waiting_state_names_each_need`
- `test_show_me_targets_first_need`
- `test_hand_toggle_updates_bar`
- `test_no_api_key_waiting_state`
- `test_duplicates_still_skipped`
- `test_cancel_while_opening_stops`
- `test_cancel_shown_while_opening`

## Slice
S

## Affected entities
All
