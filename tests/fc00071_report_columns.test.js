// FC-00071: Contract Check has its own column on the payroll report; Rounded Final and Diff are
// optional columns, off by default, kept in the settings file. FC-00077: every column is chosen on
// the export preview; Contract Check shows whenever it is ticked. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { xlNum, xlFormulaMismatches, pdfBody } = require('./xl-helpers');
const { setup } = require('./fc70-helpers');

const hdrOf = (ws) => ws.rows.find(r => r && r[1] && r[1].value === 'Employee').slice(1).map(c => c.value);
// FC-00080: Employee is the first column.
const rowOf = (ws, name) => ws.rows.find(r => r && r[1] && r[1].value === name);

test('test_default_columns', async () => {
  const api = setup();
  assert.equal(api.reportShowsFinalDiff(), false, 'off by default');
  await api.exportCombinedExcel();
  assert.deepEqual(hdrOf(api.__lastExcelWorkbook.worksheets[0]), ['Employee', 'Type', 'Method', 'Hours', 'Over time', 'Rate', 'Bonus', 'Total', 'Deposit', 'Check', 'Cash']); // FC-00080
});

test('test_contract_check_own_column_and_total', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
  const dane = rowOf(ws, 'Dane Dtest');
  assert.equal(xlNum(dane[C.contract + 1]), 150);
  assert.equal(xlNum(dane[C.deposit + 1]), 0, 'not in Deposit');
  const fern = rowOf(ws, 'Fern Ftest');
  assert.equal(xlNum(fern[C.contract + 1]), 0);
  assert.equal(xlNum(fern[C.deposit + 1]), 320);
  const sub = rowOf(ws, 'ALPHA TEST TOTAL');
  assert.equal(xlNum(sub[C.contract + 1]), 150, 'Contract Check subtotal');
  assert.equal(xlNum(sub[C.deposit + 1]), 525 + 300 + 532, 'Deposit subtotal leaves Contract Check out');
  const grand = rowOf(ws, 'GRAND TOTAL — ALL ENTITIES');
  assert.equal(xlNum(grand[C.contract + 1]), 150);
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
  // The preview and the PDF use the same columns.
  const m = api._fc13PreviewModel();
  assert.deepEqual(m.headers, api.COMBINED_HEADERS);
  assert.equal(m.rows.find(r => r.kind === 'data' && r.cells[0] === 'Dane Dtest').cells[C.contract], '$150.00');
  await api.exportCombinedPdf();
  const call = api.__lastAutoTableCalls[api.__lastAutoTableCalls.length - 1];
  assert.deepEqual(call.options.head[0], api.COMBINED_HEADERS);
  assert.equal(pdfBody(api).find(r => r[0].content === 'Dane Dtest')[C.contract].content, '$150.00');
});

test('test_contract_column_follows_its_tick', async () => {
  // FC-00077: ticked, the column shows even when nobody on the report is paid that way.
  const api = setup();
  await api._withExportScope([1], () => api.exportCombinedExcel());
  assert.ok(hdrOf(api.__lastExcelWorkbook.worksheets[0]).includes('Check'), 'Beta Test still has the column');
  // Unticked, a contract check is counted under Deposit, the same in the Excel, the preview and the PDF.
  assert.equal(api.setReportColumnOn('contract', false), true);
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
  assert.ok(!hdrOf(ws).includes('Check'));
  const dane = rowOf(ws, 'Dane Dtest');
  assert.equal(xlNum(dane[C.deposit + 1]), 150);
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
  const m = api._fc13PreviewModel();
  assert.equal(m.rows.find(r => r.kind === 'data' && r.cells[0] === 'Dane Dtest').cells[api.COMBINED_COLS.deposit], '$150.00');
});

test('test_final_and_diff_optional_and_saved', async () => {
  const api = setup();
  assert.equal(api.setReportFinalDiff(true), true);
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  assert.deepEqual(hdrOf(ws).slice(-3), ['Cash', 'Rounded Final', 'Diff']);
  const C = api.COMBINED_COLS, L = (k) => String.fromCharCode(65 + C[k]);
  const dane = rowOf(ws, 'Dane Dtest');
  const n = ws.rows.indexOf(dane);
  assert.equal(dane[C.final + 1].value.formula, 'ROUND(' + L('deposit') + n + '+' + L('cash') + n + '+' + L('contract') + n + ',2)', 'Rounded Final adds Contract Check');
  assert.equal(xlNum(dane[C.final + 1]), 150);
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
  // Saved in the settings file's Tool Settings (FC-00077: as the report's column list) and read back.
  await api.exportToolSettingsExcel(); // FC-00083
  const ts = api.__lastExcelWorkbook.worksheets.find(w => w.name === 'Tool Settings');
  assert.ok(ts.rows.some(r => r && r[1] && r[1].value === 'Payroll report · Columns' && /^Employee, .*Cash, Entity \(off\), Rounded Final, Diff, Mode \(off\), /.test(r[2].value)));
  // A settings file from before the picker still ticks or unticks the two columns.
  const b = setup();
  assert.equal(b._ingestToolSettings([['Payroll report · Rounded Final and Diff columns', 'Include']]), 1);
  assert.equal(b.reportShowsFinalDiff(), true);
  b._ingestToolSettings([['Payroll report · Rounded Final and Diff columns', 'no']]);
  assert.equal(b.reportShowsFinalDiff(), false, 'anything but include/yes leaves them out');
  // Logged and undoable from History.
  const line = api.session.log.filter(e => e.type === 'toolSetting' && e.target.field === 'reportColumns').at(-1);
  api.revertFromHistory(line.id);
  assert.equal(api.reportShowsFinalDiff(), false);
});

test('test_exports_card_points_to_the_preview', () => {
  // FC-00077: the columns are chosen on the export preview; the card says how many are on.
  const api = setup();
  api.renderDownloadsPanel();
  const html = api.__sandbox.document.getElementById('downloadsHost').innerHTML;
  assert.match(html, /class="dl-desc report-cols-note">Columns: 11 of 23, chosen and ordered on the Export preview</);
  assert.doesNotMatch(html, /final-diff-toggle/);
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
  const avery = rowOf(ws, 'Avery Atest');
  assert.equal(avery[otIdx].value, 2.5); assert.equal(avery[otIdx].numFmt, '0.00', 'Over time is written as hours');
});
