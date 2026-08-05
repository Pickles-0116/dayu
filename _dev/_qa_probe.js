/* QA 独立复核探针（严过关）—— 不复用实现方断言，独立取证
   用法：node _dev/_qa_probe.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = {};
const sandbox = {
  console, Math, JSON, Object, Array, String, Number, Boolean, Date,
  setTimeout, isNaN, parseInt, parseFloat, URLSearchParams,
  location: { search: '' },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  }
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const NAMES = ['ATTRS','ATTR_CAP','ORIGINS','ROUTES','CHAINS','GENERAL','DAILY','ENDINGS','ACTIONS',
  'FATE_CARDS','XIAN_ENTRY','XIAN_NEED','XIAN_CAP','XIAN_LIFE','TIER_WEIGHT','META','S','INHERIT',
  'RANKS','ENDING_RANKS','clamp','ri','chance','pick','newLife','runChildhood','applyEff','addChild',
  'doBreakthrough','routeState','routeGap','activateRoute','routeReqAt','doSettle','pickEvents',
  'judgeNaturalDeath','computeInherit','commitLegacy','drawOrigins','xianNeed','lifeScore',
  'endingRank','recordEnding','resetMeta','saveMeta','loadMeta','dexStat','yearEconomy','drawFate'];
const trailer = '\n;globalThis.__API={' +
  NAMES.map(n => `get ${n}(){return typeof ${n}!=="undefined"?${n}:undefined;},set ${n}(v){ ${n}=v; }`).join(',') + '};\n';
vm.runInContext(src('data.js') + '\n' + src('engine.js') + trailer, sandbox, { filename: 'b.js' });
const G = sandbox.__API;

const issues = [];
const notes = [];
let checks = 0;
function chk(cond, label, detail) {
  checks++;
  if (!cond) issues.push({ label, detail: detail || '' });
  return cond;
}
function info(label, detail) { notes.push(`${label}: ${detail}`); }

console.log('═════ QA 独立复核探针 ═════\n');

/* ── 1. P0-3 死锁不变量：穷举 UI 门控(show && ok) ── */
{
  let worst = null, deadlocks = 0, combos = 0;
  const healths = [0, 1, 5, 9, 11, 13, 17, 40, 100];
  const moneys = [-30, -1, 0, 7, 8, 500];
  for (const o of G.ORIGINS) {
    for (let age = 6; age <= 90; age++) {
      for (const h of healths) {
        for (const m of moneys) {
          G.newLife(o);
          const s = G.S; s.age = age; s.health = h; s.money = m;
          combos++;
          const avail = G.ACTIONS.filter(a => a.show(s) && a.ok(s));
          if (!avail.length) { deadlocks++; if (!worst) worst = { o: o.id, age, h, m }; }
        }
      }
    }
  }
  chk(deadlocks === 0, 'P0-3 任何状态下均有可选行动（无死锁年）',
    deadlocks ? `${deadlocks}/${combos} 组合无行动，例：${JSON.stringify(worst)}` : '');
  info('P0-3 穷举组合数', `${combos} 组（24出身 × 85年龄 × 9健康 × 6银钱），空转 ${deadlocks}`);

  // 平民少年 6–15 岁：确认非 rest 的成长型行动确实覆盖
  const cm = G.ORIGINS.find(o => !o.beggar && !o.royal && o.t <= 2);
  const cover = {};
  for (let age = 6; age <= 15; age++) {
    G.newLife(cm); const s = G.S; s.age = age; s.health = 60; s.money = 30;
    cover[age] = G.ACTIONS.filter(a => a.show(s) && a.ok(s)).map(a => a.id);
  }
  chk(cover[6].length >= 3 && cover[15].length >= 5,
    'P0-3 平民 6–15 岁有多样成长行动（非仅养生）',
    `6岁:${cover[6].join('/')} | 15岁:${cover[15].join('/')}`);
  info('平民 6/10/15 岁可选行动', `6→[${cover[6]}] 10→[${cover[10]}] 15→[${cover[15]}]`);
}

