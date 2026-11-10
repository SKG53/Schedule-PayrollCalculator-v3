// FC-00069: "Scheduled, no approved punches" shows each day in its own box with that day's
// scheduled shift and a count; a box goes to that day on the person's tab. Invented data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const SH = ['2:30PM-9:45PM', '8:20AM-4:50PM', 'OFF', '8:20AM-4:50PM', 'OFF', '1:10PM-7:40PM', 'OFF'];
function setup() {
  const api = loadApp({ savedNames: true });
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true;
  const e = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [{ name: 'Avery', shifts: SH }], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(e); api.ensureIntakeState(e);
  const r = api.processReviewRow({ empName: 'Avery', date: '2026-08-10', clockIn1: '09:00', clockOut1: '17:00', clockIn2: '', clockOut2: '', confidence: 0.95, source: 'TC', originalName: 'a.jpg' }, e);
  e.intake.reviewRows.push(r); api.approveReviewRow(r.id);
  api.setTab('intake');
  e.intake.activeEmpTab = 'Avery';
  return { api, e };
}

test('test_one_box_per_missing_day', () => {
  const { api, e } = setup();
  const html = api.renderReviewTableHtml(e, 0);
  const box = html.match(/<div class="sched-no-punch"[\s\S]*?<\/div><\/div>/)[0];
  const chips = box.match(/class="snp-chip"/g) || [];
  assert.equal(chips.length, 3, 'Sun, Wed and Fri: three boxes, not one sentence');
  assert.doesNotMatch(box, /Sun Aug 9, Wed/, 'no comma list');
});

test('test_box_shows_scheduled_shift', () => {
  const { api, e } = setup();
  const html = api.renderReviewTableHtml(e, 0);
  assert.match(html, /data-iso="2026-08-09"[^>]*>Sun Aug 9<span class="snp-shift">2:30PM – 9:45PM<\/span><\/a>/);
  assert.match(html, /data-iso="2026-08-14"[^>]*>Fri Aug 14<span class="snp-shift">1:10PM – 7:40PM<\/span><\/a>/);
});

test('test_count_matches_boxes', () => {
  const { api, e } = setup();
  const html = api.renderReviewTableHtml(e, 0);
  assert.match(html, /Scheduled, no approved punches · 3 days<div class="snp-chips">/);
});

test('test_click_targets_day_row', () => {
  const { api, e } = setup();
  const html = api.renderReviewTableHtml(e, 0);
  assert.match(html, /onclick="scrollToReviewDay\('2026-08-12'\);return false"/);
  assert.match(html, /<tr class="day-head"><td colspan="\d+" data-iso="2026-08-12">/, 'the day row it goes to carries the date');
  assert.equal(api.scrollToReviewDay('2026-08-12'), false, 'no page in the test harness: nothing to scroll, no error');
});
