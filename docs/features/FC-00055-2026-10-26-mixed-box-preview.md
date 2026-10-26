# FC-00055 — Mixed / Auto-Classify box: drop images, a zip or a folder and see what each image is before OCR

**Date:** 2026-10-26 · **Slice:** S · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
Each entity's **Mixed / Auto-Classify** box takes images, a `.zip` or a whole folder. Every image is looked at right away and a preview opens with the thumbnails sorted into **Timecard photos**, **EasyClocking screenshots** and **Unsure** for that entity. The owner can switch a type with one click, remove an image, then **Add to the lists** or **Start OCR**.

## Why
The owner: "if i upload a zip file or a folder full of screenshots on the 'Mixed / Auto Classify' button for each entity, can you show me a quick preview … that shows thumbnails of the images I uploaded and which category they'd fall into?"

Before: the box took only image files — a zip or a folder dropped on it was ignored without a word — and the type was decided inside OCR, so nothing showed what each image was.

## Where in UI
Actuals Intake → each entity's Mixed / Auto-Classify box (now with **Folder** and **Images or zip** buttons) → the sort screen, titled "<ENTITY> — what each image is, before OCR".

## Touches
intake, display

## Risk
Low. It reuses the FC-00053 reader, classifier and sort screen; OCR and pay math are untouched.

## Reversibility
Fully reversible via one revert of the FC-00054–61 commit.

## Definition of Done
1. Drag-and-drop or pick: images, a zip, or a folder (subfolders included). Non-images are listed as skipped; an image already in the session is skipped (same SHA-256), so nothing is read twice.
2. Every image belongs to the box's entity, whatever folder it sits in.
3. Every image is classified by looking at it (FC-00053's classifier, 3 at a time, 3 tries); a failure goes to Unsure. Never by file type.
4. The preview shows a thumbnail per image (click for full size) grouped by type, with a type switch and Remove.
5. **Add to the lists** puts the images on the entity's Timecard / EasyClocking lists without starting OCR; **Start OCR** runs it. Both stay off while anything is unsure or still being looked at.
6. The week-folder drop (FC-00053) is unchanged.

## Built
- `_wireMixedDrop(idx)`: drop → `mixedDropFromDataTransfer`, pickers → `mixedDropFromInput`; both call `weekDropAddFiles(list,{entIdx})`.
- `weekDropAddFiles` takes `opts.entIdx` (scope): every item gets that entity; the screen hides folder mapping and shows **Add to the lists** (`weekDropStartOcr(true)`).
- Zip and folder reading shared with FC-00053 (`_listFromDataTransfer`, `_expandZips`).
- Thumbnails 132 px with click-to-enlarge.

## Verification
- `npm test`: all pass; `tests/fc00055_mixed_box_preview.test.js` (5 tests).
- Real browser: a zip of a real entity's 8 images on that entity's box → 6 Timecard, 2 EasyClocking, all on that entity, 8 thumbnails; **Add to the lists** queued 6 + 2 with OCR not started; a folder through the Folder button → 9 images on its entity. The classifier was a stand-in (no Gemini key on the test machine).

## Out of scope
- Changing the classifier or OCR.

## Assumptions
- No Gemini key: every image is Unsure and the owner sorts by hand (as FC-00053).

## Open questions
None.

## Tests
`tests/fc00055_mixed_box_preview.test.js`:
- `test_mixed_drop_belongs_to_its_entity_whatever_the_folders`
- `test_preview_shows_thumbnails_by_type_and_offers_add_or_ocr`
- `test_add_to_lists_queues_typed_images_without_ocr`
- `test_non_images_and_duplicates_skipped`
- `test_week_folder_drop_unchanged`

## Slice
S

## Affected entities
All
