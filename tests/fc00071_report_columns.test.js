// FC-00071: Contract Check has its own column on the payroll report (only when someone on the
// report is paid that way); Rounded Final and Diff are optional columns, off by default, chosen on
// the Exports card and kept in the settings file. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { xlNum, xlFormulaMismatches } = require('./xl-helpers');
const { setup } = require('./fc70-helpers');

const hdrOf = (ws) => ws.rows.find(r => r && r[1] && r[1].value === 'Entity').slice(1).map(c => c.value);

test('test_default_columns', async () => {
  const api = setup();
  assert.equal(api.reportShowsFinalDiff(), false, 'off by default');
  await api.exportCombinedExcel();
  assert.deepEqual(hdrOf(api.__lastExcelWorkbook.worksheets[0]), ['Entity', 'Employee', 'Method', 'Hours', 'Over time', 'Rate', 'Actual Total', 'Deposit', 'Contract Check', 'Cash']);
});

test('test_contract_check_own_column_and_total', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
  const dane = ws.rows.find(r => r && r[2] && r[2].value === 'Dane Dtest');
  assert.equal(xlNum(dane[C.contract + 1]), 150);
  assert.equal(xlNum(dane[C.deposit + 1]), 0, 'not in Deposit');
  const fern = ws.rows.find(r => r && r[2] && r[2].value === 'Fern Ftest');
  assert.equal(xlNum(fern[C.contract + 1]), 0);
  assert.equal(xlNum(fern[C.deposit + 1]), 320);
  const sub = ws.rows.find(r => r && r[1] && r[1].value === 'Alpha Test subtotal');
  assert.equal(xlNum(sub[C.contract + 1]), 150, 'Contract Check subtotal');
  assert.equal(xlNum(sub[C.deposit + 1]), 525 + 300 + 532, 'Deposit subtotal leaves Contract Check out');
  const grand = ws.rows.find(r => r && r[1] && r[1].value === 'GRAND TOTAL');
  assert.equal(xlNum(grand[C.contract + 1]), 150);
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
  // The preview and the PDF use the same columns.
  const m = api._fc13PreviewModel();
  assert.deepEqual(m.headers, api.COMBINED_HEADERS);
  assert.equal(m.rows.find(r => r.kind === 'data' && r.cells[1] === 'Dane Dtest').cells[C.contract], '$150.00');
  await api.exportCombinedPdf();
  const call = api.__lastAutoTableCalls[api.__lastAutoTableCalls.length - 1];
  assert.deepEqual(call.options.head[0], api.COMBINED_HEADERS);
  assert.equal(call.options.body.find(r => r[1] === 'Dane Dtest')[C.contract], '$150.00');
});

test('test_contract_column_only_when_needed', async () => {
  const api = setup();
  api.payMethod[api.wKey(0, 'Dane Dtest')] = 'cash';
  await api.exportCombinedExcel();
  assert.ok(!hdrOf(api.__lastExcelWorkbook.worksheets[0]).includes('Contract Check'));
  // A per-entity report shows it only if that entity has someone paid that way.
  api.payMethod[api.wKey(0, 'Dane Dtest')] = 'contract';
  await api._withExportScope([1], () => api.exportCombinedExcel());
  assert.ok(!hdrOf(api.__lastExcelWorkbook.worksheets[0]).includes('Contract Check'), 'Beta Test has no Contract Check');
});

test('test_final_and_diff_optional_and_saved', async () => {
  const api = setup();
  assert.equal(api.setReportFinalDiff(true), true);
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  assert.deepEqual(hdrOf(ws).slice(-3), ['Cash', 'Rounded Final', 'Diff']);
  const C = api.COMBINED_COLS, L = (k) => String.fromCharCode(65 + C[k]);
  const dane = ws.rows.find(r => r && r[2] && r[2].value === 'Dane Dtest');
  const n = ws.rows.indexOf(dane);
  assert.equal(dane[C.final + 1].value.formula, 'ROUND(' + L('deposit') + n + '+' + L('cash') + n + '+' + L('contract') + n + ',2)', 'Rounded Final adds Contract Check');
  assert.equal(xlNum(dane[C.final + 1]), 150);
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
  // Saved in the settings file's Tool Settings and read back.
  await api.exportPayrollSettingsExcel(false);
  const ts = api.__lastExcelWorkbook.worksheets.find(w => w.name === 'Tool Settings');
  assert.ok(ts.rows.some(r => r && r[1] && r[1].value === 'Payroll report · Rounded Final and Diff columns' && r[2].value === 'Include'));
  const b = setup();
  assert.equal(b._ingestToolSettings([['Payroll report · Rounded Final and Diff columns', 'Include']]), 1);
  assert.equal(b.reportShowsFinalDiff(), true);
  b._ingestToolSettings([['Payroll report · Rounded Final and Diff columns', 'no']]);
  assert.equal(b.getToolSetting('reportFinalDiff'), 'Leave out', 'anything but include/yes is Leave out');
  // Logged and undoable from History.
  const line = api.session.log.filter(e => e.type === 'toolSetting' && e.target.field === 'reportFinalDiff').at(-1);
  api.revertFromHistory(line.id);
  assert.equal(api.reportShowsFinalDiff(), false);
});

test('test_exports_card_has_the_choice', () => {
  const api = setup();
  api.renderDownloadsPanel();
  const html = api.__sandbox.document.getElementById('downloadsHost').innerHTML;
  assert.match(html, /class="final-diff-toggle" +onchange="setReportFinalDiff\(this\.checked\)"> Include Rounded Final and Diff columns/);
});

test('test_editable_copy_keeps_its_own_columns', async () => {
  const api = setup();
  api.setReportFinalDiff(true);
  api._fc24MakeCopy();
  api.setReportFinalDiff(false);
  await api._fc24ExportScratchExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const hdr = hdrOf(ws);
  assert.deepEqual(hdr.slice(-2), ['Rounded Final', 'Diff'], 'the copy keeps the columns it was made with');
  const dIdx = hdr.indexOf('Diff') + 1;
  assert.equal(ws.colWidths[dIdx], 10);
  const otIdx = hdr.indexOf('Over time') + 1;
  const avery = ws.rows.find(r => r && r[2] && r[2].value === 'Avery Atest');
  assert.equal(avery[otIdx].value, 2.5); assert.equal(avery[otIdx].numFmt, '0.00', 'Over time is written as hours');
});
