// FC-00052: labor cost by day (tied to the payroll Actual to the cent), by hour of day, and
// scheduled vs actual; the Semi-monthly pay type (paid in the run whose week holds the 1st
// or the 15th, cost spread as amount × 24 ÷ 52 per week).
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const SCHED_HDR = ['Name', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Pay week Sun Oct 4 – Sat Oct 10 2026 → run Mon Oct 12, run week Oct 11–17 (holds the 15th).
const week = (sun) => { const out = []; const d = new Date(sun + 'T00:00:00'); for (let i = 0; i < 7; i++) { const x = new Date(d); x.setDate(d.getDate() + i); out.push(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()] + ' ' + x.getDate() + ' ' + x.getFullYear()); } return out; };
const iso = (lbl) => { const d = new Date(lbl); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function setup(sun = '2026-10-04') {
  const WEEK = week(sun);
  const api = loadApp();
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  api.__sandbox.crypto = webcrypto;
  const ent = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [], dateLabels: WEEK, breakMinutes: 30, breakMinutesSet: true });
  api._syncEntityCode(ent);
  const O = 'OFF';
  api.parseSchedule([SCHED_HDR,
    ['AVERY', O, '9:00AM-5:00PM', '9:00AM-5:00PM', O, O, O, O],
    ['BRAM', O, '10:00PM-6:00AM', O, O, O, O, O],
    ['WREN', O, '5:45AM-2:15PM', O, O, O, O, O],
  ], 0);
  const e = api.entities[0];
  e.dateLabels = WEEK.slice();
  api.ensureIntakeState(e);
  api.wageRates[api.wKey(0, 'AVERY')] = 13.37;
  api.wageRates[api.wKey(0, 'BRAM')] = 12.11;
  const add = (name, d, i, o) => {
    const r = api.processReviewRow({ empName: name, date: iso(WEEK[d]), clockIn1: i, clockOut1: o, confidence: 0.95, source: 'TC', originalName: name + d + '.jpg' }, e);
    e.intake.reviewRows.push(r); api.approveReviewRow(r.id); return r;
  };
  add('AVERY', 1, '08:57', '17:04');
  add('AVERY', 2, '09:00', '13:13');
  add('BRAM', 1, '22:00', '06:00');
  api.syncActualsFromReview();
  return { api, e, WEEK };
}
// Make WREN semi-monthly with $2,000 per half-month (through the dispatcher, as the screen does).
function makeSemi(api, amount = 2000) {
  const k = api.wKey(0, 'WREN');
  api.dispatch({ type: 'flatWage', screen: 'payroll', target: { kind: 'employee', entity: 0, id: k, field: 'flatWage' }, from: null, to: amount, meta: { empName: 'WREN' } });
  api.dispatch({ type: 'semiMonthlySet', screen: 'payroll', target: { kind: 'employee', entity: 0, id: k, field: 'semiMonthly' }, from: null, to: true, meta: { empName: 'WREN' } });
}

test('test_day_cost_ties_to_payroll_actual_to_the_cent', () => {
  const { api } = setup();
  const lc = api.entityLaborCost(0);
  const actual = api._collectExportData()[0].rows.reduce((a, r) => a + r._breakdown.actualFinal, 0);
  assert.equal(Math.round((lc.week.cost + lc.fixedSum) * 100), Math.round(actual * 100));
  assert.equal(Math.round(lc.days.reduce((a, d) => a + d.cost, 0) * 100), Math.round(lc.week.cost * 100), 'days add up to the week');
  assert.equal(lc.days[1].people, 2);
  assert.ok(lc.days[1].perHour > 12 && lc.days[1].perHour < 13.37);
});

test('test_overnight_minutes_land_in_next_day_early_hours', () => {
  const { api } = setup();
  const lc = api.entityLaborCost(0);
  // BRAM 10 PM Mon → 6 AM Tue: the day cost belongs to Monday, the hours after midnight sit in Tuesday's grid.
  assert.ok(lc.grid[23][1].people.has('BRAM'), '11 PM Monday');
  assert.ok(lc.grid[2][2].people.has('BRAM'), '2 AM in Tuesday\'s column');
  assert.ok(!lc.grid[2][1].people.has('BRAM'));
  assert.equal(lc.days[2].people, 1, 'only AVERY works a shift starting Tuesday');
});

