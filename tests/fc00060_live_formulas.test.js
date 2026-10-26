// FC-00060: every Excel the tool writes is a math sheet. The payroll report's Hours are formulas
// over an Hours sheet (every paid day punch by punch, with the tool's day rule), Stats and Labor
// Cost totals/percents/averages are formulas, and the Timecards Excel holds real Excel times with
// a punched-hours formula per row. Every formula evaluates to the tool's own number.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, resetToSingleEntity } = require('./load-app');
const { xlNum, xlEval, xlFormulaMismatches } = require('./xl-helpers');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const SHIFT = ['', '9AM - 5PM', '9AM - 5PM', '9PM - 5AM', '', '', ''];
const P = (inH, outAdj) => ({ in: inH, out: outAdj % 24, outAdj, minutes: Math.round((outAdj - inH) * 60) });
function setup() {
  const api = loadApp({ savedNames: true });
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  const ent = resetToSingleEntity(api, {
    id: 0, name: 'Alpha Test', employees: [{ name: 'Avery', shifts: SHIFT }, { name: 'Bram', shifts: SHIFT }],
    dateLabels: WEEK, breakMinutes: 30, breakMinutesSet: true,
    actualDays: [
      // a long lunch (gap 50 min > the 30 min minimum) and a short one (10 min < 30)
      { empName: 'Avery', entityName: 'Alpha Test', date: '2026-08-10', dayIdx: 1, pairs: [P(8.95, 12.5), P(13 + 1 / 3, 17.1)] },
      { empName: 'Avery', entityName: 'Alpha Test', date: '2026-08-11', dayIdx: 2, pairs: [P(9, 13), P(13 + 1 / 6, 17)] },
      // an overnight shift with a second pair after midnight
      { empName: 'Avery', entityName: 'Alpha Test', date: '2026-08-12', dayIdx: 3, pairs: [P(21, 25.5), P(26, 29.25)] },
      { empName: 'Bram', entityName: 'Alpha Test', date: '2026-08-10', dayIdx: 1, pairs: [P(9, 17.75)] },
    ],
  });
  api._syncEntityCode(ent);
  api.wageRates[api.wKey(0, 'Avery')] = 15.37; api.payMethod[api.wKey(0, 'Avery')] = 'cash';
  api.wageRates[api.wKey(0, 'Bram')] = 14; api.payMethod[api.wKey(0, 'Bram')] = 'deposit';
  return api;
}
const sheet = (api, n) => api.__lastExcelWorkbook.worksheets.find(w => w.name === n);

test('test_every_formula_in_the_payroll_workbook_agrees', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook;
  assert.deepEqual(wb.worksheets.map(w => w.name), ['Report', 'Hours', 'Stats', 'Labor Cost']);
  let total = 0;
  wb.worksheets.forEach(ws => { const { n, bad } = xlFormulaMismatches(wb, ws); total += n; assert.deepEqual(bad, [], ws.name); });
  assert.ok(total > 60, 'formulas everywhere: ' + total);
});

test('test_hours_sheet_follows_the_day_rule', async () => {
  const api = setup();
  // A per-day break set by hand (exact, even below the minimum) on Avery's Tuesday.
  api.breakOverrides[api.wKey(0, 'Avery') + '|2'] = 5;
  api.syncActualsFromReview && 0;
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, hs = sheet(api, 'Hours');
  const pay = api.computePayrollForEntity(0).results.find(r => r.schedName === 'Avery');
  const hdr = hs.rows.find(r => r && r[1] && r[1].value === 'Entity').map(c => c && c.value);
  const col = (k) => hdr.indexOf(k);
  const days = hs.rows.filter(r => r && r[2] && r[2].value === 'Avery');
  assert.equal(days.length, 3);
  days.forEach((r, i) => {
    const d = [1, 2, 3][i];
    assert.ok(Math.abs(xlEval(wb, hs, r[col('Hours')].value.formula) - pay.days[d].billableH) < 1e-9, 'day ' + d + ' hours = tool');
  });
  assert.equal(days[1][col('Break set (min)')].value, 5, 'the per-day break is written and used');
  assert.equal(days[2][col('+1')].value, 0);
  assert.equal(days[2][col('+1') + 3].value, 1, 'the after-midnight pair starts the next day');
  const rep = sheet(api, 'Report').rows.find(r => r && r[2] && r[2].value === 'Avery');
  assert.equal(xlNum(rep[api.COMBINED_COLS.hours + 1]), pay.actualHours);
});

test('test_changing_the_break_minimum_recalculates', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, hs = sheet(api, 'Hours'), rp = sheet(api, 'Report');
  const hdr = hs.rows.find(r => r && r[1] && r[1].value === 'Entity').map(c => c && c.value);
  const bram = hs.rows.find(r => r && r[2] && r[2].value === 'Bram');
  const grand = rp.rows.find(r => r && r[1] && r[1].value === 'GRAND TOTAL');
  const T = api.COMBINED_COLS.total + 1;
  const before = xlEval(wb, rp, grand[T].value.formula);
  bram[hdr.indexOf('Break min (min)')].value = 60; // 30 more minutes of break on an 8:45 day with no gap
  assert.equal(Math.round((before - xlEval(wb, rp, grand[T].value.formula)) * 100) / 100, 7, 'half an hour at $14 less');
});

