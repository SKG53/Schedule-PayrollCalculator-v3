// Shared fixture for FC-00070 to FC-00075. Invented names and figures only.
const { webcrypto } = require('node:crypto');
const { loadApp, resetToSingleEntity } = require('./load-app');

const WEEK = ['Aug 9 2026', 'Aug 10 2026', 'Aug 11 2026', 'Aug 12 2026', 'Aug 13 2026', 'Aug 14 2026', 'Aug 15 2026'];
const ISO = ['2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15'];
const SHIFT = ['', '8AM - 6PM', '8AM - 6PM', '8AM - 6PM', '8AM - 6PM', '8AM - 6PM', ''];
// One punch pair per day, `hours` long, starting 8:00 (no break: the entities have 0 minutes).
const days = (empName, entityName, hoursPerDay) => hoursPerDay.map((h, i) => h ? ({ empName, entityName, date: ISO[i], dayIdx: i, pairs: [{ in: 8, out: 8 + h, outAdj: 8 + h, minutes: Math.round(h * 60) }] }) : null).filter(Boolean);

// Alpha Test: Avery (Deposit, 42.5 h at $12), Bram (Cash, 42.5 h at $12), Cora (Deposit + Cash,
// 42.5 h at $12, $300 deposit typed), Dane (Contract Check, 10 h at $15), Eden (Deposit, 38 h at $14).
// Beta Test: Fern (Deposit, 20 h at $16).
function setup(opts) {
  opts = opts || {};
  const api = loadApp({ savedNames: true });
  api.__sandbox.alert = () => {}; api.__sandbox.confirm = () => true; api.__sandbox.crypto = webcrypto;
  const names = ['Avery Atest', 'Bram Btest', 'Cora Ctest', 'Dane Dtest', 'Eden Etest'];
  const ent = resetToSingleEntity(api, {
    id: 0, name: 'Alpha Test', employees: names.map(name => ({ name, shifts: SHIFT })),
    dateLabels: WEEK, breakMinutes: 0, breakMinutesSet: true,
    actualDays: [].concat(
      days('Avery Atest', 'Alpha Test', [0, 9, 9, 8.5, 8, 8, 0]),
      days('Bram Btest', 'Alpha Test', [0, 9, 9, 8.5, 8, 8, 0]),
      days('Cora Ctest', 'Alpha Test', [0, 9, 9, 8.5, 8, 8, 0]),
      days('Dane Dtest', 'Alpha Test', [0, 5, 5, 0, 0, 0, 0]),
      days('Eden Etest', 'Alpha Test', [0, 8, 8, 8, 7, 7, 0])),
  });
  api._syncEntityCode(ent);
  api.entities.push({
    id: 1, name: 'Beta Test', employees: [{ name: 'Fern Ftest', shifts: SHIFT }], dateLabels: WEEK,
    newDateLabels: ['', '', '', '', '', '', ''], newWeekStartVal: '', breakMinutes: 0, breakMinutesSet: true,
    actualDays: days('Fern Ftest', 'Beta Test', [0, 5, 5, 5, 5, 0, 0]), intake: null,
  });
  api._syncEntityCode(api.entities[1]);
  const set = (e, n, rate, method) => { api.wageRates[api.wKey(e, n)] = rate; api.payMethod[api.wKey(e, n)] = method; };
  set(0, 'Avery Atest', 12, 'deposit');
  set(0, 'Bram Btest', 12, 'cash');
  set(0, 'Cora Ctest', 12, 'both'); api.splitAmounts[api.wKey(0, 'Cora Ctest')] = { deposit: 300, typed: true, isWhole: true };
  set(0, 'Dane Dtest', 15, 'contract');
  set(0, 'Eden Etest', 14, 'deposit');
  set(1, 'Fern Ftest', 16, 'deposit');
  if (opts.exec) {
    // Gale: Executive PR in Alpha Test, $900 a week (Flat, not on the schedule).
    api.ensureIntakeState(api.entities[0]);
    api.addNewEmployee(0, 'Gale Gtest', null, { method: 'exec', flat: 900 });
  }
  return api;
}
const rowOf = (api, name) => api._collectExportData().flatMap(d => d.rows).find(r => r._empName === name);

module.exports = { setup, rowOf, WEEK, ISO, SHIFT, days };