test('test_hour_grid_total_equals_day_total', () => {
  const { api } = setup();
  const lc = api.entityLaborCost(0);
  const gridSum = lc.grid.reduce((a, row) => a + row.reduce((b, c) => b + c.cost, 0), 0);
  assert.equal(Math.round(gridSum * 100), Math.round(lc.week.cost * 100));
});

test('test_scheduled_vs_actual_hourly_only', () => {
  const { api } = setup();
  makeSemi(api);
  api.syncActualsFromReview();
  const lc = api.entityLaborCost(0);
  // AVERY Mon 8h − 30 min break = 7.5 h × 13.37; BRAM 8h − 0.5 = 7.5 h × 12.11.
  assert.equal(lc.days[1].sched, Math.round((7.5 * 13.37 + 7.5 * 12.11) * 100) / 100);
  assert.equal(lc.days[1].variance, Math.round((lc.days[1].hourlyCost - lc.days[1].sched) * 100) / 100);
  assert.ok(lc.semis.length === 1 && lc.days[1].sched < 200, 'the semi-monthly person is not in scheduled cost');
});

test('test_semi_monthly_paid_when_run_week_has_1st_or_15th', () => {
  const { api } = setup('2026-10-04'); // run Oct 12: week Oct 11–17 holds the 15th
  makeSemi(api);
  api.syncActualsFromReview();
  const info = api.semiRunInfo(api.entities[0]);
  assert.equal(info.runIso, '2026-10-12');
  assert.equal(info.paid, true);
  const w = api._collectExportData()[0].rows.find(r => r._empName === 'WREN');
  assert.equal(w._breakdown.actualFinal, 2000);
  const { api: b } = setup('2026-10-11'); // run Oct 19: week Oct 18–24, no 1st or 15th
  makeSemi(b);
  b.syncActualsFromReview();
  const w2 = b._collectExportData()[0].rows.find(r => r._empName === 'WREN');
  assert.equal(w2._breakdown.actualFinal, 0);
});

test('test_semi_monthly_history_runs', () => {
  // [pay-week Sunday, paid?] for the runs of Aug 31, Sep 7, Sep 14, Sep 28, Oct 5, Oct 12, Oct 19, Nov 2.
  const cases = [['2026-08-23', true], ['2026-08-30', false], ['2026-09-06', true], ['2026-09-20', true], ['2026-09-27', false], ['2026-10-04', true], ['2026-10-11', false], ['2026-10-25', true]];
  cases.forEach(([sun, paid]) => {
    const { api } = setup(sun);
    assert.equal(api.semiRunInfo(api.entities[0]).paid, paid, sun);
  });
});

test('test_semi_monthly_tick_override_and_zero_row_kept', () => {
  const { api } = setup('2026-10-11');
  makeSemi(api);
  api.syncActualsFromReview();
  let w = api._collectExportData()[0].rows.find(r => r._empName === 'WREN');
  assert.ok(w, 'a $0 week keeps the row');
  assert.equal(w._breakdown.actualFinal, 0);
  const k = api.wKey(0, 'WREN');
  api.dispatch({ type: 'semiPaidSet', screen: 'payroll', target: { kind: 'employee', entity: 0, id: k, field: 'semiPaid' }, from: null, to: true, meta: { empName: 'WREN' } });
  w = api._collectExportData()[0].rows.find(r => r._empName === 'WREN');
  assert.equal(w._breakdown.actualFinal, 2000, 'the owner ticked it');
  api.renderPayroll();
  api.setPayrollSubTab(0, 'payroll');
  const html = api.__sandbox.document.getElementById('payrollCalcTable').innerHTML;
  assert.match(html, /Per half-month/);
  assert.match(html, /class="semi-paid" checked/);
  assert.match(html, /holds no 1st or 15th/);
});

