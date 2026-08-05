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
vm.runInContext(src('data.js') + '\n' + src('engine.js') + '\n;globalThis.__API={get GENERAL(){return GENERAL;},get DAILY(){return DAILY;},get ENDINGS(){return ENDINGS;},get IDENTITIES(){return typeof IDENTITIES!=="undefined"?IDENTITIES:undefined;},get CAREER(){return typeof CAREER!=="undefined"?CAREER:undefined;},get ACTIONS(){return ACTIONS;}};', sandbox, { filename: 'bundle.js' });
const G = sandbox.__API;
console.log('GENERAL.length =', G.GENERAL.length);
console.log('DAILY.length   =', G.DAILY.length);
console.log('ACTIONS.length =', G.ACTIONS.length);
const grp = k => (/^b\d/.test(k) ? 'mid' : 'final');
const finalKeys = Object.keys(G.ENDINGS).filter(k => grp(k) === 'final');
const midKeys = Object.keys(G.ENDINGS).filter(k => grp(k) === 'mid');
console.log('ENDINGS final =', finalKeys.length, ' mid =', midKeys.length, ' total =', Object.keys(G.ENDINGS).length);
console.log('has mingchen ENDING?', !!G.ENDINGS.mingchen);
console.log('has fujia?', !!G.ENDINGS.fujia, ' mingjiang?', !!G.ENDINGS.mingjiang, ' guoshou?', !!G.ENDINGS.guoshou);
console.log('typeof IDENTITIES =', typeof G.IDENTITIES);
console.log('typeof CAREER =', typeof G.CAREER);
if (G.IDENTITIES) console.log('IDENTITIES keys =', Object.keys(G.IDENTITIES));
if (G.CAREER) console.log('CAREER keys =', Object.keys(G.CAREER), 'diwang len =', (G.CAREER.diwang||[]).length);
