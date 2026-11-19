// FC-00085: Deposit Entity; short-week deposit check; the accountant file is written only when
// complete; one rate per person; breaks per person; the snapshot carries TNG IDs.
// Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, rowOf } = require('./fc70-helpers');

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
// Everything the accountant file needs, so only the item under test can stop it.
function complete(api) {
  api.setPayDateByHand('deposit', '2026-08-20');
  ['Avery Atest', 'Cora Ctest', 'Eden Etest'].forEach(n => api.setAcctField(0, n, 'acct_type', 'W2'));
  api.setAcctField(1, 'Fern Ftest', 'acct_type', 'W2');
}
const sections = (api) => Object.fromEntries(api.acctFileModel().entities.map(e => [e.entityName, e.rows.map(r => r.empName)]));
const shortCora = (api) => { api.splitAmounts[api.wKey(0, 'Cora Ctest')] = { deposit: 640, typed: true, isWhole: true }; };

// ---------- Part 1: Deposit Entity ----------
test('test_deposit_entity_moves_the_deposit_on_the_accountant_file', () => {
  const api = setup();
  const before = api.acctTieOut().map(t => [t.entityName, t.gross]);
  assert.equal(api.setDepositEntity(0, 'Cora Ctest', 'Beta Test', 'register'), true);
  assert.equal(api.getDepositEntityName(0, 'Cora Ctest'), 'Beta Test');
  const s = sections(api);
  assert.ok(s['Beta Test'].includes('Cora Ctest'), 'listed under the entity that pays her deposit');
  assert.ok(!s['Alpha Test'].includes('Cora Ctest'));
  const after = api.acctTieOut();
  after.forEach(t => assert.ok(t.ok, t.entityName + ' ties'));
  const g = (l, n) => l.find(t => t[0] === n || t.entityName === n);
  const cora = rowOf(api, 'Cora Ctest')._breakdown.deposit;
  assert.equal(g(after, 'Beta Test').gross, Math.round((g(before, 'Beta Test')[1] + cora) * 100) / 100);
  assert.equal(g(after, 'Alpha Test').gross, Math.round((g(before, 'Alpha Test')[1] - cora) * 100) / 100);
  assert.ok(api.acctSelfCheck().ok);
  // Cash and the payroll report stay with the entity she works at.
  const alpha = api._collectExportData().find(d => d.entityName === 'Alpha Test');
  assert.ok(alpha.rows.some(r => r._empName === 'Cora Ctest'));
  assert.ok(rowOf(api, 'Cora Ctest')._breakdown.cash > 0);
});

test('test_deposit_entity_column_shows_only_when_used', () => {
  const api = setup();
  assert.equal(api._reportLayoutKeys(false).keys.includes('depEnt'), false, 'hidden when nobody is paid from elsewhere');
  api.setDepositEntity(0, 'Cora Ctest', 'Beta Test', 'register');
  assert.equal(api._reportLayoutKeys(false).keys.includes('depEnt'), true);
  const spec = api._columnsFor('combined');
  const C = api.COMBINED_COLS;
  assert.equal(spec.rowFn(rowOf(api, 'Cora Ctest'))[C.depEnt], 'Beta Test');
  assert.equal(spec.rowFn(rowOf(api, 'Avery Atest'))[C.depEnt], '', 'blank when it is the same entity');
  // Back to the default: the entity she works at.
  api.setDepositEntity(0, 'Cora Ctest', 'Alpha Test', 'register');
  assert.equal(api.depositElsewhere(0, 'Cora Ctest'), false);
  assert.equal(api._reportLayoutKeys(false).keys.includes('depEnt'), false);
});

test('test_deposit_entity_register_round_trip_and_old_section', async () => {
  const api = setup();
  api.setDepositEntity(0, 'Cora Ctest', 'Beta Test', 'register');
  await api.exportPayrollSettingsExcel(false);
  const wb = api.__lastExcelWorkbook;
  const ps = wb.worksheets.find(w => w.name === 'Payroll Settings');
  const hdr = ps.rows.find(r => r && r.some(c => c && c.value === 'Deposit Entity')).map(c => c && c.value);
  const row = ps.rows.find(r => r && r.some(c => c && c.value === 'Cora Ctest')).map(c => c && c.value);
  assert.equal(row[hdr.indexOf('Deposit Entity')], 'Beta Test');
  const b = setup();
  b.importPayrollSettingsFile(loadBack(b, wb, 'Employee_Register.xlsx'), false);
  b.applyStagedSettings();
  assert.equal(b.getDepositEntityName(0, 'Cora Ctest'), 'Beta Test');
  assert.ok(sections(b)['Beta Test'].includes('Cora Ctest'));
  // An older file with only an Accountant Section ("BETA TEST VENTURES") reads it as the Deposit Entity.
  const c = setup();
  assert.equal(c._entityFromSection('BETA TEST VENTURES').name, 'Beta Test');
  assert.equal(c._entityFromSection(''), null);
});

