// FC-00078: one TNG ID per person across the group, the person and their work at each entity,
// fixed entity codes, the settings file as the Employee Register. Invented names only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./fc70-helpers');

const TNG = /^TNG\d{5}$/;
const recOf = (api, e, n) => api.session.roster.byId[api.wKey(e, n)];
async function registerFile(api) {
  await api.exportPayrollSettingsExcel(false);
  const wb = api.__lastExcelWorkbook;
  const sheet = (name) => wb.worksheets.find(w => w.name === name);
  const ps = sheet('Payroll Settings');
  const hi = ps.rows.findIndex(r => r && r[1] && r[1].value === 'Entity');
  const head = ps.rows[hi].slice(1).map(c => c.value);
  const rows = ps.rows.slice(hi + 1).filter(Boolean).map(r => head.map((h, i) => { const v = r[i + 1] && r[i + 1].value; return v == null ? '' : String(v); }));
  const cm = {}; head.forEach((h, i) => { cm[h.toLowerCase()] = i; });
  // FC-00083: the IDs and entity codes are on Register Info; the register has no Tool Settings sheet.
  const tool = sheet('Register Info').rows.slice(2).filter(Boolean).map(r => [r[1].value, r[2] && r[2].value]);
  return { wb, sheet, head, rows, cm, tool };
}

test('test_tng_ids_given_in_old_id_order_and_never_reused', () => {
  const api = setup();
  assert.equal(api.tngOf(0, 'Avery Atest'), '', 'no TNG ID before the register is shown or saved');
  api.assignTngIds();
  const ids = api.registerRows().map(r => [r.code, r.id, r.tng]);
  ids.forEach(x => assert.match(x[2], TNG));
  const sorted = ids.slice().sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
  assert.deepEqual(sorted.map(x => x[2]), sorted.map((x, i) => 'TNG' + String(i + 1).padStart(5, '0')), 'numbered by entity code, then old number');
  // A person made inactive keeps the ID; a new person gets the next number after the highest.
  api.setRosterActive(0, 'Bram Btest', false);
  const hi = api._tngHighWater();
  api.addNewEmployee(0, 'Gail Gtest');
  api.assignTngIds();
  assert.equal(api.tngOf(0, 'Gail Gtest'), 'TNG' + String(hi + 1).padStart(5, '0'));
  assert.equal(api.tngOf(0, 'Bram Btest'), ids.find(x => x[1] === api.wKey(0, 'Bram Btest'))[2]);
});

test('test_register_file_round_trip_people_and_info_sheets', async () => {
  const api = setup();
  api.setManagement(0, 'Eden Etest', true);
  api.setAcctField(0, 'Avery Atest', 'acct_type', 'w2');
  const f = await registerFile(api);
  assert.deepEqual(f.head.slice(-2), ['TNG ID', 'Management']);
  assert.ok(f.rows.every(r => TNG.test(r[f.cm['tng id']])));
  assert.equal(f.rows.find(r => r[1] === 'Eden Etest')[f.cm['management']], 'Yes');
  const people = f.sheet('People');
  assert.ok(people.rows.some(r => r && r[2] && r[2].value === 'Avery Atest' && r[5] && r[5].value === 'W2'), 'People sheet lists each person with their employment type');
  const info = f.sheet('Register Info').rows.filter(Boolean).map(r => [r[1] && r[1].value, r[2] && r[2].value]);
  assert.ok(info.some(r => r[0] === 'Highest TNG ID issued' && TNG.test(r[1])));
  assert.ok(f.tool.some(r => r[0] === 'Highest TNG ID issued' && TNG.test(r[1])));
  assert.ok(f.tool.some(r => r[0] === 'Entity code · Alpha Test' && /^[A-Z0-9]{3}$/.test(r[1])));
  // Read back by another session: the same TNG IDs and Management.
  const b = setup();
  b._ingestToolSettings(f.tool);
  b._ingestPayrollSettings(f.rows, f.cm, false);
  ['Avery Atest', 'Bram Btest', 'Cora Ctest', 'Dane Dtest', 'Eden Etest'].forEach(n => assert.equal(b.tngOf(0, n), api.tngOf(0, n), n));
  assert.equal(b.isManagement(0, 'Eden Etest'), true);
  assert.equal(b.isManagement(0, 'Avery Atest'), false);
  b.assignTngIds();
  assert.equal(b._tngHighWater(), api._tngHighWater(), 'nothing new numbered');
});

