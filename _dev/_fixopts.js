// _fixopts.js
// Diagnostic + repair for premature ']' in `opts:[ ... ]` option lines.
// A line is corrupt when the ']' that closes the opts array appears while
// object braces ('ok' / option object) are still open. We move that ']'
// to just before the trailing comma.
//
// Usage:
//   node _fixopts.js        -> report only (no changes)
//   node _fixopts.js fix    -> apply repair in place

const fs = require('fs');
const path = 'c:\\Users\\Hoolinks\\WorkBuddy\\2026-08-04-17-23-59\\project\\data.js';
const APPLY = process.argv[2] === 'fix';

const src = fs.readFileSync(path, 'utf8');
const lines = src.split('\n');
const out = [];
const report = [];

for (let li = 0; li < lines.length; li++) {
  let line = lines[li];
  const oi = line.indexOf('opts:[');
  if (oi === -1) { out.push(line); continue; }

  let depthP = 0, depthB = 0, depthC = 0;
  let prematureIdx = -1;
  for (let i = oi; i < line.length; i++) {
    const ch = line[i];
    if (ch === '(') depthP++;
    else if (ch === ')') depthP--;
    else if (ch === '[') depthB++;
    else if (ch === ']') {
      depthB--;
      if (depthB === 0 && depthC > 0 && prematureIdx === -1) {
        prematureIdx = i; // opts closed but objects still open
      }
    } else if (ch === '{') depthC++;
    else if (ch === '}') depthC--;
  }

  if (prematureIdx === -1) { out.push(line); continue; }

  report.push({ line: li + 1, text: line.trim() });
  if (!APPLY) { out.push(line); continue; }

  // Remove the premature ']' and reinsert it right before the trailing comma.
  let newLine = line.slice(0, prematureIdx) + line.slice(prematureIdx + 1);
  const ci = newLine.lastIndexOf(',');
  if (ci !== -1) {
    newLine = newLine.slice(0, ci) + ']' + newLine.slice(ci);
  } else {
    newLine = newLine + ']';
  }
  out.push(newLine);
}

if (APPLY) {
  fs.writeFileSync(path, out.join('\n'), 'utf8');
}

const summary = (APPLY ? 'APPLIED' : 'DRYRUN') + ' fixes=' + report.length;
fs.writeFileSync(
  'c:\\Users\\Hoolinks\\WorkBuddy\\2026-08-04-17-23-59\\project\\_dev\\_fixopts_log.txt',
  summary + '\n' +
  report.map((r) => 'L' + r.line + ': ' + r.text).join('\n') + '\n'
);
console.log(summary);
console.log(report.map((r) => 'L' + r.line).join(' '));
