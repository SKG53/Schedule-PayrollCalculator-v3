// FC-00091: the screen never jumps and boxes never lose what you are typing.
//
// A redraw (host.innerHTML=…) replaces every element inside host. _keepPlace(host, draw) puts back
// the page scroll, the scroll of each scroll box inside host, folded parts, and the cursor (the
// same box with the same caret; the box Tab or a mouse press was moving to). The repository's
// fake document has no tree, so these tests carry a small DOM of their own: elements with
// parents, attributes, scroll offsets, focus and selection, and a draw that throws the old
// elements away and builds new ones (scroll 0, nothing focused), as a browser does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./load-app');

// ---- a small DOM ----
const FOCUSABLE = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']);
function makeDom() {
  const doc = { activeElement: null, focusCalls: [] };
  class El {
    constructor(tag, attrs, kids) {
      this.nodeType = 1;
      this.tagName = tag.toUpperCase();
      this.attrs = Object.assign({}, attrs || {});
      this.id = this.attrs.id || '';
      this.className = this.attrs.class || '';
      this.type = this.tagName === 'INPUT' ? (this.attrs.type || 'text') : (this.tagName === 'BUTTON' ? 'submit' : (this.tagName === 'SELECT' ? 'select-one' : ''));
      this.value = this.attrs.value || '';
      this.scrollTop = 0; this.scrollLeft = 0;
      this.open = 'open' in this.attrs;
      this.disabled = false;
      this.tabIndex = FOCUSABLE.has(this.tagName) ? 0 : -1;
      this.selectionStart = null; this.selectionEnd = null; this.selectionDirection = 'none';
      this.children = []; this.parentNode = null; this.listeners = {};
      (kids || []).forEach(k => this.append(k));
    }
    append(k) { k.parentNode = this; this.children.push(k); return k; }
    getAttribute(n) { return n in this.attrs ? String(this.attrs[n]) : null; }
    get isConnected() { let e = this; while (e.parentNode) e = e.parentNode; return e === doc.documentElement; }
    get offsetParent() { return this.isConnected ? doc.body : null; }
    getClientRects() { return this.isConnected ? [{}] : []; }
    contains(o) { for (let e = o; e; e = e.parentNode) if (e === this) return true; return false; }
    descendants() { const out = []; const walk = e => e.children.forEach(c => { out.push(c); walk(c); }); walk(this); return out; }
    querySelectorAll(sel) {
      const all = this.descendants();
      if (sel === '*') return all;
      const tags = sel.split(',').map(s => s.trim().replace(/\[.*$/, '').toUpperCase()).filter(Boolean);
      return all.filter(e => tags.includes(e.tagName));
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    closest(sel) { const tags = sel.split(',').map(s => s.trim().replace(/\[.*$/, '').toUpperCase()); for (let e = this; e && e.tagName; e = e.parentNode) if (tags.includes(e.tagName)) return e; return null; }
    compareDocumentPosition(o) { const all = doc.documentElement.descendants(); return all.indexOf(o) > all.indexOf(this) ? 4 : 2; }
    focus(opts) { if (!this.isConnected || this.disabled) return; doc.activeElement = this; doc.focusCalls.push({ el: this, opts }); }
    setSelectionRange(s, e, d) { if (this.type === 'number') throw new Error('not supported'); this.selectionStart = s; this.selectionEnd = e; this.selectionDirection = d || 'none'; }
    select() { this.setSelectionRange(0, String(this.value).length); }
    addEventListener(t, f, o) { (this.listeners[t] = this.listeners[t] || []).push({ f, once: o && o.once }); }
    removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter(x => x.f !== f); }
    dispatchEvent(ev) { const l = (this.listeners[ev.type] || []).slice(); this.listeners[ev.type] = (this.listeners[ev.type] || []).filter(x => !x.once); l.forEach(x => x.f(ev)); return true; }
    // A redraw: the old children leave the page; whatever had the cursor in here loses it.
    replaceKids(kids) {
      const had = doc.activeElement && this.contains(doc.activeElement);
      this.children.forEach(c => { c.parentNode = null; });
      this.children = [];
      kids.forEach(k => this.append(k));
      if (had) doc.activeElement = doc.body;
    }
  }
  doc.documentElement = new El('html');
  doc.body = doc.documentElement.append(new El('body'));
  doc.activeElement = doc.body;
  doc.getElementById = id => doc.documentElement.descendants().find(e => e.id === id) || null;
  doc.querySelectorAll = sel => doc.documentElement.querySelectorAll(sel);
  doc.querySelector = sel => doc.querySelectorAll(sel)[0] || null;
  doc.addEventListener = () => {};
  const h = (tag, attrs, ...kids) => new El(tag, attrs, kids);
  return { doc, h, El };
}

function setup() {
  const api = loadApp();
  const dom = makeDom();
  const win = { scrollX: 0, scrollY: 0, scrollCalls: [], event: undefined, localStorage: api.__sandbox.window.localStorage };
  win.scrollTo = (x, y) => { win.scrollCalls.push([x, y]); win.scrollX = x; win.scrollY = y; };
  api.__sandbox.document = dom.doc;
  api.__sandbox.window = win;
  api.__sandbox.Event = class { constructor(type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); } };
  const host = dom.doc.body.append(dom.h('div', { id: 'host' }));
  return { api, dom, win, host, h: dom.h, doc: dom.doc };
}

// The register-like screen: a search box, a scroll box with rows of boxes, a folded list.
function registerKids(h, people) {
  return [
    h('input', { type: 'search', class: 'reg-search', oninput: "setRegisterFilter('q',this.value)" }),
    h('div', { class: 'reg-scroll' },
      h('table', {}, ...people.map(p => h('tr', {},
        h('input', { type: 'text', value: p + ' note', onchange: `setPersonField('${p}','acct_note',this.value)` }),
        h('input', { type: 'number', value: '12', onchange: `regSetRate('${p}',this.value)` }),
        h('details', { class: 'reg-ents' }, h('summary', {}), h('input', { type: 'checkbox', onchange: `regToggleEntity('${p}',1,this.checked)` })))))),
    h('button', { onclick: 'exportRegisterCsv()' }),
  ];
}
const PEOPLE = ['p1', 'p2', 'p3', 'p4', 'p5'];
const box = (host, re) => host.descendants().find(e => re.test((e.getAttribute('onchange') || '') + (e.getAttribute('oninput') || '')));

test('test_scroll_restore_page_and_inner_scroll_box', () => {
  const { api, win, host, h } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  host.querySelector('div').scrollTop = 300; host.querySelector('div').scrollLeft = 25;
  api._kpNoteScroll(host.querySelector('div')); // the browser's scroll event
  win.scrollY = 500;
  api._keepPlace(host, () => { host.replaceKids(registerKids(h, PEOPLE)); win.scrollY = 0; }); // the redraw resets both
  const sc = host.querySelectorAll('div').find(d => d.className === 'reg-scroll');
  assert.equal(sc.scrollTop, 300, 'the scroll box is where it was');
  assert.equal(sc.scrollLeft, 25);
  assert.deepEqual(win.scrollCalls, [[0, 500]], 'the page is put back where it was');
});

test('test_two_redraws_in_one_click_keep_the_scroll_box', () => {
  const { api, host, h } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const sc = () => host.querySelectorAll('div').find(d => d.className === 'reg-scroll');
  sc().scrollTop = 180; api._kpNoteScroll(sc());
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE)));
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE))); // before any scroll event
  assert.equal(sc().scrollTop, 180);
});