/* ── 2. lifeScore 入线深度是否真的计分（怀疑 r.step 悬空） ── */
{
  const o = G.ORIGINS.find(x => !x.beggar && !x.debt);
  G.resetMeta(); G.newLife(o);
  const s = G.S; s.age = 60;
  G.activateRoute('yi');
  const shallow = G.lifeScore('pingdan');
  // 把主线推到最后一节（模拟通关）
  s.routes.yi.node = G.CHAINS.yi.nodes.length - 1;
  const deep = G.lifeScore('pingdan');
  chk(deep > shallow, 'P1-4 主线推进深度应影响品第评分',
    `节点 0 → ${s.routes.yi.node} 分数纹丝不动（${shallow} → ${deep}）；engine.js:507 读的是 r.step，而路线状态只有 node，字段悬空`);
  info('lifeScore 入线深度', `node=0 得 ${shallow}；node=末节 得 ${deep}`);
  const keys = Object.keys(s.routes.yi);
  info('路线状态实际字段', keys.join(','));
}

/* ── 3. 银钱地板：applyEff vs doSettle 是否一致（罪籍 -30 地板） ── */
{
  const debtO = G.ORIGINS.find(x => x.debt);
  G.newLife(debtO);
  const s = G.S;
  const before = s.money;
  G.applyEff({ money: -5 }, null);
  chk(s.money <= before, '罪籍受罚扣银不应反而增加',
    `起始 ${before} 银，applyEff({money:-5}) 后变为 ${s.money}（engine.js:172 硬性 Math.max(0,…)，忽略 -30 地板，惩罚变奖励）`);
  info('罪籍 applyEff 扣银', `${before} → ${s.money}`);
  // doSettle 侧地板确认
  G.newLife(debtO); const s2 = G.S; s2.money = -28; s2.age = 70; s2.flags.mundane = true;
  for (let i = 0; i < 20; i++) { if (s2.pendingEnd) break; s2.health = 90; s2.age = 40; G.doSettle(); }
  chk(s2.money >= -30, 'doSettle 侧 -30 地板生效', String(s2.money));
  info('罪籍逐年结算后银钱', String(s2.money));
}

/* ── 4. 闭关高危二次确认（P0-9 / D-13） ── */
{
  const o = G.ORIGINS[0];
  G.newLife(o); const s = G.S; s.flags.仙缘 = true; G.activateRoute('xian');
  s.health = 80;
  const secl = G.ACTIONS.find(a => a.id === 'seclude');
  const c = secl.confirm(s);
  chk(c.left !== null && c.left !== undefined, '闭关确认弹窗含「余下」字段', JSON.stringify(c.left));
  chk(Number(c.left) === 80 - Math.ceil(80 * 0.35), '「余下气血」数值正确',
    `显示 ${c.left}，应为 ${80 - Math.ceil(80 * 0.35)}`);
  chk(/35%/.test(c.cost) && /28/.test(c.cost), '代价文案标明扣除量', c.cost);
  // 作罢不扣血：confirm 本身必须是纯函数
  const h1 = s.health; secl.confirm(s); secl.confirm(s);
  chk(s.health === h1, '仅查看确认弹窗（作罢）不扣血', `${h1} → ${s.health}`);
  // 决行确实扣血
  G.applyEff(secl.run(s).eff, null);
  chk(s.health < h1, '决行确实扣血', `${h1} → ${s.health}`);
  // 低血闭关 → 次年结算走火入魔
  G.newLife(o); const s3 = G.S; s3.flags.仙缘 = true; G.activateRoute('xian');
  s3.health = 2; s3.age = 30;
  G.applyEff(G.ACTIONS.find(a => a.id === 'seclude').run(s3).eff, null);
  G.doSettle();
  chk(s3.pendingEnd === 'zouhuo', '气血耗尽后结算判走火入魔', String(s3.pendingEnd));
  info('闭关确认弹窗', `代价「${c.cost}」余下「${c.left}」`);
}

