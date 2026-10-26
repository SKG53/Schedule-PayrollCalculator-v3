// FC-00059: one Exports panel. Every report is a card with its own Excel / PDF buttons; the
// combined payroll report covers the entities ticked on its card; every entity has its own
// payroll report with the same columns and formatting; a batch of ticked files downloads as
// files or one zip. One export preview (the old all-entity preview merged into it) shows the
// report exactly as written, H:MM beside Hours, every number column totalled.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');
const { xlNum } = require('./xl-helpers');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const SCHED_HDR = ['Name', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const shift = ['OFF', '9:00-17:00', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF'];
function setup() {
  const api = loadApp();
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  api.__sandbox.crypto = webcrypto;
  const a = resetToSingleEntity(api, { id: 0, name: 'NIRVANA 11TH', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  api._syncEntityCode(a);
  api.entities.push({ id: 1, name: 'HEFNER', code: '', employees: [], dateLabels: WEEK.slice(), newDateLabels: ['', '', '', '', '', '', ''], newWeekStartVal: '', breakMinutes: 0, breakMinutesSet: true, actualDays: [], intake: null });
  api._syncEntityCode(api.entities[1]);
  api.parseSchedule([SCHED_HDR, ['Ann Able', ...shift]], 0);
  api.parseSchedule([SCHED_HDR, ['Bo Best', ...shift], ['Cy Cole', ...shift]], 1);
  api.entities.forEach(e => { e.dateLabels = WEEK.slice(); api.ensureIntakeState(e); });
  const rows = [];
  [[0, 'Ann Able', '17:00'], [1, 'Bo Best', '17:00'], [1, 'Cy Cole', '13:15']].forEach(([i, n, out]) => {
    const e = api.entities[i];
    const r = api.processReviewRow({ empName: n, date: '2026-08-10', clockIn1: '09:00', clockOut1: out, confidence: 0.95, source: 'TC', originalName: 'x.jpg' }, e);
    e.intake.reviewRows.push(r); rows.push(r);
    api.dispatch({ type: 'wage', screen: 'payroll', target: { kind: 'employee', entity: e.id, id: api.wKey(e.id, n), field: 'wage' }, from: null, to: 15, meta: { empName: n } });
    api.approveReviewRow(r.id);
  });
  api.syncActualsFromReview();
  api._rerenderAll();
  const saved = [];
  api.__sandbox.document.createElement = () => { const el = { style: {}, click() { saved.push(el.download); } }; return el; };
  return { api, rows, saved };
}
const report = (api) => api.__lastExcelWorkbook.worksheets.find(w => w.name === 'Report');
const names = (ws) => ws.rows.filter(r => r && r[2] && typeof r[2].value === 'string' && r[1] && !/subtotal|TOTAL/.test(r[1].value) && r[1].value !== 'Entity').map(r => r[2].value);

test('test_cards_with_excel_and_pdf_buttons_one_place', () => {
  const { api } = setup();
  api.renderDownloadsPanel();
  const html = api.__sandbox.document.getElementById('downloadsHost').innerHTML;
  assert.match(html, /<h3>Exports<\/h3>/);
  for (const k of ['payroll', 'payroll:0', 'payroll:1']) {
    assert.ok(html.includes(`exportCardNow('${k}','xlsx')`) && html.includes(`exportCardNow('${k}','pdf')`), k + ' has Excel and PDF buttons');
  }
  assert.ok(html.includes("exportCardNow('timecards','xlsx')"));
  assert.ok(html.includes("exportCardNow('settings','xlsx')"));
  assert.match(html, /Include per-day breaks/, 'the settings export option lives on its card');
  assert.match(html, /In batch:/, 'batch ticks, not radio buttons, for downloading several at once');
  // The old per-report button block and the second Export Settings button are gone from the page.
  const page = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!/>Export Settings \(\.xlsx\)</.test(page), 'settings export only on its card');
});

test('test_entity_report_has_only_that_entity', async () => {
  const { api, saved } = setup();
  const files = await api.exportCardNow('payroll:1', 'xlsx');
  assert.deepEqual(saved, ['Hefner_0809to0815_AllEmployeesPayroll.xlsx']);
  assert.equal(files.length, 1);
  const ws = report(api);
  assert.match(ws.rows[1][1].value, /^PAYROLL REPORT — HEFNER/);
  assert.deepEqual(names(ws).sort(), ['BO BEST', 'CY COLE']);
  const grand = ws.rows.find(r => r && r[1] && r[1].value === 'GRAND TOTAL');
  assert.equal(xlNum(grand[api.COMBINED_COLS.total + 1]), 15 * 8 + 15 * 4.25, 'the grand total is this entity only');
  assert.equal(api.getExportScope(), null, 'scope is put back after the export');
});

test('test_combined_report_for_ticked_entities', async () => {
  const { api, saved } = setup();
  await api.exportCardNow('payroll', 'xlsx');
  assert.match(report(api).rows[1][1].value, /^COMBINED PAYROLL REPORT/);
  assert.deepEqual(names(report(api)).sort(), ['ANN ABLE', 'BO BEST', 'CY COLE']);
  api.setCombinedEntity(1, false);
  await api.exportCardNow('payroll', 'xlsx');
  assert.equal(saved.at(-1), 'Nirvana_0809to0815_AllEmployeesPayroll.xlsx', 'named after the ticked entities');
  assert.deepEqual(names(report(api)), ['ANN ABLE']);
  assert.match(report(api).rows[1][1].value, /^PAYROLL REPORT — NIRVANA 11TH/);
});

test('test_entity_pdf_fits_and_has_only_that_entity', async () => {
  const { api, saved } = setup();
  const n0 = api.__lastAutoTableCalls.length;
  await api.exportCardNow('payroll:0', 'pdf');
  assert.deepEqual(saved, ['Nirvana_0809to0815_AllEmployeesPayroll.pdf']);
  const body = api.__lastAutoTableCalls.slice(n0).flatMap(c => c.options.body);
  const cells = body.map(r => (r[1] && typeof r[1] === 'object' ? r[1].content : r[1]));
  assert.ok(cells.includes('ANN ABLE') && !cells.includes('BO BEST'));
});

test('test_stop_asks_only_about_the_exported_entity', async () => {
  const { api, rows, saved } = setup();
  api.unapproveReviewRow(rows[1].id); // a HEFNER row
  await api.exportCardNow('payroll:0', 'xlsx');
  assert.equal(api.payGateIsOpen(), false, 'a NIRVANA-only report does not stop on a HEFNER row');
  assert.equal(saved.length, 1);
  await api.exportCardNow('payroll:1', 'xlsx');
  assert.equal(api.payGateIsOpen(), true, 'the HEFNER report asks first');
  assert.equal(api.unpaidReviewRows().length, 1);
  api.payGateLeaveOut(api.unpaidReviewRows()[0].row.id);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(saved.at(-1), 'Hefner_0809to0815_AllEmployeesPayroll.xlsx', 'the waiting export runs, same entity');
});

test('test_batch_zip_with_entity_reports', async () => {
  const { api, saved } = setup();
  const zips = [];
  api.__sandbox.JSZip = class { constructor() { this.files = {}; zips.push(this); } file(n, d) { this.files[n] = d; } async generateAsync() { return new api.__sandbox.Blob(); } };
  api.setDownloadTick('payroll:1', 'xlsx', true);
  api.setDownloadTick('snapshot', 'json', false);
  await api.downloadZip();
  assert.equal(saved.length, 1);
  assert.deepEqual(Object.keys(zips[0].files).sort(), [
    'Hefner_0809to0815_AllEmployeesPayroll.xlsx',
    'Nirvana_Hefner_0809to0815_AllEmployeesPayroll.pdf', 'Nirvana_Hefner_0809to0815_AllEmployeesPayroll.xlsx',
    'Nirvana_Hefner_0809to0815_AllEmployeesPayroll_Settings.xlsx', 'Nirvana_Hefner_0809to0815_AllEmployeesTimecards.xlsx'].sort());
});

test('test_one_preview_in_export_format', () => {
  const { api } = setup();
  api.renderPayroll();
  const doc = api.__sandbox.document;
  assert.equal(doc.getElementById('allEntityPreviewHost').innerHTML, '', 'the separate all-entity preview is gone');
  const m = api._fc13PreviewModel();
  assert.deepEqual(m.headers, api.COMBINED_HEADERS);
  const C = api.COMBINED_COLS;
  const cy = m.rows.find(r => r.kind === 'data' && r.cells[1] === 'CY COLE');
  assert.deepEqual([cy.cells[C.hours], cy.cells[C.hmm]], ['4.25', '4:15'], 'decimal and h:mm side by side');
  const sub = m.rows.filter(r => r.kind === 'subtotal');
  assert.ok(sub.every(r => r.cells[C.hours] && r.cells[C.hmm] && r.cells[C.final]), 'hours, h:mm and rounded final are totalled');
  // The preview can show one entity's report instead.
  api.setPreviewKey('payroll:1');
  const m1 = api._fc13PreviewModel();
  assert.match(m1.rows[0].cells[0], /^PAYROLL REPORT — HEFNER/);
  assert.ok(!m1.rows.some(r => r.kind === 'data' && r.cells[1] === 'ANN ABLE'));
});

test('test_preview_flags_unconfirmed_off_schedule_person', () => {
  const { api } = setup();
  const e = api.entities[0];
  const r = api.processReviewRow({ empName: 'Zed Newby', date: '2026-08-10', clockIn1: '09:00', clockOut1: '12:00', confidence: 0.95, source: 'TC', originalName: 'z.jpg' }, e);
  e.intake.reviewRows.push(r); api.approveReviewRow(r.id); api.syncActualsFromReview();
  const m = api._fc13PreviewModel();
  const z = m.rows.find(x => x.kind === 'data' && /ZED/.test(x.cells[1]));
  assert.match(z.flag, /not confirmed/, 'flagged on screen, as the old all-entity preview did');
  assert.match(api.renderPayrollExportPreviewHtml(), /not confirmed/);
});