test('test_stats_and_labor_cost_are_formulas', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const st = sheet(api, 'Stats'), lc = sheet(api, 'Labor Cost');
  const fx = (ws) => ws.rows.flat().filter(c => c && c.value && typeof c.value === 'object' && 'formula' in c.value).map(c => c.value.formula);
  assert.ok(fx(st).some(f => /^IF\(C\d+>0,D\d+\/C\d+,""\)$/.test(f)), 'worked % = worked / expected');
  assert.ok(fx(st).some(f => /^SUM\(/.test(f)), 'entity totals are sums');
  assert.ok(fx(lc).some(f => /^SUM\(B\d+:H\d+\)$/.test(f)), 'week = sum of the days');
  assert.ok(fx(lc).some(f => /-/.test(f) && /^I\d+-I\d+$|^[A-I]\d+-[A-I]\d+$/.test(f)), 'variance = actual − scheduled');
  const total = lc.rows.find(r => r && r[1] && r[1].value === 'Labor cost this week');
  assert.ok(total[9].value.formula, 'the week\'s labor cost is a formula');
});

test('test_timecards_excel_real_times_and_hours', async () => {
  const api = setup();
  const e = api.entities[0];
  api.ensureIntakeState(e);
  const r = api.processReviewRow({ empName: 'Avery', date: '2026-08-10', clockIn1: '21:00', clockOut1: '01:30', clockIn2: '02:00', clockOut2: '05:15', confidence: 0.95, source: 'TC', originalName: 'a.jpg' }, e);
  e.intake.reviewRows.push(r);
  await api.exportActualsIntakeExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  const row = ws.rows.find(x => x && x[17] && x[17].value === r.id);
  assert.equal(row[3].value, (Date.UTC(2026, 7, 10) - Date.UTC(1899, 11, 30)) / 86400000, 'a real date');
  assert.equal(row[3].numFmt, 'yyyy-mm-dd', 'prints as before');
  assert.equal(row[5].value, 21 / 24, 'a real time');
  assert.equal(row[5].numFmt, 'h:mm AM/PM');
  assert.equal(xlEval(wb, ws, row[18].value.formula), 7.75, 'punched hours over midnight');
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
});

// Review fix: OCR can store a time Excel cannot hold as written ("24:00", "9:01:30"). Through the
// Timecards Excel it comes back as the same clock time; that box is not "changed by hand", so it
// is not blue and does not turn its pair into a manual entry (which would drop the other card's
// overlapping punches and change the hours).
test('test_timecards_round_trip_same_clock_time_is_not_an_edit', async () => {
  const api = setup();
  const e = api.entities[0];
  e.actualDays = [];
  api.ensureIntakeState(e);
  const tc = api.processReviewRow({ empName: 'Bram', date: '2026-08-11', clockIn1: '17:00', clockOut1: '24:00', confidence: 0.95, source: 'TC', originalName: 't.jpg' }, e);
  const ec = api.processReviewRow({ empName: 'Bram', date: '2026-08-11', clockIn1: '16:50', clockOut1: '00:10', confidence: 0.95, source: 'EC', originalName: 'e.jpg' }, e);
  e.intake.reviewRows.push(tc, ec);
  api.approveReviewRow(tc.id); api.approveReviewRow(ec.id);
  api.syncActualsFromReview();
  const hrs = () => api._collectExportData()[0].rows.find(r => r._empName === 'Bram').actualHours;
  const before = hrs();
  await api.exportActualsIntakeExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const H = api.ACTUALS_INTAKE_HEADERS.map(h => h.toLowerCase());
  const cm = {}; H.forEach((h, i) => { cm[h] = i; });
  // Read back the way SheetJS shows it: times as text, the stored "24:00" now "12:00 AM".
  const text = (c) => { const v = c && c.value; if (v == null) return ''; if (typeof v === 'object' && 'formula' in v) return String(v.result); if (typeof v === 'number' && c.numFmt === 'h:mm AM/PM') { const m = Math.round(v * 1440) % 1440; return api.to12h(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')); } if (typeof v === 'number' && c.numFmt === 'yyyy-mm-dd') { return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10); } return String(v); };
  const rows = ws.rows.filter(r => r && r[17] && (r[17].value === tc.id || r[17].value === ec.id)).map(r => H.map((_, i) => text(r[i + 1])));
  assert.equal(rows.length, 2);
  e.intake.reviewRows = [];
  api._ingestActualsIntakeRows(rows, cm);
  api.syncActualsFromReview();
  const back = e.intake.reviewRows.find(r => r.id === tc.id);
  assert.equal(api._boxEdited(back, 'clockOut1'), false, 'not blue');
  assert.equal(back.source, 'TC', 'still an OCR row, not manual');
  assert.equal(hrs(), before, 'hours unchanged by the round trip');
});
