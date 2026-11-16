# FC-00076 — Retry all failed images

**Date:** 2026-11-16 · **Slice:** S · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
1. **Retry all failed (N)** reads every failed image again in one go:
   - on each entity, above its image list (that entity's failed images);
   - on the OCR bar at the top of Actuals Intake (every entity's failed images), also after the bar's run is over or the bar was closed.
2. It is one run: the OCR bar counts it, **Images read at once** applies, each image gets up to 3 attempts, and one Undo step takes it all back. Images whose file is no longer attached (after reopening a snapshot) are not counted.
3. The buttons show only when something failed and nothing is running; they appear as soon as a run ends.
4. **Credits used up (HTTP 402, "Your prepayment credits are depleted"):** that image is not tried again, the rest of the run is not sent ("Not read: Gemini credits are used up"), and the bar and the entity say "Gemini credits are used up — add credits at aistudio.google.com/billing, then press Retry all failed". Before, every image waited through 3 attempts.
5. The single-image Retry 1x / Retry 3x buttons stay.

## Why
The owner, 2026-11-16, after a run where every image failed on used-up Gemini credits: "seems i can only hit retry 3x for one image at a time? if many fail like this - i don't have a "Retry All Failed" button overall and by entity? Need to fix if that's not possible"

## Where in UI
Actuals Intake: the OCR bar and each entity's image list.

## Touches
intake, display

## Risk
Low: it reuses the single-image retry; rows from a failed image are replaced the same way.

## Reversibility
Fully reversible via one revert commit.

## Definition of Done
1. One press retries every failed image of the entity / of every entity, never more at once than Images read at once.
2. A credits error is tried once, stops the run and names the fix; after adding credits one press reads them all.
3. One Undo step reverts the retry.

## Out of scope
- Showing the credit balance in the tool.

## Assumptions
- 3 attempts per image, like Run OCR.

## Open questions
None.

## Tests
`tests/fc00076_retry_all_failed.test.js`: `test_retry_all_for_one_entity`, `test_retry_all_for_every_entity_one_undo`, `test_credits_error_not_retried_and_stops_the_run`, `test_buttons_shown_only_when_something_failed_and_nothing_runs`.

## Slice
S

## Affected entities
All
