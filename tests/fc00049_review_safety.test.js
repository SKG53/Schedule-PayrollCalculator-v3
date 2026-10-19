// FC-00049: a payroll export stops on review rows that are neither approved nor left out
// (they would not be paid) and lists them with Approve / Leave out; hours show as h:mm on
// screen (display only); every worked day cell on the Payroll grid shows its break.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const SCHED_HDR = ['Name', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const mon = ['OFF', '9:00AM-5:00PM', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF'];
const tue = ['OFF', 'OFF', '9:00AM-5:00PM', 'OFF', 'OFF', 'OFF', 'OFF'];

function setup() {
  const api = loadApp();
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  api.__sandbox.crypto = webcrypto;
  const ent = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(ent);
  api.parseSchedule([SCHED_HDR, ['AVERY', ...mon], ['BRAM', ...tue]], 0);
  const e = api.entities[0];
  e.dateLabels = WEEK.slice();
  api.ensureIntakeState(e);
  api.wageRates[api.wKey(0, 'AVERY')] = 15;
  api.wageRates[api.wKey(0, 'BRAM')] = 12;
  const add = (name, date, i, o, approve = true) => {
    const r = api.processReviewRow({ empName: name, date, clockIn1: i, clockOut1: o, confidence: 0.95, source: 'TC', originalName: name + date + '.jpg' }, e);
    e.intake.reviewRows.push(r);
    if (approve) api.approveReviewRow(r.id);
    return r;
  };
  const a = add('AVERY', '2026-08-10', '09:00', '17:00');
  const b = add('BRAM', '2026-08-11', '09:00', '16:18', false); // edited, so un-approved: 7:18
  api.syncActualsFromReview();
  // Record every file an export writes.
  const written = [];
  const doc = api.__sandbox.document;
  const origCreate = doc.createElement;
  doc.createElement = (tag) => {
    const el = origCreate(tag);
    if (tag === 'a') el.click = () => { if (el.download) written.push(el.download); };
    return el;
  };
  return { api, e, a, b, written, add };
}
const sheetText = (api) => {
  const ws = api.__sandbox.__lastExcelWorkbook.worksheets[0];
  return ws.rows.slice(1).map(r => (r || []).slice(1).map(c => (c && c.value && c.value.formula) ? c.value.result : (c ? c.value : '')).join('|')).join('\n');
};

