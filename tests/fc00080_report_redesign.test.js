// FC-00080: the payroll report in blocks. Per entity: a band with its name, EMPLOYEES and
// MANAGEMENT (Cash, Contract Check, Deposit + Cash, Deposit), a subtotal for each, the entity's
// TOTAL; GRAND TOTAL — ALL ENTITIES at the end. Hours is straight time; Over time is separate.
// The preview, the Excel and the PDF show the same rows. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { xlNum, xlFormulaMismatches, pdfCalls, pdfBody, pdfRowText } = require('./xl-helpers');
const { setup, rowOf } = require('./fc70-helpers');

const xlRows = (ws) => ws.rows.map((r, i) => [i, r && r[1] ? r[1].value : undefined]);

test('test_blocks_groups_and_row_order', async () => {
  const api = setup();
  // Cora (Deposit + Cash) and Bram (Cash) are Management at Alpha Test.
  api.setManagement(0, 'Cora Ctest', true);
  api.setManagement(0, 'Bram Btest', true);
  const m = api._fc13PreviewModel();
  const seq = m.rows.filter(r => r.kind !== 'title' && r.kind !== 'note' && r.kind !== 'hdr' && r.kind !== 'blank').map(r => r.kind + ':' + r.cells[0]);
  assert.deepEqual(seq, [
    'band:ALPHA TEST',
    'group:EMPLOYEES', 'data:Dane Dtest', 'data:Avery Atest', 'data:Eden Etest', 'subtotal:Employees subtotal',
    'group:MANAGEMENT', 'data:Bram Btest', 'data:Cora Ctest', 'subtotal:Management subtotal',
    'enttotal:ALPHA TEST TOTAL',
    'band:BETA TEST', 'group:EMPLOYEES', 'data:Fern Ftest', 'subtotal:Employees subtotal', 'enttotal:BETA TEST TOTAL',
    'grand:GRAND TOTAL — ALL ENTITIES',
  ]);
  // The same rows in the Excel and the PDF.
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  const xl = xlRows(ws).map(([, v]) => v).filter(v => typeof v === 'string' && v && !/^(COMBINED|Deposit paid|Employee$)/.test(v));
  assert.deepEqual(xl, seq.map(x => x.replace(/^\w+:/, '')));
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
  await api.exportCombinedPdf();
  const pdf = pdfBody(api).map(pdfRowText).map(r => r[0]).filter(Boolean);
  assert.deepEqual(pdf, seq.map(x => x.replace(/^\w+:/, '')));
});

test('test_totals_add_up_by_group_entity_and_grand', async () => {
  const api = setup();
  api.setManagement(0, 'Cora Ctest', true);
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
  const v = (label, k, from) => { const r = ws.rows.find((x, i) => i > (from || 0) && x && x[1] && x[1].value === label); return xlNum(r[C[k] + 1]); };
  const at = (label) => ws.rows.findIndex(x => x && x[1] && x[1].value === label);
  const alpha = at('ALPHA TEST'), beta = at('BETA TEST');
  assert.equal(v('Employees subtotal', 'total', alpha), 525 + 510 + 150 + 532);
  assert.equal(v('Management subtotal', 'total', alpha), 510);
  assert.equal(v('ALPHA TEST TOTAL', 'total'), 2227);
  assert.equal(v('ALPHA TEST TOTAL', 'deposit'), 525 + 300 + 532);
  assert.equal(v('ALPHA TEST TOTAL', 'contract'), 150);
  assert.equal(v('ALPHA TEST TOTAL', 'cash'), 510 + 210);
  assert.equal(v('Employees subtotal', 'total', beta), 320);
  assert.equal(v('GRAND TOTAL — ALL ENTITIES', 'total'), 2547);
  assert.equal(v('GRAND TOTAL — ALL ENTITIES', 'cash'), 720);
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
});

test('test_one_entity_has_no_grand_total', async () => {
  const api = setup();
  await api._withExportScope([0], () => api.exportCombinedExcel());
  const ws = api.__lastExcelWorkbook.worksheets[0];
  assert.ok(ws.rows.some(r => r && r[1] && r[1].value === 'ALPHA TEST TOTAL'));
  assert.ok(!ws.rows.some(r => r && r[1] && /^GRAND TOTAL/.test(String(r[1].value))));
});

test('test_hours_are_straight_time_and_pay_unchanged', async () => {
  const api = setup();
  const avery = rowOf(api, 'Avery Atest');
  assert.equal(avery.actualHours, 42.5);
  assert.equal(avery.otPaidH, 2.5);
  const m = api._fc13PreviewModel(), C = api.COMBINED_COLS;
  const d = m.rows.find(r => r.kind === 'data' && r.cells[0] === 'Avery Atest');
  assert.equal(d.cells[C.hours], '40.00');
  assert.equal(d.cells[C.ot], '2.50');
  assert.equal(d.cells[C.total], '$525.00', '40 × 12 + 2.5 × 12 × 1.5');
  // Cash and Deposit + Cash people over 40 have no Over time: Hours is all they worked.
  assert.equal(m.rows.find(r => r.kind === 'data' && r.cells[0] === 'Bram Btest').cells[C.hours], '42.50');
  // With Over time unticked, Hours is the hours worked again.
  api.setReportColumnOn('ot', false);
  const m2 = api._fc13PreviewModel();
  assert.equal(m2.rows.find(r => r.kind === 'data' && r.cells[0] === 'Avery Atest').cells[api.COMBINED_COLS.hours], '42.50');
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook;
  assert.deepEqual(xlFormulaMismatches(wb, wb.worksheets[0]).bad, [], 'Over time hidden: the old formulas still agree');
});

