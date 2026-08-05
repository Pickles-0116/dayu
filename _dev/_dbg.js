const fs = require('fs');
const src = fs.readFileSync('data.js', 'utf8');
const i0 = src.indexOf('const CAREER = {');
const xi = src.indexOf('const XIAN_TIERS');
const end = src.lastIndexOf('];', xi);
const block = src.substring(i0, end + 2);
let inner = block.substring('const CAREER = {'.length);
inner = inner.substring(0, inner.lastIndexOf('];'));
const keyIdx = inner.indexOf('diwang:[');
console.log('i0', i0, 'end', end, 'keyIdx', keyIdx);
console.log('inner head 120:', JSON.stringify(inner.substring(0, 120)));
console.log("has diwang:[ ?", inner.indexOf('diwang:['), " has {id:E101 ?", inner.indexOf("{id:'E101'"));
const region = inner.substring(keyIdx);
const a = region.indexOf("{id:'E101'");
const b = region.indexOf("{id:'E102'");
const one = region.substring(a, b);
const optsIdx = one.indexOf('opts:[');
const optsText = one.substring(optsIdx + 6);
console.log('a', a, 'b', b, 'one.length', one.length);
console.log('ONE first 300:', JSON.stringify(one.substring(0, 300)));
console.log('optsIdx', optsIdx);

function matchBrace(s, openIdx) {
  const open = s[openIdx];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (c === "'") { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}
const okIdx = optsText.indexOf('ok:{');
console.log('okIdx', okIdx, 'matchBrace', matchBrace(optsText, okIdx));
// also test on just the first ok object text
const sample = "ok:{txt:'你力主出兵，旗开得胜，边将献上首级。军功与威望，一并涨了。', eff:{merit:1,a:{望:1}}}";
console.log('sample matchBrace', matchBrace(sample, 0));
// check for stray apostrophes in optsText
let apos = 0;
for (const ch of optsText) if (ch === "'") apos++;
console.log('apostrophe count in optsText(500):', apos);
