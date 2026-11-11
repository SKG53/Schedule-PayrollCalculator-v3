// FC-00070: a Deposit person's hours over 40 in the week are paid at 1.5×. Hours stay the total
// worked; the Over time column shows the part over 40. Cash, Deposit + Cash and Contract Check stay
// straight time. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { xlNum, xlFormulaMismatches } = require('./xl-helpers');
const { setup, rowOf } = require('./fc70-helpers');

test('test_deposit_over_40_paid_time_and_half', () => {
  const api = setup();
  const r = rowOf(api, 'Avery Atest');
  assert.equal(r.actualHours, 42.5, 'hours stay the total worked');
  assert.equal(r.otPaidH, 2.5);
  assert.equal(r._breakdown.actualFinal, 525, '40 × $12 + 2.5 × $18');
  assert.equal(r._breakdown.deposit, 525, 'the deposit goes up with it');
  assert.equal(r._breakdown.cash, 0);
});

test('test_other_methods_straight_time', () => {
  const api = setup();
  const bram = rowOf(api, 'Bram Btest'), cora = rowOf(api, 'Cora Ctest');
  assert.equal(bram.otPaidH, 0); assert.equal(bram._breakdown.cash, 510, 'Cash: totals do not change');
  assert.equal(cora.otPaidH, 0); assert.equal(cora._breakdown.actualFinal, 510, 'Deposit + Cash: no overtime');
  assert.equal(cora._breakdown.deposit, 300); assert.equal(cora._breakdown.cash, 210);
  api.payMethod[api.wKey(0, 'Avery Atest')] = 'contract';
  const a = rowOf(api, 'Avery Atest');
  assert.equal(a.otPaidH, 0, 'Contract Check: no overtime');
  assert.equal(a._breakdown.actualFinal, 510);
});

test('test_at_or_under_40_unchanged', () => {
  const api = setup();
  const eden = rowOf(api, 'Eden Etest');
  assert.equal(eden.otPaidH, 0);
  assert.equal(eden._breakdown.actualFinal, 532);
  // Exactly 40 h: no overtime.
  api.entities[0].actualDays = api.entities[0].actualDays.filter(d => !(d.empName === 'Avery Atest' && d.dayIdx === 3));
  const a = rowOf(api, 'Avery Atest');
  assert.equal(a.actualHours, 34); assert.equal(a.otPaidH, 0); assert.equal(a._breakdown.actualFinal, 408);
  // A flat Deposit person is never paid overtime.
  api.flatWages[api.wKey(0, 'Avery Atest')] = 700;
  assert.equal(rowOf(api, 'Avery Atest').otPaidH, 0);
});

test('test_excel_over_time_column_and_formulas', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  const C = api.COMBINED_COLS;
  assert.equal(api.COMBINED_HEADERS[C.ot], 'Over time');
  assert.equal(C.ot, C.hours + 1, 'Over time sits after Hours');
  const L = (k) => String.fromCharCode(65 + C[k]);
  const avery = ws.rows.find(r => r && r[2] && r[2].value === 'Avery Atest');
  const n = ws.rows.indexOf(avery);
  assert.equal(avery[C.ot + 1].value.formula, 'MAX(0,ROUND(' + L('hours') + n + '-40,2))');
  assert.equal(xlNum(avery[C.ot + 1]), 2.5);
  assert.equal(avery[C.total + 1].value.formula, 'ROUND((' + L('hours') + n + '+0.5*' + L('ot') + n + ')*' + L('rate') + n + ',2)');
  assert.equal(xlNum(avery[C.total + 1]), 525);
  const bram = ws.rows.find(r => r && r[2] && r[2].value === 'Bram Btest');
  assert.equal(bram[C.ot + 1].value, '', 'no Over time for Cash');
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, [], 'every formula agrees with the tool');
  const sub = ws.rows.find(r => r && r[1] && r[1].value === 'Alpha Test subtotal');
  assert.equal(xlNum(sub[C.ot + 1]), 2.5, 'Over time is totalled');
});

test('test_overtime_formula_follows_an_edited_hour', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  const { xlEval } = require('./xl-helpers');
  const C = api.COMBINED_COLS;
  const eden = ws.rows.find(r => r && r[2] && r[2].value === 'Eden Etest');
  // Eden (Deposit, 38 h): typing 44 hours in the report moves 4 hours into Over time.
  eden[C.hours + 1].value = 44;
  assert.equal(xlEval(wb, ws, eden[C.ot + 1].value.formula), 4);
  assert.equal(xlEval(wb, ws, eden[C.total + 1].value.formula), Math.round(14 * (44 + 2) * 100) / 100);
});

test('test_flags_and_payroll_tab_say_overtime_paid', () => {
  const api = setup();
  const flags = api.collectAllFlags(api.entities.map((e, i) => Object.assign({ entityName: e.name }, api.computePayrollForEntity(i))));
  const av = flags.find(f => f.emp === 'Avery Atest' && /^40h\+/.test(f.category));
  assert.equal(av.category, '40h+ (Deposit — overtime paid at 1.5×)');
  const br = flags.find(f => f.emp === 'Bram Btest' && /^40h\+/.test(f.category));
  assert.equal(br.category, '40h+ (straight-time — no OT paid)');
  api.setTab('payroll'); api.renderPayroll();
  const html = api.__sandbox.document.getElementById('payrollCalcTable').innerHTML;
  assert.match(html, /class="ot-paid-note"[^>]*>.{0,120}2\.50.{0,40} over 40 at 1\.5×<\/div>/);
  assert.doesNotMatch(html, /&lt;span/, 'the hours print as hours, not as escaped markup');
});

test('test_outside_week_day_never_counts_toward_40', async () => {
  // Review fix: Eden (Deposit, 38 h at $14) is also paid a 4 h day from the week before (FC-00066).
  const api = setup();
  api.entities[0].actualDays.push({ empName: 'Eden Etest', entityName: 'Alpha Test', date: '2026-08-08', dayIdx: 6, payOutside: true, pairs: [{ in: 8, out: 12, outAdj: 12, minutes: 240 }] });
  const r = rowOf(api, 'Eden Etest');
  assert.equal(r.actualHours, 42);
  assert.equal(r.otPaidH, 0, 'only 38 h in the week');
  assert.equal(r._breakdown.actualFinal, 588, 'straight time');
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
  const row = ws.rows.find(x => x && x[2] && x[2].value === 'Eden Etest');
  assert.match(row[C.ot + 1].value.formula, /-4-40,2\)\)$/);
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
});

test('test_layouts_without_over_time_keep_the_pay', async () => {
  const api = setup();
  for (const kind of ['payrollCalc', 'depositOnly']) {
    await api._exportExcel(kind);
    const wb = api.__lastExcelWorkbook;
    assert.deepEqual(xlFormulaMismatches(wb, wb.worksheets[0]).bad, [], kind);
  }
});
