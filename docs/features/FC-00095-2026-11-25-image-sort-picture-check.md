# FC-00095 — Images are sorted by a picture check, not a retired model

**Date:** 2026-11-25 · **Slice:** S · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
When the week folder is dropped, each image is sorted as Timecard (a phone photo of a paper card) or EasyClocking (a screenshot):
1. **Picture check first, no API needed.** A screenshot is drawn in a handful of exact colours (flat grey rows, white, black text); a photo has thousands of colours. The tool shrinks the image to 256 px without smoothing and measures how much of it the 8 most common colours cover: 0.5 or more → EasyClocking; 0.4 or less → Timecard.
2. **Only an image in between goes to Gemini**, now with a current model (Gemini 2.5 Flash-Lite, no thinking, up to 16 tokens). Gemini may answer Unsure.
3. **An unclear answer is Unsure** (the owner picks), never a guessed Timecard. Unsure is a real answer, so it is not retried three times.
4. **Works without a Gemini key**: the picture check still sorts; only the images it cannot place are left as Unsure.

## Why
The owner, 2026-11-23: about 80% of the images had to be re-sorted or moved out of Unsure. The sort asked Gemini 2.0 Flash-Lite, which no longer answers, so images failed three times and landed in Unsure; any unclear answer was also forced to Timecard.

## Where in UI
Actuals Intake → week folder drop → "check the sort" screen. The older mixed-drop OCR path uses the same check (anything not EasyClocking reads as a timecard there, as before).

## Touches
`classifyTimecardImage` (rewritten), new `imageColourShare`, `imageKindFromShare`, `localImageKind`; `_classifyOne`; `weekDropClassifyAll`; `weekDropProgress` (no-key message).

## Risk
Low. Pay is not involved. A wrong sort is still caught on the sort screen before OCR.

## Reversibility
One revert commit.

## Definition of Done
1. Screenshot-like pixels → EasyClocking; photo-like pixels → Timecard; in-between → Gemini or Unsure.
2. No key and an unclear image → Unsure, not Timecard.
3. Gemini is asked with a current model; an unclear Gemini answer → Unsure.
4. On the owner's real images the picture check sorts every image correctly.

## Out of scope
OCR models for reading punches (unchanged).

## Assumptions
- The cut-offs (0.5 / 0.4) leave a wide margin on both sides of every real image measured.

## Open questions
None.

**Approved:** the owner, 2026-11-25: "Build all of them".

## Tests
`tests/fc00095_image_sort_picture_check.test.js`.

## As built (2026-11-25)
- `imageColourShare(rgba)`: share of non-transparent pixels in the 8 most common exact colours. `imageKindFromShare`: ≥ `IMG_SORT_EC_MIN` (0.5) → EC, ≤ `IMG_SORT_TC_MAX` (0.4) → TC, else null. `localImageKind(file)`: 256 px, `imageSmoothingEnabled=false`.
- `classifyTimecardImage(file, apiKey)` returns `'TC' | 'EC' | 'UNSURE'`: picture check, then (key only) `gemini-2.5-flash-lite` with `thinkingBudget: 0`; anything but TC/EC → UNSURE. Network errors still throw (retried as before).
- `_classifyOne`: UNSURE returns at once (no retries). `weekDropClassifyAll` runs without a key. The two mixed-drop OCR paths map anything but EC to TC, as before.
- `tests/fc00067_sort_progress.test.js`: the no-key reminder text changed to "no Gemini key: sort the Unsure ones by hand".
- **Measured on the owner's real images (private, not committed):** 500 past images (138 screenshots, 362 photos) in Python: screenshots 0.69–0.83, photos 0.02–0.26. In Chromium with the tool's own function on 74 images from the last three weeks: 74 right, 0 wrong, 0 Unsure; screenshots 0.94–0.96, photos 0.02–0.08.
- Tests: 670 of 670 pass.
