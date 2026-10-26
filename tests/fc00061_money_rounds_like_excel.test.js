// FC-00061: money rounds like Excel's ROUND (half away from zero on the decimal value). Before,
// 10.03 h × $16.50 = $165.495 was stored as 165.49499… and rounded down to $165.49 (cash $165),
// while the Excel the tool wrote recalculated to $165.50 (cash $166): the PDF and the Excel
// disagreed by a dollar.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, resetToSingleEntity } = require('./load-app');
const { xlFormulaMismatches } = require('./xl-helpers');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
function setup(hours, rate, method) {
  const api = loadApp({ savedNames: true });
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true;
  // Spread over days of 8 h at most (a punch pair is never 24 h or more).
  let left = Math.round(hours * 60); const days = []; let di = 1;
  while (left > 0) { const m = Math.min(480, left); left -= m; days.push({ empName: 'Avery', entityName: 'Alpha Test', date: '2026-08-' + (9 + di), dayIdx: di, pairs: [{ in: 8, out: 8 + m / 60, outAdj: 8 + m / 60, minutes: m }] }); di++; }
  const e = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [{ name: 'Avery', shifts: ['', '9AM - 5PM', '', '', '', '', ''] }], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true, actualDays: days });
  api._syncEntityCode(e);
  api.wageRates[api.wKey(0, 'Avery')] = rate; api.payMethod[api.wKey(0, 'Avery')] = method;
  return api;
}

test('test_half_cent_rounds_up_like_excel', async () => {
  const api = setup(10.03, 16.5, 'cash'); // 10:02 = 10.03 h on the report
  const r = api._collectExportData()[0].rows[0];
  assert.equal(Math.round(r.actualHours * 100) / 100, 10.03);
  assert.equal(r._breakdown.actualFinal, 165.5, '$165.495 → $165.50, as Excel');
  assert.equal(r._breakdown.cash, 166);
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook;
  wb.worksheets.forEach(ws => assert.deepEqual(xlFormulaMismatches(wb, ws).bad, [], ws.name + ': the file says the same as the tool'));
});

test('test_rounding_helper', () => {
  const api = setup(1, 1, 'cash');
  assert.equal(api.roundDeposit(165.495), 165.5);
  assert.equal(api.roundDeposit(1.005), 1.01);
  assert.equal(api.roundDeposit(-0.495), -0.5);
  assert.equal(api.roundCash(165.5), 166);
  assert.equal(api.roundCash(165.49), 165);
  assert.equal(api.roundDeposit(12.344), 12.34);
});
