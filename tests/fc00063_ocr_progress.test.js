// FC-00063: one progress bar for the whole OCR run, above all entities: images done of all
// queued, the entity being read now, the ones waiting in order, failures; "OCR finished" at the end.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
function setup() {
  const api = loadApp();
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true; api.__sandbox.crypto = webcrypto;
  resetToSingleEntity(api, { id: 0, name: 'ALPHA', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  ['BETA', 'GAMMA'].forEach((n, k) => api.entities.push({ id: k + 1, name: n, code: '', employees: [], dateLabels: WEEK.slice(), newDateLabels: ['', '', '', '', '', '', ''], newWeekStartVal: '', breakMinutes: 0, breakMinutesSet: true, actualDays: [], intake: null }));
  api.entities.forEach(e => { api._syncEntityCode(e); api.ensureIntakeState(e); });
  api.setTab('intake');
  return api;
}
const bar = (api) => api.__sandbox.document.getElementById('ocrRunBar').innerHTML;

test('test_bar_walks_through_the_entities_in_order', () => {
  const api = setup();
  api.renderIntake();
  assert.equal(bar(api), '', 'nothing before a run');
  api._ocrRunPlan([{ idx: 0, total: 6 }, { idx: 1, total: 5 }, { idx: 2, total: 4 }]);
  assert.match(bar(api), /Reading images · 0 of 15/);
  assert.match(bar(api), /next: ALPHA \(6\), BETA \(5\), GAMMA \(4\)/);
  api._ocrRunStart(0, 6);
  api._ocrRunProgress(0, 3, 0);
  assert.match(bar(api), /Reading images · 3 of 15<\/b> · now: <b>ALPHA<\/b> 3 of 6 · next: BETA \(5\), GAMMA \(4\)/);
  assert.match(bar(api), /width:20%/, '3 of 15');
  api._ocrRunEntityDone(0, 6, 0);
  api._ocrRunStart(1, 5); api._ocrRunProgress(1, 5, 2); api._ocrRunEntityDone(1, 5, 2);
  api._ocrRunStart(2, 4);
  assert.match(bar(api), /now: <b>GAMMA<\/b> 0 of 4 · last entity/);
  assert.match(bar(api), /2 failed \(BETA 2\)/);
  api._ocrRunEntityDone(2, 4, 0);
  assert.match(bar(api), /OCR finished · 13 of 15 images read/);
  assert.match(bar(api), /closeOcrRunBar\(\)/, 'can be closed once finished');
  api.closeOcrRunBar();
  assert.equal(bar(api), '');
});

test('test_bar_survives_redraws_and_sits_above_the_entities', () => {
  const api = setup();
  api._ocrRunPlan([{ idx: 0, total: 3 }, { idx: 1, total: 2 }]);
  api._ocrRunStart(0, 3);
  api.renderIntake();
  const html = api.__sandbox.document.getElementById('intakeContent').innerHTML;
  assert.ok(html.indexOf('id="ocrRunBar"') < html.indexOf('intakeBlock_0'), 'above every entity');
  assert.match(bar(api), /now: <b>ALPHA<\/b>/);
});

test('test_single_entity_run_and_a_second_one_joins', () => {
  const api = setup();
  api._ocrRunStart(1, 5);
  assert.match(bar(api), /Reading images · 0 of 5<\/b> · now: <b>BETA<\/b> 0 of 5 · last entity/);
  api._ocrRunStart(2, 4); // GAMMA pressed while BETA runs
  assert.match(bar(api), /0 of 9/);
  api._ocrRunEntityDone(1, 5, 0);
  assert.doesNotMatch(bar(api), /OCR finished/, 'GAMMA still running');
  api._ocrRunEntityDone(2, 4, 0);
  assert.match(bar(api), /OCR finished · 9 of 9 images read/);
});

test('test_entities_that_never_start_are_named', async () => {
  const api = setup();
  // No API key in tests: Start OCR queues the images, the run cannot start; the bar says so.
  api._setClassifierForTests(async () => 'TC');
  const img = (n) => ({ name: n, type: 'image/jpeg', arrayBuffer: async () => new TextEncoder().encode(n).buffer });
  await api.weekDropAddFiles([{ file: img('a.jpg'), path: 'Alpha/a.jpg' }, { file: img('b.jpg'), path: 'Beta/b.jpg' }]);
  await api.weekDropStartOcr();
  assert.match(bar(api), /not started: ALPHA, BETA/);
  assert.match(bar(api), /OCR did not run/);
});
