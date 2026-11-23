// FC-00090: the register's and tool settings' own buttons name files like every other export.
// Invented names only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./fc70-helpers');

function capture(api) {
  const written = [];
  const doc = api.__sandbox.document, oc = doc.createElement;
  doc.createElement = (t) => { const el = oc(t); if (t === 'a') el.click = () => { if (el.download) written.push(el.download); }; return el; };
  return written;
}

test('test_register_buttons_use_the_export_naming', async () => {
  const api = setup();
  const stem = api._fileStem();
  assert.ok(stem.length > 0);
  const written = capture(api);
  api.exportRegisterCsv();
  await api.exportPayrollSettingsExcel(false);
  await api.exportPayrollSettingsExcel(true);
  await api.exportToolSettingsExcel();
  assert.ok(written.includes(stem + '_EmployeeRegister.csv'), written.join(','));
  assert.ok(written.includes(stem + '_EmployeeRegister.xlsx'), written.join(','));
  assert.ok(written.includes(stem + '_EmployeeRegister_WithBreaks.xlsx'), written.join(','));
  assert.ok(written.includes(stem + '_ToolSettings.xlsx'), written.join(','));
  assert.equal(api._stemFileName('EmployeeRegister', 'xlsx'), stem + '_EmployeeRegister.xlsx');
  assert.equal(api._stemFileName('EmployeeRegister_WithBreaks', 'xlsx'), stem + '_EmployeeRegister_WithBreaks.xlsx');
  assert.equal(api._stemFileName('ToolSettings', 'xlsx'), stem + '_ToolSettings.xlsx');
});

test('test_same_name_as_the_exports_card', () => {
  const api = setup();
  const card = api.downloadFileNames('settings', true);
  assert.deepEqual(card, [api._stemFileName('EmployeeRegister', 'xlsx')]);
  const ts = api.downloadFileNames('toolsettings', true);
  assert.deepEqual(ts, [api._stemFileName('ToolSettings', 'xlsx')]);
});
