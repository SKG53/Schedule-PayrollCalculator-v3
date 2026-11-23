// FC-00089: people paid without a schedule on the Payroll tab: the same controls as the Register
// tab, counted with the entity's people, a summary card each, the reminder, and pay unchanged
// whichever tab makes a change. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, rowOf } = require('./fc70-helpers');

const NEXT = ['Aug 16 2026', 'Aug 17 2026', 'Aug 18 2026', 'Aug 19 2026', 'Aug 20 2026', 'Aug 21 2026', 'Aug 22 2026'];
const nextWeek = (api) => api.entities.forEach(e => { e.dateLabels = NEXT.slice(); });
const recOf = (api, ent, name) => api.noSchedRecords().find(r => r.entity === ent && r.canonical_name === name);
const el = (api, id) => api.__sandbox.document.getElementById(id).innerHTML;

// Two people paid without a schedule at Alpha Test, one at Beta Test, each carried from last week.
function withPeople() {
  const api = setup(); nextWeek(api);
  api.addNoSchedPerson(0, 'Lark', 'Ltest', { amount: 500, method: 'deposit', mgmt: true });
  api.addNoSchedPerson(0, 'Mira', 'Mtest', { amount: 310, method: 'cash' });
  api.addNoSchedPerson(1, 'Nell', 'Ntest', { amount: 640, method: 'both', deposit: 400 });
  ['Lark Ltest', 'Mira Mtest'].forEach(n => { const r = recOf(api, 0, n); r.ns_carry = { amount: api.flatWages[r.id], paid: api.flatWages[r.id], week: '2026-08-09' }; });
  const n = recOf(api, 1, 'Nell Ntest'); n.ns_carry = { amount: 640, paid: 640, week: '2026-08-09' };
  return api;
}
const openPayroll = (api, idx) => { api.setTab('payroll'); api.switchPayrollEntity(idx || 0); };

test('test_table_lists_the_entitys_people_with_every_control', () => {
  const api = withPeople();
  assert.deepEqual(api.noSchedOnPayroll(api.entities[0]).map(r => r.canonical_name), ['Lark Ltest', 'Mira Mtest']);
  assert.deepEqual(api.noSchedOnPayroll(api.entities[1]).map(r => r.canonical_name), ['Nell Ntest']);
  openPayroll(api, 0);
  const html = el(api, 'payrollEntityContent');
  assert.match(html, /<h4>Paid without a schedule · 2<\/h4>/);
  const lark = recOf(api, 0, 'Lark Ltest').id;
  assert.ok(html.includes(`setNoSchedAmount('${lark}',this.value,'payroll')`), 'this week\'s amount');
  assert.ok(html.includes(`keepNoSched('${lark}','payroll')`), 'Keep');
  assert.ok(html.includes(`setNoSchedSkip('${lark}',this.checked,'payroll')`), 'Not paid this week');
  assert.ok(html.includes(`setNoSchedMethod('${lark}',this.value)`), 'Pay Method dropdown');
  assert.ok(html.includes(`setNoSchedActive('${lark}',this.checked)`), 'Active');
  assert.ok(html.includes(`setManagement(0,'Lark Ltest',this.checked,'payroll')`), 'Mgmt');
  assert.match(html, /value="500"/, 'starts at last week\'s amount');
  assert.match(html, /Same as last week \(\$500\.00\): keep or change/);
  assert.match(html, /\$500\.00 deposit/);
  assert.match(html, /\$310 cash/);
  assert.doesNotMatch(html, /Nell Ntest/, 'only this entity');
  openPayroll(api, 1);
  const beta = el(api, 'payrollEntityContent');
  assert.ok(beta.includes(`setNoSchedDeposit('${recOf(api, 1, 'Nell Ntest').id}',this.value)`), 'deposit part for Deposit + Cash');
  assert.match(beta, /\$400\.00 deposit \+ \$240 cash/);
});

test('test_someone_on_the_schedule_or_punched_is_not_listed_twice', () => {
  const api = withPeople();
  api.entities[0].employees.push({ name: 'Lark Ltest', shifts: ['', '', '', '', '', '', ''] });
  assert.deepEqual(api.noSchedOnPayroll(api.entities[0]).map(r => r.canonical_name), ['Mira Mtest']);
  api.entities[0].actualDays.push({ empName: 'Mira Mtest', entityName: 'Alpha Test', date: '2026-08-17', dayIdx: 1, pairs: [{ in: 8, out: 12, outAdj: 12, minutes: 240 }] });
  assert.deepEqual(api.noSchedOnPayroll(api.entities[0]), []);
});

test('test_counts_and_summary_cards', () => {
  const api = withPeople();
  openPayroll(api, 0);
  assert.equal(api._payrollEmpCount(api.entities[0]), 7);
  assert.match(el(api, 'payrollEntityContent'), /<span class="n">7<\/span> employees in the system/);
  const bar = el(api, 'payrollEntityTabBar');
  assert.match(bar, /Alpha Test<span class="entity-emp-count"[^>]*><span class="n">7<\/span> employees/);
  assert.match(bar, /Beta Test<span class="entity-emp-count"[^>]*><span class="n">2<\/span> employees/);
  let chips = el(api, 'payrollInfoBar');
  assert.match(chips, /class="info-chip ns-chip"[\s\S]*Lark Ltest[\s\S]*Flat · \$500\.00/);
  assert.match(chips, /Mira Mtest[\s\S]*Flat · \$310\.00[\s\S]*not checked yet/);
  api.setNoSchedSkip(recOf(api, 0, 'Mira Mtest').id, true, 'payroll');
  chips = el(api, 'payrollInfoBar');
  assert.match(chips, /Mira Mtest<\/span><\/div><div class="hrs"[^>]*>Not paid this week</);
  assert.equal(api._payrollEmpCount(api.entities[0]), 7, 'still counted when not paid this week');
});

