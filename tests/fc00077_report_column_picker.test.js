// FC-00077: the payroll report's columns are chosen on the export preview: one chip per column,
// tick to include, drag to move. The preview, the PDF and the Excel follow the choice; the Excel
// keeps any column a shown formula reads as a hidden column. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app');
const { xlNum, xlFormulaMismatches, pdfBody } = require('./xl-helpers');
const { setup, rowOf } = require('./fc70-helpers');

const hdrOf = (ws) => ws.rows.find(r => r && r.some(c => c && c.value === 'Employee')).slice(1).map(c => c.value);
const lastPdf = (api) => api.__lastAutoTableCalls[api.__lastAutoTableCalls.length - 1].options;
// FC-00080: Employee is the first column; the PDF is one table per entity page.
const xlRow = (ws, name) => ws.rows.find(r => r && r[1] && r[1].value === name);
const headOf = (opts) => opts.head[0].map(c => (c && typeof c === 'object' ? c.content : c));
const keysOn = (api) => api.reportColumns().filter(c => c.on).map(c => c.key);

test('test_default_pool_order_and_employee_locked', () => {
  const api = setup();
  const list = api.reportColumns();
  assert.deepEqual(list.map(c => c.key), api.REPORT_COL_KEYS, 'every column in the pool, standard order');
  assert.equal(list.length, 24); // FC-00079 adds Bonus; FC-00085 Deposit Entity
  assert.deepEqual(keysOn(api), ['employee', 'acctType', 'method', 'hours', 'ot', 'rate', 'bonus', 'total', 'deposit', 'contract', 'cash', 'depEnt'], 'FC-00080: the standard columns; the extras start unticked (FC-00085: Deposit Entity is on, shown only when used)');
  assert.equal(api.setReportColumnOn('employee', false), false, 'Employee is always on');
  assert.ok(keysOn(api).includes('employee'));
  assert.equal(api._reportColsParse('Cash, Bogus, Employee (off), Hours (OFF)').filter(c => c.on).map(c => c.key).join(','), 'cash,employee,depEnt', 'unknown words ignored; Employee forced on; FC-00085: Deposit Entity starts on (shown only when used)');
  assert.equal(api._reportColsFormat(api.reportColumns()), api.getToolSetting('reportColumns'));
  const parsed = api._reportColsParse('Cash, Hours');
  assert.deepEqual(parsed.slice(0, 2), [{ key: 'cash', on: true }, { key: 'hours', on: true }]);
  assert.ok(parsed.slice(2).every(c => !c.on || c.key === 'employee' || c.key === 'depEnt'), 'columns missing from the words start left out (FC-00085: except Deposit Entity, which shows only when used)');
  assert.equal(parsed.length, 24);
  // FC-00080: a list saved before the redesign takes the new standard columns; the optional
  // columns keep their tick.
  const old = api._reportColsParse('Entity, Employee, Method, Hours, Over time, Rate, Bonus (off), Actual Total, Deposit, Contract Check, Cash, Rounded Final, Diff, Mode (off), H:MM (off), Break (off), Scheduled Hours (off), Hours vs Schedule (off), Avg In vs Schedule (off), Avg Out vs Schedule (off), Accountant Name, Employment Type (off), Pay Date (off)');
  assert.deepEqual(old.filter(c => c.on).map(c => c.key), ['employee', 'acctType', 'method', 'hours', 'ot', 'rate', 'bonus', 'total', 'deposit', 'contract', 'cash', 'final', 'diff', 'acctName', 'depEnt']);
  assert.deepEqual(old.map(c => c.key), api.REPORT_COL_KEYS);
  // Old names still read.
  assert.equal(api._reportColKeyOf('Actual Total'), 'total');
  assert.equal(api._reportColKeyOf('Contract Check'), 'contract');
  assert.equal(api._reportColKeyOf('Employment Type'), 'acctType');
});

test('test_untick_and_move_follow_in_preview_pdf_and_excel', async () => {
  const api = setup();
  assert.equal(api.setReportColumnOn('bonus', false), true);
  assert.equal(api.moveReportColumn('cash', 'hours', 'before'), true);
  const want = ['Employee', 'Type', 'Method', 'Cash', 'Hours', 'Over time', 'Rate', 'Total', 'Deposit', 'Check'];
  assert.deepEqual(api._fc13PreviewModel().headers, want);
  await api.exportCombinedPdf();
  assert.deepEqual(headOf(lastPdf(api)), want);
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  assert.deepEqual(hdrOf(ws), want);
  assert.deepEqual(ws.hiddenCols.filter(Boolean), [], 'nothing hidden: every formula input is shown');
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, [], 'every formula still agrees');
  const bram = xlRow(ws, 'Bram Btest');
  assert.equal(xlNum(bram[api.COMBINED_COLS.cash + 1]), 510);
  // The cash tint follows the Cash column wherever it is.
  const m = api._fc13PreviewModel();
  const d = m.rows.find(r => r.kind === 'data');
  assert.notEqual(d.bgs[3], d.bgs[4], 'Cash is tinted, Hours is not');
  assert.equal(d.bgs[3], '#' + api.REPORT_COLORS.cashData.slice(2));
});

