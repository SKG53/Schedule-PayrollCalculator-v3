// FC-00066: a day from outside the pay week can be paid in this run with its real date; the
// settings file remembers it, and the next run leaves a matching row out on its own (one-click
// undo). An inactive person paid this way is on the report as "(final pay)". Invented data only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const NEXT = ['Aug 16 2026', 'Aug 17 2026', 'Aug 18 2026', 'Aug 19 2026', 'Aug 20 2026', 'Aug 21 2026', 'Aug 22 2026'];
const SH = ['', '9AM - 5PM', '9AM - 5PM', '', '', '', ''];

function setup(labels) {
  const api = loadApp({ savedNames: true });
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  const e = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [{ name: 'Avery', shifts: SH }, { name: 'Bram', shifts: SH }], dateLabels: labels || WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(e);
  api.ensureIntakeState(e);
  api.wageRates[api.wKey(0, 'Avery')] = 10;
  api.wageRates[api.wKey(0, 'Bram')] = 10;
  const add = (name, date, i, o) => {
    const r = api.processReviewRow({ empName: name, date, clockIn1: i, clockOut1: o, clockIn2: '', clockOut2: '', confidence: 0.95, source: 'TC', originalName: name + '.jpg' }, e);
    e.intake.reviewRows.push(r); return r;
  };
  api.setTab('intake');
  return { api, e, add };
}
const avery = (api) => { const c = api.computePayrollForEntity(0); return c.results.concat(c.orphanRows).find(r => (r.schedName || r.name) === 'Avery'); };

test('test_toggle_off_pay_unchanged', () => {
  const { api, add } = setup();
  const a = add('Avery', '2026-08-10', '09:00', '17:00');
  const out = add('Avery', '2026-08-16', '09:00', '13:00');
  api.approveReviewRow(a.id); api.approveReviewRow(out.id);
  api.syncActualsFromReview();
  const r = avery(api);
  assert.equal(r.actualHours, 8, 'the outside day is not paid while the toggle is off');
  assert.equal(r.outsideDays.length, 0);
  assert.equal(api.computePayrollForEntity(0).excludedActuals.length, 1, 'and is still reported as left out by the week filter');
});

test('test_after_week_row_paid_with_real_date', () => {
  const { api, e, add } = setup();
  const a = add('Avery', '2026-08-10', '09:00', '17:00');
  const out = add('Avery', '2026-08-16', '09:00', '13:30');
  api.approveReviewRow(a.id); api.approveReviewRow(out.id);
  assert.equal(api.setRowPayOutside(out.id, true), true);
  const r = avery(api);
  assert.equal(r.actualHours, 12.5, '8 h in the week + 4.5 h outside');
  assert.equal(r.pay, 125);
  assert.equal(r.outsideDays[0].iso, '2026-08-16', 'keeps its real date');
  assert.equal(r.days[0].billableH, 0, 'never stacked onto the Sunday of this week');
  assert.equal(api.computePayrollForEntity(0).excludedActuals.length, 0);
  // Hours sheet: the real date, marked.
  api.exportCombinedExcel && api.__sandbox;
  const data = api._collectExportData();
  const wb = { addWorksheet: (n) => { const rows = []; const ws = { rows, addRow: (v) => { const cells = {}; const row = { number: rows.length + 1, values: v, getCell: (i) => (cells[i] = cells[i] || { value: (v || [])[i - 1] }), eachCell: () => {}, font: {} }; rows.push(row); return row; }, getColumn: () => ({}), views: [] }; return ws; } };
  const sheetHolder = {};
  const realAdd = wb.addWorksheet; wb.addWorksheet = (n) => (sheetHolder.ws = realAdd(n));
  api._writeHoursDetailSheet(wb, data);
  const rows = sheetHolder.ws.rows;
  const hdr = rows.find(x => (x.values || [])[0] === 'Entity').values;
  assert.equal(hdr[hdr.length - 1], 'Note');
  const noteCol = hdr.length;
  const marked = rows.filter(x => x.getCell(noteCol).value === 'Outside pay week · paid in this run');
  assert.equal(marked.length, 1, 'one Hours row, marked as outside the pay week');
  void e;
});

