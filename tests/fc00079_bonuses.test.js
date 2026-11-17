// FC-00079: weekly (recurring), monthly and specialty bonuses, each paid by deposit, cash or
// contract check. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app');
const { xlNum, xlFormulaMismatches } = require('./xl-helpers');
const { setup, rowOf } = require('./fc70-helpers');

const NEXT = ['Aug 16 2026', 'Aug 17 2026', 'Aug 18 2026', 'Aug 19 2026', 'Aug 20 2026', 'Aug 21 2026', 'Aug 22 2026'];

test('test_only_recurring_weekly_carries_to_next_week', () => {
  const api = setup();
  api.addBonus(0, 'Avery Atest', { type: 'weekly', amount: 50, recurring: true });
  api.addBonus(0, 'Avery Atest', { type: 'monthly', amount: 100 });
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 25 });
  api.addBonus(0, 'Avery Atest', { type: 'weekly', amount: 10 });
  assert.equal(api.bonusesThisRun(0, 'Avery Atest').length, 4);
  assert.equal(api.bonusTotals(0, 'Avery Atest').total, 185);
  assert.equal(api.getBonuses(0, 'Avery Atest').find(b => b.type === 'monthly').recurring, false, 'only a Weekly bonus can recur');
  api.entities.forEach(e => { e.dateLabels = NEXT.slice(); });
  assert.deepEqual(api.bonusesThisRun(0, 'Avery Atest').map(b => [b.type, b.amount]), [['weekly', 50]], 'next week: only the recurring weekly bonus');
});

test('test_each_bonus_pays_the_way_chosen', () => {
  const api = setup();
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 50, pay: 'deposit' });
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 30.4, pay: 'cash' });
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 20, pay: 'contract' });
  let bd = rowOf(api, 'Avery Atest')._breakdown;
  assert.equal(bd.actualFinal, 625.4, '525 + 50 + 30.40 + 20');
  assert.equal(bd.bonus, 100.4);
  assert.deepEqual(api.payParts(bd), { deposit: 575, contract: 20, cash: 30 });
  // Cash person: a cash bonus rounds together with their cash.
  api.addBonus(0, 'Bram Btest', { type: 'monthly', amount: 0.6 });
  bd = rowOf(api, 'Bram Btest')._breakdown;
  assert.equal(api.getBonuses(0, 'Bram Btest')[0].pay, 'cash', 'default: the person\'s own way');
  assert.equal(bd.cash, 511, 'round(510 + 0.60)');
  // Deposit + Cash ($300 whole deposit): a deposit bonus adds to the deposit, a cash bonus to the cash.
  api.addBonus(0, 'Cora Ctest', { type: 'specialty', amount: 40, pay: 'deposit' });
  api.addBonus(0, 'Cora Ctest', { type: 'specialty', amount: 10.5, pay: 'cash' });
  bd = rowOf(api, 'Cora Ctest')._breakdown;
  assert.equal(bd.deposit, 340);
  assert.equal(bd.cash, 221, 'round(510 + 10.50 − 300) = round(220.50)');
  // Contract Check person: default by check.
  api.addBonus(0, 'Dane Dtest', { type: 'specialty', amount: 15 });
  assert.deepEqual(api.payParts(rowOf(api, 'Dane Dtest')._breakdown), { deposit: 0, contract: 165, cash: 0 });
});