test('test_deposit_entity_undo', () => {
  const api = setup();
  api.setDepositEntity(0, 'Cora Ctest', 'Beta Test', 'register');
  const e = api.session.log.filter(x => x.target && x.target.field === 'dep_ent').pop();
  api.revert(e.id);
  assert.equal(api.depositElsewhere(0, 'Cora Ctest'), false);
});

// ---------- Part 2: short week ----------
test('test_short_week_flag_and_choices', () => {
  const api = setup(); shortCora(api);
  // 42.5 h × $12 = $510.00 against a $640 deposit: $130 short.
  const sw = api.shortWeekInfo(0, 'Cora Ctest', rowOf(api, 'Cora Ctest').pay);
  assert.deepEqual({ h: sw.hoursPay, s: sw.setDeposit, by: sw.shortBy, c: sw.choice }, { h: 510, s: 640, by: 130, c: '' });
  let b = rowOf(api, 'Cora Ctest')._breakdown;
  assert.deepEqual([b.actualFinal, b.deposit, b.cash], [510, 510, 0], 'undecided: paid by the hours, as before');
  assert.equal(api.shortWeekUndecided().length, 1);
  assert.match(api._shortWeekHtml(), /\$130\.00 less than the set deposit of \$640\.00/);
  api.setShortWeekChoice(0, 'Cora Ctest', 'deposit');
  b = rowOf(api, 'Cora Ctest')._breakdown;
  assert.deepEqual([b.actualFinal, b.deposit, b.cash], [640, 640, 0]);
  assert.equal(api.shortWeekUndecided().length, 0);
  const line = api.acctFileModel().entities.flatMap(e => e.rows).find(r => r.empName === 'Cora Ctest');
  assert.equal(line.salary, 640); assert.equal(line.gross, 640);
  assert.ok(api.acctTieOut().every(t => t.ok));
  api.setShortWeekChoice(0, 'Cora Ctest', 'hours');
  b = rowOf(api, 'Cora Ctest')._breakdown;
  assert.deepEqual([b.actualFinal, b.deposit, b.cash], [510, 510, 0]);
  // No flag when the hours pay covers the deposit.
  const ok = setup();
  assert.equal(ok.shortWeekList().length, 0);
});

test('test_short_week_choice_is_kept_in_the_snapshot_not_the_register', async () => {
  const api = setup(); shortCora(api);
  api.setShortWeekChoice(0, 'Cora Ctest', 'deposit');
  const snap = JSON.parse(JSON.stringify(await api.buildSnapshot()));
  const b = setup();
  assert.ok(b.openSnapshotData(snap, 'snap.json').ok);
  assert.equal(rowOf(b, 'Cora Ctest')._breakdown.actualFinal, 640);
  await api.exportToolSettingsExcel();
  const flat = JSON.stringify(api.__lastExcelWorkbook.worksheets.map(w => w.rows.map(r => (r || []).map(c => c && c.value))));
  assert.equal(/swDep:/.test(flat), false, 'never in Tool Settings');
});

test('test_short_week_deposit_excel_is_a_fixed_amount', async () => {
  const api = setup(); shortCora(api); complete(api);
  api.setShortWeekChoice(0, 'Cora Ctest', 'deposit');
  await api.exportCombinedExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0], C = api.COMBINED_COLS;
  const row = ws.rows.find(r => r && r.some(c => c && typeof c.value === 'string' && /CORA/i.test(c.value)));
  const tot = row[C.total + 1].value, dep = row[C.deposit + 1].value, cash = row[C.cash + 1].value;
  const v = (x) => (x && typeof x === 'object' && 'result' in x) ? x.result : x;
  assert.equal(v(tot), 640); assert.equal(typeof tot === 'object' && tot && 'formula' in tot, false, 'Total is the deposit, not hours × rate');
  assert.equal(v(dep), 640); assert.equal(v(cash), 0);
});

// ---------- Part 3: the accountant file is written only when complete ----------
test('test_accountant_file_blocked_until_complete', async () => {
  const api = setup();
  const said = []; api.__sandbox.alert = (m) => said.push(m);
  const before = api.__lastExcelWorkbook;
  await api.exportAccountantFile();
  assert.equal(api.__lastExcelWorkbook, before, 'not written');
  const bl = api.acctBlockers().join(' | ');
  assert.match(bl, /Deposit pay date not set/);
  assert.match(bl, /Employment type not set/);
  complete(api);
  assert.deepEqual(api.acctBlockers(), []);
  await api.exportAccountantFile();
  assert.notEqual(api.__lastExcelWorkbook, before, 'written once complete');
  // An undecided short week stops it again.
  shortCora(api);
  assert.match(api.acctBlockers().join(' | '), /Short-week deposit not decided \(Payroll tab\): Cora Ctest/);
  assert.match(api._acctCardHtml(), /Not written until complete/);
  api.setShortWeekChoice(0, 'Cora Ctest', 'hours');
  assert.deepEqual(api.acctBlockers(), []);
});