test('test_before_week_row_paid_with_real_date', () => {
  const { api, add } = setup(NEXT);
  const late = add('Avery', '2026-08-11', '09:00', '15:00');
  api.approveReviewRow(late.id);
  api.setRowPayOutside(late.id, true);
  const r = avery(api);
  assert.equal(r.actualHours, 6);
  assert.equal(r.outsideDays[0].iso, '2026-08-11');
});

test('test_unapproved_toggled_row_stops_export', () => {
  const { api, add } = setup();
  const out = add('Avery', '2026-08-16', '09:00', '13:00');
  assert.equal(api.unpaidReviewRows().length, 0, 'an outside row is not asked about while not chosen');
  api.setRowPayOutside(out.id, true);
  const u = api.unpaidReviewRows();
  assert.equal(u.length, 1, 'chosen to pay but not approved → the export asks');
  assert.equal(u[0].row.id, out.id);
});

test('test_settings_file_round_trips_paid_outside_rows', () => {
  const { api, add } = setup();
  const out = add('Avery', '2026-08-16', '09:00', '13:30');
  api.approveReviewRow(out.id);
  api.setRowPayOutside(out.id, true);
  const rows = api._toolSettingsRows().filter(x => /^Paid outside the pay week/.test(x[0]));
  assert.equal(rows.length, 1);
  assert.match(rows[0][0], /^Paid outside the pay week · \S+ · 2026-08-16$/);
  assert.equal(rows[0][1], '09:00–13:30 · 4.50 h · paid in the 08/09/26–08/15/26 run');
  const p = api._parsePaidOutValue(rows[0][1]);
  assert.deepEqual(p.pairs, [[540, 810]]);
  assert.equal(p.hours, 4.5);
  assert.equal(p.run, '08/09/26–08/15/26');
});

function nextRun(rowsFromFile, id) {
  const { api, e, add } = setup(NEXT);
  // The record of the person comes from the file; give Avery that ID (as a settings load does).
  const rec = api.ensureRosterRecord(0, 'Avery', id);
  api._ingestToolSettings(rowsFromFile);
  return { api, e, add, rec };
}

test('test_next_run_blocks_matching_row_and_says_why', () => {
  const first = setup();
  const out = first.add('Avery', '2026-08-16', '09:00', '13:30');
  first.api.approveReviewRow(out.id); first.api.setRowPayOutside(out.id, true);
  const id = first.api.ensureRosterRecord(0, 'Avery').id;
  const fileRows = first.api._toolSettingsRows().filter(x => /^Paid outside/.test(x[0]));
  const { api, e, add } = nextRun(fileRows, id);
  const again = add('Avery', '2026-08-16', '09:02', '13:28');
  const other = add('Avery', '2026-08-17', '09:00', '17:00');
  api.approveReviewRow(again.id); api.approveReviewRow(other.id);
  api.syncActualsFromReview();
  const rec = api.paidBeforeRecord(again, e);
  assert.ok(rec, 'same person, same date, overlapping punches');
  assert.equal(rec.run, '08/09/26–08/15/26');
  assert.equal(avery(api).actualHours, 8, 'only Monday is paid; the Sunday paid last run is not paid again');
  e.intake.activeEmpTab = 'Avery';
  const html = api.renderReviewTableHtml(e, 0);
  assert.match(html, /Paid in the 08\/09\/26–08\/15\/26 run · not paid again/);
  assert.match(api._leftOutNoteText(e), /Not paid again: Avery · Sun Aug 16 · .* \(paid in the 08\/09\/26–08\/15\/26 run\)/);
  assert.equal(api.unpaidReviewRows().length, 0);
});

