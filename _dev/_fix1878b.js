const fs = require('fs');
const p = 'data.js';
let s = fs.readFileSync(p, 'utf8');
const bad = "eff:{cult:20,a:{脉:1}}}]} ";
const good = "eff:{cult:20,a:{脉:1}" + "}" + "}" + "}" + "}" + "]" + "} ";
if (s.indexOf(bad) < 0) {
  console.log('bad pattern NOT FOUND. snippet near E604:');
  const i = s.indexOf("eff:{cult:20,a:{脉:1}");
  console.log(JSON.stringify(s.substring(i, i + 30)));
  process.exit(1);
}
s = s.replace(bad, good);
fs.writeFileSync(p, s);
console.log('E604 fixed');
