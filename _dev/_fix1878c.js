const fs = require('fs');
const p = 'data.js';

const opt1 = { l: '拉同门同去', hint: '修为＋20 脉＋1', ok: { txt: 'x', eff: { cult: 20, a: { 脉: 1 } } } };
try { JSON.stringify([opt1]); } catch (e) { console.log('opt1 JSON FAIL', e.message); process.exit(1); }
console.log('opt1 structure OK');

// Build correct line: eff:{cult:20,a:{脉:1}} -> a,eff,ok,opt1 closes, then opts, event closes
const correct =
  "  opts:[ {l:'拉同门同去', hint:'修为＋20 脉＋1', ok:{txt:'你约了同门同去，彼此有个照应，也分了些机缘。', ef" +
  "f:{cult:20,a:{脉:1}" + "}" + "}" + "}" + "}" + "]" + "}" + ",";
console.log('correct tail:', correct.slice(-28));

// Verify the FULL opts array parses (count both () [] {})
const start = correct.indexOf('opts:[ ') + 'opts:[ '.length;
let depth = 0, endBracket = -1;
for (let k = start; k < correct.length; k++) {
  const c = correct[k];
  if (c === '[' || c === '{' || c === '(') depth++;
  else if (c === ']' || c === '}' || c === ')') { depth--; if (depth === 0) { endBracket = k; break; } }
}
const inner = correct.substring(start, endBracket + 1);
try { new Function('return ' + inner + ';'); console.log('FULL opts PARSE OK'); }
catch (e) { console.log('FULL opts PARSE FAIL:', e.message); process.exit(1); }

let lines = fs.readFileSync(p, 'utf8').split('\n');
lines[1877] = correct;
fs.writeFileSync(p, lines.join('\n'));
console.log('line 1878 written');