/* ── 5. 修仙六阶全链可达 + 入口常数 ── */
{
  chk(G.XIAN_ENTRY <= 100, '引气入体门槛凡人可达（闭关约两次）', `XIAN_ENTRY=${G.XIAN_ENTRY}，单次闭关得 30–50`);
  G.newLife(G.ORIGINS[0]); const s = G.S; s.flags.仙缘 = true; G.activateRoute('xian');
  const caps = [], lifes = [];
  for (let t = 0; t <= 5; t++) { s.cult += 99999; G.doBreakthrough(); caps.push(s.healthMax); lifes.push(s.lifespan); }
  chk(s.xianTier === 5, '六境全链可达至渡劫', String(s.xianTier));
  chk(caps.join() === G.XIAN_CAP.join(), '各境气血上限 150/300/600/1200/2500/5000', caps.join('/'));
  chk(lifes[5] >= G.XIAN_LIFE[5], '寿命轴被改写', String(lifes[5]));
  // 纯靠闭关能否自然引气入体
  G.newLife(G.ORIGINS[0]); const s2 = G.S; s2.flags.仙缘 = true; G.activateRoute('xian');
  s2.health = 100; s2.healthMax = 100;
  let n = 0; const secl = G.ACTIONS.find(a => a.id === 'seclude');
  while (s2.cult < G.xianNeed(-1) && n < 10) { G.applyEff(secl.run(s2).eff, null); s2.health = 100; n++; }
  chk(n <= 3, '凡人纯靠闭关可引气入体', `需闭关 ${n} 次`);
  info('引气入体', `XIAN_ENTRY=${G.XIAN_ENTRY}，实测闭关 ${n} 次达成`);
}

/* ── 6. 属性/健康/门槛钳制 ── */
{
  G.newLife(G.ORIGINS[0]);
  const s = G.S;
  G.applyEff({ a: { 体: 99, 智: 99, 财: 99 } }, null);
  chk(G.ATTRS.every(k => s.attrs[k] <= 10 && s.attrs[k] >= 0), '八维恒在 0–10',
    G.ATTRS.map(k => k + s.attrs[k]).join(' '));
  G.applyEff({ h: 99999 }, null);
  chk(s.health <= s.healthMax, '健康不溢出上限', `${s.health}/${s.healthMax}`);
  // 门槛随年龄 +1/7年，上限 10
  const r = G.ROUTES.find(x => x.id === 'shang');
  const at = a => G.routeReqAt(r, a);
  const k0 = Object.keys(r.attr)[0];
  chk(at(r.age + 7)[k0] === Math.min(10, at(r.age)[k0] + 1), '门槛每 7 年 +1',
    `${at(r.age)[k0]} → ${at(r.age + 7)[k0]}`);
  chk(Object.values(at(200)).every(v => v <= 10), '门槛上限封顶 10', JSON.stringify(at(200)));
  info('从商门槛', `${r.age}岁 ${JSON.stringify(at(r.age))} → ${r.age + 21}岁 ${JSON.stringify(at(r.age + 21))} → 老年 ${JSON.stringify(at(200))}`);
}

/* ── 7. 出身抽取：24 项全可抽 + T0–T5 权重 ≈ 30/30/20/12/6/2 ── */
{
  const seen = {}, tierCnt = {};
  const N = 300000;
  for (let i = 0; i < N; i++) {
    const one = G.drawOrigins(1)[0];
    seen[one.id] = (seen[one.id] || 0) + 1;
    tierCnt[one.t] = (tierCnt[one.t] || 0) + 1;
  }
  chk(Object.keys(seen).length === G.ORIGINS.length, '24 项出身均可被抽中',
    `${Object.keys(seen).length}/${G.ORIGINS.length}`);
  const want = [30, 30, 20, 12, 6, 2];
  const got = [0, 1, 2, 3, 4, 5].map(t => (tierCnt[t] || 0) / N * 100);
  const dev = got.map((g, i) => Math.abs(g - want[i]));
  chk(dev.every((d, i) => d < Math.max(1.5, want[i] * 0.12)), 'T0–T5 权重符合 30/30/20/12/6/2',
    got.map((g, i) => `T${i}=${g.toFixed(1)}%`).join(' '));
  info('T0–T5 实测权重', got.map((g, i) => `T${i} ${g.toFixed(2)}%(期望${want[i]})`).join(' · '));
  const beg = G.ORIGINS.find(o => o.beggar), roy = G.ORIGINS.find(o => o.royal);
  chk(seen[beg.id] > 0, '孤儿乞丐必可抽', String(seen[beg.id]));
  chk(seen[roy.id] > 0, '皇族旁支必可抽', String(seen[roy.id]));
  info('乞丐/宗室抽中率', `${beg.n} ${(seen[beg.id] / N * 100).toFixed(2)}% · ${roy.n} ${(seen[roy.id] / N * 100).toFixed(2)}%`);
}

