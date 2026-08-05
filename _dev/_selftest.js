/* 离线自检脚本（仅开发期使用，不参与交付运行时）
   用法：node _selftest.js
   作用：① 数据完整性断言 ② 引擎四阶段管线压力模拟 ③ 结局键闭合性检查 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ── 最小浏览器环境桩 ── */
const store = {};
const sandbox = {
  console,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Date,
  setTimeout,
  isNaN,
  parseInt,
  parseFloat,
  URLSearchParams,
  location: { search: '' },
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

/* 浏览器中多个经典 script 共享同一个「全局词法环境」，顶层 const/let 跨文件可见；
   而 Node vm 每次 runInContext 会新建词法作用域。故此处拼接为单次执行以忠实模拟浏览器。 */
function src(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); }
const EXPORTS = ['ATTRS', 'ATTR_CAP', 'ATTR_FULL', 'RANKS', 'TIER_WEIGHT', 'ORIGINS', 'ROUTES',
  'FATE_CARDS', 'CHAINS', 'GENERAL', 'DAILY', 'ENDINGS', 'ACTIONS', 'XIAN_TIERS', 'XIAN_CAP',
  'XIAN_NEED', 'XIAN_LIFE', 'XIAN_ENTRY', 'HOUSE_TIERS', 'META', 'S', 'DRAW', 'INHERIT', 'LUCKY',
  'ENDING_RANKS', 'ENDING_GROUPS', 'CAREER',
  'IDENTITIES', 'ROUTE_LAYERS', 'COMBO_WHITELIST'];
const FNS = ['clamp', 'ri', 'chance', 'pick', 'mix', 'newLife', 'runChildhood', 'runBeggarGauntlet',
  'applyEff', 'addChild', 'doBreakthrough', 'drawFate', 'routeState', 'routeGap', 'activateRoute',
  'routeReqAt', 'yearEconomy', 'doSettle', 'pickEvents', 'doUpdate', 'judgeNaturalDeath',
  'computeInherit', 'commitLegacy', 'drawOrigins', 'fateGroupWeights', 'saveMeta', 'loadMeta', 'resetMeta', 'xianNeed', 'activeRouteId',
  'endingGroupOf', 'lifeScore', 'endingRank', 'recordEnding', 'dexStat', 'metaDefaults',
  'moneyFloor', 'clampMoney',
  /* v1.6：专精约束 + 青史双卷 */
  'comboCheck', 'isBright', 'activeBrightIds', 'recordIdentity', 'recordDeath', 'diwangVariant',
  'diwangProto'];
const trailer = '\n;globalThis.__API = {' +
  EXPORTS.concat(FNS).map(n => 'get ' + n + '(){ return typeof ' + n + '!=="undefined" ? ' + n + ' : undefined; }').join(',') +
  '};\n';
vm.runInContext(src('data.js') + '\n' + src('engine.js') + trailer, sandbox, { filename: 'bundle.js' });

/* ── 断言工具 ── */
let pass = 0;
const fails = [];
function ok(cond, label, detail) {
  if (cond) { pass++; }
  else { fails.push(label + (detail ? '  → ' + detail : '')); }
}
function eq(actual, expected, label) {
  ok(actual === expected, label, 'got ' + actual + ', want ' + expected);
}

const G = sandbox.__API;

/* ═══════ ① 数据完整性 ═══════ */
eq(G.ORIGINS.length, 26, '出身表 26 项');
eq(G.ROUTES.length, 9, '路线表 9 条');
eq(G.FATE_CARDS.length, 23, '机遇卡 23 张');
eq(Object.keys(G.CHAINS).length, 9, '分支主线 9 链');
ok(G.GENERAL.length >= 12, '通用事件已扩充（≥12，基础 12＋新增）', String(G.GENERAL.length));
ok(G.DAILY.length >= 10, '日常支线已扩充（≥10，基础 10＋新增）', String(G.DAILY.length));
ok(G.CAREER && Object.keys(G.CAREER).length === 7, '生涯事件七线', Object.keys(G.CAREER || {}).length + '');
const careerTotal = G.CAREER ? Object.values(G.CAREER).reduce(function (a, b) { return a + (b ? b.length : 0); }, 0) : 0;
ok(careerTotal === 84, '生涯事件 84 条（规格 §0）', String(careerTotal));
ok(G.ACTIONS.length >= 12, '主动行动 ≥12 项', String(G.ACTIONS.length));
eq(G.ATTRS.length, 8, '八维属性');
eq(G.TIER_WEIGHT.length, 6, 'T0–T5 权重六档');

/* 出身层级覆盖 T0–T5，且乞丐 / 宗室可抽 */
const tiers = new Set(G.ORIGINS.map(o => o.t));
ok([0, 1, 2, 3, 4, 5].every(t => tiers.has(t)), '出身覆盖 T0–T5');
ok(G.ORIGINS.some(o => o.beggar), '存在孤儿乞丐出身');
ok(G.ORIGINS.some(o => o.royal), '存在宗室旁支出身');
G.ORIGINS.forEach(o => {
  ok(o.id && o.n && o.rn && o.hook && o.lean && o.off && Array.isArray(o.tags),
    '出身字段完整: ' + (o.id || '?'));
  ok(typeof o.rank === 'number' && o.rank >= 0 && o.rank < G.RANKS.length,
    '出身 rank 合法: ' + o.id, String(o.rank));
});

/* 主线节点数 4–6（分支链另行放宽）且选项结构完整 */
/* v1.6：duodi 拆为「玄武门／靖难」双支线，节点数天然超出线性链的 4–6 区间。
   分支链在此显式登记上下限，避免把结构性扩张误报成数据错误。 */