test('test_excel_keeps_formula_inputs_as_hidden_columns', async () => {
  const api = setup();
  ['hours', 'ot', 'rate', 'total'].forEach(k => api.setReportColumnOn(k, false));
  const shown = ['Employee', 'Type', 'Method', 'Bonus', 'Deposit', 'Check', 'Cash'];
  assert.deepEqual(api._fc13PreviewModel().headers, shown, 'the preview shows only the ticked columns');
  await api.exportCombinedPdf();
  assert.deepEqual(headOf(lastPdf(api)), shown);
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  const hdr = hdrOf(ws);
  assert.deepEqual(hdr, ['Employee', 'Type', 'Method', 'Hours', 'Over time', 'Rate', 'Bonus', 'Total', 'Deposit', 'Check', 'Cash']);
  const hidden = hdr.filter((h, i) => ws.hiddenCols[i + 1]);
  assert.deepEqual(hidden, ['Hours', 'Over time', 'Rate', 'Total'], 'written, hidden, so Deposit and Cash still calculate');
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
  const C = api.COMBINED_COLS, L = (k) => String.fromCharCode(65 + C[k]);
  const avery = xlRow(ws, 'Avery Atest');
  const n = ws.rows.indexOf(avery);
  assert.equal(avery[C.deposit + 1].value.formula, 'ROUND(' + L('total') + n + ',2)', 'Deposit reads the hidden Total');
  assert.equal(xlNum(avery[C.deposit + 1]), 525);
  // The chip bar says which columns stay hidden in the Excel.
  assert.match(api._reportColsBarHtml(), /In the Excel, Hours, Over time, Rate and Total stay as hidden columns so the formulas still work\./);
  // Rounded Final alone brings Deposit and Cash (and what they read) along, hidden.
  api.resetReportColumns();
  api.reportColumns().forEach(c => { if (c.on && c.key !== 'employee') api.setReportColumnOn(c.key, false); });
  api.setReportColumnOn('final', true);
  assert.deepEqual(api._reportLayoutKeys(true), { keys: ['employee', 'hours', 'ot', 'rate', 'total', 'deposit', 'cash', 'final'], hidden: ['hours', 'ot', 'rate', 'total', 'deposit', 'cash'] });
  await api.exportCombinedExcel();
  assert.deepEqual(xlFormulaMismatches(api.__lastExcelWorkbook, api.__lastExcelWorkbook.worksheets[0]).bad, []);
});

test('test_contract_left_out_counts_under_deposit_everywhere', async () => {
  const api = setup();
  api.setReportColumnOn('contract', false);
  api.setReportColumnOn('final', true);
  assert.ok(!api._reportLayoutKeys(true).keys.includes('contract'), 'never brought in hidden: it would move money out of Deposit');
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
  const dane = xlRow(ws, 'Dane Dtest');
  assert.equal(xlNum(dane[C.deposit + 1]), 150);
  assert.equal(xlNum(dane[C.final + 1]), 150);
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
});