test('test_undo_block_pays_and_logs', () => {
  const first = setup();
  const out = first.add('Avery', '2026-08-16', '09:00', '13:30');
  first.api.approveReviewRow(out.id); first.api.setRowPayOutside(out.id, true);
  const id = first.api.ensureRosterRecord(0, 'Avery').id;
  const { api, add } = nextRun(first.api._toolSettingsRows().filter(x => /^Paid outside/.test(x[0])), id);
  const again = add('Avery', '2026-08-16', '09:00', '13:30');
  api.approveReviewRow(again.id);
  api.syncActualsFromReview();
  assert.equal(avery(api).actualHours, 0);
  assert.equal(api.setRowPaidBeforeOk(again.id, true), true);
  assert.equal(avery(api).actualHours, 4.5, 'paid after "Pay it anyway"');
  const entry = api.session.log.filter(x => x.type === 'reviewPaidBefore').pop();
  assert.ok(entry, 'the choice is in the history');
  api.revert(entry.id);
  api.syncActualsFromReview();
  assert.equal(avery(api).actualHours, 0, 'undo leaves it out again');
});

test('test_non_matching_rows_not_blocked', () => {
  const first = setup();
  const out = first.add('Avery', '2026-08-16', '09:00', '13:30');
  first.api.approveReviewRow(out.id); first.api.setRowPayOutside(out.id, true);
  const id = first.api.ensureRosterRecord(0, 'Avery').id;
  const { api, e, add } = nextRun(first.api._toolSettingsRows().filter(x => /^Paid outside/.test(x[0])), id);
  const evening = add('Avery', '2026-08-16', '17:00', '21:00');
  const bram = add('Bram', '2026-08-16', '09:00', '13:30');
  const otherDay = add('Avery', '2026-08-18', '09:00', '13:30');
  [evening, bram, otherDay].forEach(r => api.approveReviewRow(r.id));
  assert.equal(api.paidBeforeRecord(evening, e), null, 'same date, no overlap');
  assert.equal(api.paidBeforeRecord(bram, e), null, 'another person');
  assert.equal(api.paidBeforeRecord(otherDay, e), null, 'another date');
});

test('test_final_pay_label_when_inactive', () => {
  const { api, add } = setup();
  const a = add('Avery', '2026-08-10', '09:00', '17:00');
  const out = add('Avery', '2026-08-16', '09:00', '13:00');
  api.approveReviewRow(a.id); api.approveReviewRow(out.id);
  api.setRowPayOutside(out.id, true);
  api.setRosterActive(0, 'Avery', false);
  const row = api._collectExportData()[0].rows.find(r => r._empName === 'Avery');
  assert.ok(row, 'inactive but paid a day outside the week: still on this run');
  assert.equal(row._finalPay, true);
  assert.equal(row.actualHours, 12);
  const cols = api._columnsFor('combined');
  const vals = cols.rowFn(row);
  assert.ok(vals.some(v => typeof v === 'string' && /\(final pay\)$/.test(v)), 'the report row reads NAME (final pay)');
  api.setRowPayOutside(out.id, false);
  assert.equal(api._collectExportData()[0].rows.find(r => r._empName === 'Avery'), undefined, 'without it, inactive = left out (FC-00035)');
});

test('test_stats_skip_and_labor_cost_dated_line', () => {
  const { api, add } = setup();
  const a = add('Avery', '2026-08-10', '09:00', '17:00');
  const out = add('Avery', '2026-08-16', '09:00', '13:00');
  api.approveReviewRow(a.id); api.approveReviewRow(out.id);
  api.setRowPayOutside(out.id, true);
  api.syncActualsFromReview();
  const st = api.entityStats(0).people.find(p => p.name === 'Avery');
  assert.equal(st.worked, 8, 'Stats compare with the schedule: the outside day is not in it');
  const lc = api.entityLaborCost(0);
  assert.equal(lc.outside.length, 1);
  assert.equal(lc.outside[0].iso, '2026-08-16');
  assert.equal(lc.outside[0].cost, 40);
  assert.equal(lc.week.cost, 80, 'the week table holds only the week');
  assert.equal(Math.round((lc.week.cost + lc.fixedSum + lc.outsideSum) * 100) / 100, lc.payrollActual, 'still ties to the payroll Actual');
  const tc = api._gatherActualsIntakeRows().find(r => r.date === '2026-08-16');
  assert.ok(tc.flags.some(f => /^Outside pay week · paid in the 08\/09\/26–08\/15\/26 run$/.test(f)), 'the Timecards Excel keeps the real date and marks it');
});

