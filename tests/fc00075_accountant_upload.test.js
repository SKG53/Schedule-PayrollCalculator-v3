// FC-00075: load the accountant's file — every row is matched to a person (asked once, then
// remembered), the deposit pay date and employment types are taken from it, and every difference
// between their file and ours is listed. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./fc70-helpers');

const serial = (iso) => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000;
const HDR = [null, 'Employee ID', 'Employee Name', 'EMPLOYMENT TYPE', 'Hours', 'Over time', 'Pay Rate', 'Salary', 'Gross Total', 'Notes', null, null, null, null, null, 'Overtime rate', 'Regular Amount', 'Overtime Amount'];
const row = (name, type, hours, ot, rate, salary, note) => [null, null, name, type, hours, ot, rate, salary, salary + hours * rate, note, null, null, null, null, null, rate * 1.5, hours * rate, ot * rate * 1.5];
function theirFile(o) {
  o = o || {};
  return [
    [null, 'Pay Period', o.period || '08-09-26 to 08-15-26', 'Pay date', serial(o.payDate || '2026-08-20')],
    [],
    [null, 'ALPHA VENTURES'],
    HDR,
    row('Avery Atest', 'W2', o.averyHours || 0, o.averyOt || 0, 12, 0, 'Note A'),
    row('Cora', 'W2', 0, 0, 0, 300, ''),
    row('Gale G', 1099, 0, 0, 0, 900, 'Net amount is $ 0.00'),
    row('Eden Etest', 'W2', 0, 0, 13, 0, 0),
    row('Old Person', 'W2', 0, 0, 11, 0, 'No longer an employee, please remove'),
    [null, null, null, null, 0, 0, 0, 0, 0, null, null, null, null, null, null, 0, 0, 0],
    [], [],
    [null, 'BETA VENTURES'],
    HDR,
    row('Fern Ftest', 1099, 0, 0, 16, 0, ''),
    row('Dane Dtest', 'W2', 0, 0, 15, 0, ''),
    [],
    [null, 'ALPHA BONUS'],
    [null, '#', 'EMPLOYEE NAME', 'MONTHLY BONUS'],
    [],
    [null, null, 'AVERY ATEST', 'Same as every month'],
    [null, null, 'Total Monthly Bonus', 0],
  ];
}
const sec = (api, name) => api.getAcctFile().sections.findIndex(s => s.name === name);
const rowIdx = (api, s, name) => api.getAcctFile().sections[s].rows.findIndex(r => r.name === name);

test('test_parse_reads_sections_rows_and_bonus', () => {
  const api = setup();
  const p = api.parseAccountantRows(theirFile());
  assert.equal(p.period, '08-09-26 to 08-15-26');
  assert.equal(p.payDate, '2026-08-20');
  assert.deepEqual(p.sections.map(s => [s.name, s.rows.map(r => r.name)]), [['ALPHA VENTURES', ['Avery Atest', 'Cora', 'Gale G', 'Eden Etest', 'Old Person']], ['BETA VENTURES', ['Fern Ftest', 'Dane Dtest']]], 'the spare row is skipped');
  const a = p.sections[0].rows;
  assert.deepEqual([a[2].type, a[2].salary, a[3].rate, a[3].note], ['1099', 900, 13, ''], '1099 as a number; a 0 note is no note');
  assert.equal(p.bonus.rows.length, 5); assert.equal(p.bonus.width, 4);
  assert.equal(p.bonus.rows[3][2], 'AVERY ATEST');
  assert.equal(api._acctDateIso('11-12-26'), '2026-11-12');
});