test('test_extra_columns_values_formulas_and_totals', async () => {
  const api = setup();
  ['mode', 'hmm', 'brk', 'sched', 'vsSched', 'avgIn', 'avgOut', 'acctName', 'payDate'].forEach(k => assert.equal(api.setReportColumnOn(k, true), true, k));
  api.setAcctField(0, 'Avery Atest', 'acct_name', 'Avery Q Atest');
  api.setAcctField(0, 'Avery Atest', 'acct_type', 'w2');
  api._setPayDate('deposit', '2026-08-20', 'file');
  const m = api._fc13PreviewModel();
  const H = m.headers;
  assert.deepEqual(H.slice(11), ['Mode', 'H:MM', 'Break', 'Scheduled Hours', 'Hours vs Schedule', 'Avg In vs Schedule', 'Avg Out vs Schedule', 'Accountant Name', 'Pay Date']);
  const cell = (name, h) => m.rows.find(r => r.kind === 'data' && r.cells[0] === name).cells[H.indexOf(h)];
  const avery = rowOf(api, 'Avery Atest');
  assert.equal(cell('Avery Atest', 'Mode'), 'Hourly');
  assert.equal(cell('Avery Atest', 'H:MM'), '42:30');
  assert.equal(cell('Avery Atest', 'Break'), '0.00');
  assert.equal(cell('Avery Atest', 'Scheduled Hours'), avery.expectedH.toFixed(2));
  assert.equal(cell('Avery Atest', 'Hours vs Schedule'), (42.5 - avery.expectedH).toFixed(2));
  const mins = (v) => (v > 0 ? '+' : '') + Math.round(v) + 'm';
  assert.equal(cell('Avery Atest', 'Avg In vs Schedule'), mins(avery.avgInDiff));
  assert.equal(cell('Avery Atest', 'Avg Out vs Schedule'), mins(avery.avgOutDiff));
  assert.equal(cell('Avery Atest', 'Accountant Name'), 'Avery Q Atest');
  assert.equal(cell('Avery Atest', 'Type'), 'W2');
  assert.equal(cell('Avery Atest', 'Pay Date'), 'Thu 08/20/26', 'Deposit: the deposit date');
  assert.equal(cell('Bram Btest', 'Pay Date'), 'Fri 08/21/26', 'Cash: the Friday after the week');
  assert.equal(cell('Dane Dtest', 'Pay Date'), 'Fri 08/21/26', 'Contract Check: the Friday after the week');
  assert.equal(cell('Cora Ctest', 'Pay Date'), 'Thu 08/20/26 + Fri 08/21/26', 'Deposit + Cash: both');
  const sub = m.rows.find(r => r.kind === 'subtotal' && r.cells[0] === 'Employees subtotal');
  assert.equal(sub.cells[H.indexOf('H:MM')], '175:30', '42.5 + 42.5 + 42.5 + 10 + 38 hours worked');
  assert.equal(sub.cells[H.indexOf('Hours')], '173.00', 'FC-00080: Hours is straight time (Avery 40 + 2.50 over)');
  assert.equal(sub.cells[H.indexOf('Mode')], '', 'text columns have no total');
  // The Excel: H:MM and Hours vs Schedule are live formulas off the row's Hours.
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
  const L = (k) => String.fromCharCode(65 + C[k]);
  const xr = xlRow(ws, 'Avery Atest');
  const n = ws.rows.indexOf(xr);
  // FC-00080: hours worked = straight time + over time.
  const W = '(' + L('hours') + n + '+' + L('ot') + n + ')';
  assert.equal(xr[C.hmm + 1].value.formula, 'ROUND(' + W + '*60,0)/1440');
  assert.equal(xr[C.vsSched + 1].value.formula, 'ROUND(' + W + '-' + L('sched') + n + ',2)');
  assert.equal(xr[C.acctName + 1].value, 'Avery Q Atest');
  // The PDF prints the same columns.
  await api.exportCombinedPdf();
  assert.deepEqual(headOf(lastPdf(api)), H);
});

test('test_total_labels_move_to_the_first_text_column', async () => {
  const api = setup();
  api.moveReportColumn('hours', 'employee', 'before');
  const m = api._fc13PreviewModel();
  assert.deepEqual(m.headers.slice(0, 3), ['Hours', 'Employee', 'Type']);
  const sub = m.rows.find(r => r.kind === 'subtotal');
  assert.equal(sub.cells[1], 'Employees subtotal', 'the label sits in Employee');
  assert.equal(sub.cells[0], '173.00', 'Hours keeps its subtotal in the first column');
  assert.equal(m.rows.find(r => r.kind === 'grand').cells[1], 'GRAND TOTAL — ALL ENTITIES');
  await api.exportCombinedExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const xs = ws.rows.find(r => r && r[2] && r[2].value === 'Employees subtotal');
  const rn = ws.rows.indexOf(xs);
  assert.equal(xlNum(xs[1]), 173);
  const C = api.COMBINED_COLS;
  assert.ok(ws.merges.some(([r1, c1, r2, c2]) => r1 === rn && c1 === 2 && c2 === C.ot), 'the label spans Employee to the column before Over time');
  await api.exportCombinedPdf();
  const pdfSub = pdfBody(api).find(r => r.some(c => c && c.content === 'Employees subtotal'));
  assert.equal(pdfSub[0].content, '173.00');
  assert.equal(pdfSub[1].colSpan, C.ot - 1);
});