test('test_unmoved_page_is_not_scrolled', () => {
  const { api, win, host, h } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  win.scrollY = 120;
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE)));
  assert.deepEqual(win.scrollCalls, [], 'nothing to put back');
});

test('test_focus_and_caret_restore_after_typing_in_search', () => {
  const { api, host, h, doc, win } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const s = host.querySelector('input'); s.value = 'ab'; s.focus(); s.setSelectionRange(1, 2, 'forward');
  win.event = { type: 'input', target: s }; // the redraw comes from this box's own typing
  api._keepPlace(host, () => { const kids = registerKids(h, PEOPLE.slice(0, 2)); kids[0].value = 'ab'; host.replaceKids(kids); });
  const s2 = host.querySelector('input');
  assert.notEqual(s2, s, 'a new box');
  assert.equal(doc.activeElement, s2, 'the cursor is in the new search box');
  assert.deepEqual([s2.selectionStart, s2.selectionEnd, s2.selectionDirection], [1, 2, 'forward'], 'with the same caret and selection');
  assert.equal(doc.focusCalls.at(-1).opts.preventScroll, true, 'focusing does not scroll');
});

test('test_enter_saves_and_the_cursor_stays_in_the_same_box', () => {
  const { api, host, h, doc, win } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const note = box(host, /'p4','acct_note'/); note.value = 'p4 note x'; note.focus(); note.setSelectionRange(9, 9);
  win.event = { type: 'change', target: note };
  api._keepPlace(host, () => { const k = registerKids(h, PEOPLE); host.replaceKids(k); box(host, /'p4','acct_note'/).value = 'p4 note x'; });
  const n2 = box(host, /'p4','acct_note'/);
  assert.equal(doc.activeElement, n2);
  assert.deepEqual([n2.selectionStart, n2.selectionEnd], [9, 9]);
});

