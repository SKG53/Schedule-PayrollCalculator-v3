# FC-00068 — Set how many images are read at once

**Date:** 2026-11-09 · **Slice:** S · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. A setting **Images read at once**, a whole number from **1 to 10**, default **3** (the old fixed value).
2. It sets both places that send images to Gemini in parallel: OCR (`runOcrForEntity`) and the sort screen's typing step (`weekDropClassifyAll`).
3. It can be set in Settings (next to the Gemini key) and in a small number box on the sort screen bar (FC-00067) and the OCR bar (FC-00063).
4. It is a browser preference like the API key (`pv26_ocr_parallel`), not in the settings file, snapshot or any export. Back to 3 removes it.
5. A run keeps the number it started with; the change applies to the next run. The Start OCR toast says the number in use.
6. Values outside 1–10, blank or not whole are refused with the reason; the last good value stays.
7. When Gemini answers "too many requests" (429 / quota) during a run, the OCR bar says *Gemini is limiting requests — try fewer at once*.

## Why
The owner, 2026-11-09: "I also want to be able to set the number of OCR images that the system should do at once. Right now, I think it's 3, but I want to be able to enter more or less please"

## Where in UI
Settings; the sort screen bar; the OCR progress bar.

## Touches
ocr, settings UI

## Risk
Medium. Pay and punches are unchanged, but more requests at once can hit Gemini's rate limit; the existing retry (3 tries, 12 s apart) absorbs some, failed images can be re-run one by one as before, and the bar says to try fewer.

## Reversibility
Fully reversible via one revert; at 3 the behavior is the same as before.

## Definition of Done
1. At 3, OCR and sorting behave as before.
2. At 1, at most one Gemini request is in flight, for OCR and for sorting; at 6, at most six.
3. The value survives a reload and is not written to the settings file, snapshot or any export.
4. Changing it mid-run does not change the running run.
5. 0, 11, blank and "abc" are refused with a message.
6. Rate-limit failures show the "try fewer at once" note.

## Built
- `ocrParallel()`, `setOcrParallel(v)`, `_parseOcrParallel`, `_ocrParallelInputHtml()`, `_isRateLimitErr(err)`, `_ocrRunRateLimited()`; `CONCURRENCY=ocrParallel()` at the start of `runOcrForEntity`; `weekDropClassifyAll` runs `min(ocrParallel(), images)` workers; Settings field `#ocrParallelInput`. Review fixes: one number for a whole multi-entity run (`_ocrRun.parallel`); the bar boxes keep what is being typed across redraws.

## Verification
- `npm test` (tests below count the Gemini calls in flight with a stub).
- Browser: Settings and bar boxes stay in step; a stubbed 429 shows the note; no page errors.

## Out of scope
- Reading several entities at the same time (still one after another).
- Changing the retry count or delay.

## Assumptions
- One number for OCR and sorting (same key, same limit). Maximum 10.

## Open questions
None.

## Tests
`tests/fc00068_images_at_once.test.js` (invented names only):
- `test_default_is_three_and_unchanged_behavior`
- `test_ocr_never_exceeds_setting`
- `test_sort_never_exceeds_setting`
- `test_value_persists_as_pref_not_in_files`
- `test_running_run_keeps_its_number`
- `test_out_of_range_rejected`
- `test_rate_limit_note_shown`
- `test_one_run_across_entities_keeps_one_number`

## Slice
S

## Affected entities
All
