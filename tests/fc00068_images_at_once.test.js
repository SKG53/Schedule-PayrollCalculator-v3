// FC-00068: how many images are sent to Gemini at the same time is a browser preference, 1 to 10,
// default 3, used by OCR and by the sort screen. A run keeps the number it started with; rate-limit
// failures say "try fewer at once". Invented data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const img = (name) => ({ name, type: 'image/jpeg', arrayBuffer: async () => new TextEncoder().encode(name).buffer });
function base() {
  const api = loadApp();
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true; api.__sandbox.crypto = webcrypto;
  resetToSingleEntity(api, { id: 0, name: 'ALPHA ONE', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(api.entities[0]); api.ensureIntakeState(api.entities[0]);
  return api;
}
async function peakSort(api, n) {
  let live = 0, peak = 0;
  api._setClassifierForTests(async () => { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 5)); live--; return 'TC'; });
  await api.weekDropAddFiles(Array.from({ length: n }, (_, i) => ({ file: img('i' + i + '.jpg'), path: 'Alpha One/i' + i + '.jpg' })));
  return peak;
}
// OCR pool: stub the Gemini call and count calls in flight.
async function peakOcr(api, n) {
  let live = 0, peak = 0;
  api.__sandbox.ocrImage = undefined;
  const e = api.entities[0];
  e.intake.timecardFiles = Array.from({ length: n }, (_, i) => img('o' + i + '.jpg'));
  api._prefSet('pv26_api_key', 'test-key-not-real');
  api.__sandbox.fetch = async () => { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 5)); live--; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }) }; };
  await api.runOcrForEntity(0);
  return peak;
}

test('test_default_is_three_and_unchanged_behavior', async () => {
  const api = base();
  assert.equal(api.ocrParallel(), 3);
  assert.equal(await peakSort(api, 9), 3, 'three images looked at together, as before');
});

test('test_ocr_never_exceeds_setting', async () => {
  for (const n of [1, 6]) {
    const api = base();
    assert.equal(api.setOcrParallel(String(n), true), true);
    const peak = await peakOcr(api, 12);
    assert.ok(peak <= n && peak >= 1, `at ${n}: at most ${n} Gemini calls in flight (saw ${peak})`);
    if (n === 6) assert.equal(peak, 6, 'and it does use them');
  }
});

test('test_sort_never_exceeds_setting', async () => {
  const api = base();
  api.setOcrParallel('1', true);
  assert.equal(await peakSort(api, 5), 1);
  const api2 = base();
  api2.setOcrParallel('5', true);
  assert.equal(await peakSort(api2, 8), 5);
});

test('test_value_persists_as_pref_not_in_files', () => {
  const api = base();
  api.setOcrParallel('7', true);
  assert.equal(api._prefGet('pv26_ocr_parallel'), '7', 'kept in the browser like the API key');
  const again = api.ocrParallel();
  assert.equal(again, 7);
  const ts = api._toolSettingsRows().map(r => String(r[0]));
  assert.ok(!ts.some(l => /images read at once|parallel/i.test(l)), 'not in the settings file');
  api.setOcrParallel('3', true);
  assert.equal(api._prefGet('pv26_ocr_parallel'), null, 'back to the default leaves nothing stored');
});

test('test_running_run_keeps_its_number', async () => {
  const api = base();
  api.setOcrParallel('2', true);
  let live = 0, peak = 0, started; const first = new Promise(r => { started = r; });
  api._setClassifierForTests(async () => { started(); live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 10)); live--; return 'TC'; });
  const p = api.weekDropAddFiles(Array.from({ length: 8 }, (_, i) => ({ file: img('r' + i + '.jpg'), path: 'Alpha One/r' + i + '.jpg' })));
  await first; // the run has started
  api.setOcrParallel('8', true);
  await p;
  assert.equal(peak, 2, 'the run that had started keeps 2');
  assert.equal(api.ocrParallel(), 8, 'the next run uses the new number');
});

test('test_out_of_range_rejected', () => {
  const api = base();
  ['0', '11', '', 'abc', '2.5', '-3'].forEach(v => assert.equal(api.setOcrParallel(v, true), false, JSON.stringify(v)));
  assert.equal(api.ocrParallel(), 3, 'the last good value stays');
  assert.equal(api._parseOcrParallel('10'), 10);
  assert.equal(api._parseOcrParallel('1'), 1);
});

test('test_rate_limit_note_shown', () => {
  const api = base();
  assert.equal(api._isRateLimitErr(new Error('Gemini API 429: RESOURCE_EXHAUSTED')), true);
  assert.equal(api._isRateLimitErr(new Error('Gemini API 500: internal')), false);
  api._ocrRunPlan([{ idx: 0, total: 4 }]);
  api._ocrRunRateLimited();
  assert.match(api._ocrRunHtml(), /Gemini is limiting requests — try fewer at once/);
  assert.match(api._ocrRunHtml(), /class="ocr-par-input"[^>]*value="3"/, 'the number can be changed right there');
});

test('test_one_run_across_entities_keeps_one_number', () => {
  const api = base();
  api.setOcrParallel('2', true);
  api._ocrRunPlan([{ idx: 0, total: 3 }]);
  api.setOcrParallel('7', true);
  assert.equal(api.getOcrRun().parallel, 2, 'the planned run keeps 2 for every entity');
});