test('test_the_nth_of_identical_boxes_is_found_again', () => {
  const { api, host, h, doc } = setup();
  const cells = () => [0, 1, 2, 3].map(() => h('input', { type: 'text', onchange: 'onTableChange()' }));
  host.replaceKids(cells());
  host.children[2].focus();
  api._keepPlace(host, () => host.replaceKids(cells()));
  assert.equal(doc.activeElement, host.children[2], 'the third box again, not the first');
});

test('test_missing_element_is_safe', () => {
  const { api, host, h, doc, win } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  host.querySelector('div').scrollTop = 200; api._kpNoteScroll(host.querySelector('div'));
  box(host, /'p5','acct_note'/).focus();
  win.scrollY = 40;
  // The redraw drops p5 and the scroll box altogether.
  assert.doesNotThrow(() => api._keepPlace(host, () => host.replaceKids([h('p', {})])));
  assert.equal(doc.activeElement, doc.body, 'nobody gets the cursor');
  assert.equal(doc.focusCalls.length, 1, 'no focus call after the redraw');
  // Not even a host: draw still runs.
  let ran = false;
  assert.doesNotThrow(() => api._keepPlace(null, () => { ran = true; }));
  assert.ok(ran);
  // A pending cursor for a box that never comes back is dropped after the press.
  assert.ok(api.getKpPending() === null || api.getKpPending().host === host);
});

test('test_tab_moves_to_the_next_box_not_back', () => {
  const { api, host, h, doc } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const note = box(host, /'p2','acct_note'/);
  note.focus();
  api._kpHold({ kind: 'tab', back: false, el: note });
  doc.activeElement = doc.body; // the browser lets go of the box while Tab leaves it
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE)));
  assert.equal(doc.activeElement, box(host, /regSetRate\('p2'/), 'the rate box next to it has the cursor');
  assert.equal(doc.activeElement.isConnected, true);
});

test('test_shift_tab_moves_back', () => {
  const { api, host, h, doc } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const rate = box(host, /regSetRate\('p3'/);
  rate.focus();
  api._kpHold({ kind: 'tab', back: true, el: rate });
  doc.activeElement = doc.body;
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE)));
  assert.equal(doc.activeElement, box(host, /'p3','acct_note'/));
});