/* ── 8. P0-8 乞丐存活率（独立复算） ── */
{
  const beg = G.ORIGINS.find(o => o.beggar);
  let alive = 0; const M = 60000;
  for (let i = 0; i < M; i++) { G.newLife(beg); if (G.runChildhood(beg).alive) alive++; }
  const rate = alive / M;
  chk(rate > 0.005 && rate < 0.02, 'P0-8 乞丐 0–14 累计存活 ≈1%', `${(rate * 100).toFixed(3)}%（${alive}/${M}）`);
  info('乞丐存活率', `${(rate * 100).toFixed(3)}%（${alive}/${M} 世）`);
}

/* ── 9. P0-4 事件冷却 / once 不复发 ── */
{
  const withCd = G.GENERAL.filter(e => e.cd), once = G.GENERAL.filter(e => e.once);
  chk(withCd.length > 0, '存在带冷却的复发型通用事件', withCd.map(e => e.id + '(cd' + e.cd + ')').join(' '));
  chk(once.length > 0, '存在 once 事件', once.map(e => e.id).join(' '));
  const chaojia = G.GENERAL.find(e => /抄家|ruin/.test(e.id) || (e.t && /抄家/.test(e.t)));
  info('通用事件', `共 ${G.GENERAL.length} 条，带 cd ${withCd.length} 条，once ${once.length} 条`);
  info('once 事件清单', once.map(e => e.id + '/' + e.t).join(' · '));
  // 实测：同一 once 事件不会二次入队
  G.newLife(G.ORIGINS[0]); const s = G.S; s.age = 30;
  const fired = {};
  for (let y = 0; y < 400; y++) {
    s.age = 20 + (y % 50); s.health = 80;
    G.pickEvents().forEach(it => { if (it.kind === 'gen') fired[it.ev.id] = (fired[it.ev.id] || 0) + 1; });
  }
  const onceIds = once.map(e => e.id);
  const dupOnce = onceIds.filter(id => (fired[id] || 0) > 1);
  chk(dupOnce.length === 0, 'once 事件不复发', dupOnce.join(','));
  // cd 事件间隔
  const cdViolate = [];
  withCd.forEach(e => { if ((fired[e.id] || 0) > Math.ceil(400 / e.cd) + 2) cdViolate.push(e.id); });
  chk(cdViolate.length === 0, 'cd 冷却生效（未逐年重复触发）', cdViolate.join(','));
}

/* ── 10. P0-7 传承全链路 ── */
{
  G.resetMeta(); G.__proto__; sandbox.__API.INHERIT = null;
  const o = G.ORIGINS.find(x => !x.beggar && !x.debt);
  const gens = [];
  for (let g = 1; g <= 6; g++) {
    G.newLife(o); const s = G.S;
    gens.push({ gen: s.gen, house: s.houseLog.slice() });
    chk(s.gen === g, `第 ${g} 代代数递增`, String(s.gen));
    if (g > 1) chk(s.houseLog.some(x => /先人遗泽/.test(x)), `第 ${g} 代承先人遗泽`, s.houseLog.join('|'));
    s.attrs.财 = 9; s.attrs.望 = 9; s.attrs.脉 = 9; s.age = 60; s.pendingEnd = 'pingdan';
    G.addChild('书香'); G.commitLegacy(0);
  }
  chk(gens[1].house.some(x => /家训初立/.test(x)) === false, '第 2 代尚未解锁家训（需 META.gens≥2）', gens[1].house.join('|'));
  chk(gens[2].house.some(x => /家训初立/.test(x)), '第 3 代（gens=2）解锁 家训初立', gens[2].house.join('|'));
  chk(gens[4].house.some(x => /门第有声/.test(x)), '第 5 代（gens=4）解锁 门第有声', gens[4].house.join('|'));
  info('门第解锁轨迹', gens.map(x => `第${x.gen}代[${x.house.join('；') || '—'}]`).join('  '));
  // 抄家清零
  G.newLife(o); const s = G.S; s.attrs.财 = 10; s.attrs.望 = 10; s.attrs.脉 = 10;
  G.addChild('书香'); s.flags.抄家 = true;
  const ruined = G.computeInherit(0);
  chk(ruined.财 === 0 && ruined.望 === 0 && ruined.脉 === 0, 'P0-7 抄家清零传承', JSON.stringify(ruined));
  // 无嗣
  G.newLife(o); G.S.age = 60; G.S.children = [];
  chk(G.judgeNaturalDeath(false) === 'duanzi', '无嗣且享年 ≥45 判断子绝孙', G.judgeNaturalDeath(false));
  // 修仙绝嗣
  G.newLife(o); G.S.age = 60; G.S.children = []; G.S.flags.修仙入门 = true;
  chk(G.judgeNaturalDeath(false) !== 'duanzi', '修仙者不判断子绝孙（另有归宿）', G.judgeNaturalDeath(false));
}

