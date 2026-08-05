/* Re-serialize the CAREER block: extract text content per event/option,
   then re-emit with correct braces/brackets. Preserves all narrative text
   and effect values; only fixes structural delimiters. */
const fs = require('fs');
const src = fs.readFileSync('data.js', 'utf8');
const i0 = src.indexOf('const CAREER = {');
const xi = src.indexOf('const XIAN_TIERS');
const end = src.lastIndexOf('];', xi);
const block = src.substring(i0, end + 2);

let inner = block.substring('const CAREER = {'.length);
inner = inner.substring(0, inner.lastIndexOf('];'));

const KEYS = ['diwang', 'juaj', 'mingchen', 'mingjiang', 'guoshou', 'zhenren', 'jiaozong'];

function matchBrace(s, openIdx) {
  const open = s[openIdx];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (c === "'") { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function parseOption(text, from) {
  const s = text.indexOf("{l:'", from);
  if (s === -1) return null;
  const lq1 = s + 4;
  const lq2 = text.indexOf("'", lq1);
  const l = text.substring(lq1, lq2);
  const hk = text.indexOf("hint:'", lq2);
  const hq1 = hk + 6;
  const hq2 = text.indexOf("'", hq1);
  const hint = text.substring(hq1, hq2);
  const okIdx = text.indexOf('ok:{', hq2);
  const okEnd = matchBrace(text, okIdx);
  if (okEnd === -1) { console.log('FAIL ok matchBrace near', l); return null; }
  const ok = text.substring(okIdx, okEnd + 1);
  let danger = false;
  const di = text.indexOf('danger:true', hq2);
  if (di !== -1 && di < okIdx) danger = true;
  let p = null;
  const pi = text.indexOf('p:', hq2);
  if (pi !== -1 && pi < okIdx) {
    const pm = text.substring(pi + 2).match(/^[0-9.]+/);
    if (pm) p = parseFloat(pm[0]);
  }
  let ko = null;
  const koIdx = text.indexOf('ko:{', okEnd);
  if (koIdx !== -1 && koIdx < okEnd + 40) {
    const koEnd = matchBrace(text, koIdx);
    if (koEnd !== -1) ko = text.substring(koIdx, koEnd + 1);
  }
  return { l, hint, danger, p, ok, ko };
}

function emitOpt(o) {
  let s = `{l:'${o.l}', hint:'${o.hint}'`;
  if (o.danger) s += ', danger:true';
  if (o.p !== null) s += `, p:${o.p}`;
  s += `, ${o.ok}`;
  if (o.ko) s += `, ${o.ko}`;
  s += '}';
  return s;
}

const arrays = {};
for (let k = 0; k < KEYS.length; k++) {
  const key = KEYS[k];
  const keyIdx = inner.indexOf(key + ':[');
  const nextKeyIdx = (k < KEYS.length - 1)
    ? inner.indexOf(KEYS[k + 1] + ':[', keyIdx + key.length)
    : inner.length;
  const region = inner.substring(keyIdx, nextKeyIdx);
  const arrStart = region.indexOf('[', key.length) + 1;
  let evText = region.substring(arrStart);
  const events = [];
  let evIdx = evText.indexOf("{id:'E");
  while (evIdx !== -1) {
    const nextEv = evText.indexOf("{id:'E", evIdx + 5);
    const one = nextEv === -1 ? evText.substring(evIdx) : evText.substring(evIdx, nextEv);
    // extract id/t/d
    const idM = one.match(/id:'[^']*'/);
    const tM = one.match(/t:'[^']*'/);
    const dM = one.match(/d:'[^']*'/);
    const id = idM[0].substring(4, idM[0].length - 1);
    const t = tM[0].substring(3, tM[0].length - 1);
    const d = dM ? dM[0].substring(3, dM[0].length - 1) : '';
    const optsIdx = one.indexOf('opts:[');
    const optsText = one.substring(optsIdx + 6);
    // collect option start positions
    const positions = [];
    let p = optsText.indexOf("{l:'");
    while (p !== -1) { positions.push(p); p = optsText.indexOf("{l:'", p + 1); }
    const opts = [];
    for (const pos of positions) {
      const o = parseOption(optsText, pos);
      if (o) opts.push(o);
    }
    events.push({ id, t, d, opts });
    evIdx = nextEv;
  }
  arrays[key] = events;
  console.log(key, 'events:', events.length, 'opts/ev:', events.map(e => e.opts.length).join(','));
}

function emitEvent(ev) {
  return `{id:'${ev.id}', t:'${ev.t}', type:'生涯', when:(s)=>true, w:1.0, cd:5,\n` +
    `  d:'${ev.d}',\n` +
    `  opts:[ ${ev.opts.map(emitOpt).join(', ')} ]}`;
}

const body = KEYS.map(k =>
  '  ' + k + ':[\n' + arrays[k].map(e => '    ' + emitEvent(e)).join(',\n') + '\n  ]'
).join(',\n\n');
const out = 'const CAREER = {\n' + body + '\n};';

// splice back
const newSrc = src.substring(0, i0) + out + src.substring(end + 2);
fs.writeFileSync('data.js', newSrc);
console.log('CAREER re-serialized. new block length', out.length);