test('test_click_on_another_box_gives_it_the_cursor', () => {
  const { api, host, h, doc } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const left = box(host, /'p1','acct_note'/), pressed = box(host, /'p4','acct_note'/);
  left.focus();
  api._kpHold({ kind: 'ptr', el: pressed });
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE)));
  const now = box(host, /'p4','acct_note'/);
  assert.equal(doc.activeElement, now, 'the box clicked has the cursor');
  assert.equal(now.selectionStart, now.value.length, 'caret at the end');
});

test('test_click_on_empty_space_leaves_the_box', () => {
  const { api, host, h, doc } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  box(host, /'p1','acct_note'/).focus();
  api._kpHold({ kind: 'ptr', el: host.querySelector('table') });
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE)));
  assert.equal(doc.activeElement, doc.body, 'nothing takes the cursor back');
});

test('test_second_redraw_from_the_same_press_keeps_the_cursor', () => {
  const { api, host, h, doc } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const cb = host.descendants().find(e => /regToggleEntity\('p2'/.test(e.getAttribute('onchange') || ''));
  cb.focus();
  api._kpHold({ kind: 'ptr', el: cb });
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE)));
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE))); // the same handler redraws again
  assert.match(doc.activeElement.getAttribute('onchange'), /regToggleEntity\('p2'/);
  assert.equal(doc.activeElement.isConnected, true);
});

test('test_box_drawn_by_a_later_redraw_still_gets_the_cursor', () => {
  // The tab redraws first with an empty panel; the panel is filled by a second redraw.
  const { api, host, h, doc } = setup();
  const panelKids = () => [h('input', { type: 'text', onchange: "updateBonus(1,'a','b',{note:this.value})" }), h('button', { onclick: "removeBonus(1,'a','b')" })];
  const panel = () => h('div', { id: 'bonusPanel' }, ...panelKids());
  host.replaceKids([panel()]);
  const note = host.querySelector('input');
  note.focus();
  api._kpHold({ kind: 'tab', back: false, el: note });
  doc.activeElement = doc.body;
  api._keepPlace(host, () => host.replaceKids([h('div', { id: 'bonusPanel' })]));
  assert.equal(doc.activeElement, doc.body, 'not there yet');
  const p = doc.getElementById('bonusPanel');
  api._keepPlace(p, () => p.replaceKids(panelKids()));
  assert.equal(doc.activeElement && doc.activeElement.tagName, 'BUTTON', 'the box Tab was going to');
});

test('test_unsaved_typing_is_kept_through_a_redraw_from_elsewhere', () => {
  const { api, host, h, doc, win } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const note = box(host, /'p2','acct_note'/);
  note.value = 'typed, not saved'; note.focus(); note.setSelectionRange(5, 5);
  win.event = undefined; // a timer (OCR progress), not this box
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE)));
  const n2 = box(host, /'p2','acct_note'/);
  assert.equal(doc.activeElement, n2);
  assert.equal(n2.value, 'typed, not saved', 'what was typed is still there');
  assert.equal(n2.selectionStart, 5);
  // Leaving the box saves it, as leaving it always did.
  const fired = [];
  n2.addEventListener('change', () => fired.push(n2.value));
  n2.dispatchEvent({ type: 'blur' });
  assert.deepEqual(fired, ['typed, not saved']);
});

test('test_a_redraw_from_the_box_itself_shows_what_was_saved', () => {
  const { api, host, h, doc, win } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const rate = box(host, /regSetRate\('p1'/);
  rate.value = '12.5'; rate.focus();
  win.event = { type: 'change', target: rate };
  api._keepPlace(host, () => { host.replaceKids(registerKids(h, PEOPLE)); box(host, /regSetRate\('p1'/).value = '12.50'; });
  assert.equal(doc.activeElement.value, '12.50', 'the saved (shown) value, not the typed one');
});

test('test_folded_part_stays_open', () => {
  const { api, host, h, doc } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const det = host.querySelectorAll('details')[3];
  det.open = true;
  det.children[1].focus();
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE)));
  const all = host.querySelectorAll('details');
  assert.deepEqual(all.map(d => d.open), [false, false, false, true, false], 'the one left open is open');
  assert.equal(doc.activeElement, all[3].children[1], 'and its tick box has the cursor');
});

