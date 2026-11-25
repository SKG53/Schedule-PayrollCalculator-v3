// FC-00091: browser check that every tab keeps its place. Not part of `npm test` (it needs
// Playwright and a real snapshot, which never enters the repository).
//
//   SNAP=/path/to/snapshot.json node tests/browser/fc00091_keep_your_place.pw.js
//   (APP defaults to this worktree's index.html; NODE_PATH must reach playwright.)
//
// For each tab it scrolls the page down, then edits one box of each kind (Enter, Tab, click
// on another box, a choice from a list, a tick box) or types in a search box letter by letter,
// and checks: the page and every scroll box inside it stay where they were, and the cursor is
// in the box it should be in (the same box, the next one for Tab, the clicked one for a click).
// Prints one line per check and counts only: no names, no amounts.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const APP = process.env.APP || path.join(__dirname, '..', '..', 'index.html');
const SNAP = process.env.SNAP;
if (!SNAP) { console.error('Set SNAP to a snapshot .json'); process.exit(2); }

// In-page helpers: an element's identity is its tag, type and handlers, plus its place among
// elements with the same identity (the same rule the tool's own helper uses, written apart here
// so the check does not trust the code under test).
const PAGE_HELPERS = `
window.__pw = {
  sig(el){ if(!el||!el.getAttribute) return ''; const a=n=>el.getAttribute(n)||'';
    return [el.tagName,el.type||'',a('id'),a('name'),a('oninput'),a('onchange'),a('onblur'),a('onclick'),a('data-rbox')].join('|'); },
  all(){ return [...document.querySelectorAll('input,select,textarea,button,a[href],summary')]; },
  key(el){ if(!el) return null; const s=this.sig(el); const same=this.all().filter(e=>this.sig(e)===s); return {s, n:same.indexOf(el)}; },
  find(k){ if(!k) return null; return this.all().filter(e=>this.sig(e)===k.s)[k.n]||null; },
  visible(el){ if(!el || el.disabled || !el.offsetParent) return false; const r=el.getBoundingClientRect(); return r.width>0 && r.height>0; },
  tabbables(){ return this.all().filter(e=>this.visible(e) && e.tabIndex>=0 && e.type!=='hidden'); },
  nextTabbable(el){ const t=this.tabbables(); const i=t.indexOf(el); return i>=0?t[i+1]||null:null; },
  scrollers(){ const out=[]; document.querySelectorAll('body *').forEach(e=>{ if(e.scrollTop||e.scrollLeft){ const s=e.tagName+'.'+e.className+'#'+e.id; out.push({s, top:e.scrollTop, left:e.scrollLeft}); } }); return out; },
  where(){ return { x:scrollX, y:scrollY, maxY:document.documentElement.scrollHeight-innerHeight, sc:this.scrollers() }; },
};`;

// reveal: Tab may scroll a little to show the box it lands on, as the browser always does; only a
// jump back to the top (or far left) counts then.
function samePlace(a, b, reveal) {
  const near = (p, q) => Math.abs(p - q) <= 1 || (reveal && q !== 0 && Math.abs(p - q) < 400);
  const yOk = near(a.y, b.y) || (b.y >= b.maxY - 1 && b.maxY < a.y); // shorter page: clamped
  const xOk = near(a.x, b.x);
  const miss = a.sc.filter(s => !b.sc.some(t => t.s === s.s && near(s.top, t.top) && near(s.left, t.left)));
  if (process.env.DEBUG && miss.length) console.log('  before', JSON.stringify(a.sc), 'after', JSON.stringify(b.sc));
  return { ok: yOk && xOk && !miss.length, why: [!yOk ? `page ${a.y}->${b.y}` : '', !xOk ? `page x ${a.x}->${b.x}` : '', miss.length ? 'scroll box reset: ' + miss.map(m => m.s.split('#')[0]).join(',') : ''].filter(Boolean).join('; ') };
}

async function openApp(browser) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto('file://' + APP);
  await page.addScriptTag({ content: PAGE_HELPERS });
  await page.evaluate(s => openSnapshotData(JSON.parse(s), 'snap'), fs.readFileSync(SNAP, 'utf8'));
  await page.waitForTimeout(400);
  return { page, errors };
}

