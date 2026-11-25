// FC-00082: bonuses tied to their week; a row with a bonus stays live in the payroll report's
// Excel; the same heading on every page; the accountant file checks out on its own.
// Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { xlNum, xlEval, xlFormulaMismatches, pdfCalls } = require('./xl-helpers');
const { setup, completeAccountant } = require('./fc70-helpers');

const W = '2026-08-09'; // the fixture's run week (Sunday)

test('test_bonus_belongs_to_its_week', () => {
  const api = setup();
  assert.equal(api._runWeekStart(), W);
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 40, pay: 'deposit' });
  api.addBonus(0, 'Avery Atest', { type: 'monthly', amount: 25, pay: 'deposit' });
  api.addBonus(0, 'Avery Atest', { type: 'weekly', recurring: true, amount: 10, pay: 'cash' });
  const [sp, mo, wk] = api.getBonuses(0, 'Avery Atest');
  [sp, mo, wk].forEach(b => assert.equal(b.week, W, 'stamped with the run week'));
  const counts = (b, w) => api._bonusCounts(b, w);
  // One-offs: their own week only.
  assert.deepEqual([counts(sp, W), counts(sp, '2026-08-16'), counts(sp, '2026-08-02')], [true, false, false]);
  assert.deepEqual([counts(mo, W), counts(mo, '2026-08-16')], [true, false]);
  // Recurring: from its start week on, never before.
  assert.deepEqual([counts(wk, '2026-08-02'), counts(wk, W), counts(wk, '2026-09-27')], [false, true, true]);
  assert.equal(api._bonusWeekText(wk), 'from week of 08/09/26');
  assert.equal(api._bonusWeekText(sp), 'week of 08/09/26');
});

test('test_stop_a_recurring_bonus', () => {
  const api = setup();
  api.addBonus(0, 'Avery Atest', { type: 'weekly', recurring: true, amount: 10, pay: 'deposit', week: '2026-07-26' });
  const id = api.getBonuses(0, 'Avery Atest')[0].id;
  assert.equal(api.bonusTotals(0, 'Avery Atest').total, 10);
  // Last paid this week: still in this run, not after.
  api.stopBonus(0, 'Avery Atest', id, 'after');
  let b = api.getBonuses(0, 'Avery Atest')[0];
  assert.equal(b.endWeek, W);
  assert.deepEqual([api._bonusCounts(b, '2026-07-26'), api._bonusCounts(b, W), api._bonusCounts(b, '2026-08-16')], [true, true, false]);
  // Stopped from this week: earlier weeks keep it.
  api.stopBonus(0, 'Avery Atest', id, 'before');
  b = api.getBonuses(0, 'Avery Atest')[0];
  assert.equal(b.endWeek, '2026-08-02');
  assert.equal(api.bonusTotals(0, 'Avery Atest').total, 0, 'not paid this run');
  assert.equal(api._bonusCounts(b, '2026-08-02'), true, 'the week before still has it');
  assert.equal(api._bonusWeekText(b), 'from week of 07/26/26 to week of 08/02/26');
  // The panel still lists it, to resume.
  api.openBonusEditor(0, 'Avery Atest');
  const html = api.__sandbox.document.getElementById('bonusPanel').innerHTML;
  assert.match(html, /not paid this week/);
  assert.match(html, /<option value="before" selected>Stopped from this week<\/option>/);
  api.stopBonus(0, 'Avery Atest', id, '');
  assert.equal(api.bonusTotals(0, 'Avery Atest').total, 10, 'resumed');
});

test('test_week_and_end_week_in_the_register', async () => {
  const api = setup();
  api.addBonus(0, 'Avery Atest', { type: 'weekly', recurring: true, amount: 10, pay: 'deposit', week: '2026-07-26' });
  api.stopBonus(0, 'Avery Atest', api.getBonuses(0, 'Avery Atest')[0].id, 'after');
  const rows = api._bonusRowsForFile();
  assert.deepEqual(rows[0].slice(8, 10), ['2026-07-26', W]);
  // Read back, also when a spreadsheet turned the dates into m/d/yy.
  const b = setup();
  const hdr = api.THIS_WEEK_HEADERS;
  const row = rows[0].slice(); row[8] = '7/26/26'; row[9] = '8/9/2026';
  assert.equal(b._ingestBonusRows([hdr, row]), 1);
  const got = b.getBonuses(0, 'Avery Atest')[0];
  assert.deepEqual([got.week, got.endWeek, got.recurring], ['2026-07-26', W, true]);
  assert.equal(b._isoOfCell(''), '');
});

test('test_no_bonus_without_a_week', () => {
  const api = setup();
  api.entities.forEach(e => { e.dateLabels = []; });
  assert.equal(api._runWeekStart(), '');
  assert.equal(api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 5 }), false);
});

