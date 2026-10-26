# FC-00053 — Drop the whole week folder; each image classified by looking at it; Copy last week's schedule

**Date:** 2026-10-19 · **Slice:** L · **Risk:** Medium · **Status:** done · **Affected entities:** All

## What
1. **Upload the whole week at once.** On the Actuals Intake tab, the owner drops the whole week folder: a regular folder from File Explorer, the Drive zip, or one chosen with a button.
   - Each entity subfolder goes to its entity.
   - Every image is classified as Timecard or EasyClocking by looking at it.
   - The owner checks the sort on one screen, then starts OCR.
2. **Copy last week's schedule.** On the Schedules tab, **Copy last week** fills an entity's schedule from last week's shifts with this week's dates. Every cell stays editable.

## Why
- **Folder upload.** Today the owner downloads the week's folder from Google Drive, opens each entity's subfolder, and drags images into each entity's Timecard or EasyClocking drop zone by hand. The folder already says which entity each image belongs to.
- **Classify by looking.** The owner: "File type will not be enough for image type. You will have to view the image and decide. Bc it might change." The tool already has an image classifier (the Mixed / Auto-Classify box), which looks at the image and decides.
- **Copy last week.** The owner: "I don't really care for a copy last week's schedule button. But go ahead and add it anyways." It has the lowest priority in this card.

## Where in UI
- **Actuals Intake tab, top, above the entity blocks:** a "Drop the week folder or zip here" zone, with **Choose folder** and **Choose zip** buttons.
- **A sort screen** opens after the drop:
  1. folder → entity;
  2. thumbnails grouped as Timecard / EasyClocking per entity;
  3. **Start OCR**.
- **The existing per-entity drop zones stay.** That includes Mixed / Auto-Classify.
- **Schedules tab:** a **Copy last week** button per entity, next to "start blank".

## Touches
intake, schedules, display

## Risk
Medium.
- It changes how images enter the tool.
- A wrong entity or type would send punches to the wrong place, which is why the owner confirms before OCR.
- OCR and pay math are untouched.

## Reversibility
Fully reversible via one revert commit. In the tool, each entity's OCR run is one undo step (FC-00039), as today.

## Definition of Done
1. **Ways in:**
   - dragging a folder from File Explorer, including its subfolders;
   - **Choose folder**, a folder picker;
   - dropping or choosing a `.zip` (JSZip is already loaded).
   - Image types are the ones the drop zones accept today. Other files are listed as skipped.
2. **Folder → entity:**
   - each top-level subfolder is matched to an entity by name, ignoring case, spaces and punctuation;
   - a subfolder name the owner mapped before is remembered as a display preference in the browser (folder name → entity name, no payroll data);
   - an unmatched subfolder, or images sitting in the folder itself, get a dropdown of entities plus **Skip**;
   - deeper subfolders count toward their top-level subfolder.
3. **Image type:**
   - every image is classified by the existing classifier (`classifyTimecardImage`: Gemini looks at a 1024 px copy and answers Timecard or EasyClocking);
   - it runs before OCR, with the same concurrency and retries as OCR;
   - an image the classifier fails on goes to an **Unsure** group;
   - **the file type is never used to decide.**
4. **The sort screen:**
   - thumbnails per entity in Timecard, EasyClocking and Unsure groups;
   - one click moves an image to another group or another entity, and an image can be removed;
   - **Start OCR** is enabled when Unsure is empty.
5. **Start OCR** queues every image to its entity with its type. From there it is the same as dropping it in that entity's typed zone today, so a typed image is not classified a second time.
6. **Duplicates:** an image already in this session (the same SHA-256 as the snapshot uses) is skipped and listed, so dropping the folder twice never doubles punches.
7. **Copy last week:**
   - it takes last week's shifts from last week's snapshot: the one loaded for Since last week (FC-00041), or a picker if none is loaded;
   - every date moves forward 7 days;
   - people archived since are left out;
   - it fills only an empty schedule; if the entity has a schedule, it asks before replacing it;
   - it is one undo step.
8. **Pay is identical.** On Oct 4–10, dropping the real week folder:
   - every image lands in the right entity and type after the owner's check;
   - OCR then runs on the same images, by entity and type, as the hand-sorted run did.