// Screens that are not a tab: set up in the page before the probe (invented values only).
const SETUP = {
  // The week-folder sort screen with 14 small made-up images for the first entity.
  weekdrop: `(async () => {
    _setClassifierForTests(async () => 'TC');
    const list = [];
    for (let i = 0; i < 14; i++) {
      const c = document.createElement('canvas'); c.width = 30; c.height = 30;
      const x = c.getContext('2d'); x.fillStyle = 'rgb(' + (i * 17) + ',80,' + (200 - i * 9) + ')'; x.fillRect(0, 0, 30, 30); x.fillStyle = '#000'; x.fillText(String(i), 8, 18);
      const b = await new Promise(r => c.toBlob(r, 'image/png'));
      list.push({ file: new File([b], 'card' + i + '.png', { type: 'image/png' }), path: 'Week/' + entities[0].name + '/card' + i + '.png' });
    }
    await weekDropAddFiles(list);
  })()`,
  // The settings-file check: a made-up file with every other rate changed and three rows under an entity that is not open.
  stage: `(() => {
    const rows = _gatherPayrollSettingsRows(false).map((r, i) => [i < 3 ? 'Elsewhere Test' : r.entity, r.employee, r.wage === '' || r.wage == null ? '' : String((parseFloat(r.wage) || 0) + (i % 2 ? 0 : 0.25)), r.employeeId]);
    stageSettingsData(rows, { 'entity': 0, 'employee': 1, 'wage/hour': 2, 'employee id': 3 }, false, [], 'made-up file');
  })()`,
  // History with a dozen made-up edits.
  history: `(() => {
    const ids = registerPeople().slice(0, 12).map(p => p.id);
    ids.forEach((id, i) => setPersonField(id, 'acct_note', 'Probe note ' + i));
    openHistory();
  })()`,
  // A bonus being edited for the first person on the open payroll entity.
  bonus: `(() => {
    const ent = entities[activePayrollEntityIdx]; const it = _flatRows.find(x => x.entityIdx === activePayrollEntityIdx);
    const name = it.row.schedName || it.row.name;
    addBonus(ent.id, name, { type: 'specialty', amount: 7.25 }); addBonus(ent.id, name, { type: 'specialty', amount: 3.4 });
    openBonusEditor(ent.id, name);
  })()`,
};