test('test_each_control_changes_the_same_record_through_history', () => {
  const api = withPeople();
  const lark = recOf(api, 0, 'Lark Ltest'), mira = recOf(api, 0, 'Mira Mtest');
  const top = () => api.historyRows()[0];

  api.setNoSchedAmount(lark.id, '560', 'payroll');
  assert.equal(api.flatWages[lark.id], 560);
  assert.equal(top().screen, 'payroll');
  assert.equal(api.noSchedStatusText(lark), 'Changed from $500.00');
  assert.equal(rowOf(api, 'Lark Ltest')._breakdown.actualFinal, 560);
  api.revertFromHistory(top().id);
  assert.equal(api.flatWages[lark.id], 500, 'one Undo');

  api.keepNoSched(mira.id, 'payroll');
  assert.equal(api.noSchedStatus(mira).state, 'kept');
  assert.equal(top().screen, 'payroll');

  api.setNoSchedMethod(mira.id, 'contract');
  assert.equal(api.payMethod[mira.id], 'contract');
  assert.equal(top().screen, 'payroll');

  api.setManagement(0, 'Mira Mtest', true, 'payroll');
  assert.ok(api.isManagement(0, 'Mira Mtest'));
  assert.equal(top().screen, 'payroll');

  api.setNoSchedActive(mira.id, false);
  assert.equal(api.noSchedStatus(mira).state, 'inactive');
  assert.equal(api._nsPaysText(api.entities[0], mira), 'Not paid (inactive)');
  api.revertFromHistory(top().id);
  assert.notEqual(api.noSchedStatus(mira).state, 'inactive');

  // The Register tab shows the same state.
  api.setNoSchedSkip(lark.id, true, 'payroll');
  api.setTab('register');
  const reg = el(api, 'registerHost');
  const larkRow = reg.slice(reg.indexOf(`data-ns="${lark.id}"`), reg.indexOf('</tr>', reg.indexOf(`data-ns="${lark.id}"`)));
  assert.match(larkRow, /Not paid this week/);
  assert.match(larkRow, /type="checkbox" checked onchange="setNoSchedSkip/);
});

test('test_reminder_on_the_payroll_tab_cleared_there', () => {
  const api = withPeople();
  openPayroll(api, 0);
  let html = el(api, 'payrollEntityContent');
  assert.match(html, /class="ns-remind">⚠ 3 people paid without a schedule not yet checked this week \(Alpha Test 2, Beta Test 1\): keep or change each amount under "Paid without a schedule" on that entity's Payroll tab, or on the Employee Register tab\./);
  api.keepNoSched(recOf(api, 0, 'Lark Ltest').id, 'payroll');
  api.setNoSchedAmount(recOf(api, 0, 'Mira Mtest').id, 335, 'payroll');
  html = el(api, 'payrollEntityContent');
  assert.match(html, /⚠ 1 person paid without a schedule not yet checked this week \(Beta Test 1\)/);
  api.setNoSchedSkip(recOf(api, 1, 'Nell Ntest').id, true, 'payroll');
  assert.equal(api._nsPayrollReminderHtml(), '');
  assert.doesNotMatch(el(api, 'payrollEntityContent'), /class="ns-remind"/);
  assert.equal(api._nsReminderText(), '', 'the Register tab reminder clears too');
});

test('test_pay_report_and_accountant_file_same_from_either_tab', () => {
  const a = withPeople(), b = withPeople();
  const act = (api, screen) => {
    const l = recOf(api, 0, 'Lark Ltest'), m = recOf(api, 0, 'Mira Mtest'), n = recOf(api, 1, 'Nell Ntest');
    api.setNoSchedAmount(l.id, 650, screen);
    api.setNoSchedSkip(m.id, true, screen);
    api.setNoSchedMethod(n.id, 'deposit');
    api.keepNoSched(n.id, screen);
  };
  const before = a._collectExportData().flatMap(d => d.rows).length;
  act(a, 'payroll'); act(b, 'register');
  const strip = (api) => JSON.stringify(api._collectExportData().map(d => d.rows.map(r => [r.name, r._breakdown && r._breakdown.deposit, r._breakdown && r._breakdown.cash, r._breakdown && r._breakdown.actualFinal])));
  assert.equal(strip(a), strip(b));
  assert.equal(a._collectExportData().flatMap(d => d.rows).length, before - 1, 'the person not paid this week is on no report');
  assert.equal(rowOf(a, 'Lark Ltest')._breakdown.deposit, 650);
  assert.equal(rowOf(a, 'Nell Ntest')._breakdown.deposit, 640);
  const acct = (api) => JSON.stringify(api.acctFileModel().entities.map(e => e.rows.map(r => [r.empName, r.salary, r.gross])));
  assert.equal(acct(a), acct(b));
  assert.ok(a.acctSelfCheck().ok);
  assert.ok(a.acctTieOut().every(t => t.ok));
});