test('test_apply_takes_pay_date_types_names_and_first_notes', () => {
  const api = setup();
  const f = api.applyAccountantFile(api.parseAccountantRows(theirFile()), 'their.xlsx');
  assert.ok(f);
  assert.deepEqual(api.payDates().deposit, { iso: '2026-08-20', src: 'file' });
  assert.deepEqual(api._acctSectionList().map(x => x.name), ['ALPHA VENTURES', 'BETA VENTURES'], 'section order saved (settings file)');
  assert.equal(api.getAcctField(0, 'Avery Atest', 'acct_name'), 'Avery Atest');
  assert.equal(api.getAcctField(0, 'Avery Atest', 'acct_type'), 'W2');
  assert.equal(api.getAcctField(0, 'Avery Atest', 'acct_note'), 'Note A', 'a person never given a note takes theirs');
  assert.equal(api.getAcctField(1, 'Fern Ftest', 'acct_type'), '1099');
  // Undo puts it all back.
  api.undoCheckpoint();
  assert.equal(api.payDates().deposit, null);
  assert.equal(api.getAcctFile(), null, 'the file is forgotten too');
  assert.equal(api.getAcctField(0, 'Avery Atest', 'acct_note'), '');
});

test('test_unmatched_rows_asked_once_and_remembered', () => {
  const api = setup();
  api.applyAccountantFile(api.parseAccountantRows(theirFile()), 'their.xlsx');
  let c = api.acctCompare();
  const un = c.unmatched.map(u => [u.section, u.name, u.suggest ? api.session.roster.byId[u.suggest].canonical_name : '']);
  assert.deepEqual(un, [['ALPHA VENTURES', 'Cora', 'Cora Ctest'], ['ALPHA VENTURES', 'Gale G', ''], ['ALPHA VENTURES', 'Old Person', ''], ['BETA VENTURES', 'Dane Dtest', 'Dane Dtest']]);
  const a = sec(api, 'ALPHA VENTURES');
  assert.equal(api.acctMatchRow(a, rowIdx(api, a, 'Cora'), api.wKey(0, 'Cora Ctest')), true);
  assert.equal(api.getAcctField(0, 'Cora Ctest', 'acct_name'), 'Cora');
  c = api.acctCompare();
  assert.ok(!c.unmatched.some(u => u.name === 'Cora'));
  // Next week's file matches by itself.
  api.applyAccountantFile(api.parseAccountantRows(theirFile()), 'next.xlsx');
  assert.ok(!api.acctCompare().unmatched.some(u => u.name === 'Cora'));
  assert.equal(api.acctFileModel().sections[0].rows.find(r => r.empName === 'Cora Ctest').name, 'Cora', 'our file uses their spelling');
});

test('test_add_as_executive_pr_and_cross_section', () => {
  const api = setup();
  api.applyAccountantFile(api.parseAccountantRows(theirFile()), 'their.xlsx');
  const a = sec(api, 'ALPHA VENTURES'), b = sec(api, 'BETA VENTURES');
  assert.equal(api.acctMatchRow(a, rowIdx(api, a, 'Gale G'), '__exec__'), true);
  const k = api.wKey(0, 'Gale G');
  assert.equal(api.payMethod[k], 'exec'); assert.equal(api.flatWages[k], 900);
  assert.equal(api.getAcctField(0, 'Gale G', 'acct_type'), '1099');
  assert.equal(api.getAcctField(0, 'Gale G', 'acct_note'), 'Net amount is $ 0.00');
  assert.ok(api.acctFileModel().sections[0].rows.some(r => r.name === 'Gale G' && r.kind === 'exec' && r.salary === 900));
  // Someone filed under another entity's section.
  assert.equal(api.acctMatchRow(b, rowIdx(api, b, 'Dane Dtest'), api.wKey(0, 'Dane Dtest')), true);
  assert.equal(api.getAcctField(0, 'Dane Dtest', 'acct_section'), 'BETA VENTURES');
  api.payMethod[api.wKey(0, 'Dane Dtest')] = 'deposit';
  const M = api.acctFileModel();
  assert.ok(M.sections.find(s => s.name === 'BETA VENTURES').rows.some(r => r.empName === 'Dane Dtest'), 'filed under BETA VENTURES');
  assert.ok(!M.sections.find(s => s.name === 'ALPHA VENTURES').rows.some(r => r.empName === 'Dane Dtest'));
});

