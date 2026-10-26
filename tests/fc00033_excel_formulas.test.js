// FC-00033: Excel exports carry live formulas, not pasted values. Every derived money/hours
// cell is a formula whose cached result is the tool's own number, subtotals are SUM() over the
// entity's rows, and the grand total sums the subtotals. This file evaluates the written
// formulas with a small Excel-compatible evaluator, so a formula that disagrees with the
// tool's math fails here (the real-workbook LibreOffice check is in the FC-00033 card).
const test = require('node:test');
const assert = require('node:assert/strict');
// FC-00050: these tests check the saved spelling, so they ask for "As saved" names.
const { loadApp, resetToSingleEntity } = require('./load-app');
const { xlNum } = require('./xl-helpers');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const SHIFT = ['', '9AM - 5PM', '', '', '', '', ''];
const day = (empName, entityName, out) => ({ empName, entityName, date: '2026-08-10', dayIdx: 1, pairs: [{ in: 9, out, outAdj: out, minutes: (out - 9) * 60 }] });

function setup() {
  const api = loadApp({ savedNames: true });
  const people = ['Ann', 'Ben', 'Cy', 'Dee', 'Ermine', 'Falcon', 'Gravel'];
  const ent = resetToSingleEntity(api, {
    id: 0, name: 'Alpha Test', employees: people.map(name => ({ name, shifts: SHIFT })),
    dateLabels: WEEK, breakMinutesSet: true,
    actualDays: [day('Ann', 'Alpha Test', 17.2), day('Ben', 'Alpha Test', 16.45), day('Dee', 'Alpha Test', 13.1),
      day('Ermine', 'Alpha Test', 15.35), day('Falcon', 'Alpha Test', 18.6), day('Gravel', 'Alpha Test', 14.75)],
  });
  api._syncEntityCode(ent);
  api.entities.push({
    id: 1, name: 'Beta Test', employees: [{ name: 'Harbor', shifts: SHIFT }], dateLabels: WEEK,
    newDateLabels: ['', '', '', '', '', '', ''], newWeekStartVal: '', breakMinutes: 0, breakMinutesSet: true,
    actualDays: [day('Harbor', 'Beta Test', 16.3)], intake: null,
  });
  api._syncEntityCode(api.entities[1]);
  const set = (e, n, rate, method) => { api.wageRates[api.wKey(e, n)] = rate; if (method) api.payMethod[api.wKey(e, n)] = method; };
  set(0, 'Ann', 15.37, 'cash');
  set(0, 'Ben', 14.11, 'both'); api.splitAmounts[api.wKey(0, 'Ben')] = { deposit: 50, typed: true, isWhole: true };
  api.flatWages[api.wKey(0, 'Cy')] = 300;
  set(0, 'Dee', 20.03, 'deposit');
  set(0, 'Ermine', 18.5, 'contract');
  set(0, 'Falcon', 16.25, 'both'); api.splitAmounts[api.wKey(0, 'Falcon')] = { deposit: 40.5, typed: true, isWhole: false };
  set(0, 'Gravel', 13.33, 'both'); // no deposit typed: all cash
  set(1, 'Harbor', 21.07, 'cash');
  return api;
}

// ---- Evaluator (FC-00060: shared in xl-helpers, follows formulas across sheets) ----
const { xlEval, xlFormulaMismatches } = require('./xl-helpers');
let _wb = null;
function evaluate(ws, formula) { return xlEval(_wb || { worksheets: [ws] }, ws, formula); }
const isFx = (c) => !!(c && c.value && typeof c.value === 'object' && 'formula' in c.value);
function assertAllFormulasAgree(ws, label, wb) {
  _wb = wb || null;
  const { n, bad } = xlFormulaMismatches(wb || { worksheets: [ws] }, ws);
  assert.deepEqual(bad, [], label + ': every formula evaluates to the tool\'s cached value');
  return n;
}

