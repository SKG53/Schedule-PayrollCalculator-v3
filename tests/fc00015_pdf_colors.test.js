// FC-00015: Colored PDF export mirroring Excel.
//
// _exportPdf's combined/cashOnly/depositOnly modes must paint the exact same per-entity
// color palette that _exportExcel bakes into the Excel exports (FC-00012/FC-00014),
// resolved through _paletteForEntity(ent) so user-selected FC-00014 presets flow through
// PDF too — not the raw FC12_PALETTES constant. See FC_00015_BRIEF.md.
//
// These tests exercise the real `_exportPdf` writer end-to-end against the jsPDF/autoTable
// mock in tests/load-app.js, which now actually invokes `didParseCell` for every head/body
// cell (recording the resulting fillColor) instead of no-op'ing, so they observe exactly
// what a live export's autoTable() call would paint.
const test = require('node:test');
const assert = require('node:assert/strict');
const { pdfBody, pdfRowText } = require('./xl-helpers');
// FC-00050: these tests check the saved spelling, so they ask for "As saved" names.
const { loadApp, resetToSingleEntity } = require('./load-app');

// Builds a 2-entity fixture — one Nirvana 11th (hardcoded default palette), one Zion — each
// with a simple hourly Cash employee, mirroring the FC-00012 Excel-colors fixture closely
// enough to exercise every palette role (body/cash/subtotal/grand).
function makeTwoEntityFixture(api) {
  const nirvana = resetToSingleEntity(api, {
    id: 0,
    name: 'Nirvana 11th',
    employees: [{ name: 'Avery', shifts: ['', '9AM - 5PM', '', '', '', '', ''] }],
    dateLabels: ['', 'Mon Aug 10 2026', '', '', '', '', ''],
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
    dateLabels: ['', 'Mon Aug 10 2026', '', '', '', '', ''],
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

  return { nirvana, zion };
}

// The autoTable mock exposes __lastAutoTableCalls (one entry per doc.autoTable() call).
// Grabs the parsed body cells for the most recent call.
function lastCallParsedCells(api) {
  const calls = api.__lastAutoTableCalls;
  assert.ok(calls && calls.length > 0, 'expected at least one autoTable() call');
  return calls[calls.length - 1].parsedCells;
}

test('test_pdf_export_applies_palette_via_didparse', async () => {
  // FC-00080: one table per entity page. Rows: band, EMPLOYEES, data, subtotal, entity total
  // (and, on the last page, a spacer and the grand total). Fills are set on each cell.
  const api = loadApp({ savedNames: true });
  makeTwoEntityFixture(api);

  await api.exportCombinedPdf();
  const calls = api.__lastAutoTableCalls.slice(-2);
  assert.equal(calls.length, 2);
  const at = (call, r, c) => call.parsedCells.find(x => x.section === 'body' && x.rowIndex === r && x.colIndex === c);
  const RC = api.REPORT_COLORS, rgb = api._argbToRgbTriplet, CASH = api.COMBINED_COLS.cash;
  [0, 1].forEach(i => {
    const pal = api._paletteForEntity(api.entities[i]), call = calls[i];
    assert.deepEqual(at(call, 0, 0).fillColor, rgb(pal.band), 'band in the darker shade');
    assert.deepEqual(at(call, 2, 0).fillColor, rgb(pal.body), 'data row body fill');
    assert.deepEqual(at(call, 2, CASH).fillColor, rgb(RC.cashData), 'Cash is the one cash yellow');
    assert.deepEqual(at(call, 3, 0).fillColor, rgb(RC.sub), 'subtotal fill');
    assert.equal(at(call, 3, 0).fontStyle, 'bold', 'subtotal row is bold');
    assert.deepEqual(at(call, 4, 0).fillColor, rgb(RC.tot), 'entity total fill');
  });
  const grand = at(calls[1], 6, 0);
  assert.deepEqual(grand.fillColor, rgb(RC.grand), 'grand total fill');
  assert.equal(grand.fontStyle, 'bold', 'grand total row is bold');
  assert.equal(calls[1].options.body[6][0].content, 'GRAND TOTAL — ALL ENTITIES');
});

test('test_pdf_export_uses_user_selected_fc00014_preset', async () => {
  // FC-00015 DoD #3: palette resolution must go through _paletteForEntity (which consults
  // entityPalettes, the FC-00014 user-selection map), not the raw FC12_PALETTES constant —
  // so a user-selected preset override actually changes the PDF's fill colors.
  const api = loadApp({ savedNames: true });
  const { nirvana } = makeTwoEntityFixture(api);

  // Sanity: Nirvana 11th's hardcoded default is 'Green', not 'Sunset'.
  assert.equal(api.getEntityPalette(nirvana), 'Green');
  api.setEntityPalette(nirvana.id, 'Sunset');
  assert.equal(api.getEntityPalette(nirvana), 'Sunset');

  await api.exportCombinedPdf();
  const bodyCells = lastCallParsedCells(api).filter(c => c.section === 'body');

  const sunsetBodyFill = api._argbToRgbTriplet(api.FC14_PRESETS.Sunset.body);
  const defaultGreenBodyFill = api._argbToRgbTriplet(api.FC14_PRESETS['Green'].body);

  const nirvanaRow0Col0 = api.__lastAutoTableCalls.slice(-2)[0].parsedCells.find(c => c.section === 'body' && c.rowIndex === 2 && c.colIndex === 0); // FC-00080: Nirvana's page, first data row
  assert.ok(nirvanaRow0Col0);
  assert.deepEqual(nirvanaRow0Col0.fillColor, sunsetBodyFill, 'PDF picks up the user-selected Sunset preset');
  assert.notDeepEqual(nirvanaRow0Col0.fillColor, defaultGreenBodyFill, 'PDF must not fall back to the hardcoded default once a preset is chosen');
});

test('test_pdf_cashonly_and_depositonly_apply_palette_correctly', async () => {
  const api = loadApp({ savedNames: true });
  makeTwoEntityFixture(api);

  // Cash-Only: last column (Cash Portion) gets the cash tint.
  await api.exportCashPdf();
  const cashCells = lastCallParsedCells(api).filter(c => c.section === 'body');
  const spec = api._columnsFor('cashOnly');
  const lastColIdx = spec.headers.length - 1;
  const nirvanaCashPortion = cashCells.find(c => c.rowIndex === 0 && c.colIndex === lastColIdx);
  assert.ok(nirvanaCashPortion);
  assert.deepEqual(nirvanaCashPortion.fillColor, api._argbToRgbTriplet(api._paletteForEntity(api.entities[0]).cash), 'cashOnly Cash Portion column gets the cash tint');
  const nirvanaCashBody = cashCells.find(c => c.rowIndex === 0 && c.colIndex === 0);
  assert.deepEqual(nirvanaCashBody.fillColor, api._argbToRgbTriplet(api._paletteForEntity(api.entities[0]).body), 'cashOnly body fill');

  // Deposit-Only: no cash tint anywhere — every body column (including Deposit Portion,
  // the last column) is just the plain body color, matching the Excel writer's behavior.
  api.payMethod[api.wKey(1, 'Beacon')] = 'deposit';
  await api.exportDepositPdf();
  const depCells = lastCallParsedCells(api).filter(c => c.section === 'body');
  const depSpec = api._columnsFor('depositOnly');
  const depLastColIdx = depSpec.headers.length - 1;
  const zionDepositPortion = depCells.find(c => c.rowIndex === 0 && c.colIndex === depLastColIdx);
  assert.ok(zionDepositPortion);
  assert.deepEqual(zionDepositPortion.fillColor, api._argbToRgbTriplet(api._paletteForEntity(api.entities[1]).body), 'depositOnly Deposit Portion column is body-colored, not specially tinted');
});

test('test_pdf_uncolored_modes_no_palette', async () => {
  // FC-00015 DoD #2: timecard and payrollCalc PDF exports must remain uncolored (mirrors
  // FC-00012's Excel scope) — no per-entity PALETTE fill is ever applied via the
  // didParseCell hook for those modes, even though the same hook function runs for every
  // section. Note: subtotal/grand rows in every mode (including timecard/payrollCalc) keep
  // their pre-existing plain gray shading ([240,239,233]/[224,222,213], set directly on the
  // row content objects, not via the palette hook) — that shading predates FC-00015 and is
  // unrelated to entity palettes, so this test targets DATA rows only, where a palette fill
  // would show up if the hook wrongly colorized these modes.
  const api = loadApp({ savedNames: true });
  makeTwoEntityFixture(api);

  await api.exportTimecardPdf();
  // Data rows are every row except the last two (subtotal, grand) per entity block; with
  // one entity + one employee that's just row 0.
  const tcDataCells = lastCallParsedCells(api).filter(c => c.section === 'body' && c.rowIndex === 0);
  assert.ok(tcDataCells.length > 0, 'expected timecard data-row cells to have been parsed');
  assert.ok(tcDataCells.every(c => c.fillColor === undefined), 'timecard PDF export data rows must remain uncolored — no palette fillColor from didParseCell');

  await api.exportPayrollCalcPdf();
  const pcDataCells = lastCallParsedCells(api).filter(c => c.section === 'body' && c.rowIndex === 0);
  assert.ok(pcDataCells.length > 0, 'expected payrollCalc data-row cells to have been parsed');
  assert.ok(pcDataCells.every(c => c.fillColor === undefined), 'payrollCalc PDF export data rows must remain uncolored — no palette fillColor from didParseCell');
});

test('test_argb_to_rgb_triplet_conversion', () => {
  const api = loadApp({ savedNames: true });
  assert.deepEqual(api._argbToRgbTriplet('FFAABBCC'), [0xAA, 0xBB, 0xCC]);
  assert.deepEqual(api._argbToRgbTriplet('FF000000'), [0, 0, 0]);
  assert.deepEqual(api._argbToRgbTriplet('FFFFFFFF'), [255, 255, 255]);
  // Alpha byte is ignored/dropped regardless of its value.
  assert.deepEqual(api._argbToRgbTriplet('00A6A6A6'), [0xA6, 0xA6, 0xA6]);
});

test('test_pdf_flat_employee_row_shape_preserved', async () => {
  // FC-00015 DoD #1 last bullet: flat employees keep the same display shape in PDF as
  // Excel — name gets " (flat)" suffix, Hours blank, Rate literal "flat" — and still get
  // their entity's palette body fill like every other row for that entity.
  const api = loadApp({ savedNames: true });
  const { zion } = makeTwoEntityFixture(api);
  api.payMethod[api.wKey(1, 'Emery')] = 'cash';
  api.flatWages[api.wKey(1, 'Emery')] = 400;
  api.flatWagesDisplayNames['emery'] = 'Emery';

  await api.exportCombinedPdf();
  const body = pdfBody(api).map(pdfRowText);
  const flatRow = body.find(row => row[0] === 'Emery');
  assert.ok(flatRow, 'expected to find the flat employee row in the PDF body');
  assert.equal(flatRow[api.COMBINED_COLS.hours], '', 'Hours must be blank for a flat-amount employee');
  assert.equal(flatRow[api.COMBINED_COLS.rate], 'flat', 'Rate must read the text "flat"');
});
