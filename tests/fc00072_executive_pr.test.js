// FC-00072: Executive PR — a fixed weekly amount the accountant pays by deposit, always Flat.
// FC-00078 retired it as a pay method; FC-00080 prints an old row of it under MANAGEMENT.
// Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { xlNum, xlFormulaMismatches, pdfBody, pdfRowText } = require('./xl-helpers');
const { setup, rowOf } = require('./fc70-helpers');

test('test_exec_method_label_sort_and_parse', () => {
  const api = setup();
  assert.equal(api.methodLabel('exec'), 'Executive PR');
  assert.equal(api._normalizePayMethod('Executive PR'), 'exec');
  assert.equal(api._normalizePayMethod('executive'), 'exec');
  assert.ok(api.PAYTYPE_SORT_ORDER.exec > api.PAYTYPE_SORT_ORDER.contract, 'sorts after everyone');
});

test('test_exec_person_is_flat_weekly_deposit', () => {
  const api = setup({ exec: true });
  const g = rowOf(api, 'Gale Gtest');
  assert.ok(g, 'on payroll with no punches');
  assert.equal(g.isFlat, true); assert.equal(g._exec, true);
  assert.equal(g._breakdown.method, 'exec');
  assert.equal(g._breakdown.deposit, 900); assert.equal(g._breakdown.cash, 0);
  assert.equal(g.otPaidH || 0, 0);
});

// FC-00080: Executive PR is retired (FC-00078). A row still paid that way (an old snapshot) prints
// under its entity's MANAGEMENT group, and the entity total and the GRAND TOTAL include it.
test('test_report_exec_block_and_totals', async () => {
  const api = setup({ exec: true });
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
  const at = (label, from) => ws.rows.findIndex((r, i) => i > (from || 0) && r && r[1] && r[1].value === label);
  const band = at('ALPHA TEST'), emp = at('EMPLOYEES', band), esub = at('Employees subtotal', band);
  const mg = at('MANAGEMENT', band), gale = at('Gale Gtest'), msub = at('Management subtotal', band), tot = at('ALPHA TEST TOTAL');
  assert.ok(band > 0 && emp === band + 1 && esub < mg && gale === mg + 1 && msub === gale + 1 && tot === msub + 1, 'Management after Employees, then the entity total');
  assert.equal(ws.rows[gale][C.method + 1].value, 'Executive PR');
  assert.equal(ws.rows[gale][C.rate + 1].value, 'flat');
  assert.equal(xlNum(ws.rows[gale][C.total + 1]), 900);
  assert.equal(xlNum(ws.rows[gale][C.deposit + 1]), 900);
  assert.equal(xlNum(ws.rows[esub][C.total + 1]), 525 + 510 + 510 + 150 + 532);
  assert.equal(xlNum(ws.rows[msub][C.total + 1]), 900);
  const L = String.fromCharCode(65 + C.total);
  assert.equal(ws.rows[tot][C.total + 1].value.formula, 'SUM(' + L + esub + ',' + L + msub + ')');
  assert.equal(xlNum(ws.rows[tot][C.total + 1]), 2227 + 900);
  const grand = at('GRAND TOTAL — ALL ENTITIES');
  assert.equal(xlNum(ws.rows[grand][C.total + 1]), 2547 + 900);
  assert.equal(xlNum(ws.rows[grand][C.deposit + 1]), 525 + 300 + 532 + 320 + 900, 'every deposit the accountant pays');
  assert.ok(!ws.rows.some(r => r && r[1] && /EXECUTIVE PR/.test(String(r[1].value))), 'no Executive PR totals any more');
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
  // Hourly-labor sheets leave Executive PR out.
  ['Stats', 'Labor Cost'].forEach(n => {
    const s = wb.worksheets.find(w => w.name === n);
    assert.ok(s, n);
    assert.ok(!s.rows.some(r => r && r.some(c => c && typeof c.value === 'string' && /Gale/.test(c.value))), n + ' has no Executive PR');
  });
});