const CHAIN_NODE_LIMIT = { duodi: [9, 13] };
let nodeTotal = 0;
Object.keys(G.CHAINS).forEach(k => {
  const ch = G.CHAINS[k];
  const n = ch.nodes.length;
  const lim = CHAIN_NODE_LIMIT[k] || [4, 6];
  nodeTotal += n;
  ok(n >= lim[0] && n <= lim[1], '主线「' + k + '」节点数 ' + lim[0] + '–' + lim[1], String(n));
  ch.nodes.forEach((nd, i) => {
    ok(!!nd.t && !!nd.d && Array.isArray(nd.opts) && nd.opts.length > 0,
      '节点结构完整 ' + k + '#' + i);
    nd.opts.forEach((op, j) => {
      const tag = k + '#' + i + '.' + j;
      ok(!!op.l, '选项有文案 ' + tag);
      ok(!!op.ok, '选项有 ok 分支 ' + tag);
      if (op.p !== undefined) ok(!!op.ko, '带概率的选项须有 ko 分支 ' + tag);
      /* ── v1.6 新增护栏 A：选项去向不得悬空 ──
         每个 ok 分支必须给出明确去向之一：推进(adv) / 跳转(goto) / 结束(end) /
         显式退出(quit) / 或本身已是链的末节点（自然收束）。
         「既不推进也不退出」的选项会让该节点每 gap 年原地复现——
         v1.5 的「安分就藩」正是死在这里。 */
      const isLast = (i === ch.nodes.length - 1);
      /* ko（失败）原地停留是合法的「明年再来」，不算悬空；只查 ok（成功）分支。 */
      if (op.ok) {
        const e = op.ok.eff || {};
        const routed = !!e.adv || e.goto !== undefined || !!e.end || !!e.quit || isLast;
        ok(routed, '选项 ok 分支有明确去向 ' + tag);
      }
      /* 护栏 B：goto 目标必须落在本链节点范围内 */
      [op.ok, op.ko].forEach(br => {
        const g = br && br.eff && br.eff.goto;
        if (g === undefined) return;
        ok(Number.isInteger(g) && g >= 0 && g < ch.nodes.length,
          'goto 目标在链内 ' + tag, String(g));
      });
    });
  });
});
ok(nodeTotal >= 40, '主线节点合计 ≥40', String(nodeTotal));

/* ── v1.6 新增护栏 C：CHAINS 与 ROUTES.chain 双向一致 ──
   zhanw 在 v1.5 里「路线存在、链不存在」，42 万项断言全数通过却根本走不通。 */
G.ROUTES.forEach(r => {
  ok(!!r.chain && !!G.CHAINS[r.chain], '路线「' + r.id + '」的 chain 已定义', String(r.chain));
});
Object.keys(G.CHAINS).forEach(k => {
  ok(G.ROUTES.some(r => r.chain === k), '链「' + k + '」有对应路线');
});

/* ── v1.6 新增护栏 D：每条链都存在一条「可抵达末节点」的推进路径 ──
   以 opts 的 adv/goto 建有向图，从 0 出发做可达性搜索。 */
Object.keys(G.CHAINS).forEach(k => {
  const nodes = G.CHAINS[k].nodes;
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const cur = stack.pop();
    (nodes[cur].opts || []).forEach(op => {
      [op.ok, op.ko].forEach(br => {
        if (!br || !br.eff) return;
        let nx = null;
        if (br.eff.goto !== undefined) nx = br.eff.goto;
        else if (br.eff.adv) nx = cur + br.eff.adv;
        if (nx === null || nx >= nodes.length || seen.has(nx)) return;
        seen.add(nx); stack.push(nx);
      });
    });
  }
  ok(seen.has(nodes.length - 1), '链「' + k + '」末节点可达',
    '可达 ' + seen.size + '/' + nodes.length);
  nodes.forEach((nd, i) => ok(seen.has(i), '链「' + k + '」节点 #' + i + ' 可达（无孤岛）'));
});

/* 路线字段与三因子完整 */
G.ROUTES.forEach(r => {
  ok(typeof r.age === 'number', '路线有年龄因子: ' + r.id);
  ok(!!r.attr, '路线有属性因子: ' + r.id);
  ok(typeof r.cond === 'function', '路线有事件/状态因子: ' + r.id);
  ok(typeof r.vis === 'function', '路线有可见性判定: ' + r.id);
  ok(!!r.condText, '路线有缺口提示文案: ' + r.id);
});

/* 结局表：数量 + 判词/如何抵达字段 */
const endKeys = Object.keys(G.ENDINGS);
ok(endKeys.length >= 52, '结局条目 ≥52', String(endKeys.length));
endKeys.forEach(k => {
  const e = G.ENDINGS[k];
  ok(!!e.n && !!e.ep && !!e.k && !!e.b, '结局字段完整（名/判词/类别/副题）: ' + k);
  ok(['good', 'bad', 'mid', 'grey', 'ascend', 'cut', 'xian', 'hidden', 'poor'].includes(e.k),
    '结局类别合法: ' + k, e.k);
});

/* 机遇卡结构 */
G.FATE_CARDS.forEach(c => {
  ok(!!c.id && !!c.n && !!c.d && !!c.eff && !!c.kind, '机遇卡字段完整: ' + (c.id || '?'));
});

