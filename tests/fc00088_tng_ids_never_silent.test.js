// FC-00088: TNG IDs are never handed out by looking, and never silently a second time.
// Invented names only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./fc70-helpers');

const recs = (api) => Object.values(api.session.roster.byId).filter(r => r && r.canonical_name);
const numbered = (api) => recs(api).filter(r => r.tng).length;

test('test_looking_at_the_register_hands_out_no_numbers', () => {
  const api = setup();
  api.registerRows();
  api.renderRegister();
  assert.equal(numbered(api), 0);
  assert.ok(api.registerRows().every(r => !r.tng), 'shown as pending, not numbered');
});

test('test_first_save_numbers_everyone_without_asking', async () => {
  const api = setup();
  const asked = []; api.__sandbox.confirm = (m) => { asked.push(m); return true; };
  await api.exportPayrollSettingsExcel(false);
  assert.equal(numbered(api), recs(api).length);
  assert.equal(asked.length, 0, 'a browser that never numbered anyone is not asked');
  assert.equal(api._tngBrowserHigh(), recs(api).length);
});

test('test_an_older_file_in_a_browser_that_numbered_before_is_asked_and_cancel_numbers_nobody', async () => {
  const api = setup();
  api._noteBrowserTngHigh(7); // this browser numbered 7 people before
  assert.ok(api._tngFreshRisk());
  assert.match(api._registerWeekLine(), /Nobody here has a TNG ID yet.*TNG00007.*Load your latest Employee Register/);
  const asked = []; api.__sandbox.confirm = (m) => { asked.push(m); return false; };
  assert.equal(api.assignTngIds(), 0);
  assert.equal(numbered(api), 0, 'Cancel numbers nobody');
  assert.match(asked[0], /already numbered people \(up to TNG00007\)/);
  // Asked once per opened file.
  assert.equal(api.assignTngIds(), 0);
  assert.equal(asked.length, 1);
});

test('test_ok_numbers_them_after_the_highest_number_known', () => {
  const api = setup();
  api._noteBrowserTngHigh(7);
  api.__sandbox.confirm = () => true;
  const n = api.assignTngIds();
  assert.equal(n, recs(api).length);
  const nums = recs(api).map(r => +r.tng.slice(3)).sort((a, b) => a - b);
  assert.equal(nums[0], 8);
});

test('test_a_file_that_has_numbers_is_never_asked_and_new_people_get_the_next_number', () => {
  const api = setup();
  api.__sandbox.confirm = () => true;
  api.assignTngIds(); // everyone numbered (first time)
  const hi = Math.max(...recs(api).map(r => +r.tng.slice(3)));
  const asked = []; api.__sandbox.confirm = (m) => { asked.push(m); return true; };
  const added = api.addNoSchedPerson(0, 'Nora', 'Ntest', { amount: 300, method: 'cash' });
  assert.ok(added);
  api.assignTngIds();
  const nora = recs(api).find(r => /Nora/.test(r.canonical_name));
  assert.equal(nora.tng, 'TNG' + String(hi + 1).padStart(5, '0'));
  assert.equal(asked.length, 0, 'a new hire in a numbered file is not a risk');
  assert.equal(api._tngFreshRisk(), null);
});

test('test_opening_a_file_asks_again', async () => {
  const api = setup();
  const snap = JSON.parse(JSON.stringify(await api.buildSnapshot())); // no numbers in it
  api._noteBrowserTngHigh(7);
  let asked = 0; api.__sandbox.confirm = () => { asked++; return false; };
  api.assignTngIds(); api.assignTngIds();
  assert.equal(asked, 1);
  api.__sandbox.confirm = () => true; // "Open this snapshot?"
  assert.ok(api.openSnapshotData(snap, 'snap.json').ok);
  api.__sandbox.confirm = () => { asked++; return false; };
  api.assignTngIds();
  assert.equal(asked, 2, 'the newly opened file is asked about again');
});

test('test_register_pdf_and_csv_number_people_before_writing', () => {
  const api = setup();
  api.exportRegisterCsv();
  assert.equal(numbered(api), recs(api).length);
});

test('test_people_without_a_number_each_get_their_own_row', () => {
  const api = setup();
  api.setTab('register');
  const html = api.__sandbox.document.getElementById('registerHost').innerHTML;
  assert.doesNotMatch(html, /same person/, 'unnumbered people are not grouped together');
  assert.equal((html.match(/>pending</g) || []).length, recs(api).length);
});

test('test_linking_when_numbering_is_declined_links_nothing', () => {
  const api = setup();
  api._noteBrowserTngHigh(7);
  api.__sandbox.confirm = () => false;
  const a = recs(api).find(r => r.entity === 0), b = recs(api).find(r => r.entity === 1);
  assert.equal(api.linkSamePerson(a.id, b.id), false);
  assert.equal(a.tng, undefined);
  assert.equal(b.tng, undefined);
});
