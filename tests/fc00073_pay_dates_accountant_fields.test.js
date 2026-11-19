// FC-00073: the run's two pay dates (Deposit from the accountant's file, Cash and Contract Check
// the Friday after the week), each changeable behind a warning and printed on the payroll report;
// and each person's accountant name, employment type, section and note in the settings file.
// Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./fc70-helpers');

test('test_cash_date_is_friday_after_week', () => {
  const api = setup();
  const p = api.payDates();
  assert.equal(p.run, '2026-08-09');
  assert.equal(p.cash.iso, '2026-08-21', 'week Sun 08/09 – Sat 08/15 pays Fri 08/21');
  assert.equal(p.cash.src, 'auto');
  assert.equal(p.deposit, null, 'no deposit date until the accountant\'s file or the owner sets it');
  assert.equal(api._fmtPayDate('2026-08-21'), 'Fri 08/21/26');
});

test('test_change_date_warns_first', () => {
  const api = setup();
  const asked = [];
  api.__sandbox.confirm = (m) => { asked.push(m); return false; };
  assert.equal(api.setPayDateByHand('deposit', '2026-08-20'), false);
  assert.equal(api.payDates().deposit, null, 'Cancel keeps the date');
  assert.match(asked[0], /⚠ Deposit pay date/);
  assert.match(asked[0], /the accountant pays every deposit/);
  api.__sandbox.confirm = (m) => { asked.push(m); return true; };
  assert.equal(api.setPayDateByHand('deposit', '2026-08-20'), true);
  assert.deepEqual(api.payDates().deposit, { iso: '2026-08-20', src: 'hand' });
  assert.equal(api.setPayDateByHand('cash', '2026-08-22'), true);
  assert.match(asked.at(-1), /Cash and Contract Check are paid: the Friday after the pay week/);
  assert.deepEqual(api.payDates().cash, { iso: '2026-08-22', src: 'hand' });
  assert.equal(api.setPayDateByHand('cash', ''), true, 'clearing goes back to the Friday');
  assert.deepEqual(api.payDates().cash, { iso: '2026-08-21', src: 'auto' });
  assert.equal(api.setPayDateByHand('deposit', 'not a date'), false);
});

test('test_pay_dates_on_the_report', async () => {
  const api = setup();
  api.setPayDateByHand('deposit', '2026-08-20');
  const line = 'Deposit paid Thu 08/20/26   |   Cash and Check paid Fri 08/21/26'; // FC-00080
  assert.equal(api._payDatesLine(), line);
  await api.exportCombinedExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  assert.equal(ws.rows[2][1].value, line, 'under the title, in the row that was blank');
  assert.ok(ws.merges.some(([r1, c1, r2]) => r1 === 2 && r2 === 2 && c1 === 1));
  assert.equal(ws.rows[3][1].value, 'Employee', 'the header stays in its row');
  const texts = [];
  const orig = api.__sandbox.window.jspdf.jsPDF;
  api.__sandbox.window.jspdf = { jsPDF: function (o) { const d = orig(o); d.text = (t) => texts.push(t); return d; } };
  await api.exportCombinedPdf();
  assert.ok(texts.includes(line), 'the PDF prints it too');
  const m = api._fc13PreviewModel();
  assert.equal(m.rows[1].kind, 'note'); assert.equal(m.rows[1].cells[0], line);
});

test('test_pay_dates_in_snapshot_not_in_settings_file', async () => {
  const api = setup();
  api.setPayDateByHand('deposit', '2026-08-20');
  await api.exportPayrollSettingsExcel(false);
  const reg = api.__lastExcelWorkbook;
  assert.ok(!reg.worksheets.some(w => w.rows.some(r => r && r[1] && /^Pay date/.test(String(r[1].value)))), 'a pay date belongs to one week');
  await api.exportToolSettingsExcel();
  const ts = api.__lastExcelWorkbook.worksheets.find(w => w.name === 'Tool Settings');
  assert.ok(!ts.rows.some(r => r && r[1] && /^Pay date/.test(String(r[1].value))), 'nor in Tool Settings');
  const snap = await api.buildSnapshot();
  assert.equal(snap.state.toolSettings['payDate:deposit|2026-08-09'], '2026-08-20|hand');
  assert.equal(api._toolSettingLabel('payDate:deposit|2026-08-09'), 'Pay date · Deposit · week of 08/09/26');
  const line = api.session.log.filter(e => e.type === 'toolSetting').at(-1);
  api.revertFromHistory(line.id);
  assert.equal(api.payDates().deposit, null, 'undo from History');
});

