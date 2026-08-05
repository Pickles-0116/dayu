/* 一键测试入口（仅开发期，不参与交付运行时）
   用法：node _dev/run-tests.js
   跑三层：
     ① 引擎自检   node _selftest.js      —— 数据完整性 + 34 万条断言 + 路线可达性
     ② 定向场景   _scenario.html         —— 高危二次确认 / 传承页 / 图鉴持久化
     ③ 随机全流程 _browsertest.html      —— 无人值守长跑，捕获运行时异常
   ②③ 需要本机 Chrome / Edge；找不到浏览器时自动跳过并给出提示。 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const DEV = __dirname;
const ROOT = path.join(DEV, '..');
const results = [];

/* ── 定位浏览器 ── */
function findBrowser() {
  const cands = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  return cands.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }) || null;
}

/* ── 把 index.html 的 body 骨架注入测试模板 ── */
function build(tplName, outName) {
  const tpl = fs.readFileSync(path.join(DEV, tplName), 'utf8');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = idx.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (!m) throw new Error('index.html 中找不到 <body>');
  const body = m[1].replace(/<script[\s\S]*?<\/script>/g, '');
  const out = tpl.replace('<!-- 骨架：直接内联 index.html 的 body（由构建脚本注入） -->', body);
  const outPath = path.join(DEV, outName);
  fs.writeFileSync(outPath, out);
  return outPath;
}

function runHeadless(browser, file, budgetMs) {
  const dump = execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=' + budgetMs,
    '--dump-dom', 'file:///' + file.replace(/\\/g, '/')
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  const m = dump.match(/RESULT_JSON=(\{[\s\S]*?\})<\/div>/);
  if (!m) throw new Error('未取到 RESULT_JSON（页面可能未跑完）');
  return JSON.parse(m[1]);
}

/* ═══ ① 引擎自检 ═══ */
console.log('\n▌① 引擎自检 ────────────────────────────');
const st = spawnSync(process.execPath, [path.join(DEV, '_selftest.js')], { encoding: 'utf8' });
process.stdout.write(st.stdout || '');
if (st.stderr) process.stderr.write(st.stderr);
results.push(['引擎自检', st.status === 0]);

/* ═══ ②③ 浏览器测试 ═══ */
const browser = findBrowser();
if (!browser) {
  console.log('\n⚠ 未找到 Chrome / Edge，跳过浏览器层测试（②③）。');
} else {
  console.log('\n▌② 定向场景（二次确认 / 传承 / 图鉴）──────');
  try {
    const f = build('_scenario.html', '_scenario.run.html');
    const r = runHeadless(browser, f, 60000);
    console.log('  断言 ' + r.total + ' 条，失败 ' + r.failed.length + ' 条，运行时错误 ' + r.errors.length + ' 条');
    r.failed.forEach(x => console.log('   ✗ ' + x));
    r.errors.forEach(x => console.log('   ! ' + x));
    results.push(['定向场景', r.pass]);
  } catch (e) { console.log('  ✗ ' + e.message); results.push(['定向场景', false]); }

  console.log('\n▌③ 随机全流程长跑 ─────────────────────');
  try {
    const f = build('_browsertest.html', '_browsertest.run.html');
    const r = runHeadless(browser, f, 300000);
    console.log('  历 ' + r.lives + ' 世 / ' + r.years + ' 年，弹窗 ' + r.modalsSeen +
      ' 次，运行时错误 ' + r.errorCount + ' 条');
    console.log('  图鉴：' + r.dexCount + '（单元格 ' + r.dexCells + '）');
    console.log('  品第分布：' + JSON.stringify(r.rates));
    (r.errors || []).forEach(x => console.log('   ! ' + x));
    results.push(['随机长跑', r.errorCount === 0 && r.lives > 0]);
  } catch (e) { console.log('  ✗ ' + e.message); results.push(['随机长跑', false]); }
}

/* ═══ 汇总 ═══ */
console.log('\n════════ 总汇 ════════');
results.forEach(([k, v]) => console.log('  ' + (v ? '✓' : '✗') + ' ' + k));
const allPass = results.every(r => r[1]);
console.log('\nIS_PASS: ' + (allPass ? 'YES' : 'NO'));
process.exit(allPass ? 0 : 1);
