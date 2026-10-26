// FC-00065: the payroll report has no H:MM column (combined and per entity; Excel, PDF and the
// preview); money text in the PDF and preview reads like Excel ($1,234.50, -$0.17, +$0.13);
// subtotal and grand-total labels span the label columns so they print in full.
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');
const { xlFormulaMismatches } = require('./xl-helpers');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const SHIFT = ['', '9AM - 5PM', '', '', '', '', ''];
const day = (empName, entityName, out) => ({ empName, entityName, date: '2026-08-10', dayIdx: 1, pairs: [{ in: 9, out, outAdj: out, minutes: Math.round((out - 9) * 60) }] });
function setup() {
  const api = loadApp({ savedNames: true });
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true; api.__sandbox.crypto = webcrypto;
  const ent = resetToSingleEntity(api, {
    id: 0, name: 'Alpha Test', employees: [{ name: 'Avery', shifts: SHIFT }, { name: 'Bram', shifts: SHIFT }, { name: 'Cora', shifts: SHIFT }],
    dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true,
    actualDays: [day('Avery', 'Alpha Test', 17.33), day('Bram', 'Alpha Test', 13)],
  });
  api._syncEntityCode(ent);
  api.wageRates[api.wKey(0, 'Avery')] = 14.5; api.payMethod[api.wKey(0, 'Avery')] = 'cash';
  api.wageRates[api.wKey(0, 'Bram')] = 13.04; api.payMethod[api.wKey(0, 'Bram')] = 'cash';
  api.flatWages[api.wKey(0, 'Cora')] = 1234.5; api.payMethod[api.wKey(0, 'Cora')] = 'deposit';
  return api;
}
const lastPdfBody = (api) => api.__lastAutoTableCalls[api.__lastAutoTableCalls.length - 1].options.body.map(r => r.map(c => (c && typeof c === 'object' ? c.content : c)));

test('test_no_hmm_column_in_excel_pdf_preview', async () => {
  const api = setup();
  assert.ok(!api.COMBINED_HEADERS.includes('H:MM'));
  assert.equal(api.COMBINED_HEADERS.length, 10);
  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook, ws = wb.worksheets[0];
  const hdr = ws.rows.find(r => r && r[1] && r[1].value === 'Entity').slice(1).map(c => c.value);
  assert.deepEqual(hdr, ['Entity', 'Employee', 'Method', 'Hours', 'Rate', 'Actual Total', 'Deposit', 'Cash', 'Rounded Final', 'Diff']);
  assert.deepEqual(xlFormulaMismatches(wb, ws).bad, [], 'every formula still agrees');
  await api.exportCombinedPdf();
  const head = api.__lastAutoTableCalls[api.__lastAutoTableCalls.length - 1].options.head[0].map(c => (c && typeof c === 'object' ? c.content : c));
  assert.ok(!head.includes('H:MM'));
  assert.ok(!api._fc13PreviewModel().headers.includes('H:MM'));
  // The Hours sheet keeps its h:mm durations.
  assert.ok(wb.worksheets.some(w => w.name === 'Hours'));
});

test('test_money_text_has_commas_and_sign_first', async () => {
  const api = setup();
  assert.equal(api._fmtUsd(1234.5), '$1,234.50');
  assert.equal(api._fmtUsd(1234567.5), '$1,234,567.50');
  assert.equal(api._fmtUsd(-0.17), '-$0.17');
  assert.equal(api._fmtUsd(0), '$0.00');
  assert.equal(api._cellText(api.xlMoneySigned(0.13)), '+$0.13');
  assert.equal(api._cellText(api.xlMoneySigned(-0.17)), '-$0.17');
  await api.exportCombinedPdf();
  const body = lastPdfBody(api);
  const C = api.COMBINED_COLS;
  const cora = body.find(r => /Cora/i.test(r[1]));
  assert.equal(cora[C.total], '$1,234.50', 'flat amount with a comma');
  const bram = body.find(r => /Bram/i.test(r[1]));
  assert.equal(bram[C.diff], '-$0.16', '52.16 paid as $52: sign before the dollar sign');
  assert.ok(!body.some(r => r.some(c => /\$-/.test(String(c)))), 'no "$-" anywhere');
  assert.ok(!body.some(r => r.some(c => /\$\d{4,}/.test(String(c)))), 'no money of 1,000 or more without a comma');
});

test('test_total_labels_span_the_label_columns', async () => {
  const api = setup();
  await api.exportCombinedExcel();
  const ws = api.__lastExcelWorkbook.worksheets[0];
  const rowOf = (label) => ws.rows.findIndex(r => r && r[1] && r[1].value === label);
  const sub = rowOf('Alpha Test subtotal'), grand = rowOf('GRAND TOTAL');
  const span = api.COMBINED_COLS.hours; // Entity..Method
  assert.ok(ws.merges.some(([r1, c1, r2, c2]) => r1 === sub && r2 === sub && c1 === 1 && c2 === span), 'subtotal label spans Entity–Method');
  assert.ok(ws.merges.some(([r1, c1, r2, c2]) => r1 === grand && r2 === grand && c1 === 1 && c2 === span), 'grand total label spans Entity–Method');
});

test('test_pay_unchanged_by_the_column_change', () => {
  const api = setup();
  const d = api._collectExportData()[0].rows;
  const by = (n) => d.find(r => r._empName === n)._breakdown;
  assert.equal(by('Avery').actualFinal, Math.round(8.33 * 14.5 * 100) / 100);
  assert.equal(by('Bram').actualFinal, 52.16);
  assert.equal(by('Bram').cash, 52);
});

// Screens use the same money text: no "$-0.16", commas from $1,000.
test('test_screen_money_reads_like_the_files', () => {
  const api = setup();
  api.setTab('payroll'); api.renderPayroll();
  const d = api.__sandbox.document;
  const html = ['payrollEntityContent', 'payrollGrid', 'payrollCalcTable'].map(id => (d.getElementById(id) || { innerHTML: '' }).innerHTML).join('');
  assert.ok(html.length > 0);
  assert.doesNotMatch(html, /\$-\d/, 'sign before the dollar sign');
  assert.match(html, /\$1,234\.50/, 'the flat amount with a comma');
  assert.match(html, /-\$0\.16/, 'a negative diff reads -$0.16');
});
