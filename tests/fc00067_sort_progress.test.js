// FC-00067: the image sort screen opens the moment something is dropped, and a bar at its top
// always says whether the tool is working (a step with a moving count) or waiting for the owner
// (Ready, or Waiting for you with each need named and a Show me button). Invented data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const img = (name, bytes) => ({ name, type: /\.png$/i.test(name) ? 'image/png' : 'image/jpeg', arrayBuffer: async () => new TextEncoder().encode(bytes || name).buffer });
function base() {
  const api = loadApp();
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true; api.__sandbox.crypto = webcrypto;
  resetToSingleEntity(api, { id: 0, name: 'ALPHA ONE', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(api.entities[0]); api.ensureIntakeState(api.entities[0]);
  api.entities.push(Object.assign({}, api.entities[0], { id: 1, name: 'BETA TWO', intake: null, employees: [], actualDays: [] }));
  api._syncEntityCode(api.entities[1]); api.ensureIntakeState(api.entities[1]);
  return api;
}
const FILES = () => [
  { file: img('a1.jpg'), path: 'Week/Alpha One/a1.jpg' },
  { file: img('a2.png', 'screen'), path: 'Week/Alpha One/a2.png' },
  { file: img('b1.jpg', 'blurry'), path: 'Week/Beta Two/b1.jpg' },
];
const classify = async (f) => { const t = new TextDecoder().decode(await f.arrayBuffer()); if (t.includes('blurry')) throw new Error('x'); return t.includes('screen') ? 'EC' : 'TC'; };

test('test_screen_opens_before_fingerprinting', async () => {
  const api = base();
  let release; const gate = new Promise(r => { release = r; });
  const p = api._wdOpen(null, async () => { await gate; return FILES(); });
  assert.ok(api.getWeekDrop(), 'the screen is open while the zip is still being read');
  const pr = api.weekDropProgress();
  assert.equal(pr.state, 'working'); assert.equal(pr.step, 'open');
  assert.match(api._weekDropHtml(), /<b>Working<\/b> · Opening the folder or zip…/);
  assert.match(api._weekDropHtml(), /wd-bar-fill indeterminate/, 'no fake count while the size is unknown');
  api._setClassifierForTests(classify);
  release(); await p;
  assert.ok(api.getWeekDrop().items.length === 3);
});

test('test_bar_steps_and_counts_rise_to_total', async () => {
  const api = base();
  const seen = [];
  let release; const gate = new Promise(r => { release = r; });
  api._setClassifierForTests(async (f) => { await gate; return classify(f); });
  const p = api.weekDropAddFiles(FILES());
  // The check step runs first and counts up.
  await new Promise(r => setTimeout(r, 5));
  let pr = api.weekDropProgress();
  seen.push(pr.step);
  assert.equal(pr.step, 'look', 'after the check, the images are being looked at');
  assert.equal(pr.total, 3); assert.equal(pr.done, 0);
  assert.match(api._weekDropHtml(), /Looking at the images · 0 of 3/);
  assert.match(api._weekDropHtml(), /class="wd-bar-fill" style="width:0%"/);
  release(); await p;
  pr = api.weekDropProgress();
  assert.notEqual(pr.state, 'working', 'when done the bar stops working');
});

test('test_per_entity_counts_add_up', async () => {
  const api = base();
  let release; const gate = new Promise(r => { release = r; });
  api._setClassifierForTests(async (f) => { await gate; return classify(f); });
  const p = api.weekDropAddFiles(FILES());
  await new Promise(r => setTimeout(r, 5));
  const pr = api.weekDropProgress();
  assert.equal(pr.ents.length, 2);
  assert.equal(pr.ents.reduce((a, e) => a + e.total, 0), pr.total, 'per-entity totals add up to the total');
  assert.match(api._weekDropHtml(), /ALPHA ONE 0 of 2 · BETA TWO 0 of 1/);
  release(); await p;
});

test('test_ready_state_when_nothing_needed', async () => {
  const api = base();
  api._setClassifierForTests(classify);
  await api.weekDropAddFiles(FILES().slice(0, 2));
  const pr = api.weekDropProgress();
  assert.equal(pr.state, 'ready');
  assert.match(api._weekDropHtml(), /<div class="wd-bar ready"[^>]*>.*Ready — press Start OCR/);
});

test('test_waiting_state_names_each_need', async () => {
  const api = base();
  api._setClassifierForTests(classify);
  await api.weekDropAddFiles(FILES().concat([{ file: img('c1.jpg'), path: 'Week/Gamma/c1.jpg' }]));
  const pr = api.weekDropProgress();
  assert.equal(pr.state, 'waiting');
  const html = api._weekDropHtml();
  assert.match(html, /● Waiting for you<\/b> · 1 folder needs an entity · 1 image needs a type \(BETA TWO\)/);
  assert.match(html, /wd-show-me/, 'Show me is offered');
});

test('test_show_me_targets_first_need', async () => {
  const api = base();
  api._setClassifierForTests(classify);
  const wd = await api.weekDropAddFiles(FILES());
  const t = api.weekDropShowMe();
  const un = wd.items.find(i => i.name === 'b1.jpg');
  assert.equal(t.id, un.id, 'the first image without a type');
  assert.equal(api.weekDropShowMe(0), null, 'ALPHA ONE has nothing to decide');
  assert.equal(api.weekDropShowMe(1).id, un.id);
});

test('test_hand_toggle_updates_bar', async () => {
  const api = base();
  api._setClassifierForTests(classify);
  const wd = await api.weekDropAddFiles(FILES());
  assert.equal(api.weekDropProgress().state, 'waiting');
  api.weekDropSetKind(wd.items.find(i => i.name === 'b1.jpg').id, 'TC');
  assert.equal(api.weekDropProgress().state, 'ready', 'the last unsure image set → Ready at once');
  api.weekDropSetKind(wd.items.find(i => i.name === 'a1.jpg').id, 'UNSURE');
  assert.equal(api.weekDropProgress().state, 'waiting');
});

test('test_no_api_key_waiting_state', async () => {
  const api = base();
  api._setClassifierForTests(null);
  await api.weekDropAddFiles(FILES());
  const pr = api.weekDropProgress();
  assert.equal(pr.state, 'waiting', 'nothing is looked at: no fake progress');
  assert.ok(pr.needs.some(n => n.text === 'no Gemini key: sort the Unsure ones by hand')); // FC-00095
});

test('test_duplicates_still_skipped', async () => {
  const api = base();
  api._setClassifierForTests(classify);
  const wd = await api.weekDropAddFiles([{ file: img('x.jpg', 'same'), path: 'Alpha One/x.jpg' }, { file: img('y.jpg', 'same'), path: 'Alpha One/y.jpg' }, { file: { name: 'notes.txt', type: 'text/plain', arrayBuffer: async () => new ArrayBuffer(1) }, path: 'Alpha One/notes.txt' }]);
  assert.equal(wd.items.length, 1);
  assert.deepEqual(wd.dups, ['y.jpg']);
  assert.deepEqual(wd.skipped, ['notes.txt']);
});

test('test_cancel_while_opening_stops', async () => {
  const api = base();
  let release; const gate = new Promise(r => { release = r; });
  const p = api._wdOpen(null, async () => { await gate; return FILES(); });
  api.weekDropCancel();
  release();
  assert.equal(await p, null);
  assert.equal(api.getWeekDrop(), null, 'nothing reopens after Cancel');
});

test('test_cancel_shown_while_opening', async () => {
  const api = base();
  let release; const gate = new Promise(r => { release = r; });
  const p = api._wdOpen(null, async () => { await gate; return []; });
  assert.match(api._weekDropHtml(), /onclick="weekDropCancel\(\)">Cancel<\/button>/, 'the screen can always be closed');
  release(); await p;
});
