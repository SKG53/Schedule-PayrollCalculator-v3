// FC-00092: who appears on the accountant file: Auto (paid by deposit, as before), Always (even at
// $0) or Never (never, even with a deposit). One value per person on the Employee Register, kept in
// the register file (On Accountant File, last column). Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { xlNum, xlFormulaMismatches, pdfBody, pdfRowText } = require('./xl-helpers');
const { setup, completeAccountant } = require('./fc70-helpers');

const idOf = (api, e, n) => api.wKey(e, n);
const model = (api) => api.acctFileModel().entities.map(e => [e.entityName, e.rows.map(r => [r.name, r.gross]).sort()]);
const rowsOf = (api) => api.acctFileModel().entities.flatMap(e => e.rows.map(r => Object.assign({ ent: e.entityName }, r)));
const payTotals = (api) => api._collectExportData().flatMap(d => d.rows.map(r => [d.entityName, r._empName, r._breakdown.deposit, r._breakdown.cash]));
const grand = (api) => Math.round(api._acctData().reduce((a, d) => a + d.rows.reduce((b, r) => b + r._acct.gross, 0), 0) * 100) / 100;

function loadBack(api, wb, name) {
  const val = (c) => { const v = c && c.value; if (v == null) return ''; if (typeof v === 'object' && 'result' in v) return String(v.result); return String(v); };
  const sheets = {}; wb.worksheets.forEach(w => { sheets[w.name] = w; });
  api.__sandbox.FileReader = class { readAsArrayBuffer() { this.onload({ target: { result: new ArrayBuffer(0) } }); } };
  api.__sandbox.XLSX = {
    read: () => ({ SheetNames: wb.worksheets.map(w => w.name), Sheets: sheets }),
    utils: { sheet_to_json: (ws) => ws.rows.slice(1).map(r => (r || []).slice(1).map(val)) },
  };
  return { name: name || 'file.xlsx' };
}

// Nora: Flat $480 by deposit at Beta Test, paid without a schedule, ticked "Not paid this week".
// Zed: hourly by deposit at Beta Test, on no schedule and with no punches, deposit from Alpha Test.
function withZeroPeople() {
  const api = setup();
  const nora = api.addNoSchedPerson(1, 'Nora', 'Ntest', { amount: 480, method: 'deposit' });
  assert.ok(nora && nora.id);
  api.setNoSchedSkip(nora.id, true);
  const zed = api.ensureRosterRecord(1, 'Zed Ztest');
  api.wageRates[zed.id] = 13; api.payMethod[zed.id] = 'deposit';
  api.setDepositEntity(1, 'Zed Ztest', 'Alpha Test');
  return { api, nora: api.session.roster.byId[nora.id], zed };
}

test('test_auto_is_unchanged', () => {
  const plain = setup();
  const { api } = withZeroPeople();
  assert.deepEqual(model(api), model(plain), 'nobody at $0 is added on Auto');
  assert.ok(!rowsOf(api).some(r => /Ntest|Ztest|Bram/.test(r.name)), 'Not paid this week, no hours and Cash: off the file');
  assert.equal(api.acctFileChoice(api.session.roster.byId[idOf(api, 0, 'Avery Atest')]), '', 'blank = Auto');
  // Setting Auto by hand changes nothing.
  api.setPersonField(idOf(api, 0, 'Avery Atest'), 'acct_file', 'Auto');
  assert.equal(api.session.roster.byId[idOf(api, 0, 'Avery Atest')].acct_file, undefined);
  assert.deepEqual(model(api), model(plain));
});

