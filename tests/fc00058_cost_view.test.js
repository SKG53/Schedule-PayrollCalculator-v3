// FC-00058: the Weekly Actuals table switches between Hours and Cost. Cost shows each person's
// wage cost per day (their paid Actual spread over their days by minutes, in whole cents) next to
// the scheduled cost (shift hours minus the break, times the rate), with day and week totals that
// tie to the payroll Actual and the Labor Cost tab. Display only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const SHIFT = ['', '9AM - 5PM', '9AM - 5PM', '', '', '', ''];
const d = (empName, dayIdx, inH, outH) => ({ empName, entityName: 'Alpha Test', date: '2026-08-' + (9 + dayIdx), dayIdx, pairs: [{ in: inH, out: outH, outAdj: outH, minutes: Math.round((outH - inH) * 60) }] });
function setup() {
  const api = loadApp({ savedNames: true });
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  const ent = resetToSingleEntity(api, {
    id: 0, name: 'Alpha Test', employees: [{ name: 'Avery', shifts: SHIFT }, { name: 'Bram', shifts: SHIFT }, { name: 'Wren', shifts: SHIFT }],
    dateLabels: WEEK, breakMinutes: 30, breakMinutesSet: true,
    actualDays: [d('Avery', 1, 8.95, 17.1), d('Avery', 2, 9, 16.5), d('Bram', 1, 9, 17.75)],
  });
  api._syncEntityCode(ent);
  api.wageRates[api.wKey(0, 'Avery')] = 15.37; api.payMethod[api.wKey(0, 'Avery')] = 'cash';
  api.wageRates[api.wKey(0, 'Bram')] = 14; api.payMethod[api.wKey(0, 'Bram')] = 'deposit';
  api.flatWages[api.wKey(0, 'Wren')] = 300;
  return api;
}

test('test_person_cost_adds_up_to_their_actual', () => {
  const api = setup();
  const cg = api.entityCostGrid(0);
  const rows = api._collectExportData()[0].rows;
  cg.people.forEach(p => {
    const r = rows.find(x => x._empName === p.name);
    const days = Math.round(p.actual.reduce((a, b) => a + b, 0) * 100) / 100;
    if (!p.weekOnly) assert.equal(days, r._breakdown.actualFinal, p.name + ': days add up to the Actual');
    assert.equal(p.actualWeek, r._breakdown.actualFinal);
  });
});

test('test_scheduled_cost_is_shift_minus_break_times_rate', () => {
  const api = setup();
  const av = api.entityCostGrid(0).people.find(p => p.name === 'Avery');
  assert.equal(av.sched[1], Math.round(7.5 * 15.37 * 100) / 100, '8 h shift − 30 min break, at $15.37');
  assert.equal(av.sched[0], 0, 'no shift, no scheduled cost');
  assert.equal(av.kind, 'hourly');
  const wr = api.entityCostGrid(0).people.find(p => p.name === 'Wren');
  assert.equal(wr.kind, 'flat');
  assert.equal(wr.weekOnly, 300, 'a flat amount with no hours shows in the week column');
});

test('test_totals_tie_to_labor_cost', () => {
  const api = setup();
  const cg = api.entityCostGrid(0), lc = api.entityLaborCost(0);
  assert.equal(cg.week.actual, lc.total, 'week total = Labor Cost total');
  cg.dayTot.forEach((t, i) => assert.equal(t.actual, lc.days[i].cost, 'day ' + i + ' = Labor Cost day'));
  assert.equal(cg.week.sched, lc.week.sched, 'scheduled = Labor Cost scheduled (hourly)');
});

test('test_switch_shows_cost_table_display_only', () => {
  const api = setup();
  const pay = () => JSON.stringify(api._collectExportData());
  const before = pay();
  api.setPayrollGridView('cost');
  assert.equal(api.payrollGridView(), 'cost');
  const html = api.__sandbox.document.getElementById('payrollGrid').innerHTML;
  assert.match(html, /\$15\.37\/h/, 'the rate from the Payroll Calculation table');
  assert.match(html, /sched \$/);
  assert.match(html, /<b>Total<\/b>/);
  assert.equal(pay(), before, 'pay unchanged');
  assert.equal(api.__sandbox.localStorage.getItem('pv26_grid_view'), 'cost', 'a display preference in the browser only');
  api.setPayrollGridView('hours');
  assert.doesNotMatch(api.__sandbox.document.getElementById('payrollGrid').innerHTML, /\$15\.37\/h/);
});
