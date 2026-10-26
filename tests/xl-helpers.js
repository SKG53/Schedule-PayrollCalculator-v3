// FC-00033: export cells may hold a formula ({formula, result}). These helpers read a cell
// the way Excel shows it on open: the cached result for a formula, the value otherwise.
function xlNum(cell) {
  if (!cell) return undefined;
  const v = cell.value;
  return v && typeof v === 'object' && 'formula' in v ? v.result : v;
}
// A zero in a column whose number format hides zeros (third section "") displays as blank.
function xlHidesZero(cell) {
  return !!(cell && typeof cell.numFmt === 'string' && /;""$/.test(cell.numFmt));
}

// FC-00060: a small Excel-compatible evaluator for the formulas the exports write, across the
// sheets of one workbook (the payroll report's Hours point at the Hours sheet). `wb` is the mock
// workbook ({worksheets:[{name,rows}]}), `ws` the sheet the formula sits on. Text cells count as
// "" (so IF(x<>"",…) and MAX/MIN skip them like Excel); empty cells count as 0 in arithmetic.
const colNum = (L) => L.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
function xround(x, d) { const f = Math.pow(10, d); const y = Math.abs(x) * f; return Math.sign(x) * Math.round(+y.toFixed(9)) / f; }
const EMPTY = { empty: true };
function xlEval(wb, ws, formula, depth) {
  depth = depth || 0;
  if (depth > 50) throw new Error('formula depth');
  const sheetOf = (name) => (name ? (wb.worksheets || []).find(w => w.name === name) : ws);
  const cellVal = (sh, L, r) => {
    const s = sheetOf(sh); const c = s && s.rows[r] && s.rows[r][colNum(L)];
    if (!c || c.value === undefined || c.value === null || c.value === '') return EMPTY;
    const v = c.value;
    if (v && typeof v === 'object' && 'formula' in v) return xlEval(wb, s, v.formula, depth + 1);
    return v;
  };
  const range = (sh, L1, r1, L2, r2) => { const out = []; for (let r = r1; r <= r2; r++) for (let c = colNum(L1); c <= colNum(L2); c++) out.push(cellVal(sh, colLetter(c), r)); return out; };
  const num = (x) => (x === EMPTY ? 0 : (typeof x === 'number' ? x : (typeof x === 'boolean' ? +x : 0)));
  const nums = (a) => a.flat().filter(x => typeof x === 'number');
  const fns = {
    ROUND: (x, d) => xround(num(x), d), ROUNDDOWN: (x, d) => Math.trunc(num(x) * Math.pow(10, d)) / Math.pow(10, d),
    MIN: (...a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; }, MAX: (...a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    IF: (c, a, b) => (c && c !== EMPTY ? a : (b === undefined ? false : b)),
    SUM: (...a) => nums(a).reduce((s, x) => s + x, 0),
    MOD: (x, y) => { x = num(x); return x - y * Math.floor(x / y); },
    AND: (...a) => a.every(Boolean), OR: (...a) => a.some(Boolean),
    ISNUMBER: (x) => typeof x === 'number',
    COUNTIF: (a, crit) => { const m = /^([<>=]+)(.*)$/.exec(crit); const op = m ? m[1] : '='; const v = m ? +m[2] : crit; return a.filter(x => typeof x === 'number' && (op === '>' ? x > v : op === '<' ? x < v : op === '>=' ? x >= v : x === v)).length; },
  };
  const blank = (x) => (x === EMPTY ? '' : x);
  const js = formula
    .replace(/\$/g, '')
    .replace(/(?:'([^']+)'!)?([A-Z]+)(\d+):([A-Z]+)(\d+)/g, (_, sh, a, b, c, d) => `range(${sh ? JSON.stringify(sh) : 'null'},'${a}',${b},'${c}',${d})`)
    .replace(/(?:'([^']+)'!)?\b([A-Z]{1,2})(\d+)\b/g, (_, sh, a, b) => `blank(cellVal(${sh ? JSON.stringify(sh) : 'null'},'${a}',${b}))`)
    .replace(/<>/g, '!==').replace(/([^<>!=])=([^=])/g, '$1===$2')
    .replace(/\b(ROUNDDOWN|ROUND|MIN|MAX|IF|SUM|MOD|AND|OR|ISNUMBER|COUNTIF)\(/g, 'fns.$1(');
  const out = Function('fns', 'cellVal', 'range', 'blank', `return (${js});`)(fns, cellVal, range, blank);
  return out === EMPTY ? 0 : out;
}
// Every formula in `ws` evaluates to its cached result (money to the cent; durations exactly).
function xlFormulaMismatches(wb, ws) {
  const bad = []; let n = 0;
  ws.rows.forEach((row, r) => (row || []).forEach((c, ci) => {
    if (!(c && c.value && typeof c.value === 'object' && 'formula' in c.value)) return;
    n++;
    const got = xlEval(wb, ws, c.value.formula);
    const want = c.value.result;
    const g = typeof got === 'number' ? got : (got === '' ? '' : got), w = (want === undefined || want === null) ? '' : want;
    const ok = (typeof g === 'number' && typeof w === 'number') ? (Math.abs(g - w) < 1e-6 || Math.round(g * 100) / 100 === w) : g === w;
    if (!ok) bad.push(`${ws.name} R${r}C${ci} ${c.value.formula}: evaluates ${g}, cached ${w}`);
  }));
  return { n, bad };
}
module.exports = { xlNum, xlHidesZero, xlEval, xlFormulaMismatches, colNum };