test('test_always_lists_zero_people_in_their_deposit_entity_section', () => {
  const { api, nora, zed } = withZeroPeople();
  const before = grand(api), pay = payTotals(api);
  api.setPersonField(nora.id, 'acct_name', 'Nora Q. Ntest');
  api.setPersonField(nora.id, 'acct_type', '1099');
  api.setPersonField(nora.id, 'acct_note', 'On leave');
  api.setPersonField(nora.id, 'acct_file', 'always');
  api.setPersonField(zed.id, 'acct_type', 'W2');
  api.setPersonField(zed.id, 'acct_file', 'Always');
  assert.equal(api.session.roster.byId[nora.id].acct_file, 'Always');
  const r = rowsOf(api);
  const n = r.find(x => x.name === 'Nora Q. Ntest');
  assert.ok(n, 'Not paid this week, still on the file');
  assert.deepEqual([n.ent, n.type, n.note, n.reg, n.ot, n.rate, n.salary, n.bonus, n.gross], ['Beta Test', '1099', 'On leave', 0, 0, 0, 0, 0, 0]);
  const z = r.find(x => x.name === 'Zed Ztest');
  assert.ok(z, 'an hourly person with no hours and no row: a $0 line');
  assert.deepEqual([z.ent, z.type, z.gross], ['Alpha Test', 'W2', 0], 'in the section of their Deposit Entity');
  // Someone already on the file is not listed twice; a Cash person gets a $0 line.
  api.setPersonField(idOf(api, 0, 'Avery Atest'), 'acct_file', 'Always');
  api.setPersonField(idOf(api, 0, 'Bram Btest'), 'acct_file', 'Always');
  const r2 = rowsOf(api);
  assert.equal(r2.filter(x => x.name === 'Avery Atest').length, 1);
  assert.deepEqual(r2.filter(x => x.name === 'Bram Btest').map(x => [x.ent, x.gross]), [['Alpha Test', 0]]);
  // Totals and pay unchanged; the file checks out and ties.
  assert.equal(grand(api), before);
  assert.deepEqual(payTotals(api), pay, 'pay is unchanged');
  assert.ok(api.acctSelfCheck().ok, api.acctSelfCheck().problems.join('; '));
  assert.ok(api.acctTieOut().every(t => t.ok));
  // An inactive person set to Always (a former employee) is listed at $0 too.
  api.setRosterActive(1, 'Fern Ftest', false);
  api.setPersonField(idOf(api, 1, 'Fern Ftest'), 'acct_file', 'Always');
  assert.deepEqual(rowsOf(api).filter(x => x.name === 'Fern Ftest').map(x => [x.ent, x.gross]), [['Beta Test', 0]]);
});

test('test_always_zero_line_in_excel_pdf_and_preview', async () => {
  const { api, nora } = withZeroPeople();
  api.setPersonField(nora.id, 'acct_file', 'Always');
  completeAccountant(api);
  await api.exportAccountantFile();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  const at = (t) => ws.rows.findIndex(r => r && r[1] && r[1].value === t);
  const col = (k) => api.ACCT_COLS.findIndex(c => c[0] === k) + 1;
  const nr = at('Nora Ntest');
  assert.ok(nr > at('BETA TEST') && nr < at('BETA TEST TOTAL'), 'in the Beta Test section');
  const g = ws.rows[nr][col('gross')];
  assert.equal(xlNum(g), 0);
  assert.equal(g.numFmt, '$#,##0.00', 'printed as $0.00, not blank');
  assert.equal(xlNum(ws.rows[at('BETA TEST TOTAL')][col('gross')]), 320, 'the entity total is unchanged');
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, []);
  // PDF
  const orig = api.__sandbox.window.jspdf.jsPDF;
  api.__sandbox.window.jspdf = { jsPDF: function (o) { const d = orig(o); d.save = () => {}; return d; } };
  await api.exportAccountantPdf();
  const body = pdfBody(api).map(pdfRowText);
  assert.equal(body.find(r => r[0] === 'Nora Ntest')[7], '$0.00');
  // The export preview: Show "Accountant file".
  api.setPreviewKey('accountant');
  const m = api._fc13PreviewModel();
  assert.ok(m.acct);
  const row = m.rows.find(r => r.kind === 'data' && r.cells[0] === 'Nora Ntest');
  assert.equal(row.cells[col('gross') - 1], '$0.00');
  assert.ok(m.rows.some(r => r.kind === 'band' && r.cells[0] === 'BETA TEST'));
  api.renderFc00013PreviewPanel();
  const h = api.__sandbox.document.getElementById('fc13PreviewHost').innerHTML;
  assert.match(h, /<option value="accountant" selected>Accountant file<\/option>/);
  assert.match(h, /Nora Ntest/);
  assert.doesNotMatch(h, /Make editable copy/, 'the scratch copy is for the payroll report');
  api.setPreviewKey('payroll');
  assert.ok(!api._fc13PreviewModel().acct, 'back to the payroll report');
});

