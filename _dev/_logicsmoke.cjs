/* 青史双卷 / 帝王变体 的纯逻辑冒烟测试（vm，无 DOM 依赖） */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const code = ['data.js', 'engine.js', 'ui.js']
  .map(function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); })
  .join('\n;\n');

function makeEl() {
  return {
    setAttribute() {}, removeAttribute() {}, hasAttribute() { return false; },
    addEventListener() {}, appendChild() {}, querySelector() { return null; },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() { return false; } },
    style: {}, focus() {}, click() {},
    set innerHTML(v) {}, get innerHTML() { return ''; },
    textContent: '', dataset: {}, disabled: false
  };
}
const documentStub = {
  readyState: 'loading',
  getElementById() { return makeEl(); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return makeEl(); },
  addEventListener() {}, body: makeEl()
};
const ctx = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, URLSearchParams,
  Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, parseInt, parseFloat, isNaN,
  document: documentStub, window: {}, location: { search: '' },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};
ctx.window = ctx;
vm.createContext(ctx);

const test = `
(function(){
  const R={logs:[],pass:true};
  function ok(c,m){ R.logs.push((c?'PASS':'FAIL')+' '+m); if(!c)R.pass=false; }
  try{
    const o=pick(ORIGINS); newLife(o); runChildhood(o);
    const html0=qingshiHTML({});
    ok(/列传/.test(html0) && /殁录/.test(html0), '双卷标题存在');

    S.identity='mingchen'; recordIdentity(100);
    recordDeath('pingdan');
    ok(META.dexId.mingchen && META.dexId.mingchen.c===1, '列传 mingchen 已录');
    ok(META.dexDeath.pingdan===1, '殁录 pingdan 已录');
    const html1=qingshiHTML({id:'mingchen',death:'pingdan'});
    ok(/范仲淹/.test(html1), '列传含 范仲淹 史鉴');
    ok(/data-key="mingchen"/.test(html1), 'mingchen 单元格可点');
    ok(/data-key="pingdan"/.test(html1), 'pingdan 单元格可点');

    S.identity='diwang'; S.flags={玄武门:true}; recordIdentity(100);
    ok(META.dexId.diwang.v==='duodi-A', '帝王变体 duodi-A='+META.dexId.diwang.v);
    const html2=qingshiHTML({id:'diwang',death:'pingdan'});
    ok(/李世民/.test(html2), '帝王动态史鉴=李世民(玄武门)');

    recordDeath('eguan');
    const html3=qingshiHTML({death:'eguan'});
    ok(/data-key="eguan"/.test(html3), '史无其人 eguan 入殁录');

    /* ── F-R3 转途：白名单兼修 vs 自毁主业 ── */
    const o2=pick(ORIGINS); newLife(o2);
    activateRoute('zheng');
    ok(comboCheck('yi')==='ok',      '白名单兼修 zheng+yi 不转途');
    ok(comboCheck('jun')==='ok',     '白名单兼修 zheng+jun 不转途');
    activateRoute('yi');
    ok(comboCheck('shang')==='switch','超额/非法组合判为转途');
    const victims=switchVictimNames('shang');
    ok(victims.length===2 && victims.join('').indexOf('从政')>=0,
       '转途明示牺牲者：'+victims.join('、'));
    activateRoute('shang');
    ok(!S.routes.zheng.active && S.routes.zheng.node===0, '转途后旧明线离线且节点归零');
    ok(activeBrightIds().length===1 && activeBrightIds()[0]==='shang', '转途后仅余新明线');
  }catch(e){ R.pass=false; R.logs.push('THROW '+e.message+'\\n'+e.stack); }
  globalThis.__R=R;
})();
`;
vm.runInContext(code + '\n' + test, ctx, { filename: 'bundle.js' });
const R = ctx.__R;
console.log(R.logs.join('\n'));
console.log('\nLOGIC ' + (R.pass ? 'PASS' : 'FAIL'));
process.exit(R.pass ? 0 : 1);
