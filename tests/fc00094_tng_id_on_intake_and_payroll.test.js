// FC-00094: the person's TNG ID next to the entity's Employee ID on Actuals Intake and the Payroll
// tab. Looking never numbers anyone and never creates a record. Invented names only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, rowOf } = require('./fc70-helpers');

const recs = (api) => Object.values(api.session.roster.byId).filter(r => r && r.canonical_name);
const recOf = (api, ent, name) => recs(api).find(r => r.entity === ent && r.canonical_name === name);
const html = (api, id) => api.__sandbox.document.getElementById(id).innerHTML;
const openPayroll = (api, idx) => { api.setTab('payroll'); api.switchPayrollEntity(idx || 0); };
// The ID cell of the row whose name cell carries this name.
const idsCellFor = (tableHtml, name) => {
  const at = tableHtml.indexOf(`data-name="${name}"`);
  assert.ok(at >= 0, 'row for ' + name);
  const from = tableHtml.indexOf('ids-cell', at);
  return tableHtml.slice(from, tableHtml.indexOf('</td>', from));
};
// As after a register is loaded: Employee IDs show as numbers, not "ID pending".
const registerLoaded = (api) => {
  const m = {};
  recs(api).forEach(r => { const [, code, n] = r.id.split('_'); m[code] = Math.max(m[code] || 0, +n); });
  api.session._fileIdMax = m;
};
const payTables = (api) => ['payrollCalcTable', 'timecardDataTable', 'payrollGrid'].map(id => [id, html(api, id)]);

// One approved Actuals Intake row for Avery Atest at Alpha Test.
function withIntakeRow(api) {
  const e = api.entities[0];
  api.ensureIntakeState(e);
  const r = api.processReviewRow({ empName: 'Avery Atest', date: '2026-08-10', clockIn1: '08:00', clockOut1: '17:00', confidence: 0.95, source: 'TC', originalName: 'card-a.jpg' }, e);
  e.intake.reviewRows.push(r);
  e.intake.activeEmpTab = 'Avery Atest';
  return { e, r };
}
const reviewIdsCell = (api, e) => {
  const h = api.renderReviewTableHtml(e, 0);
  const at = h.indexOf('class="emp-id-cell ids-cell"');
  assert.ok(at >= 0, 'the review row has the ID cell');
  return { all: h, cell: h.slice(at, h.indexOf('</td>', at)) };
};

test('test_helper_shows_the_tng_id_or_tng_pending_and_numbers_nobody', () => {
  const api = setup();
  const before = recs(api).length;
  assert.equal(api.tngIdText(0, 'Avery Atest'), 'TNG pending');
  assert.equal(api.tngIdText(0, 'Nobody Here'), '', 'a name that is nobody');
  assert.equal(recs(api).length, before, 'no record created');
  assert.equal(recs(api).filter(r => r.tng).length, 0, 'nobody numbered');
  api.assignTngIds();
  const t = recOf(api, 0, 'Avery Atest').tng;
  assert.match(t, /^TNG\d{5}$/);
  assert.equal(api.tngIdText(0, 'avery atest'), t, 'the same person in another case');
  const cell = api._idsCellHtml(0, 'Avery Atest', 'EMP_ALP_00001');
  assert.match(cell, new RegExp(`<span class="ids-tng"[^>]*>${t}</span><span class="ids-emp"[^>]*>EMP_ALP_00001</span>`));
  assert.match(api.IDS_HEAD, /TNG ID.*Employee ID/);
});

test('test_intake_row_shows_both_ids', () => {
  const api = setup();
  api.assignTngIds();
  const { e } = withIntakeRow(api);
  registerLoaded(api);
  const rec = recOf(api, 0, 'Avery Atest');
  const { all, cell } = reviewIdsCell(api, e);
  assert.match(all, /<th style="width:110px">TNG ID<div class="ids-sub">Employee ID<\/div><\/th>/);
  assert.match(cell, new RegExp(`class="ids-tng"[^>]*>${rec.tng}</span>`));
  assert.match(cell, new RegExp(`class="ids-emp"[^>]*>${rec.id}</span>`));
  assert.ok(cell.indexOf(rec.tng) < cell.indexOf(rec.id), 'TNG ID first, Employee ID under it');
});

