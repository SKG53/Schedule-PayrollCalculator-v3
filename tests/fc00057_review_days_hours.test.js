// FC-00057: the review tab shows every day of the pay week for every person, with the day's and
// the week's hours (payroll math), an orange dot on anyone with a row not approved yet, blue boxes
// for every value changed or typed by hand, and "Approve all" asks before approving an entity.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const SH = ['', '9AM - 5PM', '9AM - 5PM', '', '', '', ''];
function setup() {
  const api = loadApp({ savedNames: true });
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  const e = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [{ name: 'Avery', shifts: SH }, { name: 'Bram', shifts: SH }], dateLabels: WEEK, breakMinutes: 30, breakMinutesSet: true });
  api._syncEntityCode(e);
  api.ensureIntakeState(e);
  const add = (name, date, i, o, i2, o2) => {
    const r = api.processReviewRow({ empName: name, date, clockIn1: i, clockOut1: o, clockIn2: i2 || '', clockOut2: o2 || '', confidence: 0.95, source: 'TC', originalName: name + '.jpg' }, e);
    e.intake.reviewRows.push(r); return r;
  };
  const a1 = add('Avery', '2026-08-10', '09:00', '13:00', '13:20', '17:05');
  const a2 = add('Avery', '2026-08-11', '08:55', '17:00');
  const b1 = add('Bram', '2026-08-10', '09:00', '17:00');
  api.setTab('intake');
  return { api, e, a1, a2, b1 };
}
const tabFor = (html, name) => (html.match(new RegExp('<button class="emp-subtab[^"]*"[^>]*>' + name + '<[\\s\\S]*?</button>')) || [''])[0];

test('test_every_day_of_the_week_is_shown', () => {
  const { api, e } = setup();
  e.intake.activeEmpTab = 'Avery';
  const html = api.renderReviewTableHtml(e, 0);
  const heads = html.match(/<tr class="day-head">/g) || [];
  assert.equal(heads.length, 7, 'Sun to Sat, worked or not');
  assert.equal((html.match(/class="day-empty"/g) || []).length, 5, 'days without punches are shown empty');
  assert.match(html, /addManualRowForDay\(0,'2026-08-09'\)/, 'an empty day offers + Add punches for that date');
  assert.match(html, /Scheduled: 9AM - 5PM/, 'the day shows its shift');
});

test('test_day_and_week_hours_match_payroll', () => {
  const { api, e, a1, a2 } = setup();
  api.approveReviewRow(a1.id); api.approveReviewRow(a2.id);
  api.syncActualsFromReview();
  const pay = api.computePayrollForEntity(0).results.find(r => r.schedName === 'Avery');
  const h = api._intakePersonHours(api._intakeHours(0, 'Avery'), e, 'Avery');
  assert.equal(h.days[1].paid, pay.days[1].billableH, 'Monday = payroll Monday (span − max(break, gap))');
  assert.equal(h.days[2].paid, pay.days[2].billableH);
  assert.equal(h.paidWeek, pay.actualHours, 'week = payroll weekly hours');
  e.intake.activeEmpTab = 'Avery';
  const html = api.renderReviewTableHtml(e, 0);
  assert.ok(html.includes('Week: <b>' + api.fmtHrs(pay.actualHours) + '</b> approved'), 'the week in h:mm and decimal');
  assert.ok(html.includes(api.fmtHrs(pay.days[1].billableH) + ' approved'), 'the day in h:mm and decimal');
});

test('test_pending_hours_shown_until_approved', () => {
  const { api, e, a1 } = setup();
  e.intake.activeEmpTab = 'Avery';
  let h = api._intakePersonHours(api._intakeHours(0, 'Avery'), e, 'Avery');
  assert.equal(h.paidWeek, 0);
  assert.ok(h.allWeek > 0, 'what the week will be once approved');
  assert.match(api.renderReviewTableHtml(e, 0), /once every row is approved/);
  api.approveReviewRow(a1.id);
  h = api._intakePersonHours(api._intakeHours(0, 'Avery'), e, 'Avery');
  assert.ok(h.paidWeek > 0 && h.paidWeek < h.allWeek);
});

test('test_hours_view_never_changes_payroll', () => {
  const { api, e, a1, b1 } = setup();
  api.approveReviewRow(a1.id); api.approveReviewRow(b1.id);
  api.syncActualsFromReview();
  const before = JSON.stringify([e.actualDays, api._collectExportData().map(d => d.rows.map(r => [r._empName, r.actualHours, r._breakdown]))]);
  api._intakeHours(0);
  e.intake.activeEmpTab = 'Avery';
  api.renderReviewTableHtml(e, 0);
  assert.equal(JSON.stringify([e.actualDays, api._collectExportData().map(d => d.rows.map(r => [r._empName, r.actualHours, r._breakdown]))]), before);
});

test('test_dot_on_every_unapproved_row_until_fully_approved', () => {
  const { api, e, a1, a2, b1 } = setup();
  // Clean OCR rows (no flags) still need a person to approve them.
  assert.ok(!b1.needsReview, 'a clean row with no flags');
  let html = api.renderReviewTableHtml(e, 0);
  assert.match(tabFor(html, 'Bram'), /warn-dot/, 'dot although nothing is flagged');
  api.approveReviewRow(b1.id);
  html = api.renderReviewTableHtml(e, 0);
  assert.doesNotMatch(tabFor(html, 'Bram'), /warn-dot/, 'gone once every row is approved');
  // An edit un-approves the row: the dot comes back.
  api.updateReviewField(b1.id, 'clockOut1', '17:30');
  api.unapproveReviewRow(b1.id);
  html = api.renderReviewTableHtml(e, 0);
  assert.match(tabFor(html, 'Bram'), /warn-dot/);
  // Ignored people are not paid from their cards: no dot.
  api.approveReviewRow(a1.id);
  api.toggleIgnoreEmployee(0, 'Avery');
  html = api.renderReviewTableHtml(e, 0);
  assert.doesNotMatch(tabFor(html, 'Avery'), /warn-dot/);
  void a2;
});

