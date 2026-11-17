// FC-00012: Bake color scheme into Excel exports.
//
// The Combined/Cash-Only/Deposit-Only Excel exports must come out with the exact
// per-entity color palette that used to be applied by hand (FFE8F0DC for Nirvana 11th,
// FFDCE6F1 for Zion, FFFCE4D6 for Hefner, with a bluer FFBDD7EE/FF9DC3E6 tint on the Cash
// column) — see FC_00012_BRIEF.md and the hand-colored reference report (kept locally,
// never committed). Palette is hardcoded,
// looked up by ent.code (FC-00007), with a DEFAULT fallback for unknown codes.
//
// These tests exercise the real `_exportExcel` writer end-to-end against the ExcelJS mock
// in tests/load-app.js (which now records real fill/value state per cell instead of
// no-op'ing), so they observe exactly what a live export would paint onto the workbook.
const test = require('node:test');
const assert = require('node:assert/strict');
// FC-00050: these tests check the saved spelling, so they ask for "As saved" names.
const { loadApp, resetToSingleEntity } = require('./load-app');

// Builds a 3-entity fixture — one Nirvana 11th, one Zion, one Hefner — each with a simple
// hourly employee on Cash, plus a flat-amount employee on Hefner, mirroring the reference
// report's shape closely enough to exercise every palette + the flat-row special case.
function makeThreeEntityFixture(api) {
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

  const hefner = { id: 2, name: 'Hefner', code: '',
    employees: [
      { name: 'Devon', shifts: ['', '9AM - 5PM', '', '', '', '', ''] },
      { name: 'Emery', shifts: ['', '', '', '', '', '', ''] },
    ],
    dateLabels: ['', 'Mon Aug 10 2026', '', '', '', '', ''],
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
  // Emery is a flat-amount employee (no hourly wage/schedule) — exercised by
  // getFlatWageRows, matching how the reference report shows "EMERY (flat)".
  api.flatWages[api.wKey(2, 'Emery')] = 400;
  api.flatWagesDisplayNames['emery'] = 'Emery';

  return { nirvana, zion, hefner };
}

// Reads every fill argb actually painted onto a worksheet, keyed by "row,col".
function fillMapFor(ws) {
  const map = {};
  for (let r = 1; r < ws.rows.length; r++) {
    const row = ws.rows[r];
    if (!row) continue;
    for (let c = 1; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      const argb = cell.fill && cell.fill.fgColor ? cell.fill.fgColor.argb : undefined;
      if (argb) map[`${r},${c}`] = argb;
    }
  }
  return map;
}

function findRowIndex(ws, predicate) {
  for (let r = 1; r < ws.rows.length; r++) {
    const row = ws.rows[r];
    if (!row) continue;
    if (predicate(row)) return r;
  }
  return -1;
}

test('test_export_applies_entity_palette', async () => {
  const api = loadApp({ savedNames: true });
  makeThreeEntityFixture(api);

  await api.exportCombinedExcel();
  // The mock records every created worksheet on the workbook instance _exportExcel just
  // built; grab it back via the API's most-recently-constructed-workbook pointer.
  const wb = api.__lastExcelWorkbook;
  assert.ok(wb, 'expected _exportExcel to have constructed a workbook the test can inspect');
  const sheet = wb.worksheets.find(w => w.name === 'Report');
  assert.ok(sheet, 'expected a Report worksheet');

  const fills = fillMapFor(sheet);

  // FC-00080: each entity is a block: its band (the entity name), a group heading, then its rows.
  // The rows carry the entity's body fill; Cash is one highlighter yellow for every entity.
  const CASH = api.COMBINED_COLS.cash + 1;
  const firstRowOf = (name) => { const b = findRowIndex(sheet, row => row[1] && row[1].value === name.toUpperCase()); return b > 0 ? b + 2 : -1; };
  const nirvanaRow = firstRowOf('Nirvana 11th'), zionRow = firstRowOf('Zion'), hefnerRow = firstRowOf('Hefner');
  assert.ok(nirvanaRow > 0 && zionRow > 0 && hefnerRow > 0, 'expected to find one data row per entity');
  [[nirvanaRow, 'N11'], [zionRow, 'ZIO'], [hefnerRow, 'HEF']].forEach(([r, code]) => {
    assert.equal(fills[`${r},1`], api.FC12_PALETTES[code].body, code + ' body fill');
    assert.equal(fills[`${r},${CASH}`], api.REPORT_COLORS.cashData, code + ' Cash column is the one cash yellow');
    assert.equal(fills[`${r - 2},1`], api.FC12_PALETTES[code].band, code + ' band in the darker shade');
    assert.equal(sheet.rows[r - 2][1].font.color.argb, 'FFFFFFFF', 'white letters on the band');
  });

  // The header row is white, its Cash heading yellow.
  const headerRow = findRowIndex(sheet, row => row[1] && row[1].value === 'Employee');
  assert.equal(fills[`${headerRow},1`], 'FFFFFFFF', 'header fill');
  assert.equal(fills[`${headerRow},${CASH}`], api.REPORT_COLORS.cashData, 'Cash heading');

  // Subtotal rows are light grey, their Cash cell a darker yellow.
  const nirvanaSubtotalRow = findRowIndex(sheet, row => row[1] && /subtotal/i.test(row[1].value || ''));
  assert.ok(nirvanaSubtotalRow > 0);
  assert.equal(fills[`${nirvanaSubtotalRow},1`], api.REPORT_COLORS.sub, 'subtotal fill');
  assert.equal(fills[`${nirvanaSubtotalRow},${CASH}`], api.REPORT_COLORS.cashSub, 'subtotal Cash fill');

  // Cash-Only export: the Cash Portion column (last column) gets the palette's cash tint,
  // and the body columns get the palette's body color.
  await api.exportCashExcel();
  const wbCash = api.__lastExcelWorkbook;
  const sheetCash = wbCash.worksheets.find(w => w.name === 'Report');
  const fillsCash = fillMapFor(sheetCash);
  const zionCashRow = findRowIndex(sheetCash, row => row[1] && row[1].value === 'Zion');
  assert.ok(zionCashRow > 0);
  assert.equal(fillsCash[`${zionCashRow},1`], api.FC12_PALETTES.ZIO.body, 'cashOnly body fill');
  const lastCol = sheetCash.rows[zionCashRow].length - 1;
  assert.equal(fillsCash[`${zionCashRow},${lastCol}`], api.FC12_PALETTES.ZIO.cash, 'cashOnly Cash Portion column gets the cash tint');

  // Deposit-Only export: no special cash tint — every body column (including the Deposit
  // Portion column) is just the palette's plain body color.
  api.payMethod[api.wKey(1, 'Beacon')] = 'deposit';
  await api.exportDepositExcel();
  const wbDep = api.__lastExcelWorkbook;
  const sheetDep = wbDep.worksheets.find(w => w.name === 'Report');
  const fillsDep = fillMapFor(sheetDep);
  const zionDepRow = findRowIndex(sheetDep, row => row[1] && row[1].value === 'Zion');
  assert.ok(zionDepRow > 0);
  const lastColDep = sheetDep.rows[zionDepRow].length - 1;
  assert.equal(fillsDep[`${zionDepRow},1`], api.FC12_PALETTES.ZIO.body, 'depositOnly body fill');
  assert.equal(fillsDep[`${zionDepRow},${lastColDep}`], api.FC12_PALETTES.ZIO.body, 'depositOnly Deposit column is body-colored, not specially tinted');

  // Timecard/PayrollCalc exports stay uncolored — no fills applied to data rows at all.
  await api.exportTimecardExcel();
  const wbTc = api.__lastExcelWorkbook;
  const sheetTc = wbTc.worksheets.find(w => w.name === 'Report');
  const fillsTc = fillMapFor(sheetTc);
  const nirvanaTcRow = findRowIndex(sheetTc, row => row[1] && row[1].value === 'Nirvana 11th');
  assert.ok(nirvanaTcRow > 0);
  assert.equal(fillsTc[`${nirvanaTcRow},1`], undefined, 'timecard export must remain uncolored');
});

test('test_export_flat_employee_row_shape', async () => {
  const api = loadApp({ savedNames: true });
  makeThreeEntityFixture(api);

  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook;
  const sheet = wb.worksheets.find(w => w.name === 'Report');

  const flatRowIdx = findRowIndex(sheet, row => row[1] && row[1].value === 'Emery');
  assert.ok(flatRowIdx > 0, 'expected to find the flat employee row');
  const row = sheet.rows[flatRowIdx];

  // FC-00080: the name prints plain; Rate says "flat".
  // Hours cell is blank for a flat employee.
  assert.equal(row[api.COMBINED_COLS.hours + 1].value, '', 'Hours must be blank for a flat-amount employee');
  // Rate cell reads the literal text "flat" (named in api.COMBINED_COLS).
  assert.equal(row[api.COMBINED_COLS.rate + 1].value, 'flat', 'Rate must read the text "flat"');
  // Still gets Hefner's palette body fill like every other Hefner row.
  assert.equal(row[1].fill.fgColor.argb, api.FC12_PALETTES.HEF.body, 'flat row still gets its entity palette');
});

test('test_export_unknown_entity_code_falls_back_to_default_palette', async () => {
  const api = loadApp({ savedNames: true });
  const ent = resetToSingleEntity(api, {
    id: 0,
    name: 'Some New Client LLC',
    employees: [{ name: 'Pathway', shifts: ['', '9AM - 5PM', '', '', '', '', ''] }],
    dateLabels: ['', 'Mon Aug 10 2026', '', '', '', '', ''],
    breakMinutes: 0,
    breakMinutesSet: true,
    actualDays: [{
      empName: 'Pathway', entityName: 'Some New Client LLC', date: '2026-08-10', dayIdx: 1,
      pairs: [{ in: 9, out: 17, outAdj: 17, minutes: 480 }],
    }],
  });
  api._syncEntityCode(ent);
  assert.notEqual(ent.code, 'N11');
  assert.notEqual(ent.code, 'ZIO');
  assert.notEqual(ent.code, 'HEF');
  api.wageRates[api.wKey(0, 'Pathway')] = 15;
  api.payMethod[api.wKey(0, 'Pathway')] = 'cash';

  await api.exportCombinedExcel();
  const wb = api.__lastExcelWorkbook;
  const sheet = wb.worksheets.find(w => w.name === 'Report');
  const patRow = findRowIndex(sheet, row => row[1] && row[1].value === 'Pathway');
  assert.ok(patRow > 0);
  assert.equal(sheet.rows[patRow][1].fill.fgColor.argb, api.FC12_PALETTES.DEFAULT.body, 'unknown entity code falls back to DEFAULT body fill');
  assert.equal(sheet.rows[patRow][api.COMBINED_COLS.cash + 1].fill.fgColor.argb, api.REPORT_COLORS.cashData, 'Cash is the one cash yellow');
  assert.equal(sheet.rows[patRow - 2][1].fill.fgColor.argb, api.FC12_PALETTES.DEFAULT.band, 'DEFAULT band');
});