// Every probe: which tab (and how to get to the right screen), which kind of box (a pattern on
// its handler) and what to do. `pick` is how far down the list of such boxes to take one.
const PROBES = [
  // Schedules
  { tab: 'schedule', name: 'shift box, Enter', re: /onTableChange/, act: 'enter', pick: 0.7 },
  { tab: 'schedule', name: 'shift box, Tab', re: /onTableChange/, act: 'tab', pick: 0.7 },
  { tab: 'schedule', name: 'shift box, click the next one', re: /onTableChange/, act: 'click', pick: 0.6 },
  // Actuals Intake (review table)
  { tab: 'intake', name: 'time box, Enter (saves and leaves the box, FC-00054)', re: /handleTimeInput/, act: 'enter', pick: 0.8, leaves: true },
  { tab: 'intake', name: 'time box, Tab', re: /handleTimeInput/, act: 'tab', pick: 0.8 },
  { tab: 'intake', name: 'time box, click the next one', re: /handleTimeInput/, act: 'click', pick: 0.7 },
  { tab: 'intake', name: 'employee choice', re: /updateReviewField\(/, tag: 'SELECT', act: 'select', pick: 0.8, mayGo: 'the row moved to that person' },
  { tab: 'intake', name: 'row tick box', re: /toggleRowSelect/, act: 'check', pick: 0.8 },
  // Payroll (Time Card Data, then Payroll Calculation)
  { tab: 'payroll', name: 'break minutes, Enter', re: /setEntityBreak/, act: 'enter', pick: 0 },
  { tab: 'payroll', name: 'notes box, Enter', re: /setRowNotes/, act: 'enter', pick: 0.7 },
  { tab: 'payroll', name: 'aliases box, Tab', re: /setRowAliases/, act: 'tab', pick: 0.7 },
  { tab: 'payroll', name: 'notes box, Shift+Tab', re: /setRowNotes/, act: 'stab', pick: 0.6 },
  { tab: 'payroll', name: 'wage box, click the next one', re: /setWage/, act: 'click', pick: 0.6 },
  { tab: 'payroll', name: 'wage box, Enter', re: /setWage/, act: 'enter', pick: 0.7 },
  { tab: 'payroll', name: 'per-day break box, Tab', re: /setRowBreakOverride/, act: 'tab', pick: 0.7 },
  { tab: 'payroll', name: 'active tick box', re: /setRowActive/, act: 'check', pick: 0.7 },
  { tab: 'payroll', name: 'no-schedule amount, Enter', re: /setNoSchedAmount/, act: 'enter', pick: 0 },
  { tab: 'payroll', name: 'report column tick box', re: /setReportColumnOn/, act: 'check', pick: 0.5 },
  { tab: 'payroll', name: 'export preview choice', re: /setPreviewKey/, tag: 'SELECT', act: 'select', pick: 0 },
  { tab: 'payroll', name: 'downloads tick box', re: /setDownloadTick/, act: 'check', pick: 0.6 },
  { tab: 'payroll', name: 'entity file label, Enter', re: /setEntityFileLabel/, act: 'enter', pick: 0.5 },
  { tab: 'payroll', name: 'accountant week note, Tab', re: /setAcctWeekNote/, act: 'tab', pick: 0.3, prep: 'details.acct-card-notes' },
  { tab: 'payroll', name: 'pay date by hand', re: /setPayDateByHand/, act: 'date', pick: 0 },
  { tab: 'payroll', name: 'names-on-exports choice', re: /setExportNameMode/, tag: 'SELECT', act: 'select', pick: 0 },
  { tab: 'payroll', sub: 'payroll', name: 'Payroll Calculation: wage, Enter', re: /setWage/, act: 'enter', pick: 0.7 },
  { tab: 'payroll', sub: 'payroll', name: 'Payroll Calculation: split deposit, Tab', re: /setSplitDepositForRow/, act: 'tab', pick: 0 },
  // Employee Register
  { tab: 'register', name: 'search, typing letter by letter', re: /setRegisterFilter\('q'/, act: 'search' },
  { tab: 'register', name: 'search, typing fast', re: /setRegisterFilter\('q'/, act: 'search', fast: true },
  { tab: 'register', name: 'standing note, click on empty space (saves and leaves the box)', re: /setPersonField\('[^']*','acct_note'/, act: 'away', pick: 0.5, leaves: true },
  { tab: 'register', name: 'standing note, Enter', re: /setPersonField\('[^']*','acct_note'/, act: 'enter', pick: 0.7 },
  { tab: 'register', name: 'display name, Tab', re: /setPersonField\('[^']*','display_name'/, act: 'tab', pick: 0.7 },
  { tab: 'register', name: 'full name, click the next one', re: /setPersonField\('[^']*','full_name'/, act: 'click', pick: 0.6 },
  { tab: 'register', name: 'rate, Enter', re: /regSetRate/, act: 'enter', pick: 0.7 },
  { tab: 'register', name: 'pay method choice', re: /regSetMethod/, tag: 'SELECT', act: 'select', pick: 0.7 },
  { tab: 'register', name: 'management tick box', re: /regSetMgmt/, act: 'check', pick: 0.7 },
  { tab: 'register', name: 'flat amount, Tab', re: /regSetFlat/, act: 'tab', pick: 0.5 },
  { tab: 'register', name: 'no-schedule amount, Enter', re: /setNoSchedAmount\('[^']*',this.value\)/, act: 'enter', pick: 0.5 },
  { tab: 'register', name: 'entity filter choice', re: /setRegisterFilter\('entity'/, tag: 'SELECT', act: 'select', pick: 0 },
  { tab: 'register', name: 'entity picker tick (inside its folded list)', re: /regToggleEntity/, act: 'check', pick: 0.6, unchecked: true, openFold: true, mayGo: 'in a file with no TNG IDs yet the person\'s row is rebuilt' },
  // Screens over the tabs
  { tab: 'intake', setup: 'weekdrop', within: '#weekDropBody', name: 'week-folder sort: entity choice', re: /weekDropSetEntity/, tag: 'SELECT', act: 'select', pick: 0.8 },
  { tab: 'intake', setup: 'weekdrop', within: '#weekDropBody', name: 'week-folder sort: kind button', re: /weekDropSetKind/, tag: 'BUTTON', act: 'check', pick: 0.8 },
  { tab: 'payroll', setup: 'stage', within: '#stageBody', name: 'settings-file check: where unknown rows go', re: /stageEntityChoice/, type: 'radio', act: 'check', pick: 0.5 },
  { tab: 'payroll', setup: 'history', within: '#historyBody', name: 'History: Revert one line', re: /revertFromHistory/, act: 'check', pick: 0.5, mayGo: 'the line now says reverted' },
  { tab: 'payroll', sub: 'payroll', setup: 'bonus', within: '#bonusPanel', name: 'bonus amount, Enter', re: /updateBonus\([^)]*amount/, act: 'enter', pick: 0.5 },
  { tab: 'payroll', sub: 'payroll', setup: 'bonus', within: '#bonusPanel', name: 'bonus note, Tab', re: /updateBonus\([^)]*note/, act: 'tab', pick: 0 },
];

async function runProbe(browser, pr) {
  const { page, errors } = await openApp(browser);
  try {
    await page.click('#tab-' + pr.tab);
    await page.waitForTimeout(250);
    if (pr.sub) { await page.evaluate(s => setPayrollSubTab(activePayrollEntityIdx, s), pr.sub); await page.waitForTimeout(250); }
    if (pr.setup) { await page.evaluate(SETUP[pr.setup]); await page.waitForTimeout(500); }
    if (pr.prep) { const sm = await page.$(pr.prep + ' > summary'); if (sm) { await sm.scrollIntoViewIfNeeded(); await sm.click(); await page.waitForTimeout(150); } } // open a folded part
    // Choose the box.
    if (pr.openFold) await page.evaluate(src => { const re = new RegExp(src); document.querySelectorAll('details').forEach(d => { if ([...d.querySelectorAll('input')].some(e => re.test(e.getAttribute('onchange') || ''))) d.open = false; }); }, pr.re.source);
    const k = await page.evaluate(({ src, tag, type, pick, unchecked, openFold, within }) => {
      const re = new RegExp(src);
      const box = within ? document.querySelector(within) : null;
      const match = e => (!within || (box && box.contains(e))) && (!tag || e.tagName === tag) && (!type || e.type === type) && (!unchecked || !e.checked) && re.test((e.getAttribute('oninput') || '') + (e.getAttribute('onchange') || '') + (e.getAttribute('onblur') || '') + (e.getAttribute('onclick') || ''));
      if (openFold) { const all = __pw.all().filter(e => match(e) && e.closest('details')); const e = all[Math.floor(pick * all.length)]; if (e) e.closest('details').open = true; }
      const els = __pw.all().filter(e => __pw.visible(e) && match(e));
      if (!els.length) return null;
      const el = els[Math.min(els.length - 1, Math.floor((pick || 0) * els.length))];
      el.scrollIntoView({ block: 'center' });
      // Nudge the nearest scroll box (a table, a dialog) off zero where there is one, keeping the box in view.
      let sc = el.parentElement; while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (sc && sc !== document.body && !sc.scrollTop) { const r = el.getBoundingClientRect(), b = sc.getBoundingClientRect(); sc.scrollTop = Math.max(0, Math.min(40, r.top - b.top - 10, sc.scrollHeight - sc.clientHeight)); }
      if (scrollY < 120 && document.documentElement.scrollHeight - innerHeight > 150) window.scrollBy(0, 120); // the page is scrolled down
      const next = els[els.indexOf(el) + 1] || null;
      return { k: __pw.key(el), next: next && __pw.visible(next) ? __pw.key(next) : null, count: els.length };
    }, { src: pr.re.source, tag: pr.tag, type: pr.type, pick: pr.pick, unchecked: pr.unchecked, openFold: pr.openFold, within: pr.within });
    if (!k) return { ...pr, result: 'SKIP', why: 'no such box on this snapshot' };
    const before = await page.evaluate(() => __pw.where());
    const handle = await page.evaluateHandle(k => __pw.find(k), k.k);
    let expect = k.k, typed = null;
    if (['enter', 'tab', 'stab', 'click', 'date', 'away'].includes(pr.act)) {
      await handle.asElement().focus();
      if (pr.act === 'date') {
        await page.keyboard.press('ArrowUp'); // change the day by one
      } else {
        const type = await page.evaluate(el => el.type, handle);
        await page.keyboard.press('End');
        await page.keyboard.type(type === 'number' ? '1' : 'x', { delay: 20 });
      }
      if (pr.act === 'enter') await page.keyboard.press('Enter');
      if (pr.act === 'date') await page.keyboard.press('Enter');
      if (pr.act === 'tab' || pr.act === 'stab') {
        const back = pr.act === 'stab';
        const nk = await page.evaluate(({ k, back }) => { const t = __pw.tabbables(); const i = t.indexOf(__pw.find(k)); return __pw.key(t[back ? i - 1 : i + 1]); }, { k: k.k, back });
        expect = nk;
        await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
      }
      if (pr.act === 'away') {
        // A spot with nothing to click: the tab's own help text.
        const spot = await page.evaluate(() => { const el = [...document.querySelectorAll('.instructions')].find(e => e.offsetParent); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + 4, y: Math.max(r.top, 0) + 4, vis: r.bottom > 0 && r.top < innerHeight }; });
        if (!spot || !spot.vis) await page.mouse.click(5, 450); else await page.mouse.click(spot.x, spot.y);
      }
      if (pr.act === 'click') {
        if (!k.next) return { ...pr, result: 'SKIP', why: 'no next box' };
        expect = k.next;
        const nh = await page.evaluateHandle(k => __pw.find(k), k.next);
        const box = await nh.asElement().boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
    } else if (pr.act === 'select') {
      const v = await page.evaluate(el => { const o = [...el.options].find(o => !o.selected && !o.disabled); return o ? o.value : null; }, handle);
      if (v == null) return { ...pr, result: 'SKIP', why: 'no other choice' };
      await handle.asElement().focus();
      await handle.asElement().selectOption(v);
    } else if (pr.act === 'check') {
      const box = await handle.asElement().boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else if (pr.act === 'search') {
      await handle.asElement().click();
      typed = 'ae';
      if (pr.fast) typed = 'aeiou';
      await page.keyboard.type(typed, { delay: pr.fast ? 0 : 60 });
    }
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => __pw.where());
    const ae = await page.evaluate(() => __pw.key(document.activeElement));
    const gone = await page.evaluate(k => !!k && !__pw.find(k), expect);
    const place = samePlace(before, after, pr.act === 'tab' || pr.act === 'stab');
    let focusOk = !!(ae && expect && ae.s === expect.s && ae.n === expect.n);
    let why = place.why;
    if (pr.act === 'search') {
      const v = await page.evaluate(() => document.activeElement && document.activeElement.value);
      focusOk = focusOk && v === typed;
      if (!focusOk) why = (why ? why + '; ' : '') + `typed "${typed}", box has "${v == null ? '(left the box)' : v}"`;
    } else if (pr.leaves) {
      // By design the box is left (FC-00054: Enter in a review box saves and leaves it).
      focusOk = !ae || ae.n < 0;
      if (!focusOk) why = (why ? why + '; ' : '') + 'cursor should have left the box';
    } else if (!focusOk && gone && pr.mayGo) {
      focusOk = true; why = (why ? why + '; ' : '') + '(the box is gone after the change: ' + pr.mayGo + ')';
    } else if (!focusOk) why = (why ? why + '; ' : '') + 'cursor ' + (ae && ae.n >= 0 ? 'in another box' : 'lost') + (process.env.DEBUG ? ' ' + JSON.stringify({ ae, expect }).replace(/'[^']*'/g, "'_'") : '');
    if (errors.length) why = (why ? why + '; ' : '') + 'page errors: ' + errors.length;
    return { ...pr, result: place.ok && focusOk && !errors.length ? 'PASS' : 'FAIL', why, y: before.y };
  } catch (e) {
    return { ...pr, result: 'ERROR', why: e.message.split('\n')[0] };
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch();
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  const res = [];
  for (const pr of PROBES) {
    if (only && !only.test(pr.tab + ' ' + pr.name)) continue;
    const r = await runProbe(browser, pr);
    res.push(r);
    console.log(`${r.result.padEnd(5)} ${r.tab.padEnd(9)} ${r.name}${r.why ? '  — ' + r.why : ''}`);
  }
  const by = {};
  res.forEach(r => { by[r.tab] = by[r.tab] || { PASS: 0, FAIL: 0, SKIP: 0, ERROR: 0 }; by[r.tab][r.result]++; });
  console.log('\nPer tab:'); Object.entries(by).forEach(([t, c]) => console.log(`  ${t.padEnd(9)} pass ${c.PASS}, fail ${c.FAIL}, skip ${c.SKIP}, error ${c.ERROR}`));
  await browser.close();
  process.exit(res.some(r => r.result === 'FAIL' || r.result === 'ERROR') ? 1 : 0);
})();
