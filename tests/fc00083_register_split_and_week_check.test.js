// FC-00083: the Employee Register holds employees only (with their bonuses, paid days and IDs);
// Tool Settings is its own file; the register week check. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./fc70-helpers');

// A workbook the tool wrote, handed back to the tool as if loaded from disk.
function loadBack(api, wb, name) {
  const val = (c) => { const v = c && c.value; if (v == null) return ''; if (typeof v === 'object' && 'result' in v) return String(v.result); return String(v); };
  const sheets = {}; wb.worksheets.forEach(w => { sheets[w.name] = w; });
  api.__sandbox.FileReader = class { readAsArrayBuffer() { this.onload({ target: { result: new ArrayBuffer(0) } }); } };
  api.__sandbox.XLSX = {
    read: () => ({ SheetNames: wb.worksheets.map(w => w.name), Sheets: sheets }),
    utils: { sheet_to_json: (ws) => ws.rows.slice(1).map(r => (r || []).slice(1).map(val)) },
  };
  return { name: name || 'file.xlsx' };
}
const allText = (wb) => wb.worksheets.flatMap(w => w.rows.flatMap(r => (r || []).map(c => (c && c.value != null ? String(c.value) : '')))).join(' | ');

test('test_register_holds_employees_only', async () => {
  const api = setup();
  api.setToolSetting('wowHours', 12);
  api.addBonus(0, 'Avery Atest', { type: 'weekly', recurring: true, amount: 10, pay: 'deposit' });
  await api.exportPayrollSettingsExcel(false);
  const wb = api.__lastExcelWorkbook;
  assert.deepEqual(wb.worksheets.map(w => w.name), ['Payroll Settings', 'People', 'Bonuses', 'Paid Days', 'Register Info']);
  const text = allText(wb);
  assert.doesNotMatch(text, /Week-over-week|Payroll report · Columns|File label|Names on exports/, 'no tool setting in the register');
  const ri = wb.worksheets.find(w => w.name === 'Register Info').rows.slice(2).filter(Boolean).map(r => [r[1].value, r[2] && r[2].value]);
  assert.equal(ri[0][0], 'Register for week');
  assert.equal(ri[0][1], '2026-08-09');
  assert.ok(ri.some(r => r[0] === 'Highest TNG ID issued' && /^TNG\d{5}$/.test(r[1])));
  assert.ok(ri.some(r => /^Highest employee ID issued · /.test(r[0])));
  assert.ok(ri.some(r => r[0] === 'Entity code · Alpha Test'));
  assert.match(text, /Avery Atest \| EMP_ALP_00001 \| Weekly \| 10/, 'the bonus is on the Bonuses sheet');
});

test('test_tool_settings_file_holds_settings_only', async () => {
  const api = setup();
  api.setToolSetting('wowHours', 12);
  api.setReportColumnOn('mode', true);
  api.setEntityFileLabel(1, 'BetaX');
  await api.exportToolSettingsExcel();
  const wb = api.__lastExcelWorkbook;
  assert.deepEqual(wb.worksheets.map(w => w.name), ['Tool Settings', 'About']);
  const text = allText(wb);
  assert.doesNotMatch(text, /Avery|Bram|TNG\d|EMP_|Highest|Entity code|Paid outside/, 'no employee and no ID in Tool Settings');
  // Loaded into a fresh tool with the same Load button: settings only.
  const b = setup();
  const before = Object.keys(b.session.roster.byId).length;
  b.importPayrollSettingsFile(loadBack(b, wb, 'TNG_ToolSettings.xlsx'), false);
  assert.equal(b.getToolSetting('wowHours'), 12);
  assert.ok(b.reportColumns().find(c => c.key === 'mode').on);
  assert.equal(b.downloadFileNames('snapshot')[0].split('_')[1], 'BetaX');
  assert.equal(Object.keys(b.session.roster.byId).length, before, 'no employee touched');
  assert.equal(b.getStaged ? b.getStaged() : null, null, 'nothing staged: it is not a register');
  assert.ok(b.session.log.some(e => e.type === 'toolSetting'), 'logged in History');
});

test('test_register_load_keeps_tool_settings_and_round_trips', async () => {
  const api = setup();
  api.addBonus(0, 'Avery Atest', { type: 'weekly', recurring: true, amount: 10, pay: 'deposit', week: '2026-08-02' });
  api.assignTngIds();
  const tng = api.tngOf(0, 'Avery Atest');
  await api.exportPayrollSettingsExcel(false);
  const wb = api.__lastExcelWorkbook;
  const b = setup();
  b.setToolSetting('wowHours', 99);
  b.importPayrollSettingsFile(loadBack(b, wb, 'Employee_Register.xlsx'), false);
  b.applyStagedSettings();
  assert.equal(b.getToolSetting('wowHours'), 99, 'loading the register never changes a tool setting');
  assert.equal(b.bonusTotals(0, 'Avery Atest').total, 10, 'the bonus came back with its week');
  assert.equal(b.getBonuses(0, 'Avery Atest')[0].week, '2026-08-02');
  assert.equal(b.tngOf(0, 'Avery Atest'), tng, 'the TNG ID came back');
  assert.deepEqual(b.getRegLoaded(), { week: '2026-08-09', high: api._tngHighWater(), legacy: false });
});

