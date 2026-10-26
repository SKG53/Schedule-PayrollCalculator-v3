// FC-00056: "Create a new employee" asks for first and last name, shows the permanent ID before
// it is created, and never hands out an ID that was issued before (the settings file carries the
// highest ID ever issued per entity). The person is in the next settings file.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const H = ['Entity', 'Employee', 'Wage/hour', 'Pay Method', 'Employee ID', 'Aliases', 'Active'];
const cm = () => { const m = {}; H.forEach((h, i) => { m[h.toLowerCase()] = i; }); return m; };
function setup({ file = true, highWater = null } = {}) {
  const api = loadApp({ savedNames: true });
  api.__sandbox.alert = () => {};
  api.__sandbox.confirm = () => true;
  const e = resetToSingleEntity(api, { id: 0, name: 'Alpha Test', employees: [], dateLabels: WEEK, breakMinutesSet: true });
  api._syncEntityCode(e);
  api.ensureIntakeState(e);
  if (highWater) api._ingestToolSettings([['Highest employee ID issued · ' + e.code, String(highWater)]]);
  if (file) api._ingestPayrollSettings([['Alpha Test', 'Rook Bellamy', '15', 'Cash', 'EMP_' + e.code + '_00003', '', 'Yes']], cm(), false);
  const r = api.processReviewRow({ empName: 'pip moss', date: '2026-08-10', clockIn1: '09:00', clockOut1: '13:00', confidence: 0.9, source: 'TC', originalName: 'p.jpg' }, e);
  e.intake.reviewRows.push(r);
  api.setTab('intake');
  return { api, e, r, code: e.code };
}

test('test_dialog_asks_first_and_last_and_shows_the_id', () => {
  const { api, code } = setup();
  api.openNewEmployeeDialog(0, { spelling: 'pip moss' });
  const d = api.getNewEmp();
  assert.deepEqual([d.first, d.last], ['Pip', 'Moss'], 'filled from the card spelling, capitalised');
  assert.equal(api.previewNextEmployeeId(0), 'EMP_' + code + '_00004', 'the next ID, shown before Create');
  const html = api.__sandbox.document.getElementById('newEmpBody').innerHTML;
  assert.match(html, /First name/); assert.match(html, /Last name/);
  assert.match(html, new RegExp('EMP_' + code + '_00004'));
});

test('test_blank_last_name_uses_the_entity_name', () => {
  const { api, e } = setup();
  const label = api.newEmployeeFullName(0, 'quill', '');
  assert.ok(label.startsWith('Quill ') && label.length > 6, label);
  assert.ok(!label.includes('undefined'));
  void e;
});

test('test_create_from_a_row_moves_the_row_and_keeps_the_card_spelling', () => {
  const { api, e, r, code } = setup();
  api.updateReviewField(r.id, 'empName', '__new__');
  api.setNewEmpField('first', 'Pip'); api.setNewEmpField('last', 'Moss');
  api.setNewEmpField('rate', '14.5'); api.setNewEmpField('method', 'cash');
  const rec = api.createNewEmployeeFromDialog();
  assert.equal(rec.id, 'EMP_' + code + '_00004');
  assert.equal(rec.canonical_name, 'Pip Moss');
  assert.equal(r.empName, 'Pip Moss', 'the row is on the new person');
  assert.equal(api.wageRates[api.wKey(0, 'Pip Moss')], 14.5);
  assert.equal(api.payMethod[api.wKey(0, 'Pip Moss')], 'cash');
  assert.equal(api.getNewEmp(), null, 'dialog closed');
  // One undo step takes all of it back.
  api.undoCheckpoint();
  assert.ok(!Object.values(api.session.roster.byId).some(x => x.canonical_name === 'Pip Moss'));
  void e;
});

test('test_never_reuses_an_issued_id', () => {
  // The file's highest person is _00003, but _00009 was issued once (to someone no longer in
  // the file): the next new person gets _00010.
  const { api, code } = setup({ highWater: 9 });
  assert.equal(api.previewNextEmployeeId(0), 'EMP_' + code + '_00010');
  api.openNewEmployeeDialog(0, {});
  api.setNewEmpField('first', 'Wren');
  const rec = api.createNewEmployeeFromDialog();
  assert.equal(rec.id, 'EMP_' + code + '_00010');
});

