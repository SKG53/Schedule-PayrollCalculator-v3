// FC-00081: our own accountant file. Deposit people only (Deposit, Deposit + Cash, salaried by
// deposit, and a bonus paid by deposit), in the payroll report's layout: entity bands, EMPLOYEES and
// MANAGEMENT, subtotals, entity totals, the grand total. Columns: Employee, Employment Type, Regular
// Hours, Overtime Hours, Rate, Salary, Bonus, Gross Total, Notes. No IDs, no cash, no checks. Each
// entity's Gross Total ties to the payroll report's Deposit. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { xlNum, xlFormulaMismatches, pdfCalls, pdfBody, pdfRowText } = require('./xl-helpers');
const { setup } = require('./fc70-helpers');

const HEAD = ['Employee', 'Employment Type', 'Regular Hours', 'Overtime Hours', 'Rate', 'Salary', 'Bonus', 'Gross Total', 'Notes'];

test('test_only_deposit_people', () => {
  const api = setup({ exec: true });
  const M = api.acctFileModel();
  assert.deepEqual(M.entities.map(e => e.entityName), ['Alpha Test', 'Beta Test']);
  const names = M.entities[0].rows.map(r => r.name).sort();
  assert.deepEqual(names, ['Avery Atest', 'Cora Ctest', 'Eden Etest', 'Gale Gtest'], 'no Cash (Bram), no Contract Check (Dane)');
  api.setRosterActive(0, 'Eden Etest', false);
  assert.ok(!api.acctFileModel().entities[0].rows.some(r => r.name === 'Eden Etest'), 'unticked Active: left off');
  // A Cash person with a bonus paid by deposit is on it, for the bonus only.
  api.addBonus(0, 'Bram Btest', { type: 'specialty', amount: 40, pay: 'deposit' });
  const bram = api.acctFileModel().entities[0].rows.find(r => r.name === 'Bram Btest');
  assert.deepEqual([bram.reg, bram.rate, bram.salary, bram.bonus, bram.gross], [0, 0, 0, 40, 40]);
});

test('test_values_by_kind_of_row', () => {
  const api = setup({ exec: true });
  const row = (n) => api.acctFileModel().entities[0].rows.find(r => r.name === n);
  // Deposit, hourly, over 40: Regular 40, Overtime 2.5, Gross = 40 × 12 + 2.5 × 12 × 1.5.
  const a = row('Avery Atest');
  assert.deepEqual([a.reg, a.ot, a.rate, a.salary, a.bonus, a.gross], [40, 2.5, 12, 0, 0, 525]);
  // Deposit + Cash: the set deposit is the Salary; the cash part is nowhere.
  const c = row('Cora Ctest');
  assert.deepEqual([c.reg, c.ot, c.rate, c.salary, c.gross], [0, 0, 0, 300, 300]);
  // Salaried by deposit (an old Executive PR row): the weekly amount.
  const g = row('Gale Gtest');
  assert.deepEqual([g.reg, g.rate, g.salary, g.gross], [0, 0, 900, 900]);
  // Bonuses: only those paid by deposit; Gross includes them.
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 50, pay: 'deposit' });
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 30, pay: 'cash' });
  api.addBonus(0, 'Cora Ctest', { type: 'monthly', amount: 25, pay: 'deposit' });
  assert.deepEqual([row('Avery Atest').bonus, row('Avery Atest').gross], [50, 575]);
  assert.deepEqual([row('Cora Ctest').salary, row('Cora Ctest').bonus, row('Cora Ctest').gross], [300, 25, 325]);
});

