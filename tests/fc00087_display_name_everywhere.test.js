// FC-00087: one Display Name per person, shown everywhere a name is displayed (screens, payroll
// report preview, Excel and PDF, Stats, Labor Cost, week over week). Display only: matching,
// keys, IDs, aliases, the accountant file and the files the tool reads back keep today's names.
// The Register (FC-00086) sets rec.display_name; these tests set it on the record directly.
// Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');
const { setup, rowOf, completeAccountant } = require('./fc70-helpers');

const recOf = (api, e, n) => api.session.roster.byId[api.wKey(e, n)];
const setDisplay = (api, e, n, v) => { recOf(api, e, n).display_name = v; };
const cells = (wb) => JSON.stringify(wb.worksheets.map(w => w.rows.map(r => (r || []).map(c => c && c.value))));
async function combined(api) { await api.exportCombinedExcel(); return api.__lastExcelWorkbook; }
// The PDF tables one export wrote (the autoTable mock keeps every call).
async function pdfBodies(api) { const n = api.__lastAutoTableCalls.length; await api.exportCombinedPdf(); return JSON.stringify(api.__lastAutoTableCalls.slice(n).map(c => c.options.body)); }
// The payroll report's Employee column and every other cell, from the first sheet.
function split(wb) {
  const ws = wb.worksheets[0];
  const h = ws.rows.findIndex(r => r && r.some(c => c && c.value === 'Employee'));
  const col = ws.rows[h].findIndex(c => c && c.value === 'Employee');
  const names = [], rest = [];
  ws.rows.forEach((r, i) => (r || []).forEach((c, j) => { const v = c && c.value; if (i > h && j === col) names.push(v); else rest.push([i, j, v && typeof v === 'object' ? JSON.stringify(v) : v]); }));
  return { names, rest: JSON.stringify(rest) };
}

test('test_helper_returns_display_name_else_the_name_shown_today', () => {
  const api = setup();
  assert.equal(api.displayNameOf(0, 'Cora Ctest'), 'Cora Ctest', 'nothing set: the name as given');
  assert.equal(api.displayNameOf(0, 'Nobody Here'), 'Nobody Here', 'unknown name: unchanged');
  assert.equal(api.displayNameOf(0, 'Nobody Here', '(unnamed)'), '(unnamed)', 'fallback when asked');
  setDisplay(api, 0, 'Cora Ctest', '  Cora C  ');
  assert.equal(api.displayNameOf(0, 'Cora Ctest'), 'Cora C', 'trimmed');
  assert.equal(api.displayNameOf(0, 'cora ctest'), 'Cora C', 'same person in another case');
  assert.equal(api.displayNameForRecord(recOf(api, 0, 'Cora Ctest')), 'Cora C');
  setDisplay(api, 0, 'Cora Ctest', '   ');
  assert.equal(api.displayNameOf(0, 'Cora Ctest'), 'Cora Ctest', 'blank: not set');
  assert.equal(api.displayNameForRecord(null), '');
});

test('test_one_display_name_covers_every_entity_of_the_person', () => {
  const api = setup();
  api.assignTngIds();
  const a = recOf(api, 0, 'Avery Atest'), f = recOf(api, 1, 'Fern Ftest');
  api.linkSamePerson(a.id, f.id);
  a.display_name = 'Avery One';
  assert.equal(api.displayNameOf(1, 'Fern Ftest'), 'Avery One', 'a record of the same person without its own copy still shows it');
  f.display_name = 'Avery One';
  assert.equal(api.displayNameOf(1, 'Fern Ftest'), 'Avery One');
});

test('test_no_display_names_files_are_unchanged', async () => {
  const api = setup();
  const before = cells(await combined(api));
  const pdfBefore = await pdfBodies(api);
  // Empty or blank values count as not set.
  setDisplay(api, 0, 'Cora Ctest', '');
  setDisplay(api, 0, 'Avery Atest', '   ');
  assert.equal(cells(await combined(api)), before);
  assert.ok(pdfBefore.length > 100);
  assert.ok((await pdfBodies(api)) === pdfBefore, 'PDF unchanged');
});

