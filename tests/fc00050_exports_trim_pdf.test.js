// FC-00050: the payroll PDF fits one landscape letter page width and carries the payroll
// sheet's rows and figures; unused reports are gone from the screen; names print FIRST LAST
// by default (a saved choice still wins).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const SCHED_HDR = ['Name', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const mon = ['OFF', '9:00AM-5:00PM', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF'];
const NAMES = ['Avery', 'Bram', 'Quill', 'Wren', 'Ozzie', 'Rook', 'Pip', 'Juno', 'Kip', 'Lark', 'Moss', 'Nell', 'Orrin', 'Pell', 'Rhea', 'Sable', 'Tamsin', 'Ulla', 'Vale', 'Wynn', 'Yara', 'Zeke'];

function setup(perEntity = 2, nEnt = 2) {
  const api = loadApp();
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  api.__sandbox.crypto = webcrypto;
  resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [], dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true });
  for (let k = 1; k < nEnt; k++) api.entities.push({ id: k, name: ['Alpha Test', 'Beta Test', 'Gamma Test'][k], code: '', employees: [], dateLabels: WEEK.slice(), newDateLabels: ['', '', '', '', '', '', ''], newWeekStartVal: '', breakMinutes: 0, breakMinutesSet: true, actualDays: [], intake: null });
  api.entities.forEach(e => api._syncEntityCode(e));
  api.entities.forEach((e, k) => {
    const people = NAMES.slice(0, perEntity).map(n => n + ' ' + 'ABC'[k] + 'test');
    api.parseSchedule([SCHED_HDR, ...people.map(n => [n, ...mon])], k);
    e.dateLabels = WEEK.slice();
    api.ensureIntakeState(e);
    people.forEach((n, i) => {
      api.wageRates[api.wKey(k, n)] = 12 + i * 0.37;
      const r = api.processReviewRow({ empName: n, date: '2026-08-10', clockIn1: '09:00', clockOut1: '17:' + String(i % 60).padStart(2, '0'), confidence: 0.95, source: 'TC', originalName: n + '.jpg' }, e);
      e.intake.reviewRows.push(r);
      api.approveReviewRow(r.id);
    });
  });
  api.syncActualsFromReview();
  return api;
}
const pdfCalls = (api, from) => api.__lastAutoTableCalls.slice(from);

test('test_payroll_pdf_columns_fit_landscape_letter', async () => {
  const api = setup();
  let opts = null;
  const orig = api.__sandbox.window.jspdf.jsPDF;
  api.__sandbox.window.jspdf = { jsPDF: function (o) { opts = o; return orig(o); } };
  const n0 = api.__lastAutoTableCalls.length;
  await api.exportCombinedPdf();
  assert.equal(opts.format, 'letter');
  assert.equal(opts.orientation, 'landscape');
  const calls = pdfCalls(api, n0);
  assert.ok(calls.length >= 1);
  calls.forEach(c => {
    const widths = Object.values(c.options.columnStyles).map(s => s.cellWidth);
    const total = widths.reduce((a, b) => a + b, 0);
    assert.equal(widths.length, 10, 'every column has a width');
    assert.ok(total <= 792 - 60 + 0.01, 'fits between the margins: ' + total);
    assert.ok(total >= 792 - 60 - 0.01, 'uses the page width');
    assert.equal(c.options.margin.left, 30);
    assert.equal(c.options.showHead, 'everyPage');
  });
});

test('test_payroll_pdf_figures_equal_combined_excel', async () => {
  const api = setup(4, 2);
  await api.exportCombinedExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const xl = ws.rows.slice(1).filter(r => r && r[2] && typeof r[2].value === 'string' && /test$/i.test(r[2].value || ''))
    .map(r => [r[2].value, r[6].value && r[6].value.result != null ? r[6].value.result : r[6].value]);
  const n0 = api.__lastAutoTableCalls.length;
  await api.exportCombinedPdf();
  const body = pdfCalls(api, n0).flatMap(c => c.options.body);
  const pdf = body.filter(r => Array.isArray(r) && typeof r[1] === 'string' && /TEST$/i.test(r[1])).map(r => [r[1], r[5]]);
  assert.equal(pdf.length, xl.length, 'same data rows');
  pdf.forEach(([name, total], i) => {
    assert.equal(name, xl[i][0], 'same order and names');
    assert.equal(total, '$' + Number(xl[i][1]).toFixed(2), 'same Actual Total to the cent');
  });
  // Subtotal and grand total rows are in both.
  assert.ok(body.some(r => r[0] && r[0].content === 'GRAND TOTAL'));
  assert.ok(ws.rows.some(r => r && r[1] && r[1].value === 'GRAND TOTAL'));
});