## Built
- **Getting the files in.**
  - The drop zone `#weekFolderDrop` sits at the top of Actuals Intake, with Choose folder (`webkitdirectory`) and Choose zip.
  - A dropped folder is read with `webkitGetAsEntry`; zips with JSZip.
  - `weekDropAddFiles([{file,path}])` does the work.
- **Folders.** `_entityFolderOf` steps over top folders every file shares, so a Drive zip unpacked into the same folder twice still works. `folderEntityIdx` matches, in order:
  1. a remembered choice (browser preference `pv26_folder_map`: folder name → entity name only);
  2. the same name;
  3. one entity name starting with the other.
- **Classifying.** Every image goes through `classifyTimecardImage`, three at a time with up to 3 tries; a failure goes to Unsure. With no API key, every image is Unsure and the screen says so.
- **The sort screen** (`#weekDropOverlay`):
  - a thumbnail per image, with a one-click type switch, an entity choice and remove;
  - folder mapping with Skip;
  - lists of skipped duplicates (same SHA-256 as an image already in the session) and non-images.
  - Start OCR stays off until nothing is classifying, unmapped or unsure.
- **Review fixes:**
  - an image the browser gave no type (e.g. `.HEIC`) gets one from its extension, so it is never dropped at Start OCR;
  - a type chosen by hand wins over a late classifier answer;
  - Start OCR waits while another OCR run is going.
- **Start OCR** adds the images to each entity's typed lists (`addIntakeFiles`) and runs OCR entity by entity. Each entity's run is its own undo step, as today.
- **Copy last week.** `copyLastWeekSchedule(idx)` takes the shifts from last week's snapshot: the one loaded for Since last week, or a file picker. It moves the dates +7 days and loads them through `parseSchedule` (one undo step; archived people are left out as on any load). It asks before replacing a schedule.

## Verification
- `npm test`: all pass, including `tests/fc00053_week_folder.test.js` (11 tests).
- **Real browser (Chromium) with the real week folder** (27 images, nested twice inside the week folder):
  - all three subfolders mapped on their own;
  - after the sort, the images queued to the right entities and types;
  - no JavaScript errors.

  The classifier was replaced by a stand-in, because the test machine has no Gemini key. The classifier itself is the existing one.

## Out of scope
- Reading the folder directly from Google Drive (it would need a Drive connection in the tool).
- Changes to OCR itself.
- Removing the Mixed / Auto-Classify box: it stays (superseded design decision, Oct 19).

## Assumptions
- **Default folder names:** "Nirvana 11th", "Zion Distribution" and "Hefner" match their entities by the name rule.
- **Classifier cost:** one small Gemini call per image, about 27 a week.
- **Copy last week** reads from the snapshot, because the settings file holds no shifts.

## Open questions
None.

## Tests
`tests/fc00053_week_folder.test.js`:
- `test_folder_tree_maps_subfolders_to_entities`
- `test_zip_maps_like_folder`
- `test_unmatched_subfolder_and_root_images_ask`
- `test_mapping_remembered_as_preference_only`
- `test_type_from_classifier_never_file_type`
- `test_classifier_failure_goes_to_unsure_blocks_start`
- `test_move_and_remove_on_sort_screen`
- `test_start_ocr_queues_typed_jobs_no_second_classify`
- `test_duplicate_image_skipped`
- `test_copy_last_week_dates_plus_7_archived_left_out`
- `test_copy_last_week_asks_before_replacing`
- `test_image_without_type_is_still_queued`
- `test_hand_choice_wins_over_a_late_classifier_answer`

Real browser: the Oct 4–10 week folder dropped in Chromium, with the classifier stubbed by the images' known types; no console errors.

## Slice
L

## Affected entities
All

## Changed later (FC-00055, owner's edits of 2026-10-26)
The same sort screen now also opens from each entity's **Mixed / Auto-Classify** box, which takes images, a zip or a folder: every image goes to that entity, is typed by looking at it, and the owner sees the thumbnails as Timecard / EasyClocking / Unsure before anything is read. From that box the screen also offers **Add to the lists** (queue without starting OCR). The week-folder drop at the top is unchanged.