test('test_folded_part_follows_its_person_when_rows_are_filtered', () => {
  const { api, host, h } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  host.querySelectorAll('details')[3].open = true; // p4's entity list
  api._keepPlace(host, () => host.replaceKids(registerKids(h, ['p2', 'p4']))); // the search leaves two people
  assert.deepEqual(host.querySelectorAll('details').map(d => d.open), [false, true], "p4's list is still open; p2's is not opened in its place");
});

test('test_cursor_outside_the_host_is_left_alone', () => {
  const { api, host, h, doc } = setup();
  host.replaceKids(registerKids(h, PEOPLE));
  const outside = doc.body.append(h('input', { id: 'entityNameInput' }));
  outside.focus();
  api._keepPlace(host, () => host.replaceKids(registerKids(h, PEOPLE)));
  assert.equal(doc.activeElement, outside);
  assert.equal(doc.focusCalls.length, 1, 'no extra focus call');
});

test('test_inner_redraw_inside_an_outer_one_is_left_to_the_outer', () => {
  const { api, host, h, win } = setup();
  host.replaceKids([h('div', { id: 'inner' }, h('div', { class: 'reg-scroll' }))]);
  const inner = host.children[0];
  win.scrollY = 300;
  let innerSaves = 0;
  api._keepPlace(host, () => {
    win.scrollY = 0;
    assert.equal(api._kpWrap(inner, () => { innerSaves++; }), false, 'covered: the caller just draws');
    api._keepPlace(inner, () => {});
    assert.deepEqual(win.scrollCalls, [], 'the inner one puts nothing back');
  });
  assert.equal(innerSaves, 0);
  assert.deepEqual(win.scrollCalls, [[0, 300]], 'the outer one does, once');
});

test('test_kp_wrap_redraws_once_through_keep_place', () => {
  const { api, host } = setup();
  let draws = 0;
  function render() { if (api._kpWrap(host, render)) return; draws++; }
  render();
  assert.equal(draws, 1);
});

test('test_press_lasts_only_while_it_is_handled', async () => {
  const { api } = setup();
  api._kpHold({ kind: 'tab', back: false, el: null });
  assert.equal(api.getKpMove().kind, 'tab');
  await new Promise(r => setTimeout(r, 5));
  assert.equal(api.getKpMove(), null);
});

// Every screen that redraws in answer to the owner goes through the helper (FC-00091 audit).
test('test_every_redrawing_screen_keeps_its_place', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const body = name => { const i = html.indexOf('function ' + name + '('); assert.ok(i >= 0, name); return html.slice(i, html.indexOf('\n}', i)); };
  ['renderRegister', 'renderPayroll', 'renderPayrollEntityContent', 'renderBonusPanel', 'renderFc00013PreviewPanel', 'renderIntake', 'renderOcrFileList',
    'renderTable', 'renderScheduleContent', '_rerenderAll', 'refreshReviewTable'].forEach(n => assert.match(body(n), /_kpWrap\(/, n));
  ['renderDownloadsPanel', 'renderWowPanel', 'renderHistoryPanel', '_renderStageOverlay', '_renderNewEmp', '_renderPayGate', '_renderWeekDrop'].forEach(n => assert.match(body(n), /_keepPlace\(/, n));
});

test('test_saving_a_box_no_longer_pulls_the_cursor_back_to_it', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  // Before: setWage, setFlatAmount, setSplitDepositForRow and setRowBreakOverride re-focused the box
  // just left on a timer, which took the cursor back from the box Tab or a click had moved to.
  ['.wage-input', '.flat-input', '.split-input', 'input.break-day-input[data-row'].forEach(sel => assert.ok(!html.includes("querySelectorAll('" + sel + "')") && !html.includes('querySelector(`' + sel), sel));
});