test('test_combined_rows_are_formulas_that_reproduce_tool_values', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook;
  const ws = wb.worksheets[0];
  // FC-00060: Hours is a formula over the Hours sheet. Columns by name (1-based).
  const C = Object.fromEntries(Object.entries(api.COMBINED_COLS).map(([k, v]) => [k, v + 1]));
  const n = assertAllFormulasAgree(ws, 'combined', wb);
  assert.ok(n >= 8 * 4, 'every pay row carries deposit/cash/final/diff formulas');
  assert.deepEqual(xlFormulaMismatches(wb, wb.worksheets.find(w => w.name === 'Hours')).bad, [], 'Hours sheet formulas agree');
  const data = api._collectExportData().flatMap(d => d.rows);
  const rowFor = (name) => ws.rows.find(r => r && r[2] && r[2].value === name);
  for (const name of ['Ann', 'Ben', 'Dee', 'Ermine', 'Falcon', 'Gravel', 'Harbor']) {
    const r = rowFor(name), b = data.find(x => x._empName === name)._breakdown;
    const L = (k) => String.fromCharCode(64 + C[k]);
    assert.match(r[C.total].value.formula, new RegExp('^ROUND\\(' + L('hours') + '\\d+\\*' + L('rate') + '\\d+,2\\)$'), name + ' Actual Total = hours x rate');
    assert.match(r[C.hours].value.formula, /^ROUND\(SUM\('Hours'!/, name + ' Hours come from the Hours sheet');
    assert.equal(xlNum(r[C.total]), b.actualFinal);
    assert.equal(xlNum(r[C.deposit]), b.deposit, name + ' deposit');
    assert.equal(xlNum(r[C.cash]), b.cash, name + ' cash');
    assert.equal(xlNum(r[C.final]), b.roundedFinal, name + ' rounded final');
    assert.equal(typeof r[C.rate].value, 'number', name + ' rate is a number so the formula can use it');
  }
  // Flat amount is an input value; its split still flows from it.
  const cy = rowFor('Cy (flat)');
  assert.equal(cy[C.total].value, 300);
  assert.ok(isFx(cy[C.cash]), 'flat row cash is still a formula');
  // Zero amounts are numbers shown as a dash, never the text "—".
  const dee = rowFor('Dee');
  assert.equal(xlNum(dee[C.cash]), 0);
  assert.match(dee[C.cash].numFmt, /"—"$/);
});

test('test_subtotals_sum_rows_and_grand_sums_subtotals', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const subs = ws.rows.map((r, i) => [r, i]).filter(([r]) => r && r[1] && / subtotal$/.test(r[1].value));
  assert.equal(subs.length, 2);
  // Columns by name: Actual Total, Deposit, Hours, Rounded Final are summed (FC-00059/65).
  const C = api.COMBINED_COLS, col = (k) => C[k] + 1, L = (k) => String.fromCharCode(65 + C[k]);
  subs.forEach(([r]) => assert.equal(r[col('total')].value.formula.replace(/\d+/g, 'n'), 'SUM(' + L('total') + 'n:' + L('total') + 'n)'));
  subs.forEach(([r]) => assert.equal(r[col('hours')].value.formula.replace(/\d+/g, 'n'), 'SUM(' + L('hours') + 'n:' + L('hours') + 'n)', 'hours subtotal'));
  const grand = ws.rows.find(r => r && r[1] && r[1].value === 'GRAND TOTAL');
  assert.equal(grand[col('total')].value.formula, 'SUM(' + subs.map(([, i]) => L('total') + i).join(',') + ')');
  assert.equal(grand[col('deposit')].value.formula, 'SUM(' + subs.map(([, i]) => L('deposit') + i).join(',') + ')');
  assert.equal(grand[col('final')].value.formula, 'SUM(' + subs.map(([, i]) => L('final') + i).join(',') + ')', 'rounded final grand total');
});

test('test_editing_an_input_moves_the_totals', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook;
  _wb = wb;
  const ws = wb.worksheets[0];
  const hs = wb.worksheets.find(w => w.name === 'Hours');
  const grand = ws.rows.find(r => r && r[1] && r[1].value === 'GRAND TOTAL');
  const C = api.COMBINED_COLS, col = (k) => C[k] + 1;
  const before = evaluate(ws, grand[col('total')].value.formula);
  // FC-00060: change Ann's clock-out on the Hours sheet by one hour: hours, pay and totals follow.
  const hdr = hs.rows.find(r => r && r[1] && r[1].value === 'Entity');
  const outCol = hdr.findIndex(c => c && c.value === 'Out 1');
  const annDay = hs.rows.find(r => r && r[2] && r[2].value === 'Ann');
  annDay[outCol].value += 1 / 24; // one more hour at $15.37
  assert.equal(Math.round((evaluate(ws, grand[col('total')].value.formula) - before) * 100) / 100, 15.37);
  const ann = ws.rows.find(r => r && r[2] && r[2].value === 'Ann');
  assert.equal(evaluate(ws, ann[col('cash')].value.formula), Math.round(evaluate(ws, ann[col('total')].value.formula)), 'cash re-rounds');
});

test('test_every_report_kind_formulas_agree_and_payroll_calc_totals_not_under_diff', async () => {
  const api = setup();
  for (const kind of ['cashOnly', 'depositOnly', 'timecard', 'payrollCalc', 'full']) {
    await api._exportExcel(kind);
    assertAllFormulasAgree(api.__lastExcelWorkbook.worksheets[0], kind, api.__lastExcelWorkbook);
  }
  await api._exportExcel('payrollCalc');
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const sub = ws.rows.find(r => r && r[1] && r[1].value === 'Alpha Test subtotal');
  assert.equal(sub[12].value, '', 'Diff column holds no subtotal');
  assert.match(sub[10].value.formula, /^SUM\(J\d+:J\d+\)$/, 'Actual Total subtotal sits under Actual Total');
});

test('test_full_excel_merges_title_once', async () => {
  const api = setup();
  await api._exportExcel('full'); // the mock throws on a second merge of the same range
  const ws = api.__lastExcelWorkbook.worksheets[0];
  assert.equal(ws.merges.filter(m => m[0] === 1).length, 1);
});

test('test_manager_report_totals_are_sums', async () => {
  const api = setup();
  api.entities[0].newDateLabels = WEEK.slice();
  await api.exportManager();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  assertAllFormulasAgree(ws, 'manager');
  const total = ws.rows.find(r => r && r[1] && r[1].value === 'TOTAL');
  assert.match(total[9].value.formula, /^SUM\(B\d+:H\d+\)$/);
  assert.equal(api.__lastExcelWorkbook.calcProperties.fullCalcOnLoad, true);
});