test('test_older_combined_file_loads_both', () => {
  const api = setup();
  // A settings file from before FC-00083: employees and Tool Settings in one file.
  const sheetOf = (rows) => ({ rows: [undefined].concat(rows.map(r => [undefined].concat(r.map(v => ({ value: v }))))) });
  const wb = { worksheets: [
    Object.assign(sheetOf([['Entity', 'Employee', 'Wage/hour', 'Type', 'Pay Method'], ['Alpha Test', 'Avery Atest', '13', 'Hourly', 'Deposit']]), { name: 'Payroll Settings' }),
    Object.assign(sheetOf([['Setting', 'Value'], ['Week-over-week hours swing', '15']]), { name: 'Tool Settings' }),
  ] };
  api.importPayrollSettingsFile(loadBack(api, wb, 'Old_Settings.xlsx'), false);
  api.applyStagedSettings();
  assert.equal(api.getToolSetting('wowHours'), 15, 'its tool settings apply');
  assert.equal(api.wageRates[api.wKey(0, 'Avery Atest')], 13, 'and its employees');
  assert.equal(api.registerWeekStatus().state, 'unknown', 'an older file has no week');
});

test('test_week_check', () => {
  const alerts = [];
  const api = setup(); api.__sandbox.alert = (m) => alerts.push(m);
  assert.equal(api.registerWeekStatus().state, 'none');
  api._setRegisterLoaded({ week: '2026-08-02', high: 5 });
  assert.equal(api.registerWeekStatus().state, 'ok', 'last week\'s register');
  api._setRegisterLoaded({ week: '2026-08-09', high: 5 });
  assert.equal(api.registerWeekStatus().state, 'ok', 'this week\'s register');
  assert.equal(alerts.length, 0);
  api._setRegisterLoaded({ week: '2026-07-19', high: 5 });
  assert.equal(api.registerWeekStatus().state, 'older');
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /^This Employee Register is from the week of 07\/19\/26; you are running the week of 08\/09\/26\./);
  api.parseSchedule([['Name', 'Sun', 'Mon'], ['Avery Atest', '', '9AM - 5PM']], 0);
  assert.equal(alerts.length, 1, 'warned once per register and week');
  api._setRegisterLoaded({ week: '2026-08-23', high: 5 });
  assert.equal(api.registerWeekStatus().state, 'newer');
  assert.match(alerts[1], /after the week you are running/);
});

test('test_week_check_when_schedules_come_after_the_register', () => {
  const alerts = [];
  const api = setup(); api.__sandbox.alert = (m) => alerts.push(m);
  const labels = api.entities.map(e => e.dateLabels.slice());
  api.entities.forEach(e => { e.dateLabels = ['', '', '', '', '', '', '']; });
  api._setRegisterLoaded({ week: '2026-07-19', high: 5 });
  assert.equal(api.registerWeekStatus().state, 'norun');
  assert.equal(alerts.length, 0, 'nothing to compare yet');
  api.entities.forEach((e, i) => { e.dateLabels = labels[i]; });
  api.parseSchedule([['Name', 'Sun', 'Mon'], ['Avery Atest', '', '9AM - 5PM']], 0);
  assert.equal(alerts.length, 1, 'the schedules arriving run the check');
});

test('test_new_tng_id_after_an_older_register_needs_confirmation', () => {
  const api = setup();
  const asked = [];
  api.__sandbox.confirm = (m) => { asked.push(m); return false; };
  api._setRegisterLoaded({ week: '2026-07-19', high: 0 });
  assert.equal(api.assignTngIds(), 0, 'declined: no ID issued');
  assert.equal(api.tngOf(0, 'Avery Atest'), '');
  assert.equal(api.assignTngIds(), 0, 'asked once per register');
  assert.equal(asked.length, 1);
  assert.match(asked[0], /^Issue \d+ new TNG IDs? from an older register\?/);
  // Last week's register: no question.
  api._setRegisterLoaded({ week: '2026-08-02', high: 0 });
  assert.ok(api.assignTngIds() > 0);
  assert.equal(asked.length, 1);
});

test('test_snapshot_raises_the_highest_tng_id', async () => {
  const later = setup();
  later.assignTngIds();
  later.addNewEmployee(0, 'Kip Ktest');
  later.assignTngIds();
  const hi = later._tngHighWater();
  const snap = await later.buildSnapshot();
  // An earlier state in another tool: opening the later snapshot raises what this browser knows.
  const api = setup();
  api.__sandbox.confirm = () => true;
  assert.equal(api._tngBrowserHigh(), 0);
  api.openSnapshotData(snap, 'later');
  assert.equal(api._tngBrowserHigh(), hi);
  assert.equal(api._tngHighWater(), hi);
});

test('test_register_tab_line', () => {
  const api = setup();
  assert.match(api._registerWeekLine(), /^No Employee Register loaded this session/);
  api._setRegisterLoaded({ week: '2026-08-02', high: 3 });
  assert.match(api._registerWeekLine(), /^✓ Register: week of 08\/02\/26 \(last week's\) · highest TNG ID TNG\d{5}$/);
  api._setRegisterLoaded({ week: '2026-07-19', high: 3 });
  assert.match(api._registerWeekLine(), /^⚠ Register: week of 07\/19\/26, older than last week \(running 08\/09\/26\)/);
  api.setTab('register');
  assert.match(api.__sandbox.document.getElementById('registerHost').innerHTML, /class="reg-week reg-week-older"/);
});

test('test_exports_cards', () => {
  const api = setup();
  const keys = api.DOWNLOADS.map(d => d.key);
  assert.ok(keys.indexOf('toolsettings') === keys.indexOf('settings') + 1);
  const ts = api.DOWNLOADS.find(d => d.key === 'toolsettings');
  assert.deepEqual(ts.formats, { xlsx: false }, 'not in the batch by default: saved when a setting changes');
  assert.equal(api.DOWNLOADS.find(d => d.key === 'settings').label, 'Employee Register');
});