test('test_semi_monthly_cost_24_over_52', () => {
  assert.equal(loadApp().semiWeeklyCost(2000), 923.08);
  assert.equal(loadApp().semiDailyCost(2000), 131.87);
  const { api } = setup('2026-10-11');
  makeSemi(api);
  api.syncActualsFromReview();
  const lc = api.entityLaborCost(0);
  assert.equal(lc.semiWeekly, 923.08);
  assert.equal(lc.total, Math.round((lc.week.cost + lc.fixedSum + 923.08) * 100) / 100);
  assert.ok(!lc.grid.some(row => row.some(c => c.people.has('WREN'))), 'not in the hourly grid');
});

test('test_semi_monthly_in_settings_file_round_trip', async () => {
  const { api } = setup();
  makeSemi(api, 2100);
  await api.exportPayrollSettingsExcel(false);
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const rows = ws.rows.slice(1).map(r => (r || []).slice(1).map(c => c && c.value));
  const hdrIdx = rows.findIndex(r => r.includes('Employee') && r.includes('Type'));
  const hdr = rows[hdrIdx];
  const wren = rows.find(r => r[hdr.indexOf('Employee')] === 'WREN');
  assert.equal(wren[hdr.indexOf('Type')], 'Semi-monthly');
  assert.equal(wren[hdr.indexOf('Flat Amount')], 2100);
  const { api: b } = setup();
  const cm = {}; hdr.forEach((h, i) => { if (h) cm[String(h).toLowerCase()] = i; });
  b._ingestPayrollSettings(rows.slice(hdrIdx + 1).filter(r => r[0]).map(r => r.map(v => v == null ? '' : String(v))), cm, false);
  assert.equal(b.isSemiMonthly(0, 'WREN'), true);
  assert.equal(b.flatWages[b.wKey(0, 'WREN')], 2100);
});

test('test_labor_cost_sheet_in_combined_excel', async () => {
  const { api } = setup();
  makeSemi(api);
  api.syncActualsFromReview();
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook;
  assert.deepEqual(wb.worksheets.map(w => w.name), ['Report', 'Stats', 'Labor Cost']);
  const vals = wb.worksheets[2].rows.slice(1).map(r => (r || []).slice(1).map(c => c && c.value));
  assert.ok(vals.some(r => r[0] === 'Cost'));
  assert.ok(vals.some(r => String(r[0]).startsWith('Semi-monthly: WREN') && r[8] === 923.08));
  assert.ok(vals.some(r => r[0] === 'Cost by hour'));
  api.setPayrollSubTab(0, 'labor');
  const html = api.__sandbox.document.getElementById('laborCostHost').innerHTML;
  assert.match(html, /Labor cost this week/);
  assert.match(html, /Semi-monthly: <b>WREN<\/b>/);
});

test('test_pay_identical_except_semi_monthly', () => {
  const { api } = setup();
  const pay = () => api._collectExportData()[0].rows.filter(r => r._empName !== 'WREN').map(r => [r._empName, r._breakdown.actualFinal]);
  const before = JSON.stringify(pay());
  makeSemi(api);
  api.syncActualsFromReview();
  api.entityLaborCost(0);
  assert.equal(JSON.stringify(pay()), before);
});

test('test_semi_monthly_type_button', () => {
  const { api } = setup();
  api.renderPayroll();
  api.setPayrollSubTab(0, 'payroll');
  const rows = api._flatRowsForTest();
  const i = rows.findIndex(x => (x.row.schedName || x.row.name) === 'WREN');
  api.setRowType(i, 'semi');
  assert.equal(api.isSemiMonthly(0, 'WREN'), true);
  assert.notEqual(api.flatWages[api.wKey(0, 'WREN')], undefined, 'semi-monthly is flat');
  api.setRowType(i, 'flat');
  assert.equal(api.isSemiMonthly(0, 'WREN'), false);
  api.setRowType(i, 'hourly');
  assert.equal(api.flatWages[api.wKey(0, 'WREN')], undefined);
});