test('test_blanks_type_and_no_flat_suffix', () => {
  const api = setup();
  api.setAcctField(0, 'Eden Etest', 'acct_type', '1099');
  const m = api._fc13PreviewModel(), C = api.COMBINED_COLS;
  const row = (n) => m.rows.find(r => r.kind === 'data' && r.cells[0] === n).cells;
  assert.equal(row('Eden Etest')[C.acctType], '1099');
  assert.equal(row('Avery Atest')[C.acctType], '');
  assert.equal(row('Avery Atest')[C.cash], '', 'blank, not "—"');
  assert.equal(row('Avery Atest')[C.contract], '');
  assert.equal(row('Bram Btest')[C.deposit], '');
  assert.ok(!m.rows.some(r => r.cells.some(c => c === '—')), 'no dash anywhere');
  assert.equal(m.headers.indexOf('Entity'), -1, 'no Entity column');
});

test('test_colors_cash_one_yellow_and_band_per_entity', async () => {
  const api = setup();
  const RC = api.REPORT_COLORS, C = api.COMBINED_COLS, css = (a) => '#' + a.slice(2);
  const m = api._fc13PreviewModel();
  const bands = m.rows.filter(r => r.kind === 'band');
  assert.equal(bands.length, 2);
  bands.forEach(b => assert.equal(b.fgs[0], '#FFFFFF'));
  m.rows.filter(r => r.kind === 'data').forEach(r => assert.equal(r.bgs[C.cash], css(RC.cashData), 'one cash yellow for every entity'));
  assert.ok(m.rows.filter(r => r.kind === 'subtotal').every(r => r.bgs[C.cash] === css(RC.cashSub)));
  assert.ok(m.rows.filter(r => r.kind === 'enttotal').every(r => r.bgs[C.cash] === css(RC.cashTot) && r.bgs[0] === css(RC.tot)));
  const g = m.rows.find(r => r.kind === 'grand');
  assert.equal(g.bgs[0], css(RC.grand)); assert.equal(g.fgs[0], '#FFFFFF');
  // The Excel: the band's row is merged across the page and each entity starts a new page.
  await api.exportCombinedExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const beta = ws.rows.findIndex(r => r && r[1] && r[1].value === 'BETA TEST');
  assert.ok(ws.merges.some(([r1, c1, r2, c2]) => r1 === beta && c1 === 1 && c2 === api.COMBINED_HEADERS.length));
  assert.deepEqual(ws.pageBreaks, [beta - 1], 'a page break before Beta Test');
  assert.equal(ws.pageSetup.orientation, 'landscape');
  assert.equal(ws.pageSetup.fitToWidth, 1);
});

test('test_pdf_one_page_per_entity_header_repeats', async () => {
  const api = setup();
  await api.exportCombinedPdf();
  const calls = pdfCalls(api);
  assert.equal(calls.length, 2, 'Alpha Test, then Beta Test on its own page');
  calls.forEach(c => { assert.deepEqual(c.options.head[0], api.COMBINED_HEADERS); assert.equal(c.options.showHead, 'everyPage'); });
  assert.equal(calls[0].options.body[0][0].content, 'ALPHA TEST');
  assert.equal(calls[1].options.body[0][0].content, 'BETA TEST');
  const last = calls[1].options.body.at(-1).map(c => c.content);
  assert.equal(last[0], 'GRAND TOTAL — ALL ENTITIES');
});

test('test_zero_paid_person_prints_when_ticked_active', () => {
  // The Active tick decides, not the amount: a person ticked Active with $0 prints.
  const api = setup();
  // Yara is on Beta Test's schedule and worked no hours this week.
  api.entities[1].employees.push({ name: 'Yara Ytest', shifts: ['', '9AM - 5PM', '', '', '', '', ''] });
  api.wageRates[api.wKey(1, 'Yara Ytest')] = 15; api.payMethod[api.wKey(1, 'Yara Ytest')] = 'cash';
  const m = api._fc13PreviewModel();
  assert.ok(m.rows.some(r => r.kind === 'data' && r.cells[0] === 'Yara Ytest'), 'ticked Active, $0, printed');
  api.setRosterActive(1, 'Yara Ytest', false);
  assert.ok(!api._fc13PreviewModel().rows.some(r => r.kind === 'data' && r.cells[0] === 'Yara Ytest'), 'unticked, left out');
});

test('test_old_saved_columns_move_to_the_new_layout', () => {
  const api = setup();
  api._ingestToolSettings([['Payroll report · Columns', 'Entity, Employee, Method, Hours, Over time, Rate, Actual Total, Deposit, Contract Check, Cash, Rounded Final, Diff, Mode (off), H:MM (off), Break (off), Scheduled Hours (off), Hours vs Schedule (off), Avg In vs Schedule (off), Avg Out vs Schedule (off), Accountant Name (off), Employment Type (off), Pay Date (off)']]);
  assert.deepEqual(api._fc13PreviewModel().headers, ['Employee', 'Type', 'Method', 'Hours', 'Over time', 'Rate', 'Bonus', 'Total', 'Deposit', 'Check', 'Cash', 'Rounded Final', 'Diff']);
});