test('test_dates_belong_to_their_week', () => {
  const api = setup();
  api.setPayDateByHand('deposit', '2026-08-20');
  api.entities.forEach(e => { e.dateLabels = ['Aug 16 2026', 'Aug 17 2026', 'Aug 18 2026', 'Aug 19 2026', 'Aug 20 2026', 'Aug 21 2026', 'Aug 22 2026']; });
  const p = api.payDates();
  assert.equal(p.deposit, null, 'last week\'s date does not carry over');
  assert.equal(p.cash.iso, '2026-08-28');
});

test('test_accountant_fields_round_trip_in_settings_file', async () => {
  const api = setup();
  assert.equal(api.setAcctField(0, 'Avery Atest', 'acct_name', '  Avery  Q Atest '), true);
  api.setAcctField(0, 'Avery Atest', 'acct_type', '1099');
  api.setAcctField(0, 'Avery Atest', 'acct_section', 'Beta Ventures');
  api.setAcctField(0, 'Avery Atest', 'acct_note', 'Standing note');
  assert.equal(api.getAcctField(0, 'Avery Atest', 'acct_name'), 'Avery Q Atest', 'spaces tidied');
  assert.equal(api.getAcctField(0, 'Avery Atest', 'acct_section'), 'BETA VENTURES');
  assert.equal(api._normAcctType('w-2'), 'W2'); assert.equal(api._normAcctType(1099), '1099');
  await api.exportPayrollSettingsExcel(false);
  const ws = api.__lastExcelWorkbook.worksheets.find(w => w.name === 'Payroll Settings');
  const hdr = ws.rows[4].slice(1).map(c => c.value);
  assert.deepEqual(hdr.slice(-10, -6), ['Accountant Name', 'Employment Type', 'Accountant Section', 'Accountant Note']); // FC-00078 adds TNG ID and Management after them; FC-00084 three more; FC-00085 Deposit Entity
  const row = ws.rows.find(r => r && r[2] && r[2].value === 'Avery Atest').slice(1).map(c => c.value);
  assert.deepEqual(row.slice(-10, -6), ['Avery Q Atest', '1099', 'BETA VENTURES', 'Standing note']);
  const eden = ws.rows.find(r => r && r[2] && r[2].value === 'Eden Etest').slice(1).map(c => c.value);
  const b = setup();
  const cm = {}; hdr.forEach((h, i) => { cm[String(h).toLowerCase()] = i; });
  b._ingestPayrollSettings([row.map(v => v == null ? '' : String(v)), eden.map(v => v == null ? '' : String(v))], cm, false);
  assert.equal(b.getAcctField(0, 'Avery Atest', 'acct_name'), 'Avery Q Atest');
  assert.equal(b.getAcctField(0, 'Avery Atest', 'acct_type'), '1099');
  assert.equal(b.getAcctField(0, 'Avery Atest', 'acct_note'), 'Standing note');
  const rec = b.session.roster.byId[b.wKey(0, 'Eden Etest')];
  assert.equal(rec.acct_note, '', 'a blank cell counts as set (cleared), never as "never given"');
  // History names the field.
  const line = api.session.log.find(e => e.type === 'rosterFieldSet' && e.target.field === 'acct_note');
  assert.ok(line);
  const fields = api._personFields(api._captureState(), api.wKey(0, 'Avery Atest'), false);
  assert.equal(fields.acctName, 'Avery Q Atest'); assert.equal(fields.acctSection, 'BETA VENTURES');
});
