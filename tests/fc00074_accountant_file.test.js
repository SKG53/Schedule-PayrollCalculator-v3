// FC-00074: the accountant's weekly file, written by the tool in the accountant's own layout:
// everyone paid by deposit (Deposit hours with Over time, Deposit + Cash as Salary = the deposit
// part, Executive PR as Salary = the weekly amount), by section, with the deposit pay date.
// Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { xlNum, xlFormulaMismatches } = require('./xl-helpers');
const { setup } = require('./fc70-helpers');

function withCf(api) {
  const W = api.__sandbox.ExcelJS.Workbook, orig = W.prototype.addWorksheet;
  W.prototype.addWorksheet = function (n) { const ws = orig.call(this, n); ws.cf = []; ws.addConditionalFormatting = (x) => ws.cf.push(x); return ws; };
}

test('test_only_deposit_people_by_section', () => {
  const api = setup({ exec: true });
  const M = api.acctFileModel();
  assert.deepEqual(M.sections.map(s => s.name), ['ALPHA VENTURES', 'BETA VENTURES'], 'default section: first word + VENTURES');
  const alpha = M.sections[0].rows;
  assert.deepEqual(alpha.map(r => r.name), ['Avery Atest', 'Cora Ctest', 'Eden Etest', 'Gale Gtest'], 'A–Z; no Cash, no Contract Check');
  const by = (n) => alpha.find(r => r.name === n);
  assert.deepEqual([by('Avery Atest').hours, by('Avery Atest').ot, by('Avery Atest').rate, by('Avery Atest').salary, by('Avery Atest').gross], [40, 2.5, 12, 0, 525]);
  assert.deepEqual([by('Cora Ctest').hours, by('Cora Ctest').rate, by('Cora Ctest').salary, by('Cora Ctest').kind], [0, 0, 300, 'split']);
  assert.deepEqual([by('Gale Gtest').salary, by('Gale Gtest').kind], [900, 'exec']);
  assert.equal(M.period, '08-09-26 to 08-15-26');
  api.setRosterActive(0, 'Eden Etest', false);
  assert.ok(!api.acctFileModel().sections[0].rows.some(r => r.name === 'Eden Etest'), 'inactive people are left off');
});

test('test_layout_like_the_accountants', async () => {
  const api = setup({ exec: true });
  withCf(api);
  api.setPayDateByHand('deposit', '2026-08-20');
  api.setAcctField(0, 'Gale Gtest', 'acct_type', '1099');
  api.setAcctField(0, 'Gale Gtest', 'acct_note', 'Standing note');
  api.setAcctField(0, 'Avery Atest', 'acct_name', 'Avery Q. Atest');
  await api.exportAccountantFile();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  assert.equal(ws.name, 'Sheet2');
  const v = (r, c) => ws.rows[r] && ws.rows[r][c] ? ws.rows[r][c].value : undefined;
  assert.deepEqual([v(1, 2), v(1, 3), v(1, 4)], ['Pay Period', '08-09-26 to 08-15-26', 'Pay date']);
  assert.equal(v(1, 5), (Date.UTC(2026, 7, 20) - Date.UTC(1899, 11, 30)) / 86400000); assert.equal(ws.rows[1][5].numFmt, 'mm-dd-yy');
  assert.equal(v(3, 2), 'ALPHA VENTURES');
  assert.ok(ws.merges.some(([r1, c1, r2, c2]) => r1 === 3 && r2 === 3 && c1 === 2 && c2 === 10), 'title spans B–J');
  assert.equal(ws.rows[3][2].fill.fgColor.argb, 'FFFFD966');
  assert.deepEqual(ws.rows[4].slice(2, 11).map(c => c.value), ['Employee ID', 'Employee Name', 'EMPLOYMENT TYPE', 'Hours', 'Over time', 'Pay Rate', 'Salary', 'Gross Total', 'Notes']);
  assert.deepEqual([v(4, 16), v(4, 17), v(4, 18)], ['Overtime rate', 'Regular Amount', 'Overtime Amount']);
  const avery = ws.rows.findIndex(r => r && r[3] && r[3].value === 'Avery Q. Atest');
  assert.deepEqual([v(avery, 2), v(avery, 4), v(avery, 5), v(avery, 6), v(avery, 7), v(avery, 8)], ['', 'W2', 40, 2.5, 12, 0]);
  assert.equal(v(avery, 9).formula, '+H' + avery + '+Q' + avery + '+R' + avery);
  assert.equal(xlNum(ws.rows[avery][9]), 525);
  assert.equal(v(avery, 16).formula, '+G' + avery + '*1.5'); assert.equal(v(avery, 17).formula, '+E' + avery + '*G' + avery); assert.equal(v(avery, 18).formula, '+P' + avery + '*F' + avery);
  const gale = ws.rows.findIndex(r => r && r[3] && r[3].value === 'Gale Gtest');
  assert.deepEqual([v(gale, 4), v(gale, 8), v(gale, 10)], [1099, 900, 'Standing note'], '1099 is written as a number, like the accountant\'s');
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, [], 'every formula gives the cached value');
  assert.match(ws.rows[avery][5].numFmt, /#,##0\.00/);
  assert.equal(ws.colWidths[10], 78.7109375);
  assert.ok(ws.cf.some(x => /^B4:J/.test(x.ref) && x.rules[0].formulae[0] === 'MOD(ROW(),2)=0'), 'banded rows');
  const beta = ws.rows.findIndex(r => r && r[2] && r[2].value === 'BETA VENTURES');
  assert.ok(beta > gale + 2, 'two blank rows between sections');
  const total = ws.rows.reduce((s, r) => s + (r && r[9] && r[9].value && r[9].value.formula ? r[9].value.result : 0), 0);
  assert.equal(Math.round(total * 100) / 100, 525 + 300 + 532 + 900 + 320, 'the file adds up to every deposit');
});