test('test_ties_to_the_report_deposit', () => {
  const api = setup({ exec: true });
  api.addBonus(0, 'Avery Atest', { type: 'specialty', amount: 50, pay: 'deposit' });
  const t = api.acctTieOut();
  assert.deepEqual(t.map(x => [x.entityName, x.gross, x.ok]), [['Alpha Test', 575 + 300 + 532 + 900, true], ['Beta Test', 320, true]]);
  // The same figures as the payroll report's Deposit column, entity by entity.
  const m = api._fc13PreviewModel(), C = api.COMBINED_COLS;
  const dep = m.rows.filter(r => r.kind === 'enttotal').map(r => r.cells[C.deposit]);
  assert.deepEqual(dep, ['$2,307.00', '$320.00']);
  api.renderDownloadsPanel();
  const html = api.__sandbox.document.getElementById('downloadsHost').innerHTML;
  assert.match(html, /✓ Alpha Test: Gross Total \$2,307\.00 matches this week's payroll deposits/);
});

test('test_excel_layout_and_formulas', async () => {
  const api = setup({ exec: true });
  api.setManagement(0, 'Gale Gtest', true);
  api.setPayDateByHand('deposit', '2026-08-20');
  api.setAcctField(0, 'Avery Atest', 'acct_name', 'Avery Q. Atest');
  api.setAcctField(0, 'Avery Atest', 'acct_type', 'w2');
  api.setAcctField(0, 'Gale Gtest', 'acct_note', 'Standing note');
  api.setAcctWeekNote(0, 'Gale Gtest', 'This week only');
  api.addBonus(0, 'Cora Ctest', { type: 'monthly', amount: 25, pay: 'deposit' });
  await api.exportAccountantFile();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  assert.equal(wb.worksheets.length, 1, 'one sheet: no Hours, Stats or Labor Cost');
  const v = (r, c) => ws.rows[r] && ws.rows[r][c] ? ws.rows[r][c].value : undefined;
  assert.equal(v(1, 1), 'ACCOUNTANT PAYROLL — PERIOD 08/09/26 – 08/15/26');
  assert.equal(v(2, 1), 'Deposit paid Thu 08/20/26');
  assert.deepEqual(ws.rows[3].slice(1).map(c => c.value), HEAD);
  const labels = ws.rows.map(r => (r && r[1] ? r[1].value : undefined)).filter(x => typeof x === 'string' && x);
  assert.deepEqual(labels.slice(3), ['ALPHA TEST', 'EMPLOYEES', 'Cora Ctest', 'Avery Q. Atest', 'Eden Etest', 'Employees subtotal', 'MANAGEMENT', 'Gale Gtest', 'Management subtotal', 'ALPHA TEST TOTAL',
    'BETA TEST', 'EMPLOYEES', 'Fern Ftest', 'Employees subtotal', 'BETA TEST TOTAL', 'GRAND TOTAL — ALL ENTITIES']);
  const at = (n) => ws.rows.findIndex(r => r && r[1] && r[1].value === n);
  const av = at('Avery Q. Atest'), L = (k) => String.fromCharCode(65 + api.ACCT_COLS.findIndex(c => c[0] === k)), col = (k) => api.ACCT_COLS.findIndex(c => c[0] === k) + 1;
  assert.deepEqual([v(av, col('type')), v(av, col('reg')), v(av, col('ot')), v(av, col('rate'))], ['W2', 40, 2.5, 12]);
  assert.equal(v(av, col('gross')).formula, 'ROUND(ROUND((' + L('reg') + av + '+1.5*' + L('ot') + av + ')*' + L('rate') + av + ',2)+' + L('bonus') + av + ',2)');
  const co = at('Cora Ctest');
  assert.equal(v(co, col('gross')).formula, 'ROUND(' + L('salary') + co + '+' + L('bonus') + co + ',2)');
  assert.equal(xlNum(ws.rows[co][col('gross')]), 325);
  assert.equal(v(at('Gale Gtest'), col('note')), 'Standing note · This week only');
  const tot = at('ALPHA TEST TOTAL'), g = at('GRAND TOTAL — ALL ENTITIES');
  assert.equal(xlNum(ws.rows[tot][col('gross')]), 525 + 325 + 532 + 900);
  assert.equal(xlNum(ws.rows[g][col('gross')]), 525 + 325 + 532 + 900 + 320);
  assert.equal(xlNum(ws.rows[g][col('reg')]), 40 + 38 + 20, 'Regular Hours totalled');
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, [], 'every formula gives the cached value');
  // Nothing about cash, checks or IDs.
  const all = JSON.stringify(ws.rows.map(r => (r || []).map(c => c && c.value)));
  assert.doesNotMatch(all, /Cash|Check|TNG\d|EMP_|Bram|Dane/);
  // Each entity on its own page; the entity's color on its band.
  assert.deepEqual(ws.pageBreaks, [at('BETA TEST') - 1]);
  assert.equal(ws.rows[at('ALPHA TEST')][1].fill.fgColor.argb, api._paletteForEntity(api.entities[0]).band);
  assert.equal(ws.rows[av][1].fill.fgColor.argb, api._paletteForEntity(api.entities[0]).body);
});