test('test_file_tng_ids_win_over_ones_given_this_session', async () => {
  const api = setup();
  const f = await registerFile(api);
  // Another session shows its register first (numbers its people in its own order) …
  const b = setup();
  b.addNewEmployee(0, 'Kip Ktest');
  b.assignTngIds();
  const kipBefore = b.tngOf(0, 'Kip Ktest');
  b._ingestToolSettings(f.tool);
  b._ingestPayrollSettings(f.rows, f.cm, false);
  ['Avery Atest', 'Eden Etest'].forEach(n => assert.equal(b.tngOf(0, n), api.tngOf(0, n), n + ' keeps the file\'s ID'));
  b.assignTngIds();
  const kip = b.tngOf(0, 'Kip Ktest');
  assert.match(kip, TNG);
  const fileIds = new Set(f.rows.map(r => r[f.cm['tng id']]));
  assert.ok(!fileIds.has(kip) || kip === kipBefore && !fileIds.has(kipBefore), 'a person not in the file never holds a file person\'s ID');
  const all = b.registerRows().map(r => r.tng);
  assert.equal(new Set(all).size, all.length, 'every record has its own TNG ID');
});

test('test_link_same_person_across_entities_and_unlink', () => {
  const api = setup();
  api.addNewEmployee(1, 'Cora');
  api.assignTngIds();
  const c = api.samePersonCandidates().find(x => [x.a.canonical_name, x.b.canonical_name].sort().join('|') === 'Cora|Cora Ctest');
  assert.ok(c, 'same first name at two entities is suggested');
  api.setAcctField(0, 'Cora Ctest', 'acct_type', '1099');
  const aId = recOf(api, 0, 'Cora Ctest').id, bId = recOf(api, 1, 'Cora').id;
  assert.equal(api.linkSamePerson(aId, bId), true);
  assert.equal(api.tngOf(1, 'Cora'), api.tngOf(0, 'Cora Ctest'), 'one person, one TNG ID');
  assert.equal(api.getAcctField(1, 'Cora', 'acct_type'), '1099', 'employment type follows the person');
  api.setAcctField(1, 'Cora', 'acct_type', 'W2');
  assert.equal(api.getAcctField(0, 'Cora Ctest', 'acct_type'), 'W2', 'and stays the same at both');
  assert.ok(!api.samePersonCandidates().some(x => x.a.id === aId && x.b.id === bId), 'no longer suggested');
  // Pay stays per entity.
  assert.notEqual(aId, bId);
  const hi = api._tngHighWater();
  assert.equal(api.unlinkPerson(bId), true);
  assert.equal(api.tngOf(1, 'Cora'), 'TNG' + String(hi + 1).padStart(5, '0'), 'unlinked: a new ID, never a used one');
  const line = api.session.log.filter(e => e.type === 'rosterFieldSet' && e.target.field === 'tng');
  assert.equal(line.length, 2, 'link and unlink are History lines');
});

test('test_entity_codes_unique_and_fixed', () => {
  const api = setup();
  const code = (name, id) => api._resolveEntityCode(name, id);
  api.entities[0].name = 'Nirvana 11th'; api.entities[0].code = 'N11'; api.entities[0].codeLocked = true;
  api.entities[1].name = 'Zion'; api.entities[1].code = 'ZIO'; api.entities[1].codeLocked = true;
  assert.equal(code('Nirvana Harvard', 9), 'NIR', 'a second Nirvana is not N11');
  assert.equal(code('Zion Production', 9), 'ZPR', 'a second Zion is not ZIO');
  assert.equal(code('Hefner', 9), 'HEF');
  assert.equal(code('Paradise Market Garnett', 9), 'PAR');
  // Once someone is numbered under it, a rename keeps the code.
  const e = api.entities[1]; e.codeLocked = false; e.code = '';
  api._syncEntityCode(e);
  api.wKey(1, 'Ivy Itest');
  e.name = 'Zion Distribution'; api._syncEntityCode(e);
  assert.equal(e.code, 'ZIO');
});