test('test_blue_on_edited_and_hand_typed_boxes', () => {
  const { api, e, a2 } = setup();
  api.updateReviewField(a2.id, 'clockIn1', '09:00');
  assert.equal(api._boxByHand(a2, 'clockIn1'), true, 'an OCR box changed by hand');
  assert.equal(api._boxByHand(a2, 'clockOut1'), false, 'an OCR box left alone');
  e.intake.activeEmpTab = 'Avery';
  api.addManualRowForDay(0, '2026-08-13');
  const mn = e.intake.reviewRows[e.intake.reviewRows.length - 1];
  assert.equal(mn.empName, 'Avery', 'the person whose tab is open');
  assert.equal(mn.date, '2026-08-13', 'the day the owner clicked');
  api.updateReviewField(mn.id, 'clockIn1', '10:00');
  assert.equal(api._boxByHand(mn, 'clockIn1'), true, 'every filled box of a hand-typed row');
  assert.equal(api._boxByHand(mn, 'clockOut1'), false, 'an empty box stays plain');
  const html = api.renderReviewTableHtml(e, 0);
  assert.match(html, /class="time-text box-edited" title="Typed by hand"/);
  assert.match(html, /class="time-text box-edited" title="Changed by hand — OCR read 8:55 AM"/);
});

test('test_blue_survives_the_timecards_excel', async () => {
  const { api, e, a2 } = setup();
  api.updateReviewField(a2.id, 'clockIn1', '09:00');
  await api.exportActualsIntakeExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const hdr = ws.rows[4].slice(1).map(c => c.value);
  assert.deepEqual(hdr.slice(-2), ['Punched Hours', 'OCR Values']);
  const row = ws.rows.find(r => r && r[17] && r[17].value === a2.id);
  const ocr = JSON.parse(row[19].value);
  assert.deepEqual([ocr.s, ocr.v.clockIn1], ['TC', '08:55']);
  // Re-import (as the reader hands rows over: formatted text).
  const cm = {}; hdr.forEach((h, i) => { cm[String(h).toLowerCase()] = i; });
  const vals = ['Alpha Test', 'Avery', '2026-08-11', 'Tuesday', '9:00 AM', '5:00 PM', '', '', '', '', 'No', 'MN', 'Avery.jpg', '0.95', '', '', a2.id, '8.00', row[19].value];
  e.intake.reviewRows.length = 0;
  api._ingestActualsIntakeRows([vals], cm);
  const back = e.intake.reviewRows[0];
  assert.equal(api._boxByHand(back, 'clockIn1'), true, 'still blue after the round trip');
  assert.equal(api._boxByHand(back, 'clockOut1'), false);
  assert.equal(back.source, 'MN');
});

test('test_approve_all_asks_first', () => {
  const { api, e } = setup();
  let asked = '';
  api.__sandbox.confirm = (m) => { asked = m; return false; };
  api.approveAll(0);
  assert.match(asked, /Approve all 3 rows for Alpha Test/);
  assert.equal(e.intake.reviewRows.filter(r => r.approved).length, 0, 'declined: nothing approved');
  api.__sandbox.confirm = () => true;
  api.approveAll(0);
  assert.equal(e.intake.reviewRows.filter(r => r.approved).length, 3);
});

test('test_rows_outside_the_week_are_listed_last', () => {
  const { api, e } = setup();
  const r = api.processReviewRow({ empName: 'Avery', date: '2026-08-17', clockIn1: '09:00', clockOut1: '12:00', confidence: 0.95, source: 'TC', originalName: 'x.jpg' }, e);
  e.intake.reviewRows.push(r);
  e.intake.activeEmpTab = 'Avery';
  const html = api.renderReviewTableHtml(e, 0);
  const i = html.indexOf('Outside this pay week'), j = html.indexOf(r.id);
  assert.ok(i > 0 && j > i, 'after the seven days, under its own heading');
});

test('test_no_schedule_week_from_the_rows', () => {
  const { api, e } = setup();
  e.dateLabels = ['', '', '', '', '', '', ''];
  assert.deepEqual(api._reviewWeekIsos(e), ['2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15']);
});

test('test_looking_at_a_tab_never_creates_a_person', () => {
  const { api, e } = setup();
  const r = api.processReviewRow({ empName: 'Zed Unknown', date: '2026-08-10', clockIn1: '09:00', clockOut1: '12:00', confidence: 0.9, source: 'TC', originalName: 'z.jpg' }, e);
  e.intake.reviewRows.push(r);
  const ids = () => Object.keys(api.session.roster.byId).sort().join(',');
  const before = ids();
  ['Avery', 'Bram', '__unrecognized__'].forEach(k => { e.intake.activeEmpTab = k; api.renderReviewTableHtml(e, 0); });
  assert.equal(ids(), before, 'no roster record (and no ID) for the unrecognized name');
});
