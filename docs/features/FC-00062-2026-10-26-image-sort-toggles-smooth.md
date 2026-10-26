# FC-00062 — Image sort screen: clear Timecard / EasyClocking / Unsure toggles, no jumping

**Date:** 2026-10-26 · **Slice:** M · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
The screen that sorts the images of a dropped week folder, zip or Mixed / Auto-Classify drop (FC-00053, FC-00055) is reorganized:
1. Every image has three clear toggles, **Timecard · EasyClocking · Unsure**, with the current one filled in its color. The small "→ EasyClocking" arrow button is gone.
2. A summary line at the top counts, per entity, timecards, EasyClocking screenshots and unsure images, and the images still being looked at.
3. Per entity, the **Unsure** group comes first (it needs a decision), then Timecard photos, then EasyClocking screenshots. Each group has a header with its count and a colored edge.
4. Changes are smooth: when an image changes group (a toggle, or the classifier finishing), the cards glide from where they were to where they land, and the image that changed is outlined for a moment, so it is clear what moved. Nothing else on the screen jumps, and the screen keeps its scroll position.

## Why
The owner: "The sorting of the images when i upload a zip file of time cards or easy clocking screenshots - this looks and feels very clunky. I should see very clear toggles for Timecard vs EasyClocking vs Unsure. Not just a little arrow to change it to the other one. Just have to organize this page a little better. Also, the page where i choose which type of image is very jumpy. Things just move immediately without smoothness. It's hard to tell what change happened when this jumping happens."

## Where in UI
Actuals Intake → week folder drop, or an entity's Mixed / Auto-Classify box → the sort screen.

## Touches
display

## Risk
Low. What gets OCR'd and as which type is unchanged; "Unsure" still has to be resolved before Start OCR.

## Reversibility
Fully reversible via one revert of the FC-00062–65 commit.

## Definition of Done
1. Each image card shows Timecard / EasyClocking / Unsure toggles; the chosen one is pressed and colored (Timecard blue, EasyClocking green, Unsure amber). Choosing Unsure by hand puts the image in the Unsure group and Start OCR waits for it.
2. The summary line counts per entity and updates live.
3. Group order per entity: Unsure, Timecard, EasyClocking.
4. Moving a card animates (about a quarter second) and highlights the moved card; with the system's reduced-motion setting there is no animation, only the highlight.
5. The overlay keeps its scroll position on every redraw.

## Built
- `weekDropSetKind(id,kind)` takes 'TC', 'EC' or 'UNSURE'.
- `_weekDropSummaryHtml`, `_wdToggleHtml`; `_renderWeekDrop` records card positions before the redraw and animates them after (`_wdFlip`); `_wdLastChanged` marks the card to outline.

## Verification
- `npm test`.
- Real browser on a real week's images: summary counts per type; groups Unsure → Timecard → EasyClocking; toggling a Timecard card to EasyClocking glides it to its group and outlines it; no page errors.

## Out of scope
- How images are classified (Gemini looking at each image, FC-00053).

## Assumptions
- "Unsure" set by hand means "I need to look at this again", so it blocks Start OCR like an image the classifier could not decide.

## Open questions
None.

## Tests
`tests/fc00062_image_sort_toggles.test.js`:
- `test_three_clear_toggles_no_arrow`
- `test_group_order_and_summary`
- `test_toggle_moves_the_image_and_marks_it`
- `test_unsure_by_hand_waits_for_a_decision`
- `test_by_hand_choice_survives_the_classifier`

## Slice
M

## Affected entities
All
