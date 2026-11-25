// FC-00084: people paid without a schedule (weekly amount carried over from last week's register,
// kept, changed or not paid this week); the accountant section moves to the Employee Register tab
// and the Accountant file card. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, rowOf } = require('./fc70-helpers');

const NEXT = ['Aug 16 2026', 'Aug 17 2026', 'Aug 18 2026', 'Aug 19 2026', 'Aug 20 2026', 'Aug 21 2026', 'Aug 22 2026'];
const nextWeek = (api) => api.entities.forEach(e => { e.dateLabels = NEXT.slice(); });

// A workbook the tool wrote, handed back to the tool as if loaded from disk.
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
const recOf = (api, ent, name) => api.noSchedRecords().find(r => r.entity === ent && r.canonical_name === name);

test('test_add_and_pay_by_each_method', () => {
  const api = setup();
  const before = api._collectExportData().flatMap(d => d.rows).length;
  api.addNoSchedPerson(0, 'Lark', 'Ltest', { amount: 500, method: 'deposit', mgmt: true });
  api.addNoSchedPerson(0, 'Mira', 'Mtest', { amount: 300, method: 'cash' });
  api.addNoSchedPerson(1, 'Nell', 'Ntest', { amount: '600', method: 'both', deposit: 400 });
  api.addNoSchedPerson(1, 'Opal', 'Otest', { amount: 250, method: 'contract' });
  assert.equal(api.noSchedRecords().length, 4);
  assert.equal(api._collectExportData().flatMap(d => d.rows).length, before + 4, 'paid with no schedule row');
  const l = rowOf(api, 'Lark Ltest');
  assert.equal(l._breakdown.actualFinal, 500); assert.equal(l._breakdown.deposit, 500); assert.equal(l.actualHours, 0);
  assert.ok(api.isManagement(0, 'Lark Ltest'));
  assert.equal(rowOf(api, 'Mira Mtest')._breakdown.cash, 300);
  const n = rowOf(api, 'Nell Ntest')._breakdown;
  assert.equal(n.deposit, 400); assert.equal(n.cash, 200);
  assert.equal(rowOf(api, 'Opal Otest')._breakdown.method, 'contract');
  assert.match(api.tngOf(0, 'Lark Ltest'), /^$|^TNG\d{5}$/);
  assert.equal(api.entities[0].employees.some(e => e.name === 'Lark Ltest'), false, 'not put on the schedule');
  // A new person is "New this week"; nothing to check yet.
  assert.equal(api.noSchedStatus(recOf(api, 0, 'Lark Ltest')).state, 'new');
  assert.equal(api.noSchedUnchecked().length, 0);
});

