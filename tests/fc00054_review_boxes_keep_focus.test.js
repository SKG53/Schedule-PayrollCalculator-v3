// FC-00054: typing a date (or any box) on the review tab never kicks the owner out. A date box
// saves when it is left (Tab, click elsewhere, Enter), never on the per-digit "change" event; a
// redraw never runs under a mouse press, and the box the owner moved to gets the cursor back.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
function setup() {
  const api = loadApp();
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  const e = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [{ name: 'Avery', shifts: ['', '9AM - 5PM', '', '', '', '', ''] }], dateLabels: WEEK, breakMinutesSet: true });
  api._syncEntityCode(e);
  api.ensureIntakeState(e);
  const r = api.processReviewRow({ empName: 'Avery', date: '2026-08-10', clockIn1: '09:00', clockOut1: '17:00', confidence: 0.95, source: 'TC', originalName: 'a.jpg' }, e);
  e.intake.reviewRows.push(r);
  api.setTab('intake');
  return { api, e, r };
}

test('test_date_box_saves_on_leave_not_on_change', () => {
  const { api, e } = setup();
  const html = api.renderReviewTableHtml(e, 0);
  const date = html.match(/<input class="date-field[^>]*>/)[0];
  assert.ok(!/onchange=/.test(date), 'no save on change (the browser fires it per digit)');
  assert.match(date, /onblur="commitDateInput\(this,'[^']+','date',event\)"/);
  assert.match(date, /data-rbox="[^"]+\|date"/, 'each box carries a key so the cursor can come back to it');
});

test('test_enter_saves_the_date', () => {
  const { api, e } = setup();
  const html = api.renderReviewTableHtml(e, 0);
  const date = html.match(/<input class="date-field[^>]*>/)[0];
  assert.match(date, /onkeydown="if\(event.key==='Enter'\)\{event.preventDefault\(\);this.blur\(\);\}"/, 'Enter leaves the box, which saves it');
});

test('test_redraw_after_leaving_a_box_is_deferred_and_keeps_the_clicked_box', () => {
  const { api, e, r } = setup();
  const host = api.__sandbox.document.getElementById('reviewTable_0');
  host.innerHTML = 'BEFORE';
  // The mouse is down on another box: the save happens, the redraw waits for the click to land.
  api._setPtrDown(true);
  api.commitTimeInput({ value: '5:30 PM' }, r.id, 'clockOut1', { relatedTarget: { getAttribute: () => r.id + '|clockIn1' } });
  assert.equal(r.clockOut1, '17:30', 'value saved at once');
  assert.equal(host.innerHTML, 'BEFORE', 'no redraw under the mouse press');
  // Mouse up: the redraw runs and the cursor goes back to the box that was clicked.
  let asked = null, focused = false;
  api.__sandbox.document.querySelector = (sel) => { asked = sel; return { focus: () => { focused = true; }, select: () => {}, type: 'text', setSelectionRange: () => {} }; };
  api._setPtrDown(false);
  api._flushDeferredReviewRefresh();
  assert.notEqual(host.innerHTML, 'BEFORE', 'redrawn after the click');
  assert.equal(asked, '[data-rbox="' + r.id + '|clockIn1"]');
  assert.ok(focused, 'the clicked box has the cursor');
  assert.equal(api.getRefocusKey(), null, 'used once');
  void e;
});

test('test_no_partial_date_saved_while_typing', () => {
  const { api, r } = setup();
  api.approveReviewRow(r.id);
  // Typing month "1" on the way to 10/15: the browser's value passes through 2026-01-11.
  api.updateReviewFieldLight(r.id, 'date', '2026-01-11');
  api.updateReviewFieldLight(r.id, 'date', '2026-10-15');
  api.commitDateInput({ value: '2026-10-15' }, r.id, 'date', {});
  const edits = api.session.log.filter(x => x.type === 'reviewEdit' && x.target.field === 'date');
  assert.equal(edits.length, 1, 'one saved change');
  assert.deepEqual([edits[0].from, edits[0].to], ['2026-08-10', '2026-10-15'], 'no half-typed date in between');
  assert.equal(r.approved, false, 'a saved date still un-approves the row, as any edit does');
});

test('test_typed_am_pm_shorthand_is_kept', () => {
  const { api } = setup();
  // Typing "500p" saved 5:00 AM before (the a/p was dropped after bare digits).
  assert.equal(api.from12h('500p'), '17:00');
  assert.equal(api.from12h('5p'), '17:00');
  assert.equal(api.from12h('1130a'), '11:30');
  assert.equal(api.from12h('12a'), '00:00');
  assert.equal(api.from12h('1215p'), '12:15');
  assert.equal(api.from12h('5:00p'), '17:00');
  // Unchanged forms.
  assert.equal(api.from12h('9:01 AM'), '09:01');
  assert.equal(api.from12h('1715'), '17:15');
  assert.equal(api.from12h('845'), '08:45');
});

test('test_reimport_keeps_approved_rows_without_punches', () => {
  const { api, e } = setup();
  const hdr = api.ACTUALS_INTAKE_HEADERS;
  const cm = {}; hdr.forEach((h, i) => { cm[h.toLowerCase()] = i; });
  const row = ['Alpha Test', 'Avery', '2026-08-12', 'Wednesday', '', '', '', '', '', '', 'Yes', 'EC', 's.png', '0.99', '', '', 'r_nopunch', '', ''];
  e.intake.reviewRows.length = 0;
  api._ingestActualsIntakeRows([row], cm);
  assert.equal(e.intake.reviewRows[0].approved, true, 'a "did not work" row the owner approved stays approved');
});

// Review fix: leaving a date box without changing it records the next box but redraws nothing;
// that key must not linger and pull the cursor into a time box on some later redraw.
test('test_unchanged_box_leaves_no_refocus_key_behind', async () => {
  const { api, r } = setup();
  const next = { getAttribute: (k) => (k === 'data-rbox' ? r.id + '|clockIn1' : null) };
  const el = { value: r.date };
  api.commitDateInput(el, r.id, 'date', { relatedTarget: next }); // first leave saves
  api.commitDateInput(el, r.id, 'date', { relatedTarget: next }); // unchanged: nothing redraws
  assert.equal(api.getRefocusKey(), r.id + '|clockIn1', 'kept for a redraw that runs straight away');
  await new Promise((res) => setTimeout(res, 5));
  assert.equal(api.getRefocusKey(), null, 'gone once that moment has passed');
});