test('test_choice_saved_in_settings_snapshot_and_undoable', async () => {
  const api = setup();
  api.setReportColumnOn('payDate', true);
  api.moveReportColumn('payDate', 'employee', 'before');
  api.setReportColumnOn('rate', false);
  const text = api.getToolSetting('reportColumns');
  assert.match(text, /^Pay Date, Employee, Type, Method, Hours, Over time, Rate \(off\), Bonus, Total, Deposit, Check, Cash, Entity \(off\), Rounded Final \(off\), /);
  // Unticked columns keep their place: ticking Rate again puts it back after Over time.
  api.setReportColumnOn('rate', true);
  assert.deepEqual(keysOn(api).slice(0, 7), ['payDate', 'employee', 'acctType', 'method', 'hours', 'ot', 'rate']);
  api.setReportColumnOn('rate', false);
  await api.exportToolSettingsExcel(); // FC-00083
  const ts = api.__lastExcelWorkbook.worksheets.find(w => w.name === 'Tool Settings');
  const rows = ts.rows.slice(2).map(r => [r[1].value, r[2].value]);
  assert.deepEqual(rows.find(r => r[0] === 'Payroll report · Columns'), ['Payroll report · Columns', text]);
  const b = setup();
  assert.equal(b._ingestToolSettings(rows), 1, 'read back from the settings file');
  assert.deepEqual(b.reportColumns(), api.reportColumns());
  // The snapshot carries it.
  const snap = await api.buildSnapshot();
  const c = loadApp(); c.__sandbox.alert = () => {}; c.__sandbox.confirm = () => true;
  c.openSnapshotData(snap, 'x');
  assert.deepEqual(c.reportColumns(), api.reportColumns());
  // Every change is one History line, undoable.
  const lines = api.session.log.filter(e => e.type === 'toolSetting' && e.target.field === 'reportColumns');
  assert.equal(lines.length, 5);
  assert.equal(api._toolSettingLabel('reportColumns'), 'Payroll report · Columns');
  api.revertFromHistory(lines.at(-1).id);
  assert.ok(api.reportColumns().find(x => x.key === 'rate').on, 'Rate is back');
});

test('test_chip_bar_and_drag_to_move', () => {
  const api = setup();
  const html = api._reportColsBarHtml();
  assert.equal((html.match(/class="rc-chip /g) || []).length, 24, 'one chip per column');
  assert.match(html, /data-key="employee"[^>]*>.*?<input type="checkbox" checked disabled/, 'Employee cannot be unticked');
  assert.match(html, /data-key="mode"[^>]*>.*?<input type="checkbox" onchange="setReportColumnOn\('mode',this\.checked\)">Mode/, 'an extra starts unticked');
  assert.doesNotMatch(html, /rc-hidden-note/, 'nothing hidden by default');
  const cls = { add() {}, remove() {}, toggle() {} };
  api._rcDragStart({ dataTransfer: { setData() {} }, currentTarget: { classList: cls } }, 'cash');
  const target = (x) => ({ preventDefault() {}, clientX: x, currentTarget: { classList: cls, getBoundingClientRect: () => ({ left: 0, width: 100 }) } });
  assert.equal(api._rcDrop(target(10), 'hours'), true, 'dropped on the left half of Hours');
  assert.deepEqual(keysOn(api).slice(0, 5), ['employee', 'acctType', 'method', 'cash', 'hours']);
  api._rcDragStart({ dataTransfer: { setData() {} }, currentTarget: { classList: cls } }, 'acctType');
  api._rcDrop(target(90), 'method');
  assert.deepEqual(keysOn(api).slice(0, 4), ['employee', 'method', 'acctType', 'cash'], 'right half: after');
  api._rcDragEnd({});
  // Dropping a chip on itself changes nothing.
  api._rcDragStart({ dataTransfer: { setData() {} }, currentTarget: { classList: cls } }, 'cash');
  assert.equal(api._rcDrop(target(10), 'cash'), false);
});

test('test_per_entity_report_uses_the_same_columns', async () => {
  const api = setup();
  api.setReportColumnOn('method', false);
  await api._withExportScope([1], () => api.exportCombinedExcel());
  const ws = api.__lastExcelWorkbook.worksheets[0];
  assert.deepEqual(hdrOf(ws), ['Employee', 'Type', 'Hours', 'Over time', 'Rate', 'Bonus', 'Total', 'Deposit', 'Check', 'Cash']);
});

test('test_snapshot_from_before_the_picker_keeps_final_and_diff', async () => {
  // A snapshot saved with FC-00071's "Include Rounded Final and Diff" opens with those two ticked,
  // and the next settings file writes them as ticked columns.
  const api = setup();
  api.session.toolSettings = { reportFinalDiff: 'Include' };
  assert.equal(api.reportShowsFinalDiff(), true);
  assert.deepEqual(api._fc13PreviewModel().headers.slice(-2), ['Rounded Final', 'Diff']);
  await api.exportToolSettingsExcel(); // FC-00083
  const ts = api.__lastExcelWorkbook.worksheets.find(w => w.name === 'Tool Settings');
  const row = ts.rows.slice(2).map(r => [r[1].value, r[2].value]).find(r => r[0] === 'Payroll report · Columns');
  assert.match(row[1], /Cash, Entity \(off\), Rounded Final, Diff, Mode \(off\)/);
  // The first change made with the picker keeps them.
  api.setReportColumnOn('mode', true);
  assert.equal(api.reportShowsFinalDiff(), true);
});