// Bonuses on every pay method and every pay-by.
function withBonuses(api) {
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 50, pay: 'deposit' });   // Deposit, over 40
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 20.4, pay: 'cash' });
  api.addBonus(0, 'Bram Btest', { type: 'specialty', amount: 15, pay: 'cash' });       // Cash
  api.addBonus(0, 'Bram Btest', { type: 'specialty', amount: 30, pay: 'deposit' });
  api.addBonus(0, 'Cora Ctest', { type: 'specialty', amount: 12.5, pay: 'cash' });     // Deposit + Cash
  api.addBonus(0, 'Cora Ctest', { type: 'specialty', amount: 25, pay: 'deposit' });
  api.addBonus(0, 'Dane Dtest', { type: 'specialty', amount: 35, pay: 'contract' });   // Contract Check
  api.addBonus(0, 'Dane Dtest', { type: 'specialty', amount: 8, pay: 'cash' });
  api.addBonus(0, 'Eden Etest', { type: 'specialty', amount: 50, pay: 'deposit' });    // Deposit
  api.addBonus(0, 'Eden Etest', { type: 'specialty', amount: 20, pay: 'cash' });
  api.addBonus(0, 'Eden Etest', { type: 'specialty', amount: 5, pay: 'contract' });
}

test('test_bonus_rows_are_live_formulas', async () => {
  for (const variant of ['default', 'noCheckCol', 'noBonusCol']) {
    const api = setup();
    withBonuses(api);
    if (variant === 'noCheckCol') api.setReportColumnOn('contract', false);
    if (variant === 'noBonusCol') api.setReportColumnOn('bonus', false);
    await api.exportCombinedExcel();
    const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
    assert.deepEqual(xlFormulaMismatches(wb, ws).bad, [], variant + ': every formula gives the tool\'s figure');
    ['Avery Atest', 'Bram Btest', 'Cora Ctest', 'Dane Dtest', 'Eden Etest'].forEach(n => {
      const r = ws.rows.find(x => x && x[1] && x[1].value === n);
      assert.ok(r[C.total + 1].value.formula, variant + ' ' + n + ': Total is a formula');
      ['deposit', 'cash'].concat(C.contract != null ? ['contract'] : []).forEach(k => assert.ok(r[C[k] + 1].value && r[C[k] + 1].value.formula, variant + ' ' + n + ': ' + k + ' is a formula'));
    });
    // The tool's own figures for each part.
    const pv = api._fc13PreviewModel();
    const cell = (n, k) => pv.rows.find(x => x.kind === 'data' && x.cells[0] === n).cells[C[k]];
    assert.equal(cell('Eden Etest', 'total'), '$607.00', variant + ': 38 × 14 + 75');
    assert.equal(cell('Eden Etest', 'cash'), '$20.00');
  }
});

test('test_hours_sheet_edit_moves_a_bonus_row', async () => {
  const api = setup();
  api.addBonus(0, 'Eden Etest', { type: 'specialty', amount: 50, pay: 'deposit' });
  api.addBonus(0, 'Eden Etest', { type: 'specialty', amount: 20, pay: 'cash' });
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0], C = api.COMBINED_COLS;
  const eden = ws.rows.find(r => r && r[1] && r[1].value === 'Eden Etest');
  // Six more hours on one day: 44 worked, 40 straight, 4 over time.
  const hs = wb.worksheets.find(w => w.name === 'Hours');
  const hdr = hs.rows.find(r => r && r[1] && r[1].value === 'Entity');
  const out1 = hdr.findIndex(c => c && c.value === 'Out 1');
  hs.rows.find(r => r && r[2] && r[2].value === 'Eden Etest')[out1].value += 6 / 24;
  const ev = (k) => xlEval(wb, ws, eden[C[k] + 1].value.formula);
  assert.equal(ev('hours'), 40);
  assert.equal(ev('ot'), 4);
  assert.equal(ev('total'), 14 * (40 + 1.5 * 4) + 70, 'pay + both bonuses');
  assert.equal(ev('deposit'), 14 * 46 + 50, 'pay + the deposit bonus');
  assert.equal(ev('cash'), 20, 'the cash bonus');
});