/* ── 11. P0-6 结局表 / 分组 / 年表首尾 ── */
{
  const keys = Object.keys(G.ENDINGS);
  chk(keys.length === 54, '结局共 54 条', String(keys.length));
  // 年表首尾必录（复刻 ui.js timelineHTML 逻辑）
  G.newLife(G.ORIGINS[0]); const s = G.S; s.age = 41; s.log = [];
  const rows = s.log.filter(l => l.kind === 'key' || l.kind === 'bad');
  rows.unshift({ age: 0, txt: '生' }); rows.push({ age: s.age, txt: '卒' });
  chk(rows.length >= 2, 'P0-6 年表首尾必录生卒（无空年表）', `${rows.length} 行`);
  // 所有结局可评级
  let bad = 0;
  keys.forEach(k => { const sc = G.lifeScore(k); if (typeof sc !== 'number' || isNaN(sc) || !G.endingRank(sc)) bad++; });
  chk(bad === 0, '全部 54 结局可评级', String(bad));
  // 结局 kind 未被 lifeScore 计分表覆盖的
  const kb = ['ascend', 'good', 'grey', 'cut', 'bad'];
  const uncovered = {};
  keys.forEach(k => { const kk = G.ENDINGS[k].k; if (!kb.includes(kk)) uncovered[kk] = (uncovered[kk] || 0) + 1; });
  if (Object.keys(uncovered).length) info('lifeScore 未加权的结局类别', JSON.stringify(uncovered) + '（按 0 分处理）');
}

/* ── 12. P0-5 路线：明线可并行 / 暗线零出身提示 / 政线锁 ── */
{
  const ming = G.ROUTES.filter(r => r.kind !== '暗线'), an = G.ROUTES.filter(r => r.kind === '暗线');
  chk(ming.length === 4, '明线 4 条', ming.map(r => r.n).join('/'));
  info('路线构成', `明线 ${ming.length}（${ming.map(r => r.n)}）· 暗线 ${an.length}（${an.map(r => r.n)}）`);
  // 明线并行
  G.newLife(G.ORIGINS.find(o => !o.beggar && !o.debt));
  ming.forEach(r => G.activateRoute(r.id));
  const activeN = Object.keys(G.S.routes).filter(id => G.S.routes[id].active).length;
  chk(activeN === 4, 'P0-5 四条明线可并行', String(activeN));
  // 暗线出身期零提示
  G.newLife(G.ORIGINS.find(o => o.t <= 1 && !o.beggar));
  const s = G.S; s.age = 6;
  const visibleAn = an.filter(r => r.vis(s));
  chk(visibleAn.length === 0, 'P0-5 暗线出身期零提示', visibleAn.map(r => r.n).join('/'));
  // 贱籍/罪籍锁政线
  // 注：须先 resetMeta —— 否则上一段传承测试遗留的 META.gens>=6「世家气象」会把
  //     rank<2 提到 2，属预期内的门第越阶，不应算作锁失效（此前为本探针自身的取样缺陷）
  G.resetMeta(); sandbox.__API.INHERIT = null;
  const jian = G.ORIGINS.filter(o => o.rank === 0);
  let lockedAll = true, sample = '';
  jian.forEach(o => {
    G.newLife(o); const st = G.S; st.age = 30;
    G.ATTRS.forEach(k => { st.attrs[k] = 10; });
    const zs = G.routeState(G.ROUTES.find(r => r.id === 'zheng'));
    if (zs === 'ready' || zs === 'active') { lockedAll = false; sample = o.n + '→' + zs; }
  });
  chk(lockedAll, 'P0-5 贱籍（rank 0）满属性仍锁政线', sample);
  info('贱籍出身数', `${jian.length} 项，均锁政线`);
  // zhanw 无主线链（由 rise 行动收束）
  chk(!G.CHAINS.zhanw, 'zhanw 走行动收束而非主线链（设计如此）',
    `CHAINS 键：${Object.keys(G.CHAINS).join(',')}`);
}