test('test_management_tick_and_executive_pr_retired', () => {
  const api = setup();
  assert.equal(api.setManagement(0, 'Avery Atest', true), true);
  assert.equal(api.isManagement(0, 'Avery Atest'), true);
  assert.equal(api.registerRows().find(r => r.name === 'Avery Atest').mgmt, true);
  assert.equal(api.setManagement(0, 'Avery Atest', true), false, 'no change, no History line');
  const line = api.session.log.filter(e => e.type === 'rosterFieldSet' && e.target.field === 'mgmt').at(-1);
  api.revertFromHistory(line.id);
  assert.equal(api.isManagement(0, 'Avery Atest'), false, 'undoable');
});

test('test_register_csv_pdf_and_tab', () => {
  const api = setup();
  api.setRosterActive(0, 'Bram Btest', false);
  const written = [];
  api.__sandbox.downloadBlob = undefined;
  const doc = api.__sandbox.document, oc = doc.createElement;
  doc.createElement = (t) => { const el = oc(t); if (t === 'a') el.click = () => { if (el.download) written.push(el.download); }; return el; };
  api.exportRegisterCsv();
  assert.ok(written.some(n => /^Employee_Register_\d{4}-\d{2}-\d{2}\.csv$/.test(n)));
  api.exportRegisterPdf();
  const t = api.__lastAutoTableCalls.at(-1).options;
  assert.equal(t.head[0][0], 'TNG ID');
  assert.equal(t.body.length, 6, 'everyone, inactive included');
  assert.ok(t.body.some(r => r[1] === 'Bram Btest' && r.includes('No')));
  api.setTab('register');
  api.renderRegister();
  const html = doc.getElementById('registerHost').innerHTML;
  assert.match(html, /Search name, TNG ID/);
  assert.match(html, /TNG0000\d/);
  assert.doesNotMatch(html, /Bram Btest/, 'inactive people are under "Inactive"');
  api.setRegisterFilter('status', 'all');
  assert.match(doc.getElementById('registerHost').innerHTML, /Bram Btest/);
});

test('test_older_register_warns', () => {
  const api = setup();
  assert.equal(api._registerIsOlder({ week: '2026-08-02', savedAt: '2026-08-10 09:00:00' }, { week: '2026-08-09', savedAt: '2026-08-03 09:00:00' }), true, 'an earlier week is older');
  assert.equal(api._registerIsOlder({ week: '2026-08-09', savedAt: '2026-08-17 09:00:00' }, { week: '2026-08-09', savedAt: '2026-08-17 10:00:00' }), true, 'same week, saved earlier');
  assert.equal(api._registerIsOlder({ week: '2026-08-16', savedAt: '2026-08-17 09:00:00' }, { week: '2026-08-09', savedAt: '2026-08-17 10:00:00' }), false);
  // A register with a stamp older than the newest used asks first; Cancel stops the load.
  api.__sandbox.localStorage.setItem('pv26_register_newest', JSON.stringify({ week: '2026-08-09', savedAt: '2026-08-17 10:00:00' }));
  let asked = 0; api.__sandbox.confirm = () => { asked++; return false; };
  api.__sandbox.XLSX.utils.sheet_to_json = () => [['Register for week', '2026-08-02'], ['Saved at', '2026-08-10 09:00:00'], ['Highest TNG ID issued', 'TNG00040']];
  assert.equal(api._checkRegisterAge({ SheetNames: ['Payroll Settings', 'Register Info'], Sheets: {} }), false);
  assert.equal(asked, 1);
  assert.ok(api._tngHighWater() >= 40, 'its highest ID still counts, so it is never handed out again');
  api.__sandbox.XLSX.utils.sheet_to_json = () => [['Register for week', '2026-08-16'], ['Saved at', '2026-08-24 09:00:00'], ['Highest TNG ID issued', 'TNG00041']];
  assert.equal(api._checkRegisterAge({ SheetNames: ['Register Info'], Sheets: {} }), true, 'a newer one loads without asking');
  assert.equal(asked, 1);
});