test('test_payroll_report_prints_display_name_pay_unchanged', async () => {
  const api = setup();
  const a = split(await combined(api));
  const pay = api._collectExportData().flatMap(d => d.rows.map(r => [r._empName, r._totalPay, r._breakdown.deposit, r._breakdown.cash]));
  setDisplay(api, 0, 'Cora Ctest', 'Cora C');
  const b = split(await combined(api));
  assert.equal(b.rest, a.rest, 'every cell but the names is the same');
  assert.deepEqual(b.names.filter(n => n !== a.names[b.names.indexOf(n)]), ['Cora C']);
  assert.ok(b.names.includes('Cora C') && !b.names.includes('Cora Ctest'));
  assert.deepEqual(api._collectExportData().flatMap(d => d.rows.map(r => [r._empName, r._totalPay, r._breakdown.deposit, r._breakdown.cash])), pay, 'pay and keys unchanged');
  // A Display Name prints as typed whatever the name setting; the others follow it as before.
  api.setExportNameMode('all', 'firstLast');
  let n = split(await combined(api)).names;
  assert.ok(n.includes('Cora C') && n.includes('BRAM BTEST'));
  api.setExportNameMode('all', 'first');
  n = split(await combined(api)).names;
  assert.ok(n.includes('Cora C') && n.includes('BRAM'));
  api.setExportNameMode('all', 'saved');
  // PDF Employee column too.
  const body = await pdfBodies(api);
  assert.match(body, /Cora C"/); assert.doesNotMatch(body, /Cora Ctest/);
});

test('test_accountant_file_keeps_its_names', async () => {
  const api = setup();
  completeAccountant(api);
  await api.exportAccountantFile();
  const before = cells(api.__lastExcelWorkbook);
  setDisplay(api, 0, 'Cora Ctest', 'Cora C');
  setDisplay(api, 0, 'Avery Atest', 'Avery A');
  await api.exportAccountantFile();
  assert.equal(cells(api.__lastExcelWorkbook), before, 'Accountant Name, else the saved name');
});

test('test_screens_show_display_name_and_keep_the_matching_name', () => {
  const api = setup();
  const doc = api.__sandbox.document;
  setDisplay(api, 0, 'Cora Ctest', 'Cora C');
  const cell = api.inlineEditableNameHtml(0, 'Cora Ctest', 'payroll', () => {});
  assert.match(cell, />Cora C<\/span>$/);
  assert.match(cell, /data-name="Cora Ctest"/, 'rename and matching still use the name');
  assert.match(cell, /matches timecards as Cora Ctest/);
  assert.match(api.inlineEditableNameHtml(0, 'Cora Ctest', 'schedule', () => {}), />Cora Ctest<\/span>$/, 'the schedule keeps its own text');
  assert.match(api.inlineEditableNameHtml(0, 'Bram Btest', 'payroll', () => {}), /title="Click to rename"/, 'unchanged without one');
  const chips = []; doc.getElementById('payrollInfoBar').appendChild = (c) => { chips.push(c.innerHTML); };
  api.renderPayrollEntityContent(0);
  ['payrollGrid', 'payrollCalcTable', 'timecardDataTable'].forEach(id => assert.match(doc.getElementById(id).innerHTML, />Cora C<\/span>/, id));
  assert.ok(chips.some(h => /class="name"[^>]*>Cora C</.test(h)), 'summary card');
  assert.ok(chips.some(h => /class="name"[^>]*>Bram Btest</.test(h)), 'others unchanged');
  // Stats
  const st = api.entityStats(0).people.find(p => p.name === 'Cora Ctest');
  assert.equal(st.display, 'Cora C');
  // Labor Cost lines and the short-week panel
  api.renderLaborCostPanel(0);
  const lab = api.__sandbox.document.getElementById('laborCostHost').innerHTML;
  assert.match(lab, /Flat, no hours this week|Outside pay week|Semi-monthly|Wages only/);
  api.renderStatsTable(0);
  assert.match(api.__sandbox.document.getElementById('statsTable').innerHTML, /class="name-cell">Cora C</);
  api.splitAmounts[api.wKey(0, 'Cora Ctest')] = { deposit: 640, typed: true, isWhole: true };
  assert.match(api._shortWeekHtml(), /<b>Cora C<\/b> \(Alpha Test\)/);
  assert.match(api._shortWeekHtml(), /setShortWeekChoice\(0,'Cora Ctest'/, 'the choice keys on the name');
});

test('test_rate_and_bonus_panels_show_display_name', () => {
  const api = setup();
  api.assignTngIds();
  const a = recOf(api, 0, 'Avery Atest'), f = recOf(api, 1, 'Fern Ftest');
  api.linkSamePerson(a.id, f.id);
  a.display_name = 'Avery One'; f.display_name = 'Avery One';
  assert.match(api._rateConflictHtml(), /<b>Avery One<\/b>/);
  api.addBonus(0, 'Cora Ctest', { type: 'monthly', amount: 25, pay: 'deposit' });
  setDisplay(api, 0, 'Cora Ctest', 'Cora C');
  api.renderBonusPanel();
  assert.match(api.__sandbox.document.getElementById('bonusPanel').innerHTML, /bonus-who">Cora C <span/);
});

// The reviewed-timecards file is read back by the tool, so it keeps the matching name.
function intakeSetup() {
  const api = loadApp();
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true; api.__sandbox.crypto = webcrypto;
  const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
  const ent = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(ent);
  api.parseSchedule([['Name', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ['Juno Jtest', 'OFF', '9:00-17:00', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF']], 0);
  const e = api.entities[0]; e.dateLabels = WEEK.slice();
  api.ensureIntakeState(e);
  const r = api.processReviewRow({ empName: 'Juno Jtest', date: '2026-08-10', clockIn1: '09:00', clockOut1: '17:00', confidence: 0.95, source: 'TC', originalName: 'x.jpg' }, e);
  e.intake.reviewRows.push(r); api.approveReviewRow(r.id);
  api.dispatch({ type: 'wage', screen: 'payroll', target: { kind: 'employee', entity: 0, id: api.wKey(0, 'Juno Jtest'), field: 'wage' }, from: null, to: 10, meta: { empName: 'Juno Jtest' } });
  api.syncActualsFromReview();
  return { api, e, r };
}

test('test_timecards_file_keeps_matching_name_and_reimport_matches', async () => {
  const { api, e, r } = intakeSetup();
  const id = api.wKey(0, 'Juno Jtest');
  api.session.roster.byId[id].display_name = 'Juno';
  // The review screen shows it; the bucket key does not change.
  const review = api.renderReviewTableHtml(e, 0);
  assert.match(review, />Juno<span class="cnt">/);
  assert.match(review, /setEmpSubtab\(0,'Juno Jtest'\)/);
  await api.exportActualsIntakeExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const H = api.ACTUALS_INTAKE_HEADERS.map(h => h.toLowerCase());
  const row = ws.rows.find(x => x && x[17] && x[17].value === r.id);
  assert.equal(row[2].value, 'Juno Jtest', 'Employee Name column keeps the matching name');
  const text = (c) => { const v = c && c.value; if (v == null) return ''; if (typeof v === 'object' && 'formula' in v) return String(v.result); if (typeof v === 'number' && c.numFmt === 'h:mm AM/PM') { const m = Math.round(v * 1440) % 1440; return api.to12h(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')); } if (typeof v === 'number' && c.numFmt === 'yyyy-mm-dd') return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10); return String(v); };
  const cm = {}; H.forEach((h, i) => { cm[h] = i; });
  const vals = H.map((_, i) => text(row[i + 1]));
  e.intake.reviewRows = [];
  api._ingestActualsIntakeRows([vals], cm);
  api.syncActualsFromReview();
  const back = api._collectExportData()[0].rows.find(x => x._empName === 'Juno Jtest');
  assert.ok(back && back.actualHours > 0, 'matched back to the same person');
  assert.equal(api.wKey(0, 'Juno Jtest'), id, 'same ID');
});

test('test_snapshot_keeps_display_names', async () => {
  const api = setup();
  setDisplay(api, 0, 'Cora Ctest', 'Cora C');
  const snap = JSON.parse(JSON.stringify(await api.buildSnapshot()));
  const B = loadApp();
  B.__sandbox.alert = () => {}; B.__sandbox.confirm = () => true; B.__sandbox.crypto = webcrypto;
  assert.equal(B.openSnapshotData(snap).ok, true);
  assert.equal(B.displayNameOf(0, 'Cora Ctest'), 'Cora C');
  assert.equal(B.displayNameOf(0, 'Bram Btest'), 'Bram Btest');
});

test('test_week_over_week_and_pay_gate_show_display_name', () => {
  const api = setup();
  setDisplay(api, 0, 'Cora Ctest', 'Cora C');
  const html = api._weekFilterBannerHtml(api.entities[0], { excludedActuals: [{ empName: 'Cora Ctest', date: '2026-08-02', hours: 8 }], weekInfo: { start: '2026-08-09', end: '2026-08-15' } });
  assert.match(html, /<li>Cora C — /);
  assert.equal(rowOf(api, 'Cora Ctest')._empName, 'Cora Ctest', 'the row key is unchanged');
});