test('test_never_hides_a_deposit_person_and_the_check_explains_it', () => {
  const api = setup();
  const pay = payTotals(api);
  const avery = rowsOf(api).find(x => x.name === 'Avery Atest');
  api.setPersonField(idOf(api, 0, 'Avery Atest'), 'acct_file', 'Never');
  assert.ok(!rowsOf(api).some(x => x.name === 'Avery Atest'), 'left off, even with a deposit');
  const t = api.acctTieOut().find(x => x.entityName === 'Alpha Test');
  assert.ok(t.ok, 'not a failure');
  assert.equal(t.never, avery.deposit);
  assert.deepEqual(t.neverList.map(x => x.name), ['Avery Atest']);
  assert.equal(t.payrollDeposit, Math.round((t.deposit + avery.deposit) * 100) / 100);
  api.renderDownloadsPanel();
  const html = api.__sandbox.document.getElementById('downloadsHost').innerHTML;
  assert.ok(html.includes('✓ Alpha Test: Gross Total ' + api._fmtUsd(t.gross) + ' matches this week\'s payroll deposits ' + api._fmtUsd(t.payrollDeposit) + ', less ' + api._fmtUsd(avery.deposit) + ' not on the accountant file (Never: Avery Atest)'), html.match(/acct-tie[^<]*Alpha[^<]*/));
  assert.ok(!api._acctStatusReasons().some(x => /does not match/.test(x)));
  // Every deposit person of an entity set to Never: the entity is still checked, at $0.
  api.setPersonField(idOf(api, 1, 'Fern Ftest'), 'acct_file', 'Never');
  const b = api.acctTieOut().find(x => x.entityName === 'Beta Test');
  assert.deepEqual([b.gross, b.ok, b.never], [0, true, 320]);
  assert.ok(!api.acctFileModel().entities.some(e => e.entityName === 'Beta Test'));
  // The preview names who is left off.
  api.setPreviewKey('accountant');
  api.renderFc00013PreviewPanel();
  assert.match(api.__sandbox.document.getElementById('fc13PreviewHost').innerHTML, /Not on the accountant file \(On accountant file: Never, on the Employee Register\): Avery Atest \$525\.00, Fern Ftest \$320\.00/);
  assert.deepEqual(payTotals(api), pay, 'pay is unchanged');
});

test('test_register_dropdown_history_and_undo', () => {
  const api = setup();
  const a = idOf(api, 0, 'Avery Atest');
  const other = api.regToggleEntity(a, 1, true); // Avery also works at Beta Test
  api.setTab('register');
  let h = api.__sandbox.document.getElementById('registerHost').innerHTML;
  assert.match(h, /<th>Type<\/th><th>On accountant file<\/th><th>Rate<\/th>/);
  assert.ok(h.includes(`setPersonField('${a}','acct_file',this.value)`));
  api.setPersonField(a, 'acct_file', 'Never');
  assert.deepEqual([api.session.roster.byId[a].acct_file, api.session.roster.byId[other.id].acct_file], ['Never', 'Never'], 'one value per person');
  const lines = api.session.log.filter(e => e.type === 'rosterFieldSet' && e.target.field === 'acct_file');
  assert.deepEqual(lines.map(e => api._historyField(e)), ['On accountant file', 'On accountant file']);
  h = api.__sandbox.document.getElementById('registerHost').innerHTML;
  assert.match(h, /<option value="Never" selected>Never<\/option>/);
  api.undoCheckpoint();
  assert.equal(api.session.roster.byId[a].acct_file, undefined, 'one Undo step');
  assert.equal(api.session.roster.byId[other.id].acct_file, undefined);
  // Always shows the Accountant Name box for someone not paid by deposit.
  const bram = idOf(api, 0, 'Bram Btest');
  const bramShows = () => api.registerPeople().find(p => p.id === bram).showAcct;
  assert.equal(bramShows(), false);
  api.setPersonField(bram, 'acct_file', 'Always');
  assert.equal(bramShows(), true);
});

