// FC-00013: Live WYSIWYG preview panel on Payroll tab.
//
// renderPayrollExportPreviewHtml() must render a read-only HTML mirror of exactly what
// exportCombinedExcel() produces: same FC12_PALETTES colors, same row order (per-entity
// data rows -> subtotal -> blank separator, repeated per entity, then one grand total),
// same flat-employee treatment (" (flat)" suffix, blank Hours, Rate="flat"). See
// FC_00013_BRIEF.md and the FC-00012 Combined Excel export (_exportExcel) it mirrors.
const test = require('node:test');
const assert = require('node:assert/strict');
// FC-00050: these tests check the saved spelling, so they ask for "As saved" names.
const { loadApp, resetToSingleEntity } = require('./load-app');

// Standard Mon-Sun-style week labels in the exact "Mon D YYYY" shape formatDateCell()
// produces (no weekday prefix) so _exportPeriodStr's toShort() regex matches and the
// preview title renders "MM/DD/YY – MM/DD/YY" instead of falling back to the raw label.
const WEEK_LABELS = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];

// Builds a 3-entity fixture matching the reference report's shape: Nirvana 11th (1 cash
// hourly employee), Zion (1 cash hourly employee), Hefner (1 cash hourly employee + 1
// flat-amount employee) — 4 employees total across 3 entities.
function makeThreeEntityFixture(api) {
  const nirvana = resetToSingleEntity(api, {
    id: 0,
    name: 'Nirvana 11th',
    employees: [{ name: 'Avery', shifts: ['', '9AM - 5PM', '', '', '', '', ''] }],
    dateLabels: WEEK_LABELS,
    breakMinutes: 0,
    breakMinutesSet: true,
    actualDays: [{
      empName: 'Avery', entityName: 'Nirvana 11th', date: '2026-08-10', dayIdx: 1,
      pairs: [{ in: 9, out: 17, outAdj: 17, minutes: 480 }],
    }],
  });
  api._syncEntityCode(nirvana);
  api.wageRates[api.wKey(0, 'Avery')] = 15;
  api.payMethod[api.wKey(0, 'Avery')] = 'cash';

  const zion = { id: 1, name: 'Zion', code: '',
    employees: [{ name: 'Beacon', shifts: ['', '9AM - 5PM', '', '', '', '', ''] }],
    dateLabels: WEEK_LABELS,
    newDateLabels: ['', '', '', '', '', '', ''], newWeekStartVal: '',
    breakMinutes: 0, breakMinutesSet: true,
    actualDays: [{
      empName: 'Beacon', entityName: 'Zion', date: '2026-08-10', dayIdx: 1,
      pairs: [{ in: 9, out: 17, outAdj: 17, minutes: 480 }],
    }] };
  api._syncEntityCode(zion);
  api.entities.push(zion);
  api.wageRates[api.wKey(1, 'Beacon')] = 15;
  api.payMethod[api.wKey(1, 'Beacon')] = 'cash';

  const hefner = { id: 2, name: 'Hefner', code: '',
    employees: [
      { name: 'Devon', shifts: ['', '9AM - 5PM', '', '', '', '', ''] },
      { name: 'Emery', shifts: ['', '', '', '', '', '', ''] },
    ],
    dateLabels: WEEK_LABELS,
    newDateLabels: ['', '', '', '', '', '', ''], newWeekStartVal: '',
    breakMinutes: 0, breakMinutesSet: true,
    actualDays: [{
      empName: 'Devon', entityName: 'Hefner', date: '2026-08-10', dayIdx: 1,
      pairs: [{ in: 9, out: 17, outAdj: 17, minutes: 480 }],
    }] };
  api._syncEntityCode(hefner);
  api.entities.push(hefner);
  api.wageRates[api.wKey(2, 'Devon')] = 15;
  api.payMethod[api.wKey(2, 'Devon')] = 'cash';
  api.payMethod[api.wKey(2, 'Emery')] = 'cash';
  // Emery is a flat-amount employee — exercises the " (flat)" row shape.
  api.flatWages[api.wKey(2, 'Emery')] = 400;
  api.flatWagesDisplayNames['emery'] = 'Emery';

  return { nirvana, zion, hefner };
}

test('test_preview_renders_expected_row_count', () => {
  const api = loadApp({ savedNames: true });
  makeThreeEntityFixture(api);

  const html = api.renderPayrollExportPreviewHtml();
  assert.ok(html.length > 0, 'expected non-empty preview HTML');

  // 4 employees (Avery, Beacon, Devon, Emery) across 3 entities. FC-00080: per entity a band, an
  // EMPLOYEES heading, the rows, a subtotal and the entity's total; the grand total closes it.
  const N = 4;
  const count = (k) => (html.match(new RegExp('fc13-' + k + '-row', 'g')) || []).length;
  const rowCount = (html.match(/<tr\b/g) || []).length;
  const payDateRows = (html.match(/fc13-note-row[^>]*><td[^>]*>Deposit paid /g) || []).length;
  assert.equal(payDateRows, 1, 'the pay dates line under the title');
  assert.equal(count('title'), 1, 'exactly one title row');
  assert.equal(count('hdr'), 1, 'exactly one header row');
  assert.equal(count('band'), 3, 'one band per entity');
  assert.equal(count('group'), 3, 'one EMPLOYEES heading per entity (nobody is Management)');
  assert.equal(count('data'), N, `exactly ${N} employee data rows`);
  assert.equal(count('subtotal'), 3, 'one Employees subtotal per entity');
  assert.equal(count('enttotal'), 3, 'one total per entity');
  assert.equal(count('blank'), 2, 'one blank row between entities');
  assert.equal(count('grand'), 1, 'exactly one grand total row');
  assert.equal(rowCount, 1 + 1 + 1 + 3 + 3 + N + 3 + 3 + 2 + 1);
  assert.match(html, />GRAND TOTAL — ALL ENTITIES</);
});