test('test_unapproved_row_stops_payroll_export', async () => {
  const { api, b, written } = setup();
  await api.exportCombinedExcel();
  assert.equal(written.length, 0, 'nothing written yet');
  assert.equal(api.payGateIsOpen(), true);
  const html = api._payGateHtml();
  assert.match(html, /BRAM/);
  assert.match(html, /Tue Aug 11/);
  assert.match(html, /9:00 AM–4:18 PM/);
  assert.match(html, /7:18 won't be paid/);
  assert.equal(api.unpaidReviewRows().map(x => x.row.id).join(), b.id);
});

test('test_approve_from_list_then_export_runs', async () => {
  const { api, b, written } = setup();
  await api.exportCombinedExcel();
  await api.payGateApprove(b.id);
  assert.equal(b.approved, true);
  assert.equal(api.payGateIsOpen(), false);
  assert.equal(written.length, 1, 'the export ran once every row was decided');
  const st = api.computePayrollForEntity(0).results.find(r => r.schedName === 'BRAM');
  assert.equal(st.actualHours, 7.3, 'the approved row is paid');
});

test('test_leave_out_not_paid_and_not_asked_again', async () => {
  const { api, b, written } = setup();
  await api.exportCombinedPdf();
  await api.payGateLeaveOut(b.id);
  assert.equal(b.leftOut, true);
  assert.equal(b.approved, false, 'left out is not approved');
  assert.equal(written.length, 0, 'PDF goes through doc.save, not <a>'); // the PDF path saves via jsPDF
  assert.equal(api.payGateIsOpen(), false);
  await api.exportCombinedExcel();
  assert.equal(api.payGateIsOpen(), false, 'not asked again');
  assert.equal(written.length, 1);
  api.syncActualsFromReview();
  const st = api.computePayrollForEntity(0).results.find(r => r.schedName === 'BRAM');
  assert.equal(st.actualHours, 0, 'a left-out row is not paid');
  assert.ok(api.session.log.some(x => x.type === 'reviewLeftOut' && x.to === true), 'kept in History');
});

test('test_undo_leave_out_returns_row_to_unapproved', async () => {
  const { api, b, e } = setup();
  api.setRowLeftOut(b.id, true);
  api.setTab('intake');
  api.renderIntake();
  e.intake.activeEmpTab = 'BRAM';
  const html = api.renderReviewTableHtml(e, 0);
  assert.match(html, /Left out of pay/);
  assert.match(html, /Undo leave out/);
  api.setRowLeftOut(b.id, false);
  assert.equal(!!b.leftOut, false);
  assert.equal(api.unpaidReviewRows().length, 1, 'asked again');
  // Revert from History works too.
  api.setRowLeftOut(b.id, true);
  const entry = api.session.log.filter(x => x.type === 'reviewLeftOut').pop();
  api.revertFromHistory(entry.id);
  assert.equal(!!b.leftOut, false);
  // Approving a left-out row puts it back in pay.
  api.setRowLeftOut(b.id, true);
  api.approveReviewRow(b.id);
  assert.equal(!!b.leftOut, false);
  assert.equal(b.approved, true);
});

test('test_ignored_and_out_of_week_rows_never_stop', async () => {
  const { api, b, e, add, written } = setup();
  api.approveReviewRow(b.id);
  add('AVERY', '2026-08-03', '09:00', '17:00', false); // last week: not paid anyway
  assert.equal(api.unpaidReviewRows().length, 0);
  add('BRAM', '2026-08-12', '09:00', '12:00', false);
  assert.equal(api.unpaidReviewRows().length, 1);
  e.intake.ignoredEmployees = { BRAM: true };
  assert.equal(api.unpaidReviewRows().length, 0, 'ignored employee never stops the export');
  await api.exportCombinedExcel();
  assert.equal(written.length, 1);
});

test('test_timecards_settings_snapshot_exports_never_stop', async () => {
  const { api, written } = setup();
  await api.exportActualsIntakeExcel();
  await api.exportPayrollSettingsExcel(false);
  assert.equal(api.payGateIsOpen(), false);
  assert.equal(written.length, 2);
  const snap = await api.buildSnapshot();
  assert.ok(snap && snap.state, 'snapshot builds');
});

test('test_left_out_note_on_combined_excel', async () => {
  const { api, b } = setup();
  api.setRowLeftOut(b.id, true);
  await api.exportCombinedExcel();
  const txt = sheetText(api);
  assert.match(txt, /Left out of pay: BRAM · Tue Aug 11 · 7:18/);
  // The Timecards Excel records it, and re-import restores it.
  await api.exportActualsIntakeExcel();
  const tc = api.__sandbox.__lastExcelWorkbook.worksheets[0];
  const cells = tc.rows.slice(1).map(r => (r || []).slice(1).map(c => c && c.value));
  assert.ok(cells.some(r => r[1] === 'BRAM' && r[10] === 'Left out'), JSON.stringify(cells));
});

test('test_downloads_ask_once_then_write', async () => {
  const { api, b } = setup();
  const saved = [];
  api.__sandbox.document.createElement = () => ({ style: {}, click() { saved.push(this.download); } });
  const first = await api.downloadSelected();
  assert.equal(first, null);
  assert.equal(api.payGateIsOpen(), true);
  const files = await api.payGateLeaveOut(b.id);
  assert.ok(Array.isArray(files) && files.length > 0, 'the download ran');
  assert.ok(saved.length > 0);
});

test('test_hmm_display_both_hmm_decimal', () => {
  const { api } = setup();
  assert.equal(api.hoursFormat(), 'both', 'default');
  assert.equal(api.fmtHrs(7.98), '7:59 (7.98)');
  api.setHoursFormat('hmm');
  assert.equal(api.fmtHrs(7.98), '7:59');
  api.setHoursFormat('dec');
  assert.equal(api.fmtHrs(7.98), '7.98');
  assert.equal(api.setHoursFormat('weird'), false);
  assert.equal(api.hoursFormat(), 'dec');
  assert.equal(api.fmtHmm(0.5), '0:30');
  assert.equal(api.fmtHmm(26.25), '26:15');
});

test('test_hmm_rounds_minutes_pay_value_unchanged', () => {
  const { api, b } = setup();
  api.approveReviewRow(b.id);
  api.syncActualsFromReview();
  api.renderPayroll();
  const grid = api.__sandbox.document.getElementById('payrollGrid').innerHTML;
  assert.match(grid, /7:18 \(7\.30\)/, 'h:mm with the pay decimal beside it');
  assert.match(grid, /8:00 \(8\.00\)/);
});

test('test_break_line_gap_minimum_override', () => {
  const { api } = setup();
  const day = (extra) => Object.assign({ actual: { pairs: [] }, workedH: 7.5, spanH: 7.5 + 28 / 60, actualBreakH: 28 / 60, breakOverrideMin: null, defaultBreakMin: 0 }, extra);
  assert.equal(api.dayBreakLine(day()), 'break 0:28');
  assert.equal(api.dayBreakLine(day({ spanH: 8, workedH: 8, actualBreakH: 0.5, defaultBreakMin: 30 })), 'break 0:30 min.');
  assert.equal(api.dayBreakLine(day({ actualBreakH: 20 / 60, breakOverrideMin: 20 })), 'break 0:20 set');
  assert.equal(api.dayBreakLine(day({ spanH: 8, workedH: 8, actualBreakH: 0 })), '', 'one pair, no minimum: no line');
  assert.equal(api.dayBreakLine(day({ actual: null })), '');
});

test('test_break_line_in_payroll_grid', () => {
  const { api, e, add } = setup();
  const r = api.processReviewRow({ empName: 'AVERY', date: '2026-08-10', clockIn1: '17:28', clockOut1: '18:00', confidence: 0.95, source: 'TC', originalName: 'x2.jpg' }, e);
  e.intake.reviewRows.push(r);
  api.approveReviewRow(r.id);
  api.syncActualsFromReview();
  api.renderPayroll();
  const grid = api.__sandbox.document.getElementById('payrollGrid').innerHTML;
  assert.match(grid, /class="pay-break-line">break 0:28</);
  assert.ok(add, 'helper available');
});

test('test_pay_identical_with_display_switch', () => {
  const { api, b } = setup();
  api.approveReviewRow(b.id);
  api.syncActualsFromReview();
  const pay = () => JSON.stringify(api._collectExportData().map(d => d.rows.map(r => [r._empName, r.actualHours, r._breakdown])));
  const base = pay();
  ['hmm', 'dec', 'both'].forEach(f => { api.setHoursFormat(f); assert.equal(pay(), base, f); });
});

// Small items from the FC-00046/47/48 review, folded into this card.
test('test_rename_saves_old_spelling', () => {
  const { api } = setup();
  api.renameEmployeeViaDispatcher(0, 'AVERY', 'Avery Stone', 'payroll');
  assert.deepEqual(api.getAliases(0, 'Avery Stone'), ['AVERY']);
});

test('test_settings_file_without_id_column_counts_as_loaded', () => {
  const { api } = setup();
  assert.equal(api._settingsLoadedThisSession(), false);
  const H = ['Entity', 'Employee', 'Wage/hour', 'Pay Method'];
  const cm = {}; H.forEach((h, i) => { cm[h.toLowerCase()] = i; });
  api._ingestPayrollSettings([['Alpha Test', 'AVERY', '15', 'Cash']], cm, false);
  assert.equal(api._settingsLoadedThisSession(), true);
  api.renderSettingsFirstBar();
  assert.match(api.__sandbox.document.getElementById('settingsFirstBar').innerHTML, /Settings file loaded/, 'the prompt stops');
});

test('test_unconfirmed_off_schedule_person_named_in_status', () => {
  const { api, add } = setup();
  add('Zed Quill', '2026-08-12', '09:00', '12:00');
  api.syncActualsFromReview();
  const st = api.downloadStatus('payroll');
  assert.ok(st.reasons.some(x => /^Not on the schedule and not confirmed: Zed Quill/.test(x)), st.reasons.join(' | '));
  api.addNewEmployee(0, 'Zed Quill', null);
  api.syncActualsFromReview();
  assert.ok(!api.downloadStatus('payroll').reasons.some(x => /not confirmed/.test(x)), 'confirmed once added');
});

test('test_red_rate_cell_matches_export_status', () => {
  const { api, b } = setup();
  api.approveReviewRow(b.id);
  delete api.wageRates[api.wKey(0, 'BRAM')];
  api.syncActualsFromReview();
  api.renderPayroll();
  const html = () => { api.renderPayrollEntityContent(0); return api.__sandbox.document.getElementById('payrollEntityContent').innerHTML + api.__sandbox.document.getElementById('payrollCalcTable').innerHTML; };
  assert.match(html(), /rate-missing/);
  api.wageBlank[api.wKey(0, 'BRAM')] = true; // explicitly blank: not "missing"
  assert.doesNotMatch(html(), /rate-missing/);
  assert.deepEqual(api._rateMissingNames(), []);
});

test('test_row_without_punches_never_stops', () => {
  const { api, b, add } = setup();
  api.approveReviewRow(b.id);
  add('BRAM', '2026-08-13', '', '', false); // an EasyClocking "did not work" line
  assert.equal(api.unpaidReviewRows().length, 0, 'nothing on it would be paid');
  add('BRAM', '2026-08-14', '', '17:00', false); // a clock-out with no clock-in still asks
  assert.equal(api.unpaidReviewRows().length, 1);
});

test('test_no_function_declared_twice', () => {
  // A second top-level "function X" silently replaces the first in the browser. The hours
  // formatter is fmtHrs; fmtH stays the clock-time formatter the schedule calendar uses.
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  const names = [...html.matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm)].map(m => m[1]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dup, []);
});
