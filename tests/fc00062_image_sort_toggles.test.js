// FC-00062: the image sort screen. Every image has clear Timecard / EasyClocking / Unsure toggles
// (no little arrow), a summary per entity sits on top, and per entity the order is: being looked
// at, Unsure (needs a decision), Timecard photos, EasyClocking screenshots. The card the owner
// changed is outlined after the redraw.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const img = (name, bytes) => ({ name, type: /\.png$/i.test(name) ? 'image/png' : 'image/jpeg', arrayBuffer: async () => new TextEncoder().encode(bytes || name).buffer });
async function setup() {
  const api = loadApp();
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true; api.__sandbox.crypto = webcrypto;
  resetToSingleEntity(api, { id: 0, name: 'ALPHA ONE', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(api.entities[0]); api.ensureIntakeState(api.entities[0]);
  api._setClassifierForTests(async (f) => { const t = new TextDecoder().decode(await f.arrayBuffer()); if (t.includes('blurry')) throw new Error('x'); return t.includes('screen') ? 'EC' : 'TC'; });
  const wd = await api.weekDropAddFiles([
    { file: img('card1.jpg'), path: 'Alpha One/card1.jpg' },
    { file: img('card2.jpg', 'card two'), path: 'Alpha One/card2.jpg' },
    { file: img('shot.png', 'screen shot'), path: 'Alpha One/shot.png' },
    { file: img('odd.jpg', 'blurry'), path: 'Alpha One/odd.jpg' },
  ]);
  const id = (n) => wd.items.find(i => i.name === n).id;
  return { api, wd, id };
}
const cardHtml = (html, name) => { const i = html.indexOf('title="' + name + '"'); const s = html.lastIndexOf('<div class="wd-item"', i); return html.slice(s, html.indexOf('class="wd-row"', i)); };

test('test_three_clear_toggles_no_arrow', async () => {
  const { api } = await setup();
  const html = api._weekDropHtml();
  assert.doesNotMatch(html, /→ (EasyClocking|Timecard)/, 'the little arrow is gone');
  const c = cardHtml(html, 'card1.jpg');
  assert.match(c, />Timecard<\/button>/); assert.match(c, />EasyClocking<\/button>/); assert.match(c, />Unsure<\/button>/);
  assert.match(c, /class="tc on" aria-pressed="true"/, 'the current type is pressed');
  assert.match(cardHtml(html, 'shot.png'), /class="ec on" aria-pressed="true"/);
  assert.match(cardHtml(html, 'odd.jpg'), /class="un on" aria-pressed="true"/, 'the classifier could not decide');
});

test('test_group_order_and_summary', async () => {
  const { api } = await setup();
  const html = api._weekDropHtml();
  const at = (s) => html.indexOf(s);
  assert.ok(at('Unsure — pick a type · 1') < at('Timecard photos · 2') && at('Timecard photos · 2') < at('EasyClocking screenshots · 1'), 'Unsure, then Timecard, then EasyClocking');
  assert.match(html, /<div class="wd-sum-ent"><b>ALPHA ONE<\/b><span class="wd-pill tc">2 Timecard<\/span><span class="wd-pill ec">1 EasyClocking<\/span><span class="wd-pill un">1 Unsure<\/span><\/div>/);
});

test('test_toggle_moves_the_image_and_marks_it', async () => {
  const { api, wd, id } = await setup();
  api.weekDropSetKind(id('card1.jpg'), 'EC');
  assert.equal(wd.items.find(i => i.name === 'card1.jpg').kind, 'EC');
  const html = api._weekDropHtml();
  assert.match(html, /Timecard photos · 1/); assert.match(html, /EasyClocking screenshots · 2/);
  // The changed card is the one outlined after the redraw (cleared once drawn).
  api.weekDropSetKind(id('card2.jpg'), 'EC');
  assert.equal(api.getWdLastChanged(), null, 'the redraw used and cleared the mark');
});

test('test_unsure_by_hand_waits_for_a_decision', async () => {
  const { api, wd, id } = await setup();
  api.weekDropSetKind(id('odd.jpg'), 'TC');
  assert.deepEqual(api.weekDropBlockers(), []);
  api.weekDropSetKind(id('card2.jpg'), 'UNSURE');
  const it = wd.items.find(i => i.name === 'card2.jpg');
  assert.equal(it.kind, null); assert.equal(it.status, 'unsure');
  assert.ok(api.weekDropBlockers().includes('Sort the unsure images'), 'Start OCR waits');
  assert.match(api._weekDropHtml(), /Unsure — pick a type · 1/);
});

test('test_by_hand_choice_survives_the_classifier', async () => {
  const api = loadApp();
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true; api.__sandbox.crypto = webcrypto;
  resetToSingleEntity(api, { id: 0, name: 'ALPHA ONE', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(api.entities[0]); api.ensureIntakeState(api.entities[0]);
  let release; const gate = new Promise(r => { release = r; });
  api._setClassifierForTests(async () => { await gate; return 'TC'; });
  const p = api.weekDropAddFiles([{ file: img('slow.jpg'), path: 'Alpha One/slow.jpg' }]);
  await new Promise(r => setTimeout(r, 5));
  const wd = api.getWeekDrop();
  assert.match(api._weekDropHtml(), /Being looked at · 1/);
  assert.match(api._weekDropHtml(), /Looking at 1 image…/);
  api.weekDropSetKind(wd.items[0].id, 'UNSURE');
  release(); await p;
  assert.equal(wd.items[0].kind, null, 'the classifier does not override the owner');
  assert.equal(wd.items[0].status, 'unsure');
});