test('test_pdf_and_preview_exec_block', async () => {
  const api = setup({ exec: true });
  await api.exportCombinedPdf();
  const txt = pdfBody(api).map(pdfRowText);
  const mg = txt.findIndex(r => r[0] === 'MANAGEMENT');
  assert.ok(mg > 0 && txt[mg + 1][0] === 'Gale Gtest' && txt[mg + 2][0] === 'Management subtotal' && txt[mg + 3][0] === 'ALPHA TEST TOTAL');
  const m = api._fc13PreviewModel();
  const k = m.rows.findIndex(r => r.kind === 'group' && r.cells[0] === 'MANAGEMENT');
  assert.equal(m.rows[k + 1].cells[0], 'Gale Gtest');
  assert.match(api.renderPayrollExportPreviewHtml(), /fc13-group-row[^>]*><td[^>]*>MANAGEMENT</);
});

test('test_exec_only_entity', async () => {
  const api = setup();
  api.ensureIntakeState(api.entities[1]);
  api.addNewEmployee(1, 'Hale Htest', null, { method: 'exec', flat: 500 });
  api.setRosterActive(1, 'Fern Ftest', false);
  await api.exportCombinedExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const band = ws.rows.findIndex(r => r && r[1] && r[1].value === 'BETA TEST');
  assert.equal(ws.rows[band + 1][1].value, 'MANAGEMENT', 'an entity with nobody under Employees prints only Management');
  assert.ok(ws.rows.some(r => r && r[1] && r[1].value === 'BETA TEST TOTAL'));
});

test('test_payroll_tab_exec_makes_flat', () => {
  const api = setup();
  api.setTab('payroll'); api.renderPayroll();
  const rows = api._flatRowsForTest();
  const i = rows.findIndex(x => (x.row.schedName || x.row.name) === 'Eden Etest');
  assert.ok(i >= 0);
  api.setPayMethodForRow(i, 'exec');
  const k = api.wKey(0, 'Eden Etest');
  assert.equal(api.payMethod[k], 'exec');
  assert.ok(api.flatWages[k] != null, 'Executive PR is Flat');
  // FC-00078: Executive PR is retired as a choice on the Payroll tab (still read from older files).
  const html = api.__sandbox.document.getElementById('payrollCalcTable').innerHTML;
  assert.doesNotMatch(html, />Executive PR<\/button>/);
});

test('test_settings_file_exec_always_flat', () => {
  const api = setup();
  const head = ['Entity', 'Employee', 'Wage/hour', 'Type', 'Flat Amount', 'Pay Method', 'Employee ID'];
  const cm = {}; head.forEach((h, i) => { cm[h.toLowerCase()] = i; });
  api._ingestPayrollSettings([['Alpha Test', 'Ivy Itest', '', 'Hourly', '', 'Executive PR', ''], ['Alpha Test', 'Jay Jtest', '', 'Flat', '$1,000.00', 'Executive PR', '']], cm, false);
  assert.equal(api.flatWages[api.wKey(0, 'Ivy Itest')], 0, 'typed Hourly still loads as Flat');
  assert.equal(api.flatWages[api.wKey(0, 'Jay Jtest')], 1000);
  // FC-00078: Executive PR is retired: the same flat amount, paid by Deposit, ticked Management.
  assert.equal(api.payMethod[api.wKey(0, 'Jay Jtest')], 'deposit');
  assert.equal(api.isManagement(0, 'Jay Jtest'), true);
});

test('test_leaving_exec_goes_back_to_hourly', () => {
  // Review fix: Executive PR clicked by mistake, then Deposit again: hourly pay comes back.
  const api = setup();
  api.setTab('payroll'); api.renderPayroll();
  const idx = () => api._flatRowsForTest().findIndex(x => (x.row.schedName || x.row.name) === 'Avery Atest');
  api.setPayMethodForRow(idx(), 'exec');
  api.renderPayroll();
  api.setPayMethodForRow(idx(), 'deposit');
  const k = api.wKey(0, 'Avery Atest');
  assert.equal(api.flatWages[k], undefined, 'Hourly again');
  assert.equal(rowOf(api, 'Avery Atest')._breakdown.actualFinal, 525);
});

test('test_editable_copy_total_with_exec_sums', async () => {
  const api = setup({ exec: true });
  api._fc24MakeCopy();
  await api._fc24ExportScratchExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  const all = ws.rows.find(r => r && r[1] && r[1].value === 'GRAND TOTAL — ALL ENTITIES'); // FC-00080
  const fx = all.filter(c => c && c.value && c.value.formula).map(c => c.value.formula);
  assert.ok(fx.length && fx.every(f => /^SUM\(/.test(f)), 'SUM skips a blank cell (no #VALUE!)');
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
});