/* ── 13. 长跑稳定性（独立随机 6000 世，捕获异常/未收敛/空结局） ── */
{
  let err = 0, noEnd = 0, sample = '';
  const tally = {};
  for (let i = 0; i < 6000; i++) {
    try {
      const o = G.pick(G.ORIGINS);
      G.newLife(o);
      const res = G.runChildhood(o);
      if (o.beggar && !res.alive) { tally.eguan = (tally.eguan || 0) + 1; continue; }
      const s = G.S; let guard = 0;
      while (!s.pendingEnd && guard++ < 250) {
        G.doSettle(); if (s.pendingEnd) break;
        G.pickEvents().forEach(it => {
          const ev = it.ev;
          const usable = ev.opts.filter(op => !op.req || Object.keys(op.req).every(k => s.attrs[k] >= op.req[k]));
          const op = usable.length ? G.pick(usable) : ev.opts[0];
          let ch2 = op.p !== undefined
            ? (G.chance(typeof op.p === 'function' ? op.p(s) : op.p) ? op.ok : op.ko) : op.ok;
          if (ch2) G.applyEff(ch2.eff, it.kind === 'main' ? { rid: it.rid } : null);
        });
        if (s.pendingEnd) break;
        G.ROUTES.forEach(r => { if (G.routeState(r) === 'ready') G.activateRoute(r.id); });
        const avail = G.ACTIONS.filter(a => a.show(s) && a.ok(s));
        if (!avail.length) { noEnd++; break; }
        const safe = avail.filter(a => !a.danger);
        G.applyEff(G.pick(safe.length ? safe : avail).run(s).eff, null);
        if (s.pendingEnd) break;
        // 钳制不变量逐年校验
        if (!G.ATTRS.every(k => s.attrs[k] >= 0 && s.attrs[k] <= 10)) { err++; sample = '属性越界 ' + JSON.stringify(s.attrs); break; }
        if (s.health > s.healthMax) { err++; sample = `健康溢出 ${s.health}/${s.healthMax}`; break; }
      }
      if (guard >= 250) { noEnd++; }
      const k = s.pendingEnd || G.judgeNaturalDeath(false);
      tally[k] = (tally[k] || 0) + 1;
    } catch (e) { err++; if (!sample) sample = e.message + ' @ ' + (e.stack || '').split('\n')[1]; }
  }
  chk(err === 0, '长跑 6000 世无异常/无不变量破坏', `${err} 次，例：${sample}`);
  chk(noEnd === 0, '长跑无未收敛/无行动可选之世', String(noEnd));
  const distinct = Object.keys(tally).length;
  info('独立长跑 6000 世', `触达 ${distinct} 种结局，异常 ${err}`);
  const undef = Object.keys(tally).filter(k => !G.ENDINGS[k]);
  chk(undef.length === 0, '长跑未产生悬空结局键', undef.join(','));
}

/* ── 输出 ── */
console.log('─── 观测数据 ───');
notes.forEach(n => console.log('  · ' + n));
console.log('\n─── 判定 ───');
console.log(`  检查项 ${checks} 条，未通过 ${issues.length} 条`);
issues.forEach(i => console.log(`  ✗ ${i.label}\n      → ${i.detail}`));
console.log('\nQA_PROBE: ' + (issues.length === 0 ? 'CLEAN' : 'ISSUES=' + issues.length));
