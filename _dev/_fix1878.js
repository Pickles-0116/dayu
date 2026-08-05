const fs = require('fs');
const p = 'data.js';
let lines = fs.readFileSync(p, 'utf8').split('\n');
const i = 1877;
const correct = "  opts:[ {l:'拉同门同去', hint:'修为＋20 脉＋1', ok:{txt:'你约了同门同去，彼此有个照应，也分了些机缘。', eff:{cult:20,a:{脉:1}}}} ] },";
const start = correct.indexOf('opts:[ ') + 'opts:[ '.length;
const end = correct.lastIndexOf('}');
const inner = correct.substring(start, end);
console.log('INNER=[' + inner + ']');
const test = 'return [' + inner + '];';
console.log('TEST=[' + test + ']');
try {
  new Function(test);
  console.log('PARSES OK');
} catch (e) {
  console.log('PARSE FAIL:', e.message);
  process.exit(1);
}
lines[i] = correct;
fs.writeFileSync(p, lines.join('\n'));
console.log('line 1878 replaced');