test('test_header_repeats_entity_block_not_split', async () => {
  const api = setup(20, 3); // 3 entities × 20 people: more than one page
  const n0 = api.__lastAutoTableCalls.length;
  await api.exportCombinedPdf();
  const calls = pdfCalls(api, n0);
  assert.ok(calls.length >= 2, 'more than one page');
  calls.forEach(c => assert.deepEqual(c.options.head[0].slice(0, 2), ['Entity', 'Employee'], 'the header is on every page'));
  // Every entity's rows sit in exactly one page (each block fits a page).
  ['Alpha Test', 'Beta Test', 'Gamma Test'].forEach(ent => {
    const pages = calls.map((c, i) => c.options.body.some(r => r[0] === ent) ? i : -1).filter(i => i >= 0);
    assert.equal(pages.length, 1, ent + ' is not split across pages');
  });
});

test('test_removed_reports_absent_from_downloads_and_payroll_tab', () => {
  const api = setup();
  assert.deepEqual(api.DOWNLOADS.map(d => d.key), ['payroll', 'timecards', 'settings', 'snapshot']);
  assert.deepEqual(Object.keys(api.DOWNLOADS.find(d => d.key === 'timecards').formats), ['xlsx'], 'the Timecards PDF is gone');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const f of ['exportCashExcel()', 'exportDepositPdf()', 'exportTimecardExcel()', 'exportPayrollCalcPdf()', 'exportFullExcel()', 'onclick="exportManager()"']) {
    assert.ok(!html.includes('onclick="' + f.replace('onclick="', '').replace(/"$/, '')) || !html.includes(f), f + ' has no button');
  }
  assert.ok(!/Export Manager Report/.test(html));
  assert.ok(!/Cash-Only Report<\/div>/.test(html));
  assert.ok(/Export Employee Schedule/.test(html), 'the employee schedule export stays');
});

test('test_kept_exports_unchanged', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  assert.deepEqual(ws.rows[3].slice(1).map(c => c.value), ['Entity', 'Employee', 'Method', 'Hours', 'Rate', 'Actual Total', 'Deposit', 'Cash', 'Rounded Final', 'Diff']);
  await api.exportActualsIntakeExcel();
  assert.ok(api.__lastExcelWorkbook.worksheets.length >= 1);
});

test('test_names_default_first_last_saved_choice_wins', async () => {
  const api = setup(1, 1);
  assert.equal(api.exportNameMode('payroll'), 'firstLast');
  await api.exportCombinedExcel();
  let ws = api.__lastExcelWorkbook.worksheets[0];
  assert.ok(ws.rows.some(r => r && r[2] && r[2].value === 'AVERY ATEST'), 'FIRST LAST in capitals');
  api._ingestToolSettings([['Names on exports · all exports', 'As saved']]);
  assert.equal(api.exportNameMode('payroll'), 'saved', 'a settings file choice wins');
  await api.exportCombinedExcel();
  ws = api.__lastExcelWorkbook.worksheets[0];
  assert.ok(ws.rows.some(r => r && r[2] && r[2].value === 'Avery Atest'));
});

test('test_old_settings_and_snapshot_with_removed_kinds_load', async () => {
  const api = setup(1, 1);
  const n = api._ingestToolSettings([['Names on exports · Cash-only report', 'FIRST'], ['Names on exports · Manager schedule report', 'FIRST']]);
  assert.equal(n, 0, 'entries for removed reports are ignored');
  const snap = await api.buildSnapshot();
  snap.parts.downloadTicks = { manager: { xlsx: true }, cashOnly: { pdf: true }, accountant: { xlsx: true } };
  const b = loadApp();
  b.__sandbox.alert = () => {};
  b.__sandbox.confirm = () => true;
  const res = b.openSnapshotData(snap, 'old');
  assert.ok(res === undefined || res === true || (res && res.ok !== false), 'opens');
  assert.deepEqual(b.DOWNLOADS.filter(d => Object.keys(d.formats).some(f => b.downloadFileNames(d.key).length)).map(d => d.key).sort(), ['payroll', 'settings', 'snapshot', 'timecards']);
});