/* ═══════ ② 结局键闭合性：引擎返回的键必须都存在于 ENDINGS ═══════ */
const engineSrc = fs.readFileSync(path.join(__dirname, '..', 'engine.js'), 'utf8');
const dataSrc = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const refKeys = new Set();
/* 只扫「产出结局键」的两个函数体，不再全文件扫 return 'xxx'。
   全文扫描会把 routeState / comboCheck 之类的状态串误判成悬空结局键，
   于是又得靠一张越来越长的排除名单去兜——名单本身就是下一个 bug。 */
function fnBody(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) return '';
  let i = src.indexOf('{', at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  return '';
}
['judgeNaturalDeath', 'achievementEnding'].forEach(fn => {
  const body = fnBody(engineSrc, fn);
  ok(!!body, '自测能定位引擎函数体: ' + fn);
  (body.match(/return\s+'([a-z][a-zA-Z0-9_]*)'/g) || []).forEach(m => {
    refKeys.add(m.replace(/return\s+'/, '').replace(/'$/, ''));
  });
});
// 数据层 end:'xxx'
(dataSrc.match(/end\s*:\s*'([^']+)'/g) || []).forEach(m => {
  refKeys.add(m.replace(/end\s*:\s*'/, '').replace(/'$/, ''));
});
refKeys.forEach(k => {
  if (!G.ENDINGS[k]) fails.push('结局键悬空（被引用但未定义）: ' + k);
  else pass++;
});
/* 反向：IDENTITIES.ach 指向的成就铭文必须存在 */
Object.keys(G.IDENTITIES || {}).forEach(id => {
  const a = G.IDENTITIES[id].ach;
  if (typeof a === 'string') ok(!!G.ENDINGS[a], '身份成就铭文已定义: ' + id, String(a));
});

/* ═══════ ②b v1.6 结构：青史双卷 · 行动分组 · 路线分层 ═══════ */
/* 史鉴三件套齐全（who 人物 / era 朝代 / txt 史评），缺一则抽屉渲染残缺 */
function checkHist(h, label) {
  ok(!!h.who && typeof h.who === 'string', '史鉴有其人: ' + label);
  ok(!!h.era && typeof h.era === 'string', '史鉴有其世: ' + label);
  ok(!!h.txt && h.txt.length >= 8, '史鉴有其评: ' + label, h.txt ? h.txt.length + ' 字' : '空');
}
/* 列传（成就轴）：12 身份须条条有史可考 */
Object.keys(G.IDENTITIES || {}).forEach(id => {
  const ent = G.IDENTITIES[id];
  if (id === 'diwang') {          // 帝王史鉴按夺权路径动态取，见下
    ok(typeof G.diwangProto === 'function', '帝王动态史鉴函数存在');
    return;
  }
  ok(!!ent.hist, '列传有史鉴: ' + id);
  if (ent.hist) checkHist(ent.hist, '列传/' + id);
});
/* 帝王五变体各自成史 */
['inherit', 'duodi-A', 'duodi-B', 'zhanw', 'caom'].forEach(v => {
  const p = G.diwangProto ? G.diwangProto(v) : null;
  ok(!!p, '帝王变体有原型: ' + v);
  if (p) checkHist(p, '帝王/' + v);
});
/* 殁录（死法轴）：有 hist 的必须结构完整；「史无其人」三格明确留白 */
const NO_HIST = ['eguan', 'pingdan', 'duanzi'];
let deathHist = 0;
Object.keys(G.ENDINGS || {}).forEach(k => {
  const en = G.ENDINGS[k];
  if (!en.hist) return;
  deathHist++;
  checkHist(en.hist, '殁录/' + k);
});
ok(deathHist >= 30, '殁录史鉴覆盖充足', deathHist + ' 条');
NO_HIST.forEach(k => {
  if (G.ENDINGS[k]) ok(!G.ENDINGS[k].hist, '史无其人须留白: ' + k);
});
/* 行动五分组：cat 齐备且不越界（UI F-7 依此分栏，缺 cat 会漏渲染） */
const ACTION_CATS = ['修身', '营生', '人事', '路线', '特殊'];
(G.ACTIONS || []).forEach(a => {
  ok(!!a.cat, '行动有分组: ' + a.id);
  if (a.cat) ok(ACTION_CATS.indexOf(a.cat) >= 0, '行动分组合法: ' + a.id, a.cat);
});
/* 路线三层：layer 齐备且不越界 */
const LAYER_IDS = (G.ROUTE_LAYERS || []).map(l => l.id);
ok(LAYER_IDS.length === 3, '路线分层为三层', LAYER_IDS.join('/'));
(G.ROUTES || []).forEach(r => {
  ok(!!r.layer, '路线有分层: ' + r.id);
  if (r.layer) ok(LAYER_IDS.indexOf(r.layer) >= 0, '路线分层合法: ' + r.id, r.layer);
});
/* 专精白名单：只许明线成对，且不得自配 */
(G.COMBO_WHITELIST || []).forEach(pair => {
  ok(pair.length === 2 && pair[0] !== pair[1], '兼修组合成对且互异', pair.join('+'));
  pair.forEach(id => ok(G.isBright(id), '兼修组合限明线', id));
});

