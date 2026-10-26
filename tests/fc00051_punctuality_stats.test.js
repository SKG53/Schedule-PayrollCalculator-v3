// FC-00051: punctuality flags on the review tab (against the loaded schedule, information
// only) and per-person weekly stats on a Stats sub-tab and a Stats sheet in the Combined Excel.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const SCHED_HDR = ['Name', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const D = (n) => '2026-08-' + String(9 + n).padStart(2, '0'); // 0 = Sun Aug 9

function setup() {
  const api = loadApp();
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  api.__sandbox.crypto = webcrypto;
  const ent = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(ent);
  const day = '9:00AM-5:00PM', O = 'OFF';
  api.parseSchedule([SCHED_HDR,
    ['AVERY', O, day, day, day, O, day, O],
    ['BRAM', O, '3:15PM-1:15AM', O, O, O, O, O],
    ['WREN', O, day, O, O, O, O, O],
  ], 0);
  const e = api.entities[0];
  e.dateLabels = WEEK.slice();
  api.ensureIntakeState(e);
  api.wageRates[api.wKey(0, 'AVERY')] = 15;
  api.wageRates[api.wKey(0, 'BRAM')] = 12;
  api.flatWages[api.wKey(0, 'WREN')] = 300;
  const add = (name, date, i, o, approve = true) => {
    const r = api.processReviewRow({ empName: name, date, clockIn1: i, clockOut1: o, confidence: 0.95, source: 'TC', originalName: name + date + '.jpg' }, e);
    e.intake.reviewRows.push(r);
    if (approve) api.approveReviewRow(r.id);
    return r;
  };
  const rows = {
    mon: add('AVERY', D(1), '09:03', '17:00'), // late 3 → yellow
    tue: add('AVERY', D(2), '09:12', '16:45'), // late 12 → red, out 15 early → red
    wed: add('AVERY', D(3), '08:40', '17:08'), // early 20 (never flagged), out 8 late → yellow
    thu: add('AVERY', D(4), '10:00', '12:00'), // OFF day → worked a day off
    bram: add('BRAM', D(1), '15:15', '01:20'), // overnight, out 5 late → yellow
    wren: add('WREN', D(1), '09:30', '17:00'), // flat: minutes, no cost
  };
  // AVERY Fri is scheduled with no punches.
  api.syncActualsFromReview();
  return { api, e, rows, add };
}
const texts = (fl) => fl.map(f => f.level + ':' + f.text);

test('test_late_in_yellow_up_to_5_red_after', () => {
  const { api, e, rows } = setup();
  assert.deepEqual(texts(api.punctualityFlags(rows.mon, e)), ['yellow:Late 0:03']);
  assert.deepEqual(texts(api.punctualityFlags(rows.tue, e)), ['red:Late 0:12', 'red:Out 0:15 early']);
});

test('test_early_in_never_flagged_but_counted', () => {
  const { api, e, rows } = setup();
  assert.deepEqual(texts(api.punctualityFlags(rows.wed, e)), ['yellow:Out 0:08 late'], 'no flag for arriving early');
  const avery = api.entityStats(0).people.find(p => p.name === 'AVERY');
  assert.equal(avery.earlyDays, 1);
  assert.equal(avery.earlyMin, 20);
  assert.equal(avery.earlyMax, 20);
});

test('test_out_flags_both_directions_10_min', () => {
  const { api, e, add } = setup();
  const a = add('AVERY', D(5), '09:00', '17:11'); // 11 late → red
  const b = add('AVERY', D(5), '09:00', '16:52'); // same person and day: the latest clock-out counts
  assert.deepEqual(texts(api.punctualityFlags(a, e)), ['red:Out 0:11 late']);
  assert.deepEqual(texts(api.punctualityFlags(b, e)), ['red:Out 0:11 late'], 'flags are per person per day');
  const c = add('BRAM', D(1), '15:15', '01:16');
  assert.deepEqual(texts(api.punctualityFlags(c, e)), ['yellow:Out 0:05 late']);
});

