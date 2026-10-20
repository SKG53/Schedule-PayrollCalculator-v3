// FC-00053: drop the whole week folder (or the Drive zip): subfolders map to entities, every
// image is classified by looking at it (never by file type), the owner checks the sort, then
// Start OCR queues each image to its entity's typed list. "Copy last week" fills a schedule
// from last week's snapshot with this week's dates.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const img = (name, bytes, type) => ({ name, type: type || (/\.png$/i.test(name) ? 'image/png' : 'image/jpeg'), arrayBuffer: async () => new TextEncoder().encode(bytes || name).buffer });

function setup() {
  const api = loadApp();
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  api.__sandbox.crypto = webcrypto;
  resetToSingleEntity(api, { id: 0, name: 'ALPHA ONE', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api.entities.push({ id: 1, name: 'BETA', code: '', employees: [], dateLabels: WEEK.slice(), newDateLabels: ['', '', '', '', '', '', ''], newWeekStartVal: '', breakMinutes: 0, breakMinutesSet: true, actualDays: [], intake: null });
  api.entities.forEach(e => { api._syncEntityCode(e); api.ensureIntakeState(e); });
  // The classifier "looks" at the bytes: anything containing "screen" is EasyClocking.
  api._setClassifierForTests(async (f) => { const t = new TextDecoder().decode(await f.arrayBuffer()); if (t.includes('broken')) throw new Error('x'); return t.includes('screen') ? 'EC' : 'TC'; });
  return api;
}

test('test_folder_tree_maps_subfolders_to_entities', async () => {
  const api = setup();
  const wd = await api.weekDropAddFiles([
    { file: img('a.jpg'), path: 'Week 10-11/Alpha One/a.jpg' },
    { file: img('b.png', 'screen b'), path: 'Week 10-11/Alpha One/b.png' },
    { file: img('c.jpg'), path: 'Week 10-11/Beta Distribution/c.jpg' },
  ]);
  assert.deepEqual(wd.items.map(i => [i.name, i.folder, i.entIdx]), [['a.jpg', 'Alpha One', 0], ['b.png', 'Alpha One', 0], ['c.jpg', 'Beta Distribution', 1]]);
  assert.equal(api.folderEntityIdx('Beta Distribution'), 1, 'one name starting with the other');
  assert.deepEqual(api._entityFolderOf(['Alpha One/a.jpg', 'Beta/c.jpg']), ['Alpha One', 'Beta'], 'entity folders dropped directly');
});

test('test_zip_maps_like_folder', async () => {
  const api = setup();
  // A zip's entries arrive with the same relative paths as a folder.
  const wd = await api.weekDropAddFiles([{ file: img('a.jpg'), path: 'drive-download/Alpha One/a.jpg' }, { file: img('c.jpg'), path: 'drive-download/BETA/c.jpg' }]);
  assert.deepEqual(wd.items.map(i => i.entIdx), [0, 1]);
});

test('test_unmatched_subfolder_and_root_images_ask', async () => {
  const api = setup();
  await api.weekDropAddFiles([{ file: img('a.jpg'), path: 'W/Gamma/a.jpg' }, { file: img('r.jpg'), path: 'W/r.jpg' }, { file: img('b.jpg'), path: 'W/BETA/b.jpg' }]);
  const html = api._weekDropHtml();
  assert.match(html, /Which entity is each folder\?/);
  assert.match(html, /Gamma/);
  assert.match(html, /\(images in the top folder\)/);
  assert.ok(api.weekDropBlockers().includes('Choose an entity for every folder'));
  api.weekDropMapFolder('Gamma', 1);
  api.weekDropMapFolder('', -2); // skip
  assert.deepEqual(api.weekDropBlockers(), []);
});

test('test_mapping_remembered_as_preference_only', async () => {
  const api = setup();
  await api.weekDropAddFiles([{ file: img('a.jpg'), path: 'W/Gamma Shop/a.jpg' }, { file: img('z.jpg'), path: 'W/ALPHA ONE/z.jpg' }]);
  api.weekDropMapFolder('Gamma Shop', 1);
  const pref = JSON.parse(api.__sandbox.window.localStorage.getItem('pv26_folder_map'));
  assert.deepEqual(pref, { gammashop: 'beta' }, 'folder name → entity name, nothing else');
  assert.equal(api.folderEntityIdx('Gamma Shop'), 1, 'remembered next time');
});

test('test_type_from_classifier_never_file_type', async () => {
  const api = setup();
  const wd = await api.weekDropAddFiles([
    { file: img('photo.png'), path: 'W/BETA/photo.png' }, // a PNG that is a timecard photo
    { file: img('shot.jpg', 'screen shot'), path: 'W/BETA/shot.jpg' }, // a JPEG that is a screenshot
  ]);
  assert.deepEqual(wd.items.map(i => [i.name, i.kind]), [['photo.png', 'TC'], ['shot.jpg', 'EC']]);
});

test('test_classifier_failure_goes_to_unsure_blocks_start', async () => {
  const api = setup();
  const wd = await api.weekDropAddFiles([{ file: img('x.jpg', 'broken'), path: 'W/BETA/x.jpg' }]);
  assert.equal(wd.items[0].kind, null);
  assert.equal(wd.items[0].status, 'unsure');
  assert.ok(api.weekDropBlockers().includes('Sort the unsure images'));
  assert.match(api._weekDropHtml(), /Unsure — pick a type · 1/);
  assert.equal(await api.weekDropStartOcr(), false);
  api.weekDropSetKind(wd.items[0].id, 'EC');
  assert.deepEqual(api.weekDropBlockers(), []);
});

test('test_move_and_remove_on_sort_screen', async () => {
  const api = setup();
  const wd = await api.weekDropAddFiles([{ file: img('a.jpg'), path: 'W/BETA/a.jpg' }, { file: img('b.jpg'), path: 'W/BETA/b.jpg' }]);
  api.weekDropSetKind(wd.items[0].id, 'EC');
  api.weekDropSetEntity(wd.items[0].id, 0);
  api.weekDropRemove(wd.items[1].id);
  assert.deepEqual(api.getWeekDrop().items.map(i => [i.name, i.kind, i.entIdx]), [['a.jpg', 'EC', 0]]);
});

test('test_start_ocr_queues_typed_jobs_no_second_classify', async () => {
  const api = setup();
  await api.weekDropAddFiles([
    { file: img('a.jpg'), path: 'W/ALPHA ONE/a.jpg' },
    { file: img('b.png', 'screen'), path: 'W/ALPHA ONE/b.png' },
    { file: img('c.jpg'), path: 'W/BETA/c.jpg' },
  ]);
  await api.weekDropStartOcr(); // no API key in tests: OCR does not run, the files stay queued
  const q = (i) => [api.entities[i].intake.timecardFiles.map(f => f.name), api.entities[i].intake.easyclockFiles.map(f => f.name), (api.entities[i].intake.mixedFiles || []).length];
  assert.deepEqual(q(0), [['a.jpg'], ['b.png'], 0], 'typed lists, never the Mixed box');
  assert.deepEqual(q(1), [['c.jpg'], [], 0]);
  assert.equal(api.getWeekDrop(), null);
});

test('test_duplicate_image_skipped', async () => {
  const api = setup();
  await api.weekDropAddFiles([{ file: img('a.jpg', 'same'), path: 'W/BETA/a.jpg' }]);
  await api.weekDropStartOcr();
  const wd = await api.weekDropAddFiles([{ file: img('a-copy.jpg', 'same'), path: 'W/BETA/a-copy.jpg' }, { file: img('new.jpg'), path: 'W/BETA/new.jpg' }, { file: { name: 'notes.txt', type: 'text/plain', arrayBuffer: async () => new ArrayBuffer(1) }, path: 'W/BETA/notes.txt' }]);
  assert.deepEqual(wd.items.map(i => i.name), ['new.jpg']);
  assert.deepEqual(wd.dups, ['a-copy.jpg'], 'the same image again is skipped');
  assert.deepEqual(wd.skipped, ['notes.txt']);
});

test('test_copy_last_week_dates_plus_7_archived_left_out', () => {
  const api = setup();
  api.setLastWeekSchedules([{ name: 'ALPHA ONE', dateLabels: ['Aug 2 2026', 'Aug 3 2026', 'Aug 4 2026', 'Aug 5 2026', 'Aug 6 2026', 'Aug 7 2026', 'Aug 8 2026'], employees: [{ name: 'AVERY', shifts: ['OFF', '9:00AM-5:00PM', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF'] }, { name: 'WREN', shifts: ['OFF', 'OFF', '9:00AM-5:00PM', 'OFF', 'OFF', 'OFF', 'OFF'] }] }]);
  const H = ['Entity', 'Employee', 'Wage/hour', 'Pay Method', 'Employee ID', 'Active'];
  const cm = {}; H.forEach((h, i) => { cm[h.toLowerCase()] = i; });
  api._ingestPayrollSettings([['ALPHA ONE', 'WREN', '12', 'Cash', 'EMP_ALP_00001', 'No']], cm, false);
  assert.equal(api.copyLastWeekSchedule(0), true);
  const e = api.entities[0];
  assert.deepEqual(e.dateLabels, WEEK, 'every date moves forward 7 days');
  assert.deepEqual(e.employees.map(x => x.name), ['AVERY'], 'archived people are left out');
  assert.equal(e.employees[0].shifts[1], '9:00AM-5:00PM');
  assert.ok(api.getCheckpoints().some(c => /Schedule load/.test(c.label)), 'one undo step');
});

test('test_copy_last_week_asks_before_replacing', () => {
  const api = setup();
  api.setLastWeekSchedules([{ name: 'ALPHA ONE', dateLabels: ['Aug 2 2026', 'Aug 3 2026', 'Aug 4 2026', 'Aug 5 2026', 'Aug 6 2026', 'Aug 7 2026', 'Aug 8 2026'], employees: [{ name: 'AVERY', shifts: ['OFF', '9:00AM-5:00PM', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF'] }] }]);
  api.parseSchedule([['Name', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ['BRAM', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF']], 0);
  let asked = 0;
  api.__sandbox.confirm = () => { asked++; return false; };
  assert.equal(api.copyLastWeekSchedule(0), false);
  assert.equal(asked, 1);
  assert.deepEqual(api.entities[0].employees.map(x => x.name), ['BRAM'], 'declined: nothing replaced');
});