/* ═══════ ③ 引擎压力模拟：完整跑通四阶段管线 ═══════ */
const actionsSeen = {};
let emptyActionYears = 0, totalActionYears = 0;
function simulateOneLife(forceOrigin, goal, prep) {
  const o = forceOrigin || G.pick(G.ORIGINS);
  G.newLife(o);
  const S = G.S;
  if (prep) prep(S);
  const res = G.runChildhood(o);
  if (o.beggar && !res.alive) return { end: 'eguan', beggarDead: true, age: S.age };
  G.drawFate();
  S.fateLastYear = S.age;

  let guard = 0;
  while (!S.pendingEnd && guard++ < 200) {
    // 阶段①结算
    G.doSettle();
    if (S.pendingEnd) break;
    // 机遇卡：随机触发
    if (S.fate && G.chance(0.5)) {
      G.applyEff(S.fate.eff, null);
      S.fate = null;
      if (S.pendingEnd) break;
    }
    // 阶段②事件
    const evs = G.pickEvents();
    for (const item of evs) {
      const ev = item.ev;
      if (!ev.opts || !ev.opts.length) { fails.push('事件无选项: ' + ev.t); break; }
      // 仅在满足 req 的选项中挑选（镜像 UI 的禁用逻辑）
      const usable = ev.opts.filter(op =>
        !op.req || Object.keys(op.req).every(k => S.attrs[k] >= op.req[k]));
      const op = usable.length ? G.pick(usable) : ev.opts[0];
      let chosen;
      if (op.p !== undefined) {
        const p = (typeof op.p === 'function') ? op.p(S) : op.p;
        ok(typeof p === 'number' && p >= 0 && p <= 1, '概率合法 ' + ev.t, String(p));
        chosen = G.chance(p) ? op.ok : op.ko;
      } else chosen = op.ok;
      ok(!!chosen, '事件分支可解析: ' + ev.t);
      if (!chosen) break;
      ok(typeof chosen.txt === 'string', '结果有文案: ' + ev.t);
      G.applyEff(chosen.eff, item.kind === 'main' ? { rid: item.rid } : null);
      if (S.pendingEnd) break;
    }
    if (S.pendingEnd) break;
    /* 路线：达标即入（镜像 UI —— 仅 ready 的卡片可点击）
       F-R3 后必须镜像玩家的取舍：明线至多 2 条且须白名单组合，越界会「转途」把旧明线
       顶下线且节点归零。理性玩家不会为了兼修而自毁主业，故此处只做无害兼修；
       唯有目标路线本身值得转途。旧写法盲目激活所有 ready 明线，导致排在 ROUTES 前列的
       jun/shang 每每被其后的 yi/zheng 顶掉，可达性统计恒为 0。 */
    const takeRoute = r => {
      if (G.routeState(r) !== 'ready') return false;
      G.activateRoute(r.id);
      return true;
    };
    if (goal) {
      const gr = G.ROUTES.find(x => x.id === goal);
      if (gr) takeRoute(gr);
    }
    G.ROUTES.forEach(r => {
      if (goal && r.id === goal) return;
      if (goal && r.kind !== '明线') return;      // 目标导向下不误入其他暗线
      if (G.comboCheck(r.id) === 'switch') return; // 不做会自毁主业的转途
      takeRoute(r);
    });
    // 阶段③行动：show 与 ok 双重门控（镜像 UI）
    const avail = G.ACTIONS.filter(a => a.show(S) && a.ok(S));
    if (avail.length) {
      // 目标导向：优先补齐目标路线仍缺的属性；其次濒危时保命；否则随机（避开高危）
      let act = null;
      if (goal) {
        const gr = G.ROUTES.find(x => x.id === goal);
        if (gr && !(S.routes[goal] && S.routes[goal].active)) {
          const req = G.routeReqAt(gr, S.age);
          const map = { 才:'study', 智:'study', 武:'martial', 体:'martial', 财:'trade', 脉:'social', 望:'social' };
          for (const k of Object.keys(req)) {
            if (S.attrs[k] >= req[k]) continue;
            const cand = avail.find(a => a.id === map[k]);
            if (cand) { act = cand; break; }
          }
        }
      }
      if (!act && S.health < S.healthMax * 0.3) act = avail.find(a => a.id === 'rest') || null;
      if (!act) {
        const safe = avail.filter(a => !a.danger);
        act = G.pick(safe.length && G.chance(0.85) ? safe : avail);
      }
      if (act.confirm) { const c = act.confirm(S); ok(!!c && !!c.title, '二次确认结构完整: ' + act.n); }
      const r = act.run(S);
      ok(!!r && typeof r === 'object' && !!r.eff, '行动返回结构: ' + act.n);
      G.applyEff(r.eff, null);
      actionsSeen[act.id] = (actionsSeen[act.id] || 0) + 1;
    } else emptyActionYears++;
    totalActionYears++;
    if (S.pendingEnd) break;
    // 阶段④更新
    G.doUpdate();
    // 路线判定不得抛错
    G.ROUTES.forEach(r => { G.routeState(r); G.routeGap(r); });
  }
  if (guard >= 200) fails.push('年回合未收敛（>200 年仍未结局）');
  return { end: S.pendingEnd, age: S.age, guard };
}