test('test_scheduled_day_no_punches_red', () => {
  const { api, e } = setup();
  assert.deepEqual(api.scheduledNoPunchDays(e, 'AVERY'), [D(5)]);
  e.intake.activeEmpTab = 'AVERY';
  const html = api.renderReviewTableHtml(e, 0);
  assert.match(html, /Scheduled, no approved punches: Fri Aug 14/);
  // Ignored employees are not reported.
  e.intake.ignoredEmployees = { AVERY: true };
  assert.deepEqual(api.scheduledNoPunchDays(e, 'AVERY'), []);
});

test('test_worked_day_off_yellow', () => {
  const { api, e, rows } = setup();
  assert.deepEqual(texts(api.punctualityFlags(rows.thu, e)), ['yellow:Worked a day off']);
  e.intake.activeEmpTab = 'AVERY';
  const html = api.renderReviewTableHtml(e, 0);
  assert.match(html, /punct-pill punct-yellow[^>]*>Worked a day off/);
  assert.match(html, /punct-pill punct-red[^>]*>Late 0:12/);
  assert.equal(rows.thu.needsReview, false, 'punctuality never makes a row need review');
});

test('test_overnight_shift_attributed_to_start_day', () => {
  const { api, e, rows } = setup();
  assert.deepEqual(texts(api.punctualityFlags(rows.bram, e)), ['yellow:Out 0:05 late']);
  const bram = api.entityStats(0).people.find(p => p.name === 'BRAM');
  assert.equal(bram.workedSchedDays, 1);
  assert.equal(bram.stayDays, 1);
  assert.equal(bram.stayMin, 5);
  assert.equal(bram.lateDays, 0);
});

test('test_stats_counts_and_percents', () => {
  const { api } = setup();
  const avery = api.entityStats(0).people.find(p => p.name === 'AVERY');
  assert.equal(avery.workedSchedDays, 3, 'Mon, Tue, Wed (Thu is a day off, Fri missed)');
  assert.equal(avery.missedDays, 1);
  assert.equal(avery.lateDays, 2);
  assert.equal(avery.late5Days, 1);
  assert.equal(avery.avgLate, 7.5);
  const cells = api._statsCells(avery);
  assert.equal(cells[4], '2/3 · 67%');
  assert.equal(cells[5], '1/3 · 33%');
  assert.equal(cells[6], '0:08', 'average minutes late, rounded to the minute');
  assert.equal(avery.expected, 32);
  assert.equal(Math.round(avery.workedPct * 1000) / 1000, Math.round(avery.worked / 32 * 1000) / 1000);
});

test('test_early_and_stayed_late_cost_hourly_only', () => {
  const { api } = setup();
  const ps = api.entityStats(0).people;
  const avery = ps.find(p => p.name === 'AVERY');
  assert.equal(avery.earlyCost, 5, '20 min at $15');
  assert.equal(avery.stayCost, 2, '8 min at $15');
  const wren = ps.find(p => p.name === 'WREN');
  assert.equal(wren.lateDays, 1);
  assert.equal(wren.earlyCost, null, 'flat-paid: minutes only, no cost');
  assert.equal(wren.stayCost, null);
});

test('test_entity_rollup', () => {
  const { api } = setup();
  const st = api.entityStats(0);
  const sum = (k) => st.people.reduce((a, p) => a + p[k], 0);
  assert.equal(st.total.lateDays, sum('lateDays'));
  assert.equal(st.total.workedSchedDays, sum('workedSchedDays'));
  assert.equal(st.total.stayMin, sum('stayMin'));
  assert.equal(st.total.earlyCost, 5);
  assert.equal(st.total.stayCost, 3, '$2.00 + 5 min at $12');
  api.setPayrollSubTab(0, 'stats');
  const html = api.__sandbox.document.getElementById('statsTable').innerHTML;
  assert.match(html, /Total/);
  assert.match(html, /AVERY/);
});

