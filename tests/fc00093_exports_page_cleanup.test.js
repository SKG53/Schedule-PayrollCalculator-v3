// FC-00093: the Exports page — a simpler accountant card (one status, no dates, no notes), pay
// dates set once on the Payroll tab and printed the same everywhere, Refresh on every card, the
// same aligned rows on every card, editable file names per week. Invented names and figures only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, completeAccountant } = require('./fc70-helpers');

const cardOf = (html, key) => {
  const at = html.indexOf('data-key="' + key + '"');
  const next = html.indexOf('<div class="exp-card', at);
  return html.slice(at, next > 0 ? next : html.indexOf('<div class="dl-actions"', at));
};
const panel = (api) => { api.renderDownloadsPanel(); return api.__sandbox.document.getElementById('downloadsHost').innerHTML; };
const ROWS = ['exp-title', 'exp-desc', 'exp-opts', 'exp-fname', 'exp-btns', 'exp-batch', 'exp-status'];

// ---------- 1. The accountant card ----------
test('test_accountant_card_has_no_date_pickers_notes_or_checks_list', () => {
  const api = setup({ exec: true });
  const one = cardOf(panel(api), 'accountant');
  assert.doesNotMatch(one, /type="date"/, 'no pay date pickers');
  assert.doesNotMatch(one, /setPayDateByHand/);
  assert.doesNotMatch(one, /Notes for the accountant|acct-week-note/, 'no week notes section');
  assert.doesNotMatch(one, /checks out on its own|matches this week's payroll deposits|Not written until complete/, 'no list of checks');
  assert.equal((one.match(/class="exp-status/g) || []).length, 1, 'one status');
  assert.match(one, /⚠ Not ready: Deposit pay date not set — set it on the Payroll tab/);
  // Complete it: the same single status as every other card.
  completeAccountant(api);
  assert.deepEqual(api.acctBlockers(), []);
  const done = cardOf(panel(api), 'accountant');
  assert.match(done, /<div class="exp-status dl-ok">✓ Ready<\/div>/);
});

test('test_accountant_status_is_one_short_line_and_blocking_is_unchanged', async () => {
  const api = setup();
  api.setPayDateByHand('deposit', '2026-08-20');
  const st = api.downloadStatus('accountant');
  assert.equal(st.ok, false);
  assert.match(st.reasons[0], /^\d+ deposit people have no employment type — fix on the Employee Register$/);
  assert.match(api._acctCardHtml(), /⚠ Not ready: \d+ deposit people have no employment type — fix on the Employee Register/);
  assert.match(api._acctCardHtml(), /title="[^"]*Avery Atest/, 'who is named in the tooltip');
  // The file is still refused while incomplete.
  const before = api.__lastExcelWorkbook;
  await api.exportAccountantFile();
  assert.equal(api.__lastExcelWorkbook, before, 'not written');
  assert.match(api.acctBlockers().join(' | '), /Employment type not set/);
});

// ---------- 2. Pay dates: set on the Payroll tab, printed the same everywhere ----------
test('test_pay_dates_are_set_on_the_payroll_tab', () => {
  const api = setup();
  api.setTab('payroll');
  const html = api.__sandbox.document.getElementById('payrollEntityContent').innerHTML;
  assert.match(html, /class="paydates-bar"/);
  assert.match(html, /onchange="setPayDateByHand\('deposit',this.value\)"/);
  assert.match(html, /onchange="setPayDateByHand\('cash',this.value\)"/);
  assert.match(api._payDatesBarHtml(), /paydate-unset/, 'an unset deposit date stands out');
  const asked = []; api.__sandbox.confirm = (m) => { asked.push(m); return true; };
  assert.equal(api.setPayDateByHand('deposit', '2026-08-20'), true);
  assert.equal(asked.length, 1, 'the FC-00073 warning still comes first');
  const after = api.__sandbox.document.getElementById('payrollEntityContent').innerHTML;
  assert.match(after, /value="2026-08-20"/, 'the Payroll tab shows the new date');
  assert.doesNotMatch(api._payDatesBarHtml(), /paydate-unset/);
});

test('test_pay_dates_identical_in_payroll_report_and_accountant_file', async () => {
  const api = setup();
  // Not set: every place says so the same way.
  assert.equal(api.payDateText('deposit'), '(date not set)');
  assert.match(api._payDatesLine(), /^Deposit paid \(date not set\) {3}\| {3}Cash and Check paid /);
  assert.equal(api._acctDatesLine(), 'Deposit paid (date not set)');
  // Set once (the Payroll tab): the report and the accountant file print the same date.
  completeAccountant(api, '2026-08-20');
  await api._exportExcel('combined');
  const rep = api.__lastExcelWorkbook.worksheets[0].rows[2][1].value;
  await api.exportAccountantFile();
  const acct = api.__lastExcelWorkbook.worksheets[0].rows[2][1].value;
  assert.equal(acct, 'Deposit paid Thu 08/20/26');
  assert.ok(rep.startsWith(acct + '   |   '), rep + ' vs ' + acct);
});

test('test_payroll_card_warns_when_the_deposit_date_is_missing', () => {
  const api = setup();
  const msg = 'Deposit pay date not set — set it on the Payroll tab (Pay dates)';
  assert.ok(api.downloadStatus('payroll').reasons.includes(msg));
  assert.ok(api.downloadStatus('payroll:0').reasons.includes(msg));
  api.setPayDateByHand('deposit', '2026-08-20');
  assert.ok(!api.downloadStatus('payroll').reasons.includes(msg));
  // Nobody paid by deposit in the report's scope: nothing to warn about.
  const b = setup();
  Object.keys(b.payMethod).forEach(k => { b.payMethod[k] = 'cash'; });
  assert.ok(!b.downloadStatus('payroll').reasons.includes(msg));
});

// ---------- 3. Refresh ----------
test('test_refresh_rebuilds_the_card_from_current_data', () => {
  const api = setup();
  completeAccountant(api);
  delete api.session.toolSettings['payDate:deposit|2026-08-09']; // changed without redrawing
  let html = panel(api);
  assert.match(cardOf(html, 'accountant'), /Not ready/);
  api.session.toolSettings['payDate:deposit|2026-08-09'] = '2026-08-20|hand'; // the panel is now stale
  assert.match(cardOf(api.__sandbox.document.getElementById('downloadsHost').innerHTML, 'accountant'), /Not ready/, 'stale until refreshed');
  const r = api.refreshExportCard('accountant');
  assert.equal(r.ok, true);
  html = api.__sandbox.document.getElementById('downloadsHost').innerHTML;
  assert.match(cardOf(html, 'accountant'), /✓ Ready<span class="exp-checked"> · checked /);
  assert.deepEqual(r.names, api.downloadFileNames('accountant', true));
  // A card for a new entity appears on Refresh; a card that is gone says so.
  api.entities[1].actualDays = [];
  api.entities[1].employees = [];
  assert.equal(api.refreshExportCard('payroll:1'), null);
  assert.ok(api.DOWNLOADS.every(d => d.key !== 'payroll:1'));
});

test('test_every_card_has_a_refresh_button', () => {
  const api = setup();
  const html = panel(api);
  api.DOWNLOADS.forEach(d => assert.match(cardOf(html, d.key), new RegExp(`onclick="refreshExportCard\\('${d.key}'\\)"[^>]*>Refresh</button>`), d.key));
});

// ---------- 4. The same rows on every card, lined up ----------
test('test_every_card_has_the_same_rows_in_the_same_order', () => {
  const api = setup();
  const html = panel(api);
  api.DOWNLOADS.forEach(d => {
    const one = cardOf(html, d.key);
    const seen = [...one.matchAll(/<div class="(?:dl-desc )?(exp-[a-z]+)/g)].map(m => m[1]).filter(c => ROWS.includes(c));
    assert.deepEqual(seen.filter((c, i) => seen.indexOf(c) === i), ROWS, d.key);
    assert.match(one, /<div class="exp-btns">(<button[^>]*>[^<]*<\/button>)+<\/div>/, d.key + ': buttons in one row');
  });
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(css, /\.exp-card\{[^}]*grid-template-rows:subgrid;grid-row:span 7/);
  assert.equal(api.EXP_CARD_ROWS, ROWS.length);
});

test('test_descriptions_say_what_who_when', () => {
  const api = setup();
  api._syncDownloads();
  api.DOWNLOADS.forEach(d => {
    assert.ok(d.what && d.who && d.when, d.key);
    assert.match(d.who, /^For /, d.key);
    assert.match(d.when, /^Ready /, d.key);
    assert.equal(d.desc, d.what + ' · ' + d.who + ' · ' + d.when);
  });
});

// ---------- 5. Editable file names ----------
test('test_edited_file_name_is_used_by_the_card_and_download_batch', async () => {
  const api = setup();
  const def = api.defaultFileBase('timecards');
  assert.equal(api.exportFileBase('timecards'), def);
  assert.match(cardOf(panel(api), 'timecards'), new RegExp(`<textarea[^>]*class="exp-fname-input"[^>]*>${def}</textarea>`));
  // The extension cannot be edited: a typed one is dropped, and unsafe characters go.
  assert.equal(api.setExportFileName('timecards', 'Week 33: punches?.xlsx'), true);
  assert.equal(api.exportFileBase('timecards'), 'Week 33 punches');
  assert.deepEqual(api.downloadFileNames('timecards', true), ['Week 33 punches.xlsx']);
  api.setExportFileName('payroll', 'Pay run Alpha');
  assert.deepEqual(api.downloadFileNames('payroll', true), ['Pay run Alpha.xlsx', 'Pay run Alpha.pdf']);
  const html = panel(api);
  assert.match(cardOf(html, 'payroll'), /class="exp-fname-input edited"[^>]*>Pay run Alpha<\/textarea>/);
  assert.match(cardOf(html, 'payroll'), /<span class="exp-ext">File name · \.xlsx \/ \.pdf · edited for this week<\/span>/, 'the extension is shown, not edited');
  api.setExportFileName('payroll', 'Pay run\nAlpha'); // a line break typed in the box
  assert.equal(api.exportFileBase('payroll'), 'Pay run Alpha');
  // Download batch uses the edited names.
  ['payroll', 'timecards', 'accountant', 'settings', 'snapshot'].forEach(k => Object.keys(api.DOWNLOADS.find(d => d.key === k).formats).forEach(f => api.setDownloadTick(k, f, false)));
  api.setDownloadTick('payroll', 'xlsx', true);
  api.setDownloadTick('settings', 'xlsx', true);
  api.setExportFileName('settings', 'Register for Alpha');
  const files = await api.buildSelectedDownloads();
  assert.deepEqual(files.map(f => f.name).sort(), ['Pay run Alpha.xlsx', 'Register for Alpha.xlsx']);
  // The register's own buttons use it too (FC-00090's names).
  assert.equal(api._stemFileName('EmployeeRegister', 'csv'), 'Register for Alpha.csv');
  assert.equal(api._stemFileName('EmployeeRegister_WithBreaks', 'xlsx'), 'Register for Alpha_WithBreaks.xlsx');
  // One card's Excel button.
  const one = await api.exportCardNow('settings', 'xlsx');
  assert.deepEqual(one.map(f => f.name), ['Register for Alpha.xlsx']);
});

test('test_reset_restores_the_default_and_the_edit_belongs_to_the_week', async () => {
  const api = setup();
  const def = api.defaultFileBase('accountant');
  api.setExportFileName('accountant', 'For the accountant');
  assert.equal(api.fileNameEdited('accountant'), true);
  assert.equal(api._toolSettingLabel('fileName:accountant|2026-08-09'), 'File name · Accountant file · week of 08/09/26');
  // In the snapshot, not in the Tool Settings file.
  const snap = await api.buildSnapshot();
  assert.equal(snap.state.toolSettings['fileName:accountant|2026-08-09'], 'For the accountant');
  await api.exportToolSettingsExcel();
  const words = api.__lastExcelWorkbook.worksheets.flatMap(w => w.rows.flatMap(r => (r || []).map(c => (c && typeof c.value === 'string' ? c.value : '')))).join(' | ');
  assert.doesNotMatch(words, /For the accountant|File name/);
  // Reset: the standard name again, and no key left behind.
  assert.equal(api.resetExportFileName('accountant'), true);
  assert.equal(api.exportFileBase('accountant'), def);
  assert.ok(!('fileName:accountant|2026-08-09' in api.session.toolSettings));
  assert.match(cardOf(panel(api), 'accountant'), /class="btn btn-small exp-reset" onclick="resetExportFileName\('accountant'\)" disabled/);
  // Typing the standard name back counts as no edit.
  api.setExportFileName('accountant', 'Other name');
  api.setExportFileName('accountant', def);
  assert.equal(api.fileNameEdited('accountant'), false);
  // Another week starts with the standard names.
  api.setExportFileName('snapshot', 'Old week');
  api.entities.forEach(e => { e.dateLabels = ['Aug 16 2026', 'Aug 17 2026', 'Aug 18 2026', 'Aug 19 2026', 'Aug 20 2026', 'Aug 21 2026', 'Aug 22 2026']; });
  assert.equal(api.fileNameEdited('snapshot'), false);
  assert.match(api.exportFileBase('snapshot'), /_0816to0822_Snapshot$/);
});
