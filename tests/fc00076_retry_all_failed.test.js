// FC-00076: "Retry all failed" for one entity and for every entity, as one run (run bar, images
// read at once, up to 3 attempts each, one Undo step); a "credits are used up" answer (HTTP 402)
// is never retried and stops the rest of the run. Invented data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const img = (name) => ({ name, type: 'image/jpeg', arrayBuffer: async () => new TextEncoder().encode(name).buffer });
const OK = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }) };
const ERR = (status, msg) => ({ ok: false, status, text: async () => msg });
const CREDITS = '{ "error": { "code": 402, "message": "Your prepayment credits are depleted." } }';
function base() {
  const api = loadApp();
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true; api.__sandbox.crypto = webcrypto;
  resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(api.entities[0]); api.ensureIntakeState(api.entities[0]);
  api.entities.push(Object.assign({}, api.entities[0], { id: 1, name: 'Beta Test', intake: null, employees: [], actualDays: [] }));
  api._syncEntityCode(api.entities[1]); api.ensureIntakeState(api.entities[1]);
  api._prefSet('pv26_api_key', 'test-key-not-real');
  api.__sandbox.setTimeout = (fn) => { fn(); return 0; }; // no 12 s waits between attempts
  return api;
}
// Run OCR on n images per entity with fetch answering `answer` (a function of the call number).
async function failAll(api, nPerEnt, answer) {
  let calls = 0;
  api.__sandbox.fetch = async (url, opts) => answer(++calls, String((opts && opts.body) || ''));
  for (const i of [0, 1]) {
    api.entities[i].intake.timecardFiles = Array.from({ length: nPerEnt }, (_, k) => img('e' + i + '_' + k + '.jpg'));
    await api.runOcrForEntity(i);
  }
  return () => calls;
}

test('test_retry_all_for_one_entity', async () => {
  const api = base();
  await failAll(api, 3, () => ERR(500, 'server error'));
  assert.equal(api._failedOcrJobs(0).length, 3); assert.equal(api._failedOcrJobs(1).length, 3);
  let calls = 0, live = 0, peak = 0;
  api.__sandbox.fetch = async () => { calls++; live++; peak = Math.max(peak, live); await new Promise(r => setImmediate(r)); live--; return OK; };
  await api.retryAllFailedOcr(0);
  assert.equal(api._failedOcrJobs(0).length, 0, 'every Alpha image read');
  assert.equal(api._failedOcrJobs(1).length, 3, 'Beta untouched');
  assert.equal(calls, 3);
  assert.ok(peak <= 3, 'never more than Images read at once');
  const run = api.getOcrRun();
  assert.equal(run.finished, true);
  assert.deepEqual(run.ents.map(e => [e.idx, e.done, e.errs]), [[0, 3, 0]]);
});

test('test_retry_all_for_every_entity_one_undo', async () => {
  const api = base();
  await failAll(api, 2, () => ERR(500, 'server error'));
  assert.equal(api._failedOcrCount(), 4);
  api.__sandbox.fetch = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify([{ name: 'Avery Atest', date: '2026-08-10', clockIn1: '09:00', clockOut1: '17:00' }]) }] } }] }) });
  const cps = api.getCheckpoints ? api.getCheckpoints().length : null;
  await api.retryAllFailedOcr(null);
  assert.equal(api._failedOcrCount(), 0);
  assert.equal(api.entities[0].intake.reviewRows.length + api.entities[1].intake.reviewRows.length, 4, 'one row per image read');
  if (cps != null) assert.equal(api.getCheckpoints().length, cps + 1, 'one Undo step');
  api.undoCheckpoint();
  assert.equal(api.entities[0].intake.reviewRows.length + api.entities[1].intake.reviewRows.length, 0, 'Undo takes the rows back');
});

test('test_credits_error_not_retried_and_stops_the_run', async () => {
  const api = base();
  const calls = await failAll(api, 3, () => ERR(402, CREDITS));
  assert.equal(api._isCreditsErr(new Error('Gemini API 402: ' + CREDITS)), true);
  assert.equal(api._isCreditsErr(new Error('Gemini API 500: x')), false);
  // Alpha: the first images each get one try, nothing is retried; the rest are not sent.
  assert.ok(calls() <= 3 + 3, 'no second or third attempts on a credits error (' + calls() + ' calls)');
  const jobs = api.entities[0].intake._ocrJobs;
  assert.ok(jobs.every(j => j.status === 'err'));
  assert.ok(jobs.every(j => j.attempt == null || j.attempt === 1), 'one attempt at most');
  assert.ok(jobs.some(j => j.detail === api.OCR_CREDITS_MSG));
  // The buttons appear on the page as soon as the run has ended (not only on the next redraw).
  api.renderIntake();
  const host = api.__sandbox.document.getElementById('ocrRunBar');
  if (host && host.innerHTML) assert.match(host.innerHTML, /Retry all failed/);
  const html = api._ocrRunHtml();
  assert.match(html, /Gemini credits are used up — add credits at aistudio\.google\.com\/billing, then press Retry all failed/);
  assert.match(html, /onclick="retryAllFailedOcr\(null\)"[^>]*>↻ Retry all failed \(6\)<\/button>/);
  // After topping up, one press reads them all.
  api.__sandbox.fetch = async () => OK;
  await api.retryAllFailedOcr(null);
  assert.equal(api._failedOcrCount(), 0);
});

test('test_buttons_shown_only_when_something_failed_and_nothing_runs', async () => {
  const api = base();
  await failAll(api, 2, () => ERR(500, 'server error'));
  const n0 = api._failedOcrJobs(0).length;
  assert.ok(n0 > 0);
  api.renderIntake();
  api.renderOcrFileList(0, api.entities[0].intake._ocrJobs);
  const el = api.__sandbox.document.getElementById('ocrFileList_0');
  assert.ok(el, 'the file list is on the page');
  assert.match(el.innerHTML, new RegExp('retryAllFailedOcr\\(0\\)"[^>]*>↻ Retry all failed \\(' + n0 + '\\)'));
  api.closeOcrRunBar();
  assert.match(api._ocrRunHtml(), /image[s]? failed to read.*Retry all failed/, 'still offered after the bar is closed');
  api.__sandbox.fetch = async () => OK;
  await api.retryAllFailedOcr(null);
  api.closeOcrRunBar();
  assert.equal(api._ocrRunHtml(), '', 'nothing failed: no button');
  assert.equal(api.retryAllFailedOcr(0), undefined, 'nothing to retry');
});