test('test_differences_listed', () => {
  const api = setup();
  api.applyAccountantFile(api.parseAccountantRows(theirFile()), 'their.xlsx');
  const a = sec(api, 'ALPHA VENTURES'), b = sec(api, 'BETA VENTURES');
  api.acctMatchRow(a, rowIdx(api, a, 'Cora'), api.wKey(0, 'Cora Ctest'));
  api.acctMatchRow(a, rowIdx(api, a, 'Gale G'), '__exec__');
  api.acctMatchRow(a, rowIdx(api, a, 'Old Person'), '__skip__');
  api.acctMatchRow(b, rowIdx(api, b, 'Dane Dtest'), api.wKey(0, 'Dane Dtest'));
  const c = api.acctCompare();
  assert.equal(c.unmatched.length, 0);
  const of = (n) => c.rows.find(x => x.name === n);
  assert.deepEqual(of('Eden Etest').items, ['Pay rate: accountant $13.00, tool $14.00']);
  assert.equal(of('Old Person').kind, 'skip');
  assert.match(of('Dane Dtest').items[0], /^On the accountant's file, not on ours: paid Contract Check in the tool/);
  assert.ok(!of('Avery Atest') && !of('Fern Ftest') && !of('Cora'), 'matching rows are not listed');
  assert.equal(c.count, 2, 'Eden and Dane (a skip is not counted)');
  // A note the owner changed is listed, with "Use theirs".
  api.setAcctField(0, 'Avery Atest', 'acct_note', 'Ours now');
  const n = api.acctCompare().rows.find(x => x.name === 'Avery Atest');
  assert.deepEqual(n.note, { theirs: 'Note A', ours: 'Ours now' });
  api.renderDownloadsPanel();
  assert.match(api.__sandbox.document.getElementById('downloadsHost').innerHTML, /Note: accountant "Note A", ours "Ours now" <button class="mini-btn" onclick="acctUseTheirNote\(\d+,0\)">Use theirs<\/button>/);
  assert.equal(api.acctUseTheirNote(a, 0), true);
  assert.equal(api.getAcctField(0, 'Avery Atest', 'acct_note'), 'Note A');
  // Ours but not theirs.
  api.setRosterActive(0, 'Eden Etest', true);
  api.ensureIntakeState(api.entities[1]);
  api.addNewEmployee(1, 'Hale Htest', null, { method: 'exec', flat: 400 });
  assert.deepEqual(api.acctCompare().missing.map(x => [x.section, x.name, x.kind]), [['BETA VENTURES', 'Hale Htest', 'exec']]);
});

test('test_period_pay_date_and_hours_checked', () => {
  const api = setup();
  api.setPayDateByHand('deposit', '2026-08-19');
  api.applyAccountantFile(api.parseAccountantRows(theirFile({ period: '08-02-26 to 08-08-26', averyHours: 40, averyOt: 2 })), 'their.xlsx');
  assert.deepEqual(api.payDates().deposit, { iso: '2026-08-19', src: 'hand' }, 'a date set by hand is kept');
  const c = api.acctCompare();
  assert.deepEqual(c.period, { file: '08-02-26 to 08-08-26', ours: '08-09-26 to 08-15-26' });
  assert.deepEqual(c.payDate, { file: '2026-08-20', ours: '2026-08-19', src: 'hand' });
  assert.deepEqual(c.rows.find(x => x.name === 'Avery Atest').items, ['Hours: accountant 40.00 + 2.00 over time, ours 40.00 + 2.50 over time']);
});

test('test_status_snapshot_and_clear', async () => {
  const api = setup();
  api.applyAccountantFile(api.parseAccountantRows(theirFile()), 'their.xlsx');
  assert.ok(api.downloadStatus('accountant').reasons.some(x => /things? to look at against the accountant's file/.test(x)));
  const snap = JSON.parse(JSON.stringify(await api.buildSnapshot()));
  assert.equal(snap.parts.acctFile.fileName, 'their.xlsx');
  const b = setup();
  b.openSnapshotData(snap, 'snap');
  assert.equal(b.getAcctFile().fileName, 'their.xlsx', 'the loaded file comes back with the snapshot');
  api.clearAccountantFile();
  assert.equal(api.acctCompare(), null);
  assert.equal(api.applyAccountantFile({ sections: [] }, 'x'), null, 'not an accountant file');
});