test('test_someone_on_the_schedule_is_refused', () => {
  const api = setup();
  const said = []; api.__sandbox.alert = (m) => said.push(m);
  assert.equal(api.addNoSchedPerson(0, 'Avery', 'Atest', { amount: 100 }), null);
  assert.match(said[0], /is on this week's Alpha Test schedule/);
  assert.equal(api.addNoSchedPerson(0, 'Lark', 'Ltest', { amount: '' }), null, 'an amount is required');
});

test('test_management_block_and_accountant_file', () => {
  const api = setup();
  api.addNoSchedPerson(0, 'Lark', 'Ltest', { amount: 500, method: 'deposit', mgmt: true });
  const l = rowOf(api, 'Lark Ltest');
  assert.ok(api._reportIsMgmt(l), 'prints under Management');
  const m = api.acctFileModel();
  const line = m.entities.flatMap(e => e.rows).find(r => r.empName === 'Lark Ltest');
  assert.equal(line.salary, 500); assert.equal(line.gross, 500); assert.ok(line.mgmt);
  assert.ok(api.acctSelfCheck().ok);
  assert.ok(api.acctTieOut().every(t => t.ok), 'Gross Total still ties to the deposits');
});

test('test_carry_over_keep_change_and_not_paid', async () => {
  const api = setup();
  api.addNoSchedPerson(0, 'Lark', 'Ltest', { amount: 500, method: 'deposit', mgmt: true });
  await api.exportPayrollSettingsExcel(false);
  const wb = api.__lastExcelWorkbook;
  const ps = wb.worksheets.find(w => w.name === 'Payroll Settings');
  const hdr = ps.rows.find(r => r && r.some(c => c && c.value === 'Paid Without Schedule')).map(c => c && c.value);
  const row = ps.rows.find(r => r && r.some(c => c && c.value === 'Lark Ltest')).map(c => c && c.value);
  assert.equal(row[hdr.indexOf('Paid Without Schedule')], 'Yes');
  assert.equal(row[hdr.indexOf('Last Paid')], 500);
  assert.equal(row[hdr.indexOf('Last Paid Week')], '2026-08-09');

  // Next week: last week's register with this week's schedules.
  const b = setup(); nextWeek(b);
  b.importPayrollSettingsFile(loadBack(b, wb, 'Employee_Register.xlsx'), false);
  b.applyStagedSettings();
  const rec = recOf(b, 0, 'Lark Ltest');
  assert.ok(rec, 'still paid without a schedule');
  assert.equal(b.noSchedStatus(rec).state, 'unchecked');
  assert.equal(b.noSchedStatusText(rec), 'Same as last week ($500.00): keep or change');
  assert.equal(rowOf(b, 'Lark Ltest')._breakdown.actualFinal, 500, 'paid last week\'s amount until changed');
  assert.match(b._nsReminderText(), /^1 person paid without a schedule not yet checked this week$/);
  b.keepNoSched(rec.id);
  assert.equal(b.noSchedStatus(rec).state, 'kept');
  assert.equal(b._nsReminderText(), '');
  b.setNoSchedAmount(rec.id, '550');
  assert.equal(b.noSchedStatusText(rec), 'Changed from $500.00');
  assert.equal(rowOf(b, 'Lark Ltest')._breakdown.actualFinal, 550);
  b.setNoSchedSkip(rec.id, true);
  assert.equal(b.noSchedStatus(rec).state, 'skip');
  assert.equal(rowOf(b, 'Lark Ltest'), undefined, 'not paid this week: on no report');
  assert.equal(b.acctFileModel().entities.flatMap(e => e.rows).some(r => r.empName === 'Lark Ltest'), false);
  // Saved: last paid 0 this week; the amount is kept for the week after.
  await b.exportPayrollSettingsExcel(false);
  const wb2 = b.__lastExcelWorkbook;
  const ps2 = wb2.worksheets.find(w => w.name === 'Payroll Settings');
  const row2 = ps2.rows.find(r => r && r.some(c => c && c.value === 'Lark Ltest')).map(c => c && c.value);
  assert.equal(row2[hdr.indexOf('Last Paid')], 0);
  assert.equal(row2[hdr.indexOf('Flat Amount')], 550);
  assert.equal(row2[hdr.indexOf('Last Paid Week')], '2026-08-16');
  // The week after: paid again at the kept amount, waiting to be checked.
  const c = setup(); c.entities.forEach(e => { e.dateLabels = ['Aug 23 2026', 'Aug 24 2026', 'Aug 25 2026', 'Aug 26 2026', 'Aug 27 2026', 'Aug 28 2026', 'Aug 29 2026']; });
  c.importPayrollSettingsFile(loadBack(c, wb2, 'Employee_Register.xlsx'), false);
  c.applyStagedSettings();
  const r3 = recOf(c, 0, 'Lark Ltest');
  assert.equal(c.noSchedStatus(r3).state, 'unchecked');
  assert.equal(rowOf(c, 'Lark Ltest')._breakdown.actualFinal, 550);
});

test('test_same_week_register_counts_as_checked', async () => {
  const api = setup();
  api.addNoSchedPerson(0, 'Lark', 'Ltest', { amount: 500 });
  await api.exportPayrollSettingsExcel(false);
  const b = setup();
  b.importPayrollSettingsFile(loadBack(b, api.__lastExcelWorkbook, 'Employee_Register.xlsx'), false);
  b.applyStagedSettings();
  assert.equal(b.noSchedStatus(recOf(b, 0, 'Lark Ltest')).state, 'kept');
});

test('test_snapshot_round_trip', async () => {
  const api = setup(); nextWeek(api);
  api.addNoSchedPerson(0, 'Lark', 'Ltest', { amount: 500, mgmt: true });
  const rec = recOf(api, 0, 'Lark Ltest');
  rec.ns_carry = { amount: 450, paid: 450, week: '2026-08-09' };
  api.setNoSchedSkip(rec.id, true);
  const snap = JSON.parse(JSON.stringify(await api.buildSnapshot()));
  const b = setup();
  assert.ok(b.openSnapshotData(snap, 'snap.json').ok);
  const r = recOf(b, 0, 'Lark Ltest');
  assert.ok(r && r.mgmt === 'Yes');
  assert.deepEqual(r.ns_carry, { amount: 450, paid: 450, week: '2026-08-09' });
  assert.equal(b.noSchedStatus(r).state, 'skip');
  assert.equal(b.flatWages[r.id], 500);
});

test('test_undo_add', () => {
  const api = setup();
  api.addNoSchedPerson(0, 'Lark', 'Ltest', { amount: 500 });
  assert.equal(api.noSchedRecords().length, 1);
  api.undoCheckpoint();
  assert.equal(api.noSchedRecords().length, 0);
  assert.equal(rowOf(api, 'Lark Ltest'), undefined);
});

test('test_register_tab_section_and_accountant_columns', () => {
  const api = setup(); nextWeek(api);
  api.addNoSchedPerson(0, 'Lark', 'Ltest', { amount: 500 });
  recOf(api, 0, 'Lark Ltest').ns_carry = { amount: 500, paid: 500, week: '2026-08-09' };
  api.setTab('register');
  const html = api.__sandbox.document.getElementById('registerHost').innerHTML;
  assert.match(html, /<h4>Paid without a schedule<\/h4>/);
  assert.match(html, /class="ns-remind"/);
  assert.match(html, /Same as last week \(\$500\.00\): keep or change/);
  assert.match(html, /<th>Standing Note<\/th>/);
  assert.match(html, /setPersonField\('[^']+','acct_name',this\.value\)/, 'accountant name edited on the register (FC-00086: per person)');
  assert.match(html, /setPersonField\('[^']+','acct_note',this\.value\)/, 'standing note edited on the register (FC-00086: per person)');
  api.setAcctField(0, 'Avery Atest', 'acct_name', 'A. ATEST', 'register');
  assert.equal(api.getAcctField(0, 'Avery Atest', 'acct_name'), 'A. ATEST');
  assert.match(api._nsReminderHtml(true), /Open it/, 'the Payroll tab links to the register');
});

test('test_accountant_card_and_no_page_section', () => {
  const api = setup();
  const html = api._downloadsHtml();
  assert.doesNotMatch(html, /class="acct-panel"/, 'the page section is gone');
  const card = html.slice(html.indexOf('data-key="accountant"'));
  const one = card.slice(0, card.indexOf('<div class="exp-card', 10) > 0 ? card.indexOf('<div class="exp-card', 10) : undefined);
  // FC-00093: no pay dates, no checks list and no week notes on the card; one status line.
  assert.doesNotMatch(one, /class="acct-card-dates"/);
  assert.doesNotMatch(one, /<input type="date"/);
  assert.doesNotMatch(one, /matches this week's payroll deposits/);
  assert.doesNotMatch(one, /Notes for the accountant this week/);
  assert.equal((one.match(/class="exp-status/g) || []).length, 1);
  api.setAcctWeekNote(0, 'Avery Atest', 'Back pay included');
  assert.doesNotMatch(api._acctCardHtml(), /Notes for the accountant/);
});