test('test_order_and_bonus_follow_their_file', async () => {
  const api = setup();
  api.setAcctFile({ fileName: 'x.xlsx', period: '', payDate: '', sections: [{ name: 'ALPHA VENTURES', entityId: 0, rows: [{ name: 'Eden Etest' }, { name: 'Cora Ctest' }] }],
    bonus: { width: 4, rows: [[null, 'ALPHA BONUS', null, null], [null, '#', 'EMPLOYEE NAME', 'MONTHLY BONUS'], [null, null, 'EDEN ETEST', 'Same as every month'], [null, null, 'Total Monthly Bonus', 0]] } });
  assert.deepEqual(api.acctFileModel().sections[0].rows.map(r => r.name), ['Eden Etest', 'Cora Ctest', 'Avery Atest'], 'their order, then new people A–Z');
  await api.exportAccountantFile();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const b = ws.rows.findIndex(r => r && r[2] && r[2].value === 'ALPHA BONUS');
  assert.ok(b > 0);
  assert.deepEqual([ws.rows[b + 2][3].value, ws.rows[b + 2][4].value], ['EDEN ETEST', 'Same as every month'], 'carried as it was');
  assert.ok(ws.merges.some(([r1, c1, r2, c2]) => r1 === b && c1 === 2 && c2 === 4));
});

test('test_card_batch_and_status', () => {
  const api = setup();
  assert.deepEqual(api.downloadFileNames('accountant'), ['Alpha_Beta_0809to0815_AccountantFile.xlsx'.replace('Alpha_Beta', api.downloadFileNames('snapshot')[0].replace(/_0809to0815_Snapshot\.json$/, ''))]);
  const st = api.downloadStatus('accountant');
  assert.equal(st.ok, false);
  assert.ok(st.reasons.includes('Deposit pay date not set: load the accountant\'s file or set it below'), st.reasons.join(' | '));
  assert.ok(st.reasons.includes('The accountant\'s file is not loaded: nothing to check against'));
  assert.ok(st.reasons.some(x => /^Employment type not set \(W2 used\): /.test(x)));
  api.renderDownloadsPanel();
  const html = api.__sandbox.document.getElementById('downloadsHost').innerHTML;
  assert.match(html, /<h3>Accountant file<\/h3>/);
  assert.match(html, /Load the accountant's file…/);
  assert.match(html, /onchange="setPayDateByHand\('deposit',this.value\)"/);
  assert.match(html, /class="history-table acct-table"/);
});

test('test_no_deposit_people_no_file', async () => {
  const api = setup();
  ['Avery Atest', 'Cora Ctest', 'Eden Etest'].forEach(n => { api.payMethod[api.wKey(0, n)] = 'cash'; });
  api.payMethod[api.wKey(1, 'Fern Ftest')] = 'cash';
  assert.equal(api.acctFileModel().sections.length, 0);
  assert.deepEqual(api.downloadStatus('accountant').reasons, ['No one is paid by deposit this week']);
  const before = api.__lastExcelWorkbook;
  await api.exportAccountantFile();
  assert.equal(api.__lastExcelWorkbook, before, 'no file is written');
});