test('test_accountant_file_blocked_for_a_missing_rate', () => {
  const api = setup(); complete(api);
  delete api.wageRates[api.wKey(0, 'Avery Atest')];
  assert.match(api.acctBlockers().join(' | '), /Rate missing/);
});

// ---------- Part 4: one rate per person ----------
test('test_one_rate_per_person', () => {
  const api = setup();
  api.assignTngIds();
  const a = api.session.roster.byId[api.wKey(0, 'Avery Atest')], f = api.session.roster.byId[api.wKey(1, 'Fern Ftest')];
  api.linkSamePerson(a.id, f.id);
  // Two rates for one person ($12 and $16): flagged, nothing changed.
  const c = api.rateConflicts();
  assert.equal(c.length, 1); assert.equal(api.wageRates[f.id], 16);
  assert.match(api._rateConflictHtml(), /One person, two rates/);
  assert.equal(api.setPersonRate(a.tng, 12), true);
  assert.equal(api.wageRates[f.id], 12); assert.equal(api.rateConflicts().length, 0);
  api.undoCheckpoint();
  assert.equal(api.wageRates[f.id], 16, 'one Undo');
  api.setPersonRate(a.tng, 12);
  // A change at one entity carries to the other.
  api.dispatch({ type: 'wage', screen: 'payroll', target: { kind: 'employee', entity: 0, id: a.id, field: 'wage' }, from: 12, to: 13.5, meta: { empName: 'Avery Atest' } });
  assert.equal(api._spreadRate(0, 'Avery Atest', 'payroll'), 1);
  assert.equal(api.wageRates[f.id], 13.5);
});

test('test_rates_of_unlinked_people_are_untouched', () => {
  const api = setup();
  assert.deepEqual(api._rateSiblings(0, 'Avery Atest'), []);
  assert.equal(api._spreadRate(0, 'Avery Atest', 'payroll'), 0);
  assert.equal(api.rateConflicts().length, 0);
});

// ---------- Part 5: breaks per person ----------
test('test_breaks_per_person_and_no_break_flag', () => {
  const api = setup();
  // Eden: Tuesday becomes two punch pairs with 30 minutes out between them.
  const ent = api.entities[0];
  const d = ent.actualDays.find(x => x.empName === 'Eden Etest' && x.dayIdx === 2);
  d.pairs = [{ in: 8, out: 12, outAdj: 12, minutes: 240 }, { in: 12.5, out: 16.5, outAdj: 16.5, minutes: 240 }];
  const calc = api.computePayrollForEntity(0);
  const eden = calc.results.find(r => r.schedName === 'Eden Etest');
  const b = api.breakSummary(eden);
  assert.equal(b.shifts, 5);
  assert.equal(b.days[2].min, 30); assert.equal(b.days[2].none, false);
  assert.equal(b.none, 4, 'every other shift has no break, whatever its length');
  assert.equal(b.total, 30);
  const dane = api.breakSummary(calc.results.find(r => r.schedName === 'Dane Dtest'));
  assert.equal(dane.none, 2, 'a 5-hour shift with no break is flagged too');
  const html = api._breakRowHtml(eden);
  assert.match(html, /4 shifts with no break/); assert.match(html, /0:30/); assert.match(html, /0:00 no break/);
  // Display only: pay is unchanged by the breaks line.
  assert.equal(rowOf(api, 'Avery Atest')._breakdown.actualFinal, setupPay());
});
function setupPay() { return rowOf(setup(), 'Avery Atest')._breakdown.actualFinal; }

// ---------- Part 6: the snapshot carries TNG IDs ----------
test('test_saving_the_snapshot_issues_tng_ids', async () => {
  const api = setup();
  const recs = () => Object.values(api.session.roster.byId).filter(r => r && r.canonical_name);
  assert.ok(recs().every(r => !r.tng), 'none yet');
  await api.saveSnapshot();
  assert.ok(recs().every(r => /^TNG\d{5}$/.test(r.tng)), 'everyone numbered by the snapshot save');
  const ids = recs().map(r => r.tng).join(',');
  await api.exportPayrollSettingsExcel(false);
  assert.equal(recs().map(r => r.tng).join(','), ids, 'the register saved after it carries the same numbers');
});