test('test_stats_sheet_in_combined_excel_payroll_sheet_unchanged', async () => {
  const { api } = setup();
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook;
  // FC-00060: an Hours sheet (punch by punch) follows the report; Stats is a math sheet.
  assert.deepEqual(wb.worksheets.map(w => w.name), ['Report', 'Hours', 'Stats', 'Labor Cost']); // Labor Cost: FC-00052
  const st = wb.worksheets.find(w => w.name === 'Stats');
  const { xlNum } = require('./xl-helpers');
  const vals = st.rows.slice(1).map(r => (r || []).slice(1).map(c => c && xlNum(c)));
  const hdr = vals.find(r => r[0] === 'Employee');
  assert.deepEqual(hdr, api.STATS_XL_HEADERS);
  const H = (k) => api.STATS_XL_HEADERS.indexOf(k);
  const avery = vals.find(r => r[0] === 'AVERY');
  assert.ok(avery, 'names as the payroll report prints them (FIRST LAST)');
  assert.equal(avery[H('Expected')], 32 / 24, 'hours are real durations');
  assert.equal(avery[H('Late days')], 2);
  assert.equal(avery[H('Days worked (scheduled)')], 3);
  assert.equal(Math.round(avery[H('Late %')] * 100), 67, 'late % = late days / days worked (a formula)');
  assert.ok(vals.some(r => r[0] === 'Alpha Test total'));
  // The payroll sheet is the same with or without the Stats sheet.
  assert.equal(wb.worksheets[0].rows[3][1].value, 'Entity');
});

test('test_pay_identical', () => {
  const { api } = setup();
  const pay = () => JSON.stringify(api._collectExportData().map(d => d.rows.map(r => [r._empName, r.actualHours, r._breakdown])));
  const before = pay();
  api.entityStats(0);
  api.setPayrollSubTab(0, 'stats');
  api.renderReviewTableHtml(api.entities[0], 0);
  assert.equal(pay(), before);
});

// Review fix: a night shift split at midnight (on one row or two) is one shift.
test('test_overnight_split_at_midnight_not_flagged', () => {
  const { api, e, add } = setup();
  const r1 = add('BRAM', D(1), '15:15', '23:30');
  const r2 = add('BRAM', D(1), '00:00', '01:15');
  e.intake.reviewRows = e.intake.reviewRows.filter(r => r === r1 || r === r2 || r.empName !== 'BRAM');
  assert.deepEqual(texts(api.punctualityFlags(r1, e)), []);
  assert.deepEqual(texts(api.punctualityFlags(r2, e)), []);
  const one = api.processReviewRow({ empName: 'BRAM', date: D(1), clockIn1: '15:15', clockOut1: '23:30', clockIn2: '00:00', clockOut2: '01:15', confidence: 0.95, source: 'TC', originalName: 'b2.jpg' }, e);
  e.intake.reviewRows = e.intake.reviewRows.filter(r => r.empName !== 'BRAM').concat([one]);
  api.approveReviewRow(one.id);
  api.syncActualsFromReview();
  assert.deepEqual(texts(api.punctualityFlags(one, e)), []);
  const bram = api.entityStats(0).people.find(p => p.name === 'BRAM');
  assert.equal(bram.lateDays, 0);
  assert.equal(bram.earlyMin, 0, 'no phantom early minutes');
});

test('test_other_hours_than_scheduled_not_counted_as_early', () => {
  const { api, e, add } = setup();
  const r = add('AVERY', D(5), '05:45', '14:15'); // scheduled 9-5 Friday, worked an early shift instead
  assert.deepEqual(texts(api.punctualityFlags(r, e)), ['yellow:Other hours than scheduled']);
  api.syncActualsFromReview();
  const avery = api.entityStats(0).people.find(p => p.name === 'AVERY');
  assert.equal(avery.otherDays, 1);
  assert.equal(avery.earlyMin, 20, 'only Wednesday counts as early');
  assert.equal(avery.missedDays, 0);
});