test('test_report_bonus_column_and_excel_values', async () => {
  const api = setup();
  api.setReportColumnOn('bonus', true);
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 50, pay: 'deposit' });
  api.addBonus(0, 'Eden Etest', { type: 'monthly', amount: 20, pay: 'cash' });
  const m = api._fc13PreviewModel();
  const H = m.headers, cell = (n, h) => m.rows.find(r => r.kind === 'data' && r.cells[0] === n).cells[H.indexOf(h)]; // FC-00080: Employee first
  assert.equal(cell('Avery Atest', 'Bonus'), '$50.00');
  assert.equal(cell('Avery Atest', 'Total'), '$575.00');
  assert.equal(cell('Avery Atest', 'Hours'), '40.00', 'FC-00080: straight-time hours');
  assert.equal(cell('Avery Atest', 'Over time'), '2.50');
  assert.equal(cell('Avery Atest', 'Deposit'), '$575.00');
  assert.equal(cell('Eden Etest', 'Deposit'), '$532.00');
  assert.equal(cell('Eden Etest', 'Cash'), '$20.00');
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, [], 'every formula still agrees');
  const ev = ws.rows.find(r => r && r[1] && r[1].value === 'Eden Etest');
  const av = ws.rows.find(r => r && r[1] && r[1].value === 'Avery Atest');
  assert.equal(xlNum(av[C.hours + 1]), 40, 'a bonus row\'s hours still follow the Hours sheet');
  assert.equal(xlNum(ev[C.bonus + 1]), 20);
  assert.equal(xlNum(ev[C.cash + 1]), 20);
  const sub = ws.rows.find(r => r && r[1] && r[1].value === 'Employees subtotal');
  assert.equal(xlNum(sub[C.bonus + 1]), 70);
});

test('test_bonuses_saved_in_register_and_snapshot_and_undoable', async () => {
  const api = setup();
  api.addBonus(0, 'Avery Atest', { type: 'weekly', amount: 50, recurring: true, note: 'lead shifts' });
  api.addBonus(0, 'Bram Btest', { type: 'specialty', amount: 75, pay: 'deposit' });
  await api.exportPayrollSettingsExcel(false);
  const tw = api.__lastExcelWorkbook.worksheets.find(w => w.name === 'Bonuses'); // FC-00083
  const rows = tw.rows.filter(Boolean).map(r => r.slice(1).map(c => (c && c.value != null ? String(c.value) : '')));
  assert.ok(rows.some(r => r[2] === 'Avery Atest' && r[4] === 'Weekly' && r[7] === 'Yes' && r[10] === 'lead shifts'));
  assert.ok(rows.some(r => r[2] === 'Bram Btest' && r[4] === 'Specialty' && r[6] === 'Deposit'));
  const b = setup();
  assert.equal(b._ingestBonusRows(rows), 2);
  assert.deepEqual(b.bonusTotals(0, 'Avery Atest'), { total: 50, deposit: 50, cash: 0, contract: 0 });
  assert.equal(b.bonusTotals(0, 'Bram Btest').deposit, 75);
  const snap = await api.buildSnapshot();
  const c = loadApp(); c.__sandbox.alert = () => {}; c.__sandbox.confirm = () => true;
  c.openSnapshotData(snap, 'x');
  assert.equal(c.bonusTotals(0, 'Avery Atest').total, 50);
  const line = api.session.log.filter(e => e.target && e.target.field === 'bonuses').at(-1);
  api.revertFromHistory(line.id);
  assert.equal(api.bonusTotals(0, 'Bram Btest').total, 0, 'undone');
});

test('test_bonus_button_and_panel', () => {
  const api = setup();
  api.setTab('payroll'); api.renderPayroll();
  const doc = api.__sandbox.document;
  assert.match(doc.getElementById('payrollCalcTable').innerHTML, /openBonusEditor\(0,'Avery Atest'\)"[^>]*>\+ Bonus</);
  api.openBonusEditor(0, 'Avery Atest');
  assert.match(doc.getElementById('bonusPanel').innerHTML, /Bonuses this run/);
  api.addBonus(0, 'Avery Atest', { type: 'monthly', amount: 12 });
  api.renderPayroll(); api.renderBonusPanel();
  const html = doc.getElementById('bonusPanel').innerHTML;
  assert.match(html, /value="12\.00"/);
  assert.match(html, /this week only/, 'Monthly cannot recur');
  assert.match(doc.getElementById('payrollCalcTable').innerHTML, /Bonus \$12\.00/);
});