test('test_heading_on_every_pdf_page', async () => {
  const api = setup();
  await api.exportCombinedPdf();
  let doc = pdfCalls(api)[0].doc;
  assert.equal(doc.getNumberOfPages(), 2);
  const title = doc.__texts.find(t => /^COMBINED PAYROLL REPORT/.test(t.text)).text;
  [1, 2].forEach(p => {
    const on = doc.__texts.filter(t => t.page === p).map(t => t.text);
    assert.ok(on.includes(title), 'title on page ' + p);
    assert.ok(on.some(t => /^Deposit paid .*\|\s+Cash and Check paid /.test(t)), 'dates line on page ' + p);
    assert.ok(on.includes('Page ' + p + ' of 2'), 'page number ' + p);
  });
  pdfCalls(api).forEach(c => assert.equal(c.options.margin.top, 62, 'room for the heading'));
  // The accountant file too.
  const saved = [];
  const orig = api.__sandbox.window.jspdf.jsPDF;
  api.__sandbox.window.jspdf = { jsPDF: function (o) { const d = orig(o); d.save = (n) => saved.push(n); return d; } };
  completeAccountant(api); // FC-00085: written only when complete
  await api.exportAccountantPdf();
  doc = pdfCalls(api)[0].doc;
  [1, 2].forEach(p => {
    const on = doc.__texts.filter(t => t.page === p).map(t => t.text);
    assert.ok(on.some(t => /^ACCOUNTANT PAYROLL — PERIOD /.test(t)), 'accountant title on page ' + p);
    assert.ok(on.some(t => /^Deposit paid /.test(t)));
    assert.ok(on.includes('Page ' + p + ' of 2'));
  });
});

test('test_heading_on_every_printed_excel_page', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  let ws = api.__lastExcelWorkbook.worksheets[0];
  assert.equal(ws.pageSetup.printTitlesRow, '1:3', 'title, dates line and headings repeat');
  assert.match(ws.headerFooter.oddFooter, /Page &P of &N/);
  completeAccountant(api); // FC-00085: written only when complete
  await api.exportAccountantFile();
  ws = api.__lastExcelWorkbook.worksheets[0];
  assert.equal(ws.pageSetup.printTitlesRow, '1:3');
});

test('test_accountant_file_checks_out_on_its_own', () => {
  const api = setup({ exec: true });
  withBonuses(api);
  const c = api.acctSelfCheck();
  assert.equal(c.ok, true, c.problems.join('; '));
  assert.deepEqual(c.noteWarnings, []);
});

test('test_a_row_that_does_not_check_out_blocks_the_file', async () => {
  // A rate with a fraction of a cent prints as $12.35 but pays at 12.345: the row would not
  // reproduce from its own columns, so the file is not written.
  const api = setup();
  api.wageRates[api.wKey(0, 'Eden Etest')] = 12.345;
  const c = api.acctSelfCheck();
  assert.equal(c.ok, false);
  assert.match(c.problems[0], /^Eden Etest \(Alpha Test\): Gross Total \$\d/);
  const alerts = []; api.__sandbox.alert = (m) => alerts.push(m);
  const before = api.__lastExcelWorkbook;
  completeAccountant(api); // FC-00085: written only when complete
  await api.exportAccountantFile();
  assert.equal(api.__lastExcelWorkbook, before, 'no file');
  assert.match(alerts[0], /^The accountant file was not written: it does not check out on its own\./);
  assert.ok(api.downloadStatus('accountant').reasons.some(r => /^The file does not add up on its own, so it will not be written$/.test(r))); // FC-00093: short
  assert.ok(api._acctStatusReasons(true).some(r => /^The file does not add up on its own, so it will not be written: Eden Etest/.test(r)), 'who is in the tooltip');
});

test('test_no_process_words_on_the_accountant_file', async () => {
  const api = setup({ exec: true });
  api.setPayDateByHand('deposit', '2026-08-20');
  completeAccountant(api); // FC-00085: written only when complete
  await api.exportAccountantFile();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const words = ws.rows.flatMap(r => (r || []).map(c => (c && typeof c.value === 'string' ? c.value : ''))).join(' | ');
  assert.doesNotMatch(words, /\b(cash|checks?|envelopes?|report|TNG\d+|EMP_)\b/i);
  // A note typed by the owner is printed as typed, with a warning in the tool.
  api.setAcctWeekNote(0, 'Avery Atest', 'Rest paid in cash');
  const c = api.acctSelfCheck();
  assert.equal(c.ok, true);
  assert.deepEqual(c.noteWarnings, ['Avery Atest\'s note mentions "cash"']);
  assert.ok(api.downloadStatus('accountant').reasons.includes('1 note mentions cash, checks or our files — the accountant will see it')); // FC-00093: short
  assert.ok(api._acctStatusReasons(true).some(r => r.includes('Avery Atest\'s note mentions "cash"')), 'who is in the tooltip');
});

test('test_tie_check_ignores_the_check_column_choice', () => {
  const api = setup();
  const a = api.acctTieOut().map(t => [t.gross, t.deposit, t.ok]);
  api.setReportColumnOn('contract', false);
  assert.deepEqual(api.acctTieOut().map(t => [t.gross, t.deposit, t.ok]), a, 'contract checks are never counted as deposits');
  api.renderDownloadsPanel();
  const html = api.__sandbox.document.getElementById('downloadsHost').innerHTML;
  // FC-00093: the card shows one status line; the self-check and the tie-out still run.
  assert.equal(api.acctSelfCheck().ok, true);
  assert.ok(!api.downloadStatus('accountant').reasons.some(r => /does not add up|does not match/.test(r)));
  assert.doesNotMatch(html, /payroll report's Deposit/);
});