test('test_round_trip_through_the_register_file_and_older_file_is_auto', async () => {
  const api = setup();
  api.setPersonField(idOf(api, 0, 'Bram Btest'), 'acct_file', 'Always');
  api.setPersonField(idOf(api, 0, 'Avery Atest'), 'acct_file', 'Never');
  await api.exportPayrollSettingsExcel(false);
  const wb = api.__lastExcelWorkbook;
  const ps = wb.worksheets.find(w => w.name === 'Payroll Settings');
  const hi = ps.rows.findIndex(r => r && r[1] && r[1].value === 'Entity');
  const head = ps.rows[hi].slice(1).map(c => c.value);
  assert.equal(head.at(-1), 'On Accountant File', 'appended at the end');
  assert.deepEqual(head.slice(-4, -1), ['Deposit Entity', 'Full Name', 'Display Name']);
  const ci = head.length;
  const cellOf = (n) => { const r = ps.rows.find(x => x && x[2] && x[2].value === n); return r[ci] ? r[ci].value : ''; };
  assert.deepEqual(['Bram Btest', 'Avery Atest', 'Cora Ctest'].map(cellOf), ['Always', 'Never', ''], 'blank = Auto');
  const b = setup();
  b.importPayrollSettingsFile(loadBack(b, wb, 'Employee_Register.xlsx'), false);
  const diffs = b.getStaged().preview.changes.flatMap(c => c.diffs.map(d => [c.name, d.label, d.to]));
  assert.ok(diffs.some(d => d[0] === 'Bram Btest' && d[1] === 'On accountant file' && d[2] === 'Always'), JSON.stringify(diffs));
  b.applyStagedSettings();
  assert.equal(b.session.roster.byId[b.wKey(0, 'Bram Btest')].acct_file, 'Always');
  assert.equal(b.session.roster.byId[b.wKey(0, 'Avery Atest')].acct_file, 'Never');
  assert.equal(b.session.roster.byId[b.wKey(0, 'Cora Ctest')].acct_file, undefined);
  assert.ok(!rowsOf(b).some(x => x.name === 'Avery Atest'));
  assert.ok(rowsOf(b).some(x => x.name === 'Bram Btest'));
  // Saved again: the same cells.
  await b.exportPayrollSettingsExcel(false);
  const ps2 = b.__lastExcelWorkbook.worksheets.find(w => w.name === 'Payroll Settings');
  const col = (sheet) => sheet.rows.filter(Boolean).map(r => r[ci] && r[ci].value).slice(4);
  assert.deepEqual(col(ps2), col(ps));
  // An older register: no On Accountant File column. Everyone loads as Auto.
  ps.rows.forEach(r => { if (r && r.length > ci) r.length = ci; });
  const c = setup();
  c.importPayrollSettingsFile(loadBack(c, wb, 'Employee_Register.xlsx'), false);
  c.applyStagedSettings();
  assert.ok(Object.values(c.session.roster.byId).every(r => r.acct_file === undefined));
  assert.deepEqual(model(c), model(setup()), 'the same accountant file as before');
});

test('test_snapshot_keeps_the_choice', async () => {
  const api = setup();
  api.setPersonField(idOf(api, 0, 'Bram Btest'), 'acct_file', 'Always');
  const snap = await api.buildSnapshot();
  const b = setup();
  b.openSnapshotData(JSON.parse(JSON.stringify(snap)), 'snap');
  assert.equal(b.session.roster.byId[b.wKey(0, 'Bram Btest')].acct_file, 'Always');
  assert.ok(rowsOf(b).some(x => x.name === 'Bram Btest' && x.gross === 0));
});