test('test_settings_file_carries_the_person_and_the_highest_id', async () => {
  const { api, code } = setup({ highWater: 9 });
  api.openNewEmployeeDialog(0, {}); api.setNewEmpField('first', 'Wren'); api.setNewEmpField('last', 'Hale');
  api.createNewEmployeeFromDialog();
  await api.exportPayrollSettingsExcel(false);
  const wb = api.__lastExcelWorkbook;
  const ps = wb.worksheets.find(w => w.name === 'Payroll Settings');
  const cells = ps.rows.filter(Boolean).map(r => r.slice(1).map(c => c && c.value));
  assert.ok(cells.some(r => r.includes('Wren Hale') && r.includes('EMP_' + code + '_00010')), 'the new person and their ID');
  const ts = wb.worksheets.find(w => w.name === 'Tool Settings');
  const t = ts.rows.slice(2).map(r => [r[1].value, r[2].value]);
  assert.ok(t.some(([k, v]) => k === 'Highest employee ID issued · ' + code && v === 10), JSON.stringify(t));
  // Loading that file in a fresh session: the next ID is _00011.
  const b = loadApp();
  const e2 = resetToSingleEntity(b, { id: 0, name: 'Alpha Test', employees: [], dateLabels: WEEK });
  b._syncEntityCode(e2);
  b._ingestToolSettings(t);
  assert.equal(b.previewNextEmployeeId(0), 'EMP_' + code + '_00011');
});

test('test_duplicate_and_archived_refused', () => {
  const { api } = setup();
  api.openNewEmployeeDialog(0, {}); api.setNewEmpField('first', 'Rook'); api.setNewEmpField('last', 'Bellamy');
  assert.equal(api.createNewEmployeeFromDialog(), null);
  assert.match(api.getNewEmp().error, /already exists/);
  api.setNewEmpField('first', '');
  assert.equal(api.createNewEmployeeFromDialog(), null);
  assert.match(api.getNewEmp().error, /first name/);
});

test('test_new_person_gets_a_tab_before_any_row', () => {
  const { api, e } = setup();
  api.openNewEmployeeDialog(0, {}); api.setNewEmpField('first', 'Ozzie'); api.setNewEmpField('last', 'Lark');
  api.createNewEmployeeFromDialog();
  const html = api.renderReviewTableHtml(e, 0);
  assert.match(html, /Ozzie Lark <span style="font-size:10px;color:var\(--text3\)">\(not on schedule\)<\/span><span class="cnt">0<\/span>/);
  assert.equal(e.intake.activeEmpTab, 'Ozzie Lark');
  assert.equal((html.match(/class="day-head"/g) || []).length, 7, 'their week, ready for punches');
  assert.match(html, /\+ New employee<\/button>/, 'the tab bar offers + New employee');
});

test('test_late_settings_import_respects_the_highest_id', () => {
  // People made before the settings file loads are renumbered after the file's highest ID ever.
  const { api, code } = setup({ file: false });
  api.openNewEmployeeDialog(0, {}); api.setNewEmpField('first', 'Ozzie'); api.setNewEmpField('last', 'Lark');
  api.createNewEmployeeFromDialog();
  api._ingestToolSettings([['Highest employee ID issued · ' + code, '12']]);
  api._ingestPayrollSettings([['Alpha Test', 'Rook Bellamy', '15', 'Cash', 'EMP_' + code + '_00003', '', 'Yes']], cm(), false);
  const oz = Object.values(api.session.roster.byId).find(x => x.canonical_name === 'Ozzie Lark');
  assert.equal(oz.id, 'EMP_' + code + '_00013');
});

// Review fix: a name already looked up this session (a provisional record) keeps its ID, and the
// dialog shows that ID, not the next new number.
test('test_preview_shows_the_id_the_person_will_get', () => {
  const { api, code } = setup();
  const prov = api._employeeIdFor(0, 'Zed Quill');
  api.openNewEmployeeDialog(0, { spelling: 'Zed Quill' });
  assert.equal(api.previewNextEmployeeId(0, 'Zed Quill'), prov);
  assert.match(api.__sandbox.document.getElementById('newEmpBody').innerHTML, new RegExp(prov));
  const rec = api.createNewEmployeeFromDialog();
  assert.equal(rec.id, prov);
  assert.equal(api.previewNextEmployeeId(0), 'EMP_' + code + '_' + String(+prov.slice(-5) + 1).padStart(5, '0'));
});