test('test_preview_readonly_no_inputs', () => {
  const api = loadApp({ savedNames: true });
  makeThreeEntityFixture(api);

  const html = api.renderPayrollExportPreviewHtml();
  assert.ok(html.length > 0);
  assert.ok(!/<input/i.test(html), 'preview must not contain <input>');
  assert.ok(!/<select/i.test(html), 'preview must not contain <select>');
  assert.ok(!/<textarea/i.test(html), 'preview must not contain <textarea>');
  assert.ok(!/contenteditable/i.test(html), 'preview must not contain contenteditable');
});

test('test_preview_title_matches_combined_export_format', () => {
  const api = loadApp({ savedNames: true });
  makeThreeEntityFixture(api);

  const html = api.renderPayrollExportPreviewHtml();
  assert.match(html, /COMBINED PAYROLL REPORT — \d{2}\/\d{2}\/\d{2} – \d{2}\/\d{2}\/\d{2}/,
    'title row must read "COMBINED PAYROLL REPORT — MM/DD/YY – MM/DD/YY"');
});

test('test_preview_uses_fc12_palette_colors', () => {
  const api = loadApp({ savedNames: true });
  makeThreeEntityFixture(api);

  const html = api.renderPayrollExportPreviewHtml();
  // FC12_PALETTES ARGB fills, minus the leading alpha byte, must appear as #RRGGBB CSS colors.
  const css = (a) => '#' + a.slice(2);
  ['N11', 'ZIO', 'HEF'].forEach(k => {
    assert.ok(html.includes(css(api.FC12_PALETTES[k].body)), k + ' body fill must appear in the preview');
    assert.ok(html.includes(css(api.FC12_PALETTES[k].band)), k + ' band must appear in the preview');
  });
  // FC-00080: one cash yellow, grey subtotals, darker entity totals, a black grand total.
  const RC = api.REPORT_COLORS;
  [RC.cashData, RC.cashSub, RC.cashTot, RC.sub, RC.tot, RC.grand].forEach(a => assert.ok(html.includes(css(a)), a));
  assert.ok(!html.includes(css(api.FC12_PALETTES.N11.cash)), 'the old per-entity cash tint is gone');
});

test('test_preview_flat_employee_row_shape', () => {
  const api = loadApp({ savedNames: true });
  makeThreeEntityFixture(api);

  const html = api.renderPayrollExportPreviewHtml();
  // FC-00080: the name prints plain; the Rate cell reads "flat".
  assert.ok(!html.includes('Emery (flat)'));
  assert.match(html, />Emery<[\s\S]*?<td[^>]*>flat<\/td>/, 'flat employee Rate cell must read "flat"');
});

test('test_preview_cells_have_tooltip_title_attributes', () => {
  const api = loadApp({ savedNames: true });
  makeThreeEntityFixture(api);

  const html = api.renderPayrollExportPreviewHtml();
  assert.ok(html.includes('Edit entity name in Schedules tab'), 'entity cells get the entity-name tooltip');
  assert.ok(html.includes('Edit above in Payroll Calculation table (rename button or click name)'), 'employee name cells get the rename tooltip');
  assert.ok(html.includes('Edit above in Payroll Calculation table'), 'value cells get the generic edit tooltip');
  assert.ok(html.includes('Auto-calculated'), 'subtotal/grand/header rows get the auto-calculated tooltip');
  assert.ok(html.includes('Edit date range in the schedule for that entity'), 'title row gets the date-range tooltip');
});

test('test_preview_empty_when_no_data', () => {
  const api = loadApp({ savedNames: true });
  resetToSingleEntity(api, { id: 0, name: 'Empty Co', employees: [] });
  const html = api.renderPayrollExportPreviewHtml();
  assert.equal(html, '', 'no employees anywhere means no preview table at all');
});

test('test_preview_panel_mounts_in_dom_above_toolbar', () => {
  const api = loadApp({ savedNames: true });
  makeThreeEntityFixture(api);

  api.renderPayrollEntityContent(0);
  const host = api.__sandbox.document.getElementById('fc13PreviewHost');
  assert.ok(host, 'expected renderPayrollEntityContent to mount the fc13PreviewHost element');
  assert.ok(host.innerHTML.includes('fc13-preview-table'), 'mounted panel must contain the preview table');
  assert.ok(host.innerHTML.includes('read-only'), 'mounted panel must display a read-only indicator');
});

test('test_preview_live_updates_when_wage_changes', () => {
  const api = loadApp({ savedNames: true });
  makeThreeEntityFixture(api);

  const before = api.renderPayrollExportPreviewHtml();
  assert.ok(before.includes('$120.00'), 'expected initial 8h * $15 = $120.00 total to appear');

  api.wageRates[api.wKey(0, 'Avery')] = 20;
  const after = api.renderPayrollExportPreviewHtml();
  assert.ok(after.includes('$160.00'), 'expected updated 8h * $20 = $160.00 total to appear after wage change');
  assert.notEqual(before, after, 'preview HTML must change when underlying payroll data changes');
});