const endTally = {};
const scoreSamples = [];   /* P1-4 品第阈值标定用 */
const N = 1200;
for (let i = 0; i < N; i++) {
  try {
    const r = simulateOneLife();
    endTally[r.end || 'NULL'] = (endTally[r.end || 'NULL'] || 0) + 1;
    scoreSamples.push(G.lifeScore(r.end));
    if (!r.end) fails.push('第 ' + i + ' 世无结局键');
  } catch (e) {
    fails.push('模拟第 ' + i + ' 世抛错: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
    break;
  }
}
/* ── 目标导向play：逐条路线验证可达性与主线推进 ──
   目标：验证「路线可进入」与「链可推进」，而非考验随机属性养成能否凑齐门槛。
   故对目标路线注入最小前提（世界态/事件态 + 属性 + 身份门槛），保证早龄即可入局；
   属性门槛随年龄收紧（routeReqAt 每 6 岁 +1），注入基础值 +4 缓冲以覆盖前期窗口。
   这与 zhanw 注入 乱世/军功/野心 的既有做法一致。 */
function routePrep(r, S){
  if(r.id==='zhanw'){ S.world='乱世'; S.flags.野心=true; S.merit=6; return; }
  if(r.id==='xian'){ S.flags.仙缘=true; return; }
  if(r.id==='duodi'){ S.royal=true; return; }
  if(r.attr){
    for(const k in r.attr){ if((S.attrs[k]||0) < r.attr[k]+4) S.attrs[k] = r.attr[k]+4; }
  }
  if(r.id==='zheng' && S.rank<1) S.rank = 1;   /* 非贱籍方可应试 */
}
const routeReach = {};
G.ROUTES.forEach(r => {
  let entered = 0, finished = 0;
  // 草莽龙兴唯乞儿可入，而乞儿 0–14 存活率仅 ≈1%，故须放大样本
  const K = r.id === 'caom' ? 20000 : 400;
  for (let i = 0; i < K; i++) {
    const cands = r.id === 'caom'
      ? G.ORIGINS.filter(o => o.beggar)
      : G.ORIGINS.filter(o => !o.beggar);
    try {
      const prep = (S => routePrep(r, S));
      const rr = simulateOneLife(G.pick(cands), r.id, prep);
      const st = G.S.routes[r.id];
      if (st && st.active) {
        entered++;
        const ch = G.CHAINS[r.id];
        if (ch && st.node >= ch.nodes.length - 1) finished++;
      }
      // 幼年夭折的一世由返回值给出结局键（此时尚未写入 S.pendingEnd）
      const key = G.S.pendingEnd || rr.end || 'NULL';
      endTally[key] = (endTally[key] || 0) + 1;
      /* 草莽龙兴样本为放大 20000 世的乞儿夭折潮，计入会淹没品第分布，故排除 */
      if (r.id !== 'caom') scoreSamples.push(G.lifeScore(key));
    } catch (e) {
      fails.push('目标导向模拟(' + r.id + ')抛错: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
      break;
    }
  }
  routeReach[r.id] = { entered, finished, K };
  ok(entered > 0, '路线可进入: ' + r.id + '（' + r.n + '）', entered + '/' + K);
});

ok(Object.keys(endTally).length >= 12, '结局分布具多样性', Object.keys(endTally).length + ' 种');
ok(emptyActionYears / totalActionYears < 0.02, '行动阶段几乎不空转（P0-3）',
  '空转 ' + emptyActionYears + '/' + totalActionYears);

/* ── 乞丐存活率校验（P0-8：累计 ≈1%） ── */
const beggar = G.ORIGINS.find(o => o.beggar);
let survive = 0;
const M = 20000;
for (let i = 0; i < M; i++) {
  G.newLife(beggar);
  if (G.runChildhood(beggar).alive) survive++;
}
const rate = survive / M;
ok(rate > 0.003 && rate < 0.035, '乞丐 0–14 累计存活率 ≈1%', (rate * 100).toFixed(2) + '%');

/* ── 门槛随年龄收紧（P0-5） ── */
const rShang = G.ROUTES.find(r => r.id === 'shang');
if (rShang) {
  const base = G.routeReqAt(rShang, rShang.age);
  const old = G.routeReqAt(rShang, rShang.age + 21);
  const k0 = Object.keys(base)[0];
  ok(old[k0] > base[k0] || base[k0] >= G.ATTR_CAP, '从业门槛随年龄收紧',
    k0 + ': ' + base[k0] + ' → ' + old[k0]);
  ok(Object.keys(old).every(k => old[k] <= G.ATTR_CAP), '收紧后不超过属性上限');
}

/* ── 修仙双轨（P0-9） ── */
G.newLife(G.ORIGINS[0]);
const S2 = G.S;
const baseMax = S2.healthMax;
eq(S2.xianTier, -1, '初始为凡胎（tier -1）');
ok(G.XIAN_ENTRY > 0 && G.XIAN_ENTRY < 200, '引气入体门槛可达', String(G.XIAN_ENTRY));
// 逐境补足修为后突破，验证六境阶梯全程可达
for (let t = 0; t < 6; t++) { S2.cult += 99999; G.doBreakthrough(); }
eq(S2.xianTier, 5, '可突破至渡劫（第 6 境）');
eq(S2.healthMax, G.XIAN_CAP[5], '境界改写健康上限');
ok(S2.healthMax > baseMax, '健康上限随境界抬升');
ok(S2.lifespan >= G.XIAN_LIFE[5], '境界改写寿命轴');

/* ── 金钱系统（§7） ── */
const pauperOrigin = G.ORIGINS.find(o => o.pauper);
const debtOrigin = G.ORIGINS.find(o => o.debt);
if (pauperOrigin) { G.newLife(pauperOrigin); eq(G.S.money, 0, '赤贫出身起始银钱为 0'); }
if (debtOrigin) { G.newLife(debtOrigin); eq(G.S.money, -1, '罪籍出身起始负债 -1'); }
G.newLife(G.ORIGINS.find(o => !o.pauper && !o.debt));
ok(G.S.money === 20 + G.S.attrs.财 * 15, '常规出身起始银 = 20 + 财力×15', String(G.S.money));

/* ── 属性钳制 0–10 ── */
G.newLife(G.ORIGINS[0]);
G.applyEff({ a: { 体: 99 } }, null);
eq(G.S.attrs.体, 10, '属性上限钳制为 10');
G.applyEff({ a: { 体: -99 } }, null);
eq(G.S.attrs.体, 0, '属性下限钳制为 0');

/* ── P0-9 修仙双轨全链路：入门 → 引气 → 六境 → 闭关/秘境/飞升 ── */
(function testCultivationTrack() {
  G.newLife(G.ORIGINS[0]);
  const s = G.S;
  s.flags.仙缘 = true;
  G.activateRoute('xian');
  ok(!!s.flags.修仙入门, '入修仙之门置位 修仙入门');
  const secl = G.ACTIONS.find(a => a.id === 'seclude');
  const brk = G.ACTIONS.find(a => a.id === 'break');
  const raid = G.ACTIONS.find(a => a.id === 'raid');
  const asc = G.ACTIONS.find(a => a.id === 'ascend');
  ok(secl.show(s), '① 闭关在入门后即可用');
  ok(!raid.show(s), '② 秘境须先结「练气」（tier≥0）');
  ok(brk.show(s), '③ 突破在入门后可见');

  // ③ 闭关扣当前健康 35%（D-13）
  const h0 = s.health, exp = Math.ceil(h0 * 0.35);
  const cf = secl.confirm(s);
  ok(cf.cost.indexOf(String(exp)) >= 0, 'D-13 闭关二次确认标明扣除量', cf.cost);
  ok(String(cf.left) === String(Math.floor(h0 - exp)), 'D-13 二次确认展示余下健康', String(cf.left));
  G.applyEff(secl.run(s).eff, null);
  ok(s.health <= h0 - exp + 1, '闭关确实扣除当前健康', h0 + '→' + s.health);
  ok(s.cult > 0, '闭关换得修为', String(s.cult));

  // ② 六境阶梯全通，逐级抬升上限并改写寿命轴
  const caps = [], lifes = [];
  for (let t = 0; t <= 5; t++) {
    s.cult += 99999;
    G.doBreakthrough();
    caps.push(s.healthMax); lifes.push(s.lifespan);
  }
  eq(s.xianTier, 5, '可历六境至渡劫');
  ok(caps.join(',') === G.XIAN_CAP.join(','), '健康上限逐境为 150/300/600/1200/2500/5000', caps.join(','));
  ok(lifes[5] >= G.XIAN_LIFE[5], '寿命轴被改写至渡劫之数', String(lifes[5]));
  ok(raid.show(s), '结丹后秘境开放');
  ok(asc.show(s), '⑤ 渡劫飞升在渡劫境开放');
  ok(!brk.show(s), '已至顶境则不再显示突破');

  // ⑥ 修仙此身不入传承
  const marry = G.ACTIONS.find(a => a.id === 'marry');
  const child = G.ACTIONS.find(a => a.id === 'child');
  ok(!marry.ok(s), '⑥ 修仙者不可婚配（此身不入传承）');
  s.married = true;
  ok(!child.ok(s), '⑥ 修仙者不可求嗣');

  // ④ 秘境二元：失败即陨落；⑤ 飞升/身死道消 —— 两分支均须可达
  let raidWin = 0, raidLose = 0, up = 0, down = 0;
  for (let i = 0; i < 3000; i++) {
    s.pendingEnd = null;
    const r = raid.run(s);
    if (r.eff.end === 'b18') raidLose++; else raidWin++;
  }
  ok(raidWin > 0 && raidLose > 0, '④ 秘境成败二元皆可达', raidWin + ' 成 / ' + raidLose + ' 败');
  for (let i = 0; i < 3000; i++) {
    const r = asc.run(s);
    if (r.eff.end === 'feisheng') up++; else if (r.eff.end === 'b16') down++;
  }
  ok(up > 0 && down > 0, '⑤ 飞升与身死道消皆可达', up + ' 升 / ' + down + ' 陨');

  // ③ 闭关致健康 ≤0 → 走火入魔（由次年结算收束）
  G.newLife(G.ORIGINS[0]);
  const s2 = G.S; s2.flags.仙缘 = true; G.activateRoute('xian');
  s2.health = 1;
  G.applyEff(G.ACTIONS.find(a => a.id === 'seclude').run(s2).eff, null);
  ok(s2.health <= 1, '濒危闭关后健康归零或极低', String(s2.health));
})();

/* ── 传承折算（P0-7） ── */
G.newLife(G.ORIGINS[0]);
G.S.attrs.财 = 9; G.S.attrs.望 = 8; G.S.attrs.脉 = 8;
G.addChild('经商');
const inh = G.computeInherit(0);
ok(inh.财 >= 0 && inh.财 <= 2, '遗产 财 折算在 0–2', String(inh.财));
ok(inh.望 >= 0 && inh.望 <= 2, '遗产 望 折算在 0–2', String(inh.望));
ok(Array.isArray(inh.tags), '遗产含词条数组');

/* ── P0-7 家族传承：跨代累积与 D-18 门第三档 ── */
(function testInheritance() {
  G.resetMeta();
  const seen = { g2: false, g4: false, g6: false };
  for (let gen = 1; gen <= 7; gen++) {
    const o = G.ORIGINS.find(x => !x.beggar && !x.debt);
    G.newLife(o);
    const s = G.S;
    eq(s.gen, gen, '第 ' + gen + ' 代序号递增');
    const hl = s.houseLog.join('｜');
    if (G.META.gens >= 2) { ok(hl.indexOf('家训初立') >= 0, '≥2 代解锁 家训初立'); seen.g2 = true; }
    if (G.META.gens >= 4) { ok(hl.indexOf('门第有声') >= 0, '≥4 代解锁 门第有声'); seen.g4 = true; }
    if (G.META.gens >= 6) { ok(hl.indexOf('世家气象') >= 0, '≥6 代解锁 世家气象'); seen.g6 = true; }
    if (gen > 1) ok(hl.indexOf('先人遗泽') >= 0, '第 ' + gen + ' 代继承先人遗泽');
    s.attrs.财 = 9; s.attrs.望 = 8; s.attrs.脉 = 8;
    s.age = 60; s.pendingEnd = 'pingdan';
    G.addChild('书香');
    G.commitLegacy(0);
    eq(G.META.gens, gen, 'META 代数累加至 ' + gen);
    ok(!!G.META.trainAttr, '家训属性已锁定');
  }
  ok(seen.g2 && seen.g4 && seen.g6, 'D-18 门第三档均可解锁');
  // 抄家则家产不入传承
  G.newLife(G.ORIGINS[0]);
  G.S.attrs.财 = 9; G.S.attrs.望 = 9; G.S.attrs.脉 = 9;
  G.addChild('书香');
  G.S.flags.抄家 = true;
  const ruined = G.computeInherit(0);
  ok(ruined.财 === 0 && ruined.望 === 0 && ruined.脉 === 0, '抄家后家产不入传承');
  G.resetMeta();
  G.newLife(G.ORIGINS[0]);
  eq(G.S.children.length, 0, '重立家谱后初生无子嗣');
  eq(G.S.gen, 1, '重立家谱后回到第 1 代');
})();

/* ═══════ ⑧ P1-4 结局评级与图鉴 ═══════ */
const rateDist = {};
(function testRatingAndDex() {
  /* 品第表结构 */
  eq(G.ENDING_RANKS.length, 5, '品第五等');
  G.ENDING_RANKS.forEach(r => ok(!!r.g && !!r.n && !!r.d && typeof r.min === 'number',
    '品第字段完整: ' + (r.g || '?')));
  for (let i = 1; i < G.ENDING_RANKS.length; i++) {
    ok(G.ENDING_RANKS[i].min < G.ENDING_RANKS[i - 1].min, '品第阈值单调递减 @' + i);
  }
  eq(G.ENDING_GROUPS.length, 2, '图鉴两组');
  /* 分组闭合：每个结局都能归组，且两组之和 = 全表 */
  const gcount = {};
  Object.keys(G.ENDINGS).forEach(k => {
    const g = G.endingGroupOf(k);
    ok(G.ENDING_GROUPS.some(x => x.id === g), '结局归组合法: ' + k, g);
    gcount[g] = (gcount[g] || 0) + 1;
  });
  eq((gcount.final || 0) + (gcount.mid || 0), Object.keys(G.ENDINGS).length, '图鉴分组闭合');
  ok(gcount.final >= 31, '终局 ≥31 条（含身份成就结局）', String(gcount.final));
  ok(gcount.mid >= 21, '途中凶终 ≥21 条', String(gcount.mid));

  /* endingRank 单调性与边界 */
  ok(G.endingRank(1e9).g === G.ENDING_RANKS[0].g, '极高分落天品');
  ok(G.endingRank(0).g === G.ENDING_RANKS[G.ENDING_RANKS.length - 1].g, '零分落劫品');
  let lastIdx = -1, mono = true;
  for (let s = 0; s <= 2000; s += 20) {
    const idx = G.ENDING_RANKS.findIndex(r => r.g === G.endingRank(s).g);
    if (lastIdx >= 0 && idx > lastIdx) mono = false;   /* 分数升 → 序号只能变小 */
    lastIdx = idx;
  }
  ok(mono, '评级随分数单调不降');

  /* lifeScore 语义：同结局下，更长寿 / 更高位者得分更高 */
  G.resetMeta();
  const o = G.ORIGINS.find(x => !x.beggar && !x.debt);
  G.newLife(o); G.S.age = 30; G.S.rank = 1;
  const low = G.lifeScore('pingdan');
  G.newLife(o); G.S.age = 78; G.S.rank = 4;
  G.ATTRS.forEach(k => { G.S.attrs[k] = 8; });
  G.S.mind = 8; G.S.moral = 8;
  const high = G.lifeScore('qingshi');
  ok(high > low, 'lifeScore 随成就单调', high + ' vs ' + low);
  ok(G.lifeScore('pingdan') >= 0, 'lifeScore 非负');
  /* 凶终罚分生效 */
  G.newLife(o); G.S.age = 55; G.S.rank = 3;
  const asGood = G.lifeScore('qingshi'), asBad = G.lifeScore('dangzheng');
  ok(asGood > asBad, '善终计分高于凶终', asGood + ' vs ' + asBad);

  /* 图鉴录入 / 去重 / 累计 / 持久化 */
  G.resetMeta();
  eq(G.dexStat().seen, 0, '重置后图鉴为空');
  eq(G.dexStat().total, Object.keys(G.ENDINGS).length, '图鉴总数 = 结局表长度');
  G.newLife(o); G.S.age = 70; G.S.rank = 3;
  G.recordEnding('qingshi');
  eq(G.dexStat().seen, 1, '首次录入 seen=1');
  eq(G.META.dex.qingshi.c, 1, '首次计数 1');
  G.recordEnding('qingshi');
  eq(G.dexStat().seen, 1, '同结局重复不增 seen');
  eq(G.META.dex.qingshi.c, 2, '同结局次数累加');
  eq(G.dexStat().lives, 2, '历世累计');
  /* 取历史最高分 */
  const before = G.META.dex.qingshi.s;
  G.newLife(o); G.S.age = 20; G.S.rank = 0;
  G.recordEnding('qingshi');
  eq(G.META.dex.qingshi.s, before, '低分不覆盖历史最高分');
  G.newLife(o); G.S.age = 88; G.S.rank = 5;
  G.ATTRS.forEach(k => { G.S.attrs[k] = 10; });
  G.recordEnding('qingshi');
  ok(G.META.dex.qingshi.s > before, '高分刷新历史最高分');
  ok(!!G.META.dex.qingshi.g, '图鉴记录带品第');
  /* 非法键不入库 */
  const seenNow = G.dexStat().seen;
  G.recordEnding('__不存在的结局__');
  eq(G.dexStat().seen, seenNow, '非法结局键不入图鉴');
  /* localStorage 往返 */
  G.saveMeta();
  const snapshot = JSON.parse(store['dayu_house_v1']);
  ok(snapshot && snapshot.dex && snapshot.dex.qingshi, '图鉴已写入 localStorage');
  const times = G.META.dex.qingshi.c;
  G.META.dex = {}; G.META.lives = 0;
  G.loadMeta();
  ok(G.META.dex.qingshi && G.META.dex.qingshi.c === times, '图鉴可从 localStorage 复原',
    JSON.stringify(G.META.dex.qingshi));
  /* 旧存档兼容：dex / lives 字段缺失或为 null */
  store['dayu_house_v1'] = JSON.stringify({ gens: 2, year: 40, trainAttr: '才', dex: null });
  G.loadMeta();
  ok(G.META.dex && typeof G.META.dex === 'object', '旧存档兼容：dex 为 null 时补默认');
  ok(typeof G.META.lives === 'number', '旧存档兼容：lives 补默认');
  eq(G.META.gens, 2, '旧存档兼容：既有字段保留');
  ok(G.dexStat().seen === 0, '旧存档兼容：图鉴计数不抛错');
  G.resetMeta();

  /* 全 54 条结局均可被评级、且分组文案齐备 */
  G.newLife(o); G.S.age = 60;
  Object.keys(G.ENDINGS).forEach(k => {
    const sc = G.lifeScore(k);
    const rk = G.endingRank(sc);
    ok(typeof sc === 'number' && !isNaN(sc) && !!rk && !!rk.g, '结局可评级: ' + k);
  });

  /* 分布标定：随机世的品第落点应覆盖多档，且不畸形集中 */
  scoreSamples.forEach(s => { const g = G.endingRank(s).g; rateDist[g] = (rateDist[g] || 0) + 1; });
  ok(Object.keys(rateDist).length >= 3, '品第分布覆盖 ≥3 档', Object.keys(rateDist).join('/'));
  const top = Math.max(...Object.values(rateDist)) / scoreSamples.length;
  ok(top < 0.97, '品第分布未全部塌陷于单档', (top * 100).toFixed(1) + '%');
})();

/* ═══════ 输出 ═══════ */
console.log('\n════════ 自检结果 ════════');
console.log('断言通过：' + pass);
console.log('断言失败：' + fails.length);
if (fails.length) {
  console.log('\n─── 失败明细（前 40 条）───');
  fails.slice(0, 40).forEach(f => console.log('  ✗ ' + f));
}
console.log('\n─── 路线可达性（每条 400 世 · 目标导向）───');
Object.entries(routeReach).forEach(([id, v]) => {
  const r = G.ROUTES.find(x => x.id === id);
  console.log('  ' + id.padEnd(7) + (r ? r.n : '').padEnd(6) + (r.kind || '').padEnd(4) +
    ' 入线 ' + String(v.entered).padStart(3) + '/' + v.K +
    '   通关主线 ' + String(v.finished).padStart(3));
});
console.log('\n─── 行动使用分布 ───');
console.log('  空转年占比：' + (emptyActionYears / totalActionYears * 100).toFixed(2) + '%');
Object.entries(actionsSeen).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  const a = G.ACTIONS.find(x => x.id === k);
  console.log('  ' + String(v).padStart(6) + '  ' + k.padEnd(10) + (a ? a.n : ''));
});
console.log('\n─── 结局分布（含目标导向共 ' + Object.values(endTally).reduce((a, b) => a + b, 0) + ' 世）───');
Object.entries(endTally).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => {
  const nm = G.ENDINGS[k] ? G.ENDINGS[k].n : '（未定义）';
  console.log('  ' + String(v).padStart(5) + '  ' + k.padEnd(16) + nm);
});
console.log('\n─── 品第分布 / 阈值标定（' + scoreSamples.length + ' 世）───');
function quantiles(arr, label) {
  const s = arr.slice().sort((a, b) => a - b);
  const q = p => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  console.log('  ' + label.padEnd(10) + 'n=' + String(s.length).padStart(5) +
    '  p30=' + String(q(.30)).padStart(4) + '  p50=' + String(q(.50)).padStart(4) +
    '  p70=' + String(q(.70)).padStart(4) + '  p92=' + String(q(.92)).padStart(4) +
    '  p99=' + String(q(.99)).padStart(4) + '  max=' + s[s.length - 1]);
}
quantiles(scoreSamples.slice(0, N), '随机play');
quantiles(scoreSamples.slice(N), '目标导向');
quantiles(scoreSamples, '合计');
G.ENDING_RANKS.forEach(r => {
  const c = rateDist[r.g] || 0;
  console.log('  ' + r.n + ' (≥' + String(r.min).padStart(5) + ')  ' +
    String(c).padStart(6) + '  ' + (c / scoreSamples.length * 100).toFixed(2) + '%');
});
console.log('\nIS_PASS: ' + (fails.length === 0 ? 'YES' : 'NO'));
process.exit(fails.length === 0 ? 0 : 1);
