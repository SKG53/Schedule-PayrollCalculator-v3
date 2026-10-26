// FC-00064: hours in words where there is room ("12 Hours 34 Minutes", "8 Hours 0 Minutes",
// "1 Hour 1 Minute") with the decimal pay uses; tight cells keep h:mm with the words on hover;
// every scheduled shift on the review tab shows its length (start to end, no break taken out).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
function setup() {
  const api = loadApp();
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true;
  const e = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [{ name: 'Avery', shifts: ['OFF', '8:10AM-2:40PM', '6:20AM-3:05PM', 'OFF', '6:40PM-2:55AM', '', 'OFF'] }], dateLabels: WEEK, breakMinutes: 30, breakMinutesSet: true });
  api._syncEntityCode(e); api.ensureIntakeState(e);
  const r = api.processReviewRow({ empName: 'Avery', date: '2026-08-10', clockIn1: '08:10', clockOut1: '14:40', confidence: 0.95, source: 'TC', originalName: 'a.jpg' }, e);
  e.intake.reviewRows.push(r); api.approveReviewRow(r.id); api.syncActualsFromReview();
  e.intake.activeEmpTab = 'Avery';
  return { api, e };
}

test('test_words_singular_and_zero_minutes', () => {
  const { api } = setup();
  assert.equal(api.fmtHrsWords(12 + 34 / 60), '12 Hours 34 Minutes');
  assert.equal(api.fmtHrsWords(8), '8 Hours 0 Minutes');
  assert.equal(api.fmtHrsWords(1 + 1 / 60), '1 Hour 1 Minute');
  assert.equal(api.fmtHrsWords(0), '0 Hours 0 Minutes');
  assert.equal(api.fmtHrsWords(7.33), '7 Hours 20 Minutes', 'rounded to the minute');
  assert.equal(api.fmtHrsWords(-0.5), 'minus 0 Hours 30 Minutes');
});

test('test_long_form_follows_the_hours_setting', () => {
  const { api } = setup();
  assert.equal(api.fmtHrsLong(5.75), '5 Hours 45 Minutes (5.75)');
  api.setHoursFormat('hmm'); assert.equal(api.fmtHrsLong(5.75), '5 Hours 45 Minutes');
  api.setHoursFormat('dec'); assert.equal(api.fmtHrsLong(5.75), '5.75');
  api.setHoursFormat('both');
});

test('test_review_tab_week_day_and_scheduled_length', () => {
  const { api, e } = setup();
  const html = api.renderReviewTableHtml(e, 0);
  // 8:10 AM – 2:40 PM worked with a 30 min break minimum: 6:00 paid.
  assert.match(html, /Week: <b>6 Hours 0 Minutes \(6\.00\)<\/b> approved/);
  assert.match(html, /<span class="dh-hrs">6 Hours 0 Minutes \(6\.00\) approved<\/span>/);
  assert.match(html, /Scheduled: 8:10AM-2:40PM · 6 Hours 30 Minutes \(6\.50\)/, 'the shift length, no break taken out');
  assert.match(html, /Scheduled: 6:20AM-3:05PM · 8 Hours 45 Minutes \(8\.75\)/);
  assert.match(html, /Scheduled: 6:40PM-2:55AM · 8 Hours 15 Minutes \(8\.25\)/, 'overnight');
  assert.match(html, /Scheduled: OFF<\/span>/, 'OFF has no length');
});

test('test_table_cells_keep_hmm_with_words_on_hover', () => {
  const { api } = setup();
  assert.equal(api.fmtHrsCell(5.75), '<span title="5 Hours 45 Minutes">5:45 (5.75)</span>');
  api.setTab('payroll'); api.renderPayroll();
  const html = api.__sandbox.document.getElementById('payrollGrid').innerHTML;
  assert.match(html, /<span title="6 Hours 0 Minutes">6:00 \(6\.00\)<\/span>/, 'the Weekly Actuals grid carries the words on hover');
});

test('test_pay_unchanged', () => {
  const { api } = setup();
  const pay = () => JSON.stringify(api._collectExportData().map(d => d.rows.map(r => [r.actualHours, r._breakdown])));
  const before = pay();
  ['hmm', 'dec', 'both'].forEach(f => { api.setHoursFormat(f); api.renderReviewTableHtml(api.entities[0], 0); });
  assert.equal(pay(), before);
});