test('test_payroll_rows_show_both_ids_in_every_table', () => {
  const api = setup();
  api.assignTngIds();
  registerLoaded(api);
  openPayroll(api, 0);
  const rec = recOf(api, 0, 'Bram Btest');
  for (const [id, h] of payTables(api)) {
    assert.match(h, /TNG ID<div class="ids-sub">Employee ID<\/div>/, id + ' heading');
    const cell = idsCellFor(h, 'Bram Btest');
    assert.match(cell, new RegExp(`class="ids-tng"[^>]*>${rec.tng}</span>`), id);
    assert.match(cell, new RegExp(`class="ids-emp"[^>]*>${rec.id}</span>`), id);
  }
});

test('test_paid_without_a_schedule_table_shows_both_ids', () => {
  const api = setup();
  api.entities.forEach(e => { e.dateLabels = ['Aug 16 2026', 'Aug 17 2026', 'Aug 18 2026', 'Aug 19 2026', 'Aug 20 2026', 'Aug 21 2026', 'Aug 22 2026']; });
  api.addNoSchedPerson(0, 'Lark', 'Ltest', { amount: 480, method: 'deposit' });
  const lark = recOf(api, 0, 'Lark Ltest');
  registerLoaded(api);
  openPayroll(api, 0);
  let sec = api._nsPayrollSectionHtml(api.entities[0]);
  let row = sec.slice(sec.indexOf(`data-ns="${lark.id}"`));
  row = row.slice(0, row.indexOf('</tr>'));
  assert.match(sec, /<th>TNG ID<div class="ids-sub">Employee ID<\/div><\/th>/);
  assert.match(row, /class="ids-tng ids-pending"[^>]*>TNG pending</);
  assert.equal(lark.tng, undefined, 'still not numbered');
  api.assignTngIds();
  sec = api._nsPayrollSectionHtml(api.entities[0]);
  row = sec.slice(sec.indexOf(`data-ns="${lark.id}"`));
  row = row.slice(0, row.indexOf('</tr>'));
  assert.match(row, new RegExp(`class="ids-tng"[^>]*>${lark.tng}</span><span class="ids-emp"[^>]*>${lark.id}</span>`));
});

test('test_unnumbered_people_show_tng_pending_and_looking_numbers_nobody', () => {
  const api = setup();
  const { e } = withIntakeRow(api);
  const count = recs(api).length;
  const { cell } = reviewIdsCell(api, e);
  assert.match(cell, /class="ids-tng ids-pending"[^>]*>TNG pending</);
  openPayroll(api, 0);
  openPayroll(api, 1);
  openPayroll(api, 0);
  for (const [id, h] of payTables(api)) assert.match(idsCellFor(h, 'Cora Ctest'), /TNG pending<\/span><span class="ids-emp"[^>]*>ID pending</, id);
  assert.equal(recs(api).filter(r => r.tng).length, 0, 'nobody numbered by looking');
  assert.equal(recs(api).length, count, 'no record created by looking');
  assert.equal(api._tngBrowserHigh(), 0, 'the browser\'s highest number is untouched');
});

test('test_a_linked_person_shows_the_same_tng_id_at_both_entities', () => {
  const api = setup();
  api.assignTngIds();
  const a = recOf(api, 0, 'Avery Atest'), f = recOf(api, 1, 'Fern Ftest');
  assert.notEqual(a.tng, f.tng);
  api.linkSamePerson(a.id, f.id);
  assert.equal(f.tng, a.tng);
  registerLoaded(api);
  openPayroll(api, 0);
  const alpha = idsCellFor(html(api, 'payrollCalcTable'), 'Avery Atest');
  openPayroll(api, 1);
  const beta = idsCellFor(html(api, 'payrollCalcTable'), 'Fern Ftest');
  assert.match(alpha, new RegExp(`>${a.tng}</span><span class="ids-emp"[^>]*>${a.id}<`));
  assert.match(beta, new RegExp(`>${a.tng}</span><span class="ids-emp"[^>]*>${f.id}<`), 'same TNG ID, the entity\'s own Employee ID');
  assert.notEqual(a.id, f.id);
});

test('test_pay_is_unchanged_by_showing_ids', () => {
  const a = setup(), b = setup();
  b.assignTngIds();
  openPayroll(b, 0); openPayroll(b, 1);
  const strip = (api) => JSON.stringify(api._collectExportData().map(d => d.rows.map(r => [r._empName, r._breakdown.deposit, r._breakdown.cash, r._breakdown.actualFinal])));
  assert.equal(strip(a), strip(b));
  assert.equal(rowOf(b, 'Dane Dtest')._breakdown.actualFinal, rowOf(a, 'Dane Dtest')._breakdown.actualFinal);
});
