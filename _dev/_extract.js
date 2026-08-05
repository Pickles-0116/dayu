const fs = require('fs');
const code = fs.readFileSync('data.js', 'utf8');
const start = code.indexOf('zhenren:[');
let i = code.indexOf('[', start);
let depth = 0, instr = false, inStr = null;
let end = -1;
for (; i < code.length; i++) {
  const c = code[i];
  if (instr) {
    if (c === '\\') { i++; continue; }
    if (c === inStr) { instr = false; inStr = null; }
    continue;
  }
  if (c === "'" || c === '"' || c === '`') { instr = true; inStr = c; continue; }
  if (c === '[' || c === '{' || c === '(') depth++;
  else if (c === ']' || c === '}' || c === ')') { depth--; if (depth === 0) { end = i; break; } }
}
const arrLiteral = code.substring(code.indexOf('[', start), end + 1);
const content = arrLiteral.substring(1, arrLiteral.length - 1);

// Extract each balanced event object
let pos = 0;
let evIdx = 0;
while (pos < content.length) {
  // skip whitespace and commas
  while (pos < content.length && /[\s,]/.test(content[pos])) pos++;
  if (pos >= content.length) break;
  const objStart = content.indexOf('{', pos);
  if (objStart < 0) break;
  // balance from objStart
  let d = 0, st = false, ss = null, j = objStart;
  for (; j < content.length; j++) {
    const c = content[j];
    if (st) { if (c === '\\') { j++; continue; } if (c === ss) { st = false; ss = null; } continue; }
    if (c === "'" || c === '"' || c === '`') { st = true; ss = c; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) break; }
  }
  const objStr = content.substring(objStart, j + 1);
  const idMatch = objStr.match(/id:'[^']*'/);
  try {
    new Function('return (' + objStr + ');');
    console.log('OK   ' + (idMatch ? idMatch[0] : '?'));
  } catch (e) {
    console.log('FAIL ' + (idMatch ? idMatch[0] : '?') + ' :: ' + e.message);
    console.log('   >> ' + objStr.slice(0, 200));
  }
  pos = j + 1;
  evIdx++;
}
