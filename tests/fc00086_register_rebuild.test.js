// FC-00086: the Employee Register rebuilt: one row per person (TNG ID) with a line per entity
// record, everything editable through History, Full Name and Display Name, entities as a
// multi-select, Add employee, the Paid-without-a-schedule view. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, rowOf } = require('./fc70-helpers');

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
const idOf = (api, e, n) => api.wKey(e, n);
const html = (api) => api.__sandbox.document.getElementById('registerHost').innerHTML;
// Avery also works at Beta Test (one person, two records).
function linkAvery(api) {
  const made = api.regToggleEntity(idOf(api, 0, 'Avery Atest'), 1, true);
  assert.ok(made && made.id, 'a record at Beta Test');
  return made;
}

test('test_one_row_per_person_with_entity_lines_and_no_ids_on_view', () => {
  const api = setup();
  api.setTab('register');
  const h = html(api);
  assert.equal((h.match(/class="reg-person/g) || []).length, 6, 'one main row per person');
  assert.equal((h.match(/class="reg-sub[ "]/g) || []).length, 6, 'one line per entity record');
  assert.match(h, /<td class="reg-tng">pending<\/td>/, 'no TNG ID yet: pending');
  assert.ok(Object.values(api.session.roster.byId).every(r => !r.tng), 'showing the register hands out no TNG IDs');
  assert.match(h, /<th>Full Name<\/th><th>Display Name<\/th><th>Accountant Name<\/th><th>Type<\/th><th>Rate<\/th><th>Active<\/th><th>Standing Note<\/th><th>Entity<\/th>/);
  assert.match(h, /6 people · 6 entity records/);
  assert.match(h, /class="btn btn-green" onclick="exportPayrollSettingsExcel\(false\)"/, 'Excel button like the export cards');
  // Linked: one person, two lines.
  linkAvery(api);
  const p = api.registerPeople().find(x => x.name === 'Avery Atest');
  assert.match(p.tng, /^TNG\d{5}$/, 'linking numbers the person, as Link does');
  assert.deepEqual(p.recs.map(r => r.entity), ['Alpha Test', 'Beta Test']);
  assert.equal(api.registerPeople().length, 6);
  api.renderRegister();
  assert.match(html(api), /6 people · 7 entity records/);
  assert.equal((html(api).match(/unlinkPerson\(/g) || []).length, 2, 'Unlink on each line of a linked person');
  // Accountant Name only for Deposit or Deposit + Cash people.
  assert.equal(api.registerPeople().find(x => x.name === 'Bram Btest').showAcct, false);
  assert.equal(api.registerPeople().find(x => x.name === 'Cora Ctest').showAcct, true);
});

test('test_person_fields_on_every_record_history_and_one_undo', () => {
  const api = setup();
  const b = linkAvery(api);
  const a = api.session.roster.byId[idOf(api, 0, 'Avery Atest')];
  assert.equal(api.setPersonField(a.id, 'full_name', '  Avery  Quinn Atest '), true);
  assert.equal(a.full_name, 'Avery Quinn Atest');
  assert.equal(b.full_name, 'Avery Quinn Atest', 'every entity record of the person');
  api.setPersonField(a.id, 'display_name', 'Avie');
  assert.equal(b.display_name, 'Avie');
  const lines = api.session.log.filter(e => e.target && e.target.field === 'display_name');
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map(e => api._historyField(e)), ['Display Name', 'Display Name']);
  assert.equal(api._historyField(api.session.log.find(e => e.target && e.target.field === 'full_name')), 'Full Name');
  api.undoCheckpoint();
  const now = (r) => api.session.roster.byId[r.id];
  assert.equal(now(a).display_name, undefined); assert.equal(now(b).display_name, undefined, 'one Undo for both records');
  assert.equal(now(a).full_name, 'Avery Quinn Atest');
  assert.equal(api.setPersonField(a.id, 'full_name', 'Avery Quinn Atest'), false, 'no change, no History line');
  assert.equal(now(a).canonical_name, 'Avery Atest', 'the saved name is never renamed');
  // Accountant name, type and note follow the person.
  api.setPersonField(b.id, 'acct_name', 'ATEST, AVERY');
  api.setPersonField(b.id, 'acct_type', 'w2');
  api.setPersonField(b.id, 'acct_note', 'Weekly note');
  ['acct_name', 'acct_type', 'acct_note'].forEach(f => assert.equal(now(a)[f], now(b)[f], f));
  assert.equal(now(a).acct_type, 'W2');
  // Blank Display Name: nothing is written for anyone else.
  assert.ok(Object.values(api.session.roster.byId).filter(r => r.canonical_name !== 'Avery Atest').every(r => r.full_name === undefined && r.display_name === undefined));
  api.setTab('register');
  assert.match(html(api), /placeholder="Bram Btest"/, 'a blank name shows the saved name as its placeholder');
});

test('test_rate_and_active_per_person', () => {
  const api = setup();
  const b = linkAvery(api);
  const a = idOf(api, 0, 'Avery Atest');
  assert.equal(api.wageRates[b.id], 12, 'the new record takes the person\'s rate');
  assert.equal(api.regSetRate(a, '13.5'), true);
  assert.equal(api.wageRates[a], 13.5); assert.equal(api.wageRates[b.id], 13.5);
  api.undoCheckpoint();
  assert.equal(api.wageRates[a], 12); assert.equal(api.wageRates[b.id], 12, 'one Undo');
  assert.equal(api.regSetRate(a, '0'), false, 'a rate must be above 0');
  assert.equal(api.setPersonActive(a, false), true);
  assert.equal(api.rosterActive[a], false); assert.equal(api.rosterActive[b.id], false);
  assert.equal(api.registerPeople().find(x => x.name === 'Avery Atest').active, false);
  api.setPersonActive(a, true);
  assert.equal(api.rosterActive[a], undefined); assert.equal(api.rosterActive[b.id], undefined);
});

test('test_entity_lines_edit_through_history', () => {
  const api = setup();
  const id = idOf(api, 0, 'Bram Btest');
  assert.equal(api.regSetMethod(id, 'both'), true);
  assert.equal(api.payMethod[id], 'both');
  api.regSetDeposit(id, '200');
  assert.deepEqual(api.splitAmounts[id], { deposit: 200, typed: true, isWhole: true });
  api.regSetDeposit(id, '');
  assert.equal(api.splitAmounts[id], undefined, 'blank: the default split again');
  api.regSetPay(id, 'flat');
  assert.equal(api.flatWages[id], 0);
  api.regSetFlat(id, '450');
  assert.equal(rowOf(api, 'Bram Btest').pay, 450);
  api.regSetPay(id, 'semi');
  assert.equal(api.semiMonthly[id], true);
  api.regSetPay(id, 'hourly');
  assert.equal(api.flatWages[id], undefined); assert.ok(!api.semiMonthly[id]);
  assert.equal(api.wageRates[id], 12, 'back to hourly at the person\'s rate');
  api.regSetMgmt(id, true);
  assert.equal(api.isManagement(0, 'Bram Btest'), true);
  api.regSetMethod(id, 'deposit');
  api.regSetDepEnt(id, 'Beta Test');
  assert.equal(api.getDepositEntityName(0, 'Bram Btest'), 'Beta Test');
  const types = new Set(api.session.log.filter(e => e.target && e.target.id === id).map(e => e.type));
  ['payMethod', 'splitDeposit', 'flatWage', 'semiMonthlySet', 'rosterFieldSet'].forEach(t => assert.ok(types.has(t), t + ' is a History line'));
});

test('test_entity_multi_select_add_untick_and_last_entity', () => {
  const api = setup();
  const a = idOf(api, 0, 'Avery Atest');
  api.setPersonField(a, 'display_name', 'Avie');
  const b = linkAvery(api);
  assert.equal(b.entity, 1);
  assert.equal(b.tng, api.session.roster.byId[a].tng, 'same TNG ID');
  assert.equal(b.display_name, 'Avie', 'names follow');
  assert.match(b.id, /^EMP_BET_\d{5}$/);
  assert.notEqual(b.id, idOf(api, 1, 'Fern Ftest'));
  // Untick: asks; No changes nothing.
  let asked = '';
  api.__sandbox.confirm = (m) => { asked = m; return false; };
  assert.equal(api.regToggleEntity(a, 1, false), false);
  assert.match(asked, /Make Avery Atest inactive at Beta Test\?/);
  assert.notEqual(api.rosterActive[b.id], false);
  api.__sandbox.confirm = () => true;
  assert.equal(api.regToggleEntity(a, 1, false), true);
  assert.equal(api.rosterActive[b.id], false, 'inactive there, kept');
  assert.ok(api.session.roster.byId[b.id], 'never deleted');
  // The last active entity cannot be unticked.
  let warned = '';
  api.__sandbox.alert = (m) => { warned = m; };
  assert.equal(api.regToggleEntity(a, 0, false), false);
  assert.match(warned, /works only at Alpha Test/);
  assert.notEqual(api.rosterActive[a], false);
  // Ticked again: the same record comes back.
  api.regToggleEntity(a, 1, true);
  assert.equal(api.rosterActive[b.id], undefined);
  assert.equal(Object.values(api.session.roster.byId).filter(r => r.tng === b.tng).length, 2, 'no second record');
  // Undo of the add removes the record.
  const c = setup();
  const before = Object.keys(c.session.roster.byId).length;
  linkAvery(c);
  c.undoCheckpoint();
  assert.equal(Object.keys(c.session.roster.byId).filter(k => c.session.roster.byId[k] && c.session.roster.byId[k].entity === 1).length, 1);
  assert.ok(Object.keys(c.session.roster.byId).length <= before + 1);
});

test('test_names_round_trip_through_the_register_file', async () => {
  const api = setup();
  const a = idOf(api, 0, 'Avery Atest');
  api.setPersonField(a, 'full_name', 'Avery Quinn Atest');
  api.setPersonField(a, 'display_name', 'Avie');
  api.setPersonField(idOf(api, 1, 'Fern Ftest'), 'display_name', 'Fern');
  await api.exportPayrollSettingsExcel(false);
  const wb = api.__lastExcelWorkbook;
  const ps = wb.worksheets.find(w => w.name === 'Payroll Settings');
  const hi = ps.rows.findIndex(r => r && r[1] && r[1].value === 'Entity');
  const head = ps.rows[hi].slice(1).map(c => c.value);
  assert.deepEqual(head.slice(-3), ['Deposit Entity', 'Full Name', 'Display Name']);
  const people = wb.worksheets.find(w => w.name === 'People');
  const ph = people.rows[3].slice(1).map(c => c.value);
  assert.deepEqual(ph.slice(12, 15), ['Deposit Entity', 'Full Name', 'Display Name']);
  const b = setup();
  b.importPayrollSettingsFile(loadBack(b, wb, 'Employee_Register.xlsx'), false);
  const diffs = b.getStaged().preview.changes.flatMap(c => c.diffs.map(d => [c.name, d.label, d.to]));
  assert.ok(diffs.some(d => d[0] === 'Avery Atest' && d[1] === 'Full Name' && d[2] === 'Avery Quinn Atest'));
  assert.ok(diffs.some(d => d[0] === 'Fern Ftest' && d[1] === 'Display Name' && d[2] === 'Fern'));
  b.applyStagedSettings();
  const ra = b.session.roster.byId[b.wKey(0, 'Avery Atest')];
  assert.equal(ra.full_name, 'Avery Quinn Atest'); assert.equal(ra.display_name, 'Avie');
  assert.equal(b.session.roster.byId[b.wKey(1, 'Fern Ftest')].display_name, 'Fern');
  assert.equal(b.session.roster.byId[b.wKey(0, 'Bram Btest')].full_name, undefined, 'a blank cell writes nothing for someone never set');
  // Saved again: the same cells.
  await b.exportPayrollSettingsExcel(false);
  const ps2 = b.__lastExcelWorkbook.worksheets.find(w => w.name === 'Payroll Settings');
  const cells = (sheet) => sheet.rows.filter(Boolean).map(r => r.slice(-2).map(c => c && c.value)).slice(4);
  assert.deepEqual(cells(ps2), cells(ps));
});

test('test_add_employee_hourly_flat_and_semi', () => {
  const api = setup();
  const h = api.regAddEmployee(0, 'gail', 'gtest', { method: 'cash', pay: 'hourly', amount: '15', mgmt: true });
  assert.equal(h.canonical_name, 'Gail Gtest');
  assert.equal(api.wageRates[h.id], 15); assert.equal(api.payMethod[h.id], 'cash');
  assert.equal(api.isManagement(0, 'Gail Gtest'), true);
  assert.ok(api.registerRows().some(r => r.name === 'Gail Gtest'), 'in the register');
  api.undoCheckpoint();
  assert.ok(!api.registerRows().some(r => r.name === 'Gail Gtest'), 'one Undo');
  const f = api.regAddEmployee(1, 'Hale', 'Htest', { method: 'both', pay: 'flat', amount: '700', deposit: '500' });
  assert.equal(api.flatWages[f.id], 700); assert.equal(f.nosched, 'Yes');
  assert.equal(rowOf(api, 'Hale Htest')._breakdown.deposit, 500);
  const s = api.regAddEmployee(0, 'Ivo', 'Itest', { pay: 'semi', amount: '1000' });
  assert.equal(api.semiMonthly[s.id], true); assert.equal(api.flatWages[s.id], 1000);
  assert.equal(api.regAddEmployee(0, 'Avery', 'Atest', { pay: 'hourly' }), null, 'already there');
  // From the form.
  api.setTab('register');
  const doc = api.__sandbox.document;
  assert.match(html(api), /\+ Add employee/);
  doc.getElementById('regAddEnt').value = '0';
  doc.getElementById('regAddFirst').value = 'Jo';
  doc.getElementById('regAddLast').value = 'Jtest';
  doc.getElementById('regAddPay').value = 'hourly';
  doc.getElementById('regAddMethod').value = 'deposit';
  doc.getElementById('regAddAmt').value = '14';
  const j = api._regAddFromForm();
  assert.equal(j && j.canonical_name, 'Jo Jtest');
  assert.equal(api.wageRates[j.id], 14);
});

test('test_paid_without_a_schedule_view_lists_flat_and_semi', () => {
  const api = setup();
  api.regSetPay(idOf(api, 0, 'Eden Etest'), 'semi');
  api.addNoSchedPerson(1, 'Lark', 'Ltest', { amount: 500 });
  const ids = api.registerFlatRows().map(r => r.name).sort();
  assert.deepEqual(ids, ['Eden Etest', 'Lark Ltest'], 'exactly the Flat and Semi-monthly people');
  api.setTab('register');
  const h = html(api);
  assert.match(h, /<h4>Paid without a schedule<\/h4>/);
  assert.match(h, /data-ns="EMP_ALP_00005"[\s\S]*?Tick No schedule to check this amount every week/);
  assert.match(h, /setNoSchedAmount\('EMP_BET_\d{5}'/, 'weekly controls for people on no schedule');
  // No separate add: tick an existing flat person "No schedule".
  const e = idOf(api, 0, 'Eden Etest');
  assert.equal(api.regSetNoSched(e, true), true);
  assert.equal(api.session.roster.byId[e].nosched, 'Yes');
  assert.ok(api.noSchedRecords().some(r => r.id === e));
  api.regSetNoSched(e, false);
  assert.ok(!api.session.roster.byId[e].nosched);
  // Filters apply: another entity hides them.
  api.setRegisterFilter('entity', '1');
  assert.deepEqual(api.registerFlatRows().map(r => r.name), ['Lark Ltest']);
});

test('test_register_csv_pdf_still_number_and_carry_names', () => {
  const api = setup();
  api.setPersonField(idOf(api, 0, 'Avery Atest'), 'display_name', 'Avie');
  const written = [];
  api.__sandbox.downloadBlob = (data, name) => written.push(name);
  api.exportRegisterPdf();
  const t = api.__lastAutoTableCalls.at(-1).options;
  assert.ok(t.head[0].includes('Display Name'));
  assert.ok(t.body.some(r => r.includes('Avie')));
  assert.ok(t.body.every(r => /^TNG\d{5}$/.test(r[0])), 'the export numbers everyone, as before');
});
