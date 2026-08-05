'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const store = {};
const sandbox = {
  console, Math, JSON, Object, Array, String, Number, Boolean, Date, setTimeout,
  isNaN, parseInt, parseFloat, URLSearchParams,
  location: { search: '' },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
function src(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); }
const EXPORTS = ['ATTRS', 'ATTR_CAP', 'ATTR_FULL', 'RANKS', 'TIER_WEIGHT', 'ORIGINS', 'ROUTES',
  'FATE_CARDS', 'CHAINS', 'GENERAL', 'DAILY', 'ENDINGS', 'ACTIONS', 'XIAN_TIERS', 'XIAN_CAP',
  'XIAN_NEED', 'XIAN_LIFE', 'XIAN_ENTRY', 'HOUSE_TIERS', 'META', 'S', 'DRAW', 'INHERIT', 'LUCKY',
  'ENDING_RANKS', 'ENDING_GROUPS'];
const FNS = ['clamp', 'ri', 'chance', 'pick', 'mix', 'newLife', 'runChildhood', 'runBeggarGauntlet',
  'applyEff', 'addChild', 'doBreakthrough', 'drawFate', 'routeState', 'routeGap', 'activateRoute',
  'routeReqAt', 'yearEconomy', 'doSettle', 'pickEvents', 'doUpdate', 'judgeNaturalDeath',
  'computeInherit', 'commitLegacy', 'drawOrigins', 'fateGroupWeights', 'saveMeta', 'loadMeta', 'resetMeta', 'xianNeed', 'activeRouteId',
  'endingGroupOf', 'lifeScore', 'endingRank', 'recordEnding', 'dexStat', 'metaDefaults',
  'moneyFloor', 'clampMoney'];
const trailer = '\n;globalThis.__API = {' +
  EXPORTS.concat(FNS).map(n => 'get ' + n + '(){ return typeof ' + n + '!=="undefined" ? ' + n + ' : undefined; }').join(',') +
  '};\n';
vm.runInContext(src('data.js') + '\n' + src('engine.js') + trailer, sandbox, { filename: 'bundle.js' });
const G = sandbox.__API;

const out = [];
out.push('GENERAL.length=' + G.GENERAL.length);
out.push('DAILY.length=' + G.DAILY.length);
out.push('--- GENERAL entries ---');
G.GENERAL.forEach((e, i) => out.push(i + '  id=' + (e.id || '?') + '  t=' + (e.t || '?') + '  type=' + (e.type || '?') + '  opts=' + (e.opts ? e.opts.length : 'NONE')));
out.push('--- DAILY entries ---');
G.DAILY.forEach((e, i) => out.push(i + '  id=' + (e.id || '?') + '  t=' + (e.t || '?') + '  type=' + (e.type || '?') + '  opts=' + (e.opts ? e.opts.length : 'NONE')));
fs.writeFileSync('c:\\Users\\Hoolinks\\WorkBuddy\\2026-08-04-17-23-59\\project\\_dev\\_diag_log.txt', out.join('\n') + '\n');
console.log('done');
