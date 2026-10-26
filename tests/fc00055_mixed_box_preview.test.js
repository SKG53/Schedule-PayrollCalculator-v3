// FC-00055: the Mixed / Auto-Classify box takes images, a zip or a folder. Every image is looked
// at right away and a sort screen shows each thumbnail as Timecard, EasyClocking or Unsure for
// that entity, before anything is read. The owner can fix a pick, add the images to the lists,
// or start OCR.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const img = (name, bytes, type) => ({ name, type: type !== undefined ? type : (/\.png$/i.test(name) ? 'image/png' : 'image/jpeg'), arrayBuffer: async () => new TextEncoder().encode(bytes || name).buffer });
function setup() {
  const api = loadApp();
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  api.__sandbox.crypto = webcrypto;
  resetToSingleEntity(api, { id: 0, name: 'ALPHA ONE', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api.entities.push({ id: 1, name: 'BETA', code: '', employees: [], dateLabels: WEEK.slice(), newDateLabels: ['', '', '', '', '', '', ''], newWeekStartVal: '', breakMinutes: 0, breakMinutesSet: true, actualDays: [], intake: null });
  api.entities.forEach(e => { api._syncEntityCode(e); api.ensureIntakeState(e); });
  api._setClassifierForTests(async (f) => { const t = new TextDecoder().decode(await f.arrayBuffer()); if (t.includes('broken')) throw new Error('x'); return t.includes('screen') ? 'EC' : 'TC'; });
  return api;
}

test('test_mixed_drop_belongs_to_its_entity_whatever_the_folders', async () => {
  const api = setup();
  // A folder dropped on BETA's Mixed box, with subfolders named like the other entity.
  const files = [img('a.jpg'), img('b.png', 'screen b'), img('c.jpg', 'card c')];
  files[0].webkitRelativePath = 'Week/ALPHA ONE/a.jpg'; files[1].webkitRelativePath = 'Week/x/b.png'; files[2].webkitRelativePath = 'Week/c.jpg';
  const wd = await api.mixedDropFromInput(1, files);
  assert.equal(wd.scope, 1);
  assert.deepEqual(wd.items.map(i => i.entIdx), [1, 1, 1], 'every image goes to BETA');
  assert.deepEqual(wd.items.map(i => i.kind), ['TC', 'EC', 'TC'], 'typed by looking at each image');
  assert.deepEqual(api.weekDropBlockers(), []);
});

test('test_preview_shows_thumbnails_by_type_and_offers_add_or_ocr', async () => {
  const api = setup();
  await api.mixedDropFromInput(0, [img('a.jpg'), img('b.png', 'screen b'), img('x.jpg', 'broken')]);
  const html = api._weekDropHtml();
  assert.match(html, /Timecard photos · 1/);
  assert.match(html, /EasyClocking screenshots · 1/);
  assert.match(html, /Unsure — pick a type · 1/, 'an image the classifier could not read waits for the owner');
  assert.match(html, /Add to the lists/);
  assert.match(html, /Start OCR/);
  assert.doesNotMatch(html, /Which entity is each folder/, 'no folder mapping: the box already says which entity');
});

test('test_add_to_lists_queues_typed_images_without_ocr', async () => {
  const api = setup();
  const wd = await api.mixedDropFromInput(0, [img('a.jpg'), img('b.png', 'screen b')]);
  api.weekDropSetKind(wd.items[0].id, 'EC'); // the owner corrects a pick
  await api.weekDropStartOcr(true);
  const it = api.entities[0].intake;
  assert.deepEqual([it.timecardFiles.length, it.easyclockFiles.length], [0, 2], 'typed lists, as if dropped in the typed boxes');
  assert.equal((it._ocrJobs || []).length, 0, 'OCR not started');
  assert.equal(api.getWeekDrop(), null, 'sort screen closed');
});

test('test_non_images_and_duplicates_skipped', async () => {
  const api = setup();
  const wd = await api.mixedDropFromInput(0, [img('a.jpg', 'same'), img('notes.txt', 'n', 'text/plain'), img('a2.jpg', 'same')]);
  assert.deepEqual(wd.items.map(i => i.name), ['a.jpg']);
  assert.deepEqual(wd.skipped, ['notes.txt']);
  assert.deepEqual(wd.dups, ['a2.jpg'], 'the same image twice is read once');
});

test('test_week_folder_drop_unchanged', async () => {
  const api = setup();
  const wd = await api.weekDropAddFiles([{ file: img('a.jpg'), path: 'W/ALPHA ONE/a.jpg' }, { file: img('c.jpg'), path: 'W/BETA/c.jpg' }]);
  assert.equal(wd.scope, null);
  assert.deepEqual(wd.items.map(i => i.entIdx), [0, 1]);
  assert.doesNotMatch(api._weekDropHtml(), /Add to the lists/);
});