// ---- review fixes ----
test('test_untoggled_row_same_outside_day_not_paid', () => {
  const { api, add } = setup();
  const am = add('Avery', '2026-08-16', '09:00', '13:00');
  const pm = add('Avery', '2026-08-16', '14:00', '18:00');
  api.approveReviewRow(am.id); api.approveReviewRow(pm.id);
  api.setRowPayOutside(am.id, true);
  assert.equal(avery(api).actualHours, 4, 'only the row chosen is paid, not every row of that day');
  const rows = api._toolSettingsRows().filter(x => /^Paid outside/.test(x[0]));
  assert.equal(rows[0][1], '09:00–13:00 · 4.00 h · paid in the 08/09/26–08/15/26 run', 'and only it is recorded');
});

test('test_settings_record_written_without_payroll_tab', () => {
  const { api, add } = setup();
  const out = add('Avery', '2026-08-16', '09:00', '13:00');
  api.setRowPayOutside(out.id, true, true);
  out.approved = true; // approved on Actuals Intake; payroll not rebuilt yet
  const rows = api._toolSettingsRows().filter(x => /^Paid outside/.test(x[0]));
  assert.equal(rows.length, 1, 'the settings file brings payroll up to date before writing');
});

test('test_same_run_record_dropped_after_undo', () => {
  const { api, add } = setup();
  const out = add('Avery', '2026-08-16', '09:00', '13:00');
  api.approveReviewRow(out.id); api.setRowPayOutside(out.id, true);
  const file = api._toolSettingsRows().filter(x => /^Paid outside/.test(x[0]));
  api._ingestToolSettings(file); // this week's own file loaded again
  api.setRowPayOutside(out.id, false);
  assert.equal(api._toolSettingsRows().filter(x => /^Paid outside/.test(x[0])).length, 0, 'undone in this run → not written');
  assert.equal(api.paidBeforeRecord(out, api.entities[0]), null, 'and never blocks its own run');
});

test('test_timecards_reimport_restores_toggle', () => {
  const { api, e, add } = setup();
  const out = add('Avery', '2026-08-16', '09:00', '13:00');
  api.approveReviewRow(out.id); api.setRowPayOutside(out.id, true);
  const g = api._gatherActualsIntakeRows().find(r => r.date === '2026-08-16');
  const H = api.ACTUALS_INTAKE_HEADERS.map(h => h.toLowerCase());
  const cm = {}; H.forEach((h, i) => { cm[h] = i; });
  const row = H.map(() => '');
  row[cm.entity] = 'Alpha Test'; row[cm['employee name']] = 'Avery'; row[cm.date] = '2026-08-16';
  row[cm['clock in 1']] = '09:00'; row[cm['clock out 1']] = '13:00'; row[cm.approved] = 'Yes'; row[cm.source] = 'TC';
  row[cm.flags] = g.flags.join('; ');
  e.intake.reviewRows.length = 0;
  api._ingestActualsIntakeRows([row], cm);
  const back = e.intake.reviewRows.find(r => r.date === '2026-08-16');
  assert.equal(back.payOutside, true, 'the toggle comes back');
  assert.ok(!(back.flags || []).some(f => /paid in the/.test(f)), 'the mark is not kept as a plain flag');
});

test('test_pay_button_only_for_recognized_people', () => {
  const { api, e, add } = setup();
  const u = add('Nobody Known', '2026-08-16', '09:00', '13:00');
  assert.equal(api.setRowPayOutside(u.id, true, true), false, 'an unrecognized row cannot be paid this way');
  e.intake.ignoredEmployees = { Avery: true };
  const a = add('Avery', '2026-08-16', '09:00', '13:00');
  assert.equal(api.setRowPayOutside(a.id, true, true), false, 'nor a person whose time cards are ignored');
});