test('test_pdf_matches_the_excel', async () => {
  const api = setup({ exec: true });
  const saved = [];
  const orig = api.__sandbox.window.jspdf.jsPDF;
  api.__sandbox.window.jspdf = { jsPDF: function (o) { const d = orig(o); d.save = (n) => saved.push(n); return d; } };
  await api.exportAccountantPdf();
  assert.ok(saved.length === 1 && /_AccountantFile\.pdf$/.test(saved[0]), saved.join());
  const calls = pdfCalls(api);
  assert.equal(calls.length, 2, 'one page per entity');
  calls.forEach(c => assert.deepEqual(c.options.head[0], HEAD));
  const body = pdfBody(api).map(pdfRowText);
  const avery = body.find(r => r[0] === 'Avery Atest');
  assert.deepEqual(avery.slice(2, 8), ['40.00', '2.50', '$12.00', '', '', '$525.00']);
  const cora = body.find(r => r[0] === 'Cora Ctest');
  assert.deepEqual(cora.slice(2, 8), ['', '', '', '$300.00', '', '$300.00']);
  assert.equal(body.at(-1)[0], 'GRAND TOTAL — ALL ENTITIES');
  assert.equal(body.at(-1)[7], '$2,577.00', '525 + 300 + 532 + 900 + 320');
});

test('test_card_status_and_panel', () => {
  const api = setup();
  const d = api.DOWNLOADS.find(x => x.key === 'accountant');
  assert.deepEqual(Object.keys(d.formats), ['xlsx', 'pdf']);
  const st = api.downloadStatus('accountant');
  assert.ok(st.reasons.includes('Deposit pay date not set: set it below'), st.reasons.join(' | '));
  assert.ok(st.reasons.some(x => /^Employment type not set: /.test(x)));
  assert.ok(!st.reasons.some(x => /accountant's file is not loaded/.test(x)), 'nothing to load any more');
  api.renderDownloadsPanel();
  const html = api.__sandbox.document.getElementById('downloadsHost').innerHTML;
  assert.match(html, /<h3>Accountant file<\/h3>/);
  assert.doesNotMatch(html, /Load the accountant's file/);
  assert.match(html, /onchange="setPayDateByHand\('deposit',this.value\)"/);
  assert.match(html, /class="acct-note acct-week-note"/);
});

test('test_week_note_is_undoable_and_kept_out_of_the_settings_file', async () => {
  const api = setup();
  assert.equal(api.setAcctWeekNote(0, 'Avery Atest', 'Back pay for 08/01'), true);
  assert.equal(api.getAcctWeekNote(0, 'Avery Atest'), 'Back pay for 08/01');
  const line = api.session.log.filter(e => e.type === 'toolSetting').at(-1);
  assert.match(api._toolSettingLabel(line.target.field), /^Accountant note this week · Avery Atest · week of /);
  await api.exportPayrollSettingsExcel(false);
  const ts = api.__lastExcelWorkbook.worksheets.find(w => w.name === 'Tool Settings');
  assert.ok(!ts.rows.some(r => r && r.some(c => c && /Back pay/.test(String(c.value)))), 'a note for one week stays out of the register');
  api.revertFromHistory(line.id);
  assert.equal(api.getAcctWeekNote(0, 'Avery Atest'), '');
});

test('test_no_deposit_people_no_file', async () => {
  const api = setup();
  ['Avery Atest', 'Cora Ctest', 'Eden Etest'].forEach(n => { api.payMethod[api.wKey(0, n)] = 'cash'; });
  api.payMethod[api.wKey(1, 'Fern Ftest')] = 'cash';
  assert.equal(api.acctFileModel().entities.length, 0);
  assert.deepEqual(api.downloadStatus('accountant').reasons, ['No one is paid by deposit this week']);
  const before = api.__lastExcelWorkbook;
  await api.exportAccountantFile();
  assert.equal(api.__lastExcelWorkbook, before, 'no file is written');
});

test('test_old_snapshot_with_a_loaded_file_opens', async () => {
  const api = setup();
  const snap = await api.buildSnapshot();
  snap.parts.acctFile = { fileName: 'theirs.xlsx', sections: [] };
  const { loadApp } = require('./load-app');
  const b = loadApp(); b.__sandbox.alert = () => {}; b.__sandbox.confirm = () => true;
  const res = b.openSnapshotData(snap, 'old');
  assert.ok(res === undefined || res === true || (res && res.ok !== false));
});
