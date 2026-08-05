/* ═══════════════════════════════════════════════════════════════════
   第二层 · 引擎（ENGINE）——四阶段管线：结算 → 事件 → 行动 → 更新
   ═══════════════════════════════════════════════════════════════════ */

/* ───────── 工具 ───────── */
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function ri(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }
function chance(p){ return Math.random()<p; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function mix(a,b){ var o={},k; for(k in a)o[k]=a[k]; for(k in b)o[k]=(o[k]||0)+b[k]; return o; }
function L(n){ return '<span class="lat">'+n+'</span>'; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
/* 凡人(-1) → 练气(0) 走「引气入体」门槛；练气及以上按 XIAN_NEED 阶梯；渡劫(5) 已至顶无下一境 */
function xianNeed(t){
  if(t<0) return XIAN_ENTRY;
  return XIAN_NEED[t]!==undefined?XIAN_NEED[t]:99999;
}
function xianRaidRate(s){ return clamp(.45+s.xianTier*.03+(s.mind-5)*.02, .25, .75); }        /* D-14 */
function ascendRate(s){ return clamp(.42+(s.mind-5)*.04+(s.health/s.healthMax)*.15, .25, .80); }
function riseRate(s){ return clamp(.24+s.merit*.03+s.attrs.武*.03+s.attrs.望*.02, .15, .72); }

/* 名字池（子嗣） */
const NAMES = ['砚','昭','衡','珩','翎','珏','岐','澈','徵','稷','翊','曜','沅','旸','钰','霁'];

/* ───────── 全局 · 家族档案（跨代 meta，localStorage 兜底） ─────────
   dex   ：结局图鉴（P1-4）—— { 结局id: {c:遇见次数, s:最高得分, g:最高品第, a:享年} }
   lives ：累计游玩世数（含幼殇／乞丐夭折） */
function metaDefaults(){
  return { gens:0, year:17, trainAttr:null, houseTags:[], lastEnding:null,
           dex:{}, dexId:{}, dexDeath:{}, lives:0 };
}
let META = metaDefaults();
function loadMeta(){
  try{ const raw = localStorage.getItem('dayu_house_v1');
    if(raw){ const o=JSON.parse(raw); if(o&&typeof o==='object') META=Object.assign(META,o); }
  }catch(e){ /* file:// 下 localStorage 可能不可用，静默降级 */ }
  if(!META.dex || typeof META.dex!=='object') META.dex = {};   // 旧存档兼容
  /* 图鉴双维（规格 §3.5）：dexId＝成就卷（身份）· dexDeath＝死法卷。旧档缺字段则补空。 */
  if(!META.dexId || typeof META.dexId!=='object') META.dexId = {};
  if(!META.dexDeath || typeof META.dexDeath!=='object') META.dexDeath = {};
  if(typeof META.lives!=='number') META.lives = 0;
}
function saveMeta(){
  try{ localStorage.setItem('dayu_house_v1', JSON.stringify(META)); }catch(e){}
}
function resetMeta(){ META = metaDefaults(); saveMeta(); }

/* ───────── 运行时状态 ───────── */
let S = null;
let DRAW = { pool:[], round:1, maxRound:3, selected:null };
let INHERIT = null;                                  /* 上一代遗产（跨代，可重新赋值） */
const LUCKY = (function(){ try{ return new URLSearchParams(location.search).get('fate')==='lucky'; }catch(e){ return false; } })();

/* ───────── 出身抽取（加权 · D-08） ───────── */
function originWeight(o){
  let cnt = 0; for(let i=0;i<ORIGINS.length;i++) if(ORIGINS[i].t===o.t) cnt++;
  return TIER_WEIGHT[o.t]/cnt;                        /* 层级权重均分到该层各项 → 全量 24 项均可抽中 */
}
function drawOrigins(n){
  const pool = ORIGINS.slice(), out = [];
  while(out.length<n && pool.length){
    let total=0; for(let i=0;i<pool.length;i++) total+=originWeight(pool[i]);
    let r=Math.random()*total, idx=0;
    for(let i=0;i<pool.length;i++){ r-=originWeight(pool[i]); if(r<=0){ idx=i; break; } }
    out.push(pool.splice(idx,1)[0]);
  }
  return out;
}

/* ───────── 初始化一世 ───────── */
function newLife(origin){
  const attrs={}; ATTRS.forEach(function(k){ attrs[k]=3; });                 /* D-02 基准 3 */
  for(const k in origin.off) attrs[k]+=origin.off[k];

  let rank = origin.rank;
  const houseLog = [];

  /* 门第永久加成（D-18） */
  if(META.gens>=2 && META.trainAttr){ attrs[META.trainAttr]+=1; houseLog.push('家训初立：'+META.trainAttr+' ＋1'); }
  if(META.gens>=4){ attrs.望+=1; attrs.脉+=1; houseLog.push('门第有声：望 ＋1 · 脉 ＋1'); }
  if(META.gens>=6 && rank<2){ rank=2; houseLog.push('世家气象：初始身份提至 士商'); }

  /* 上一代遗产 */
  const inhTags=[];
  if(INHERIT){
    attrs.财+=INHERIT.财; attrs.望+=INHERIT.望; attrs.脉+=INHERIT.脉;
    INHERIT.tags.forEach(function(t){ inhTags.push(t); });
    houseLog.push('先人遗泽：财 ＋'+INHERIT.财+' · 望 ＋'+INHERIT.望+' · 脉 ＋'+INHERIT.脉);
  }
  ATTRS.forEach(function(k){ attrs[k]=clamp(attrs[k],0,10); });               /* clamp 0–10 */

  const life = clamp(55+ri(0,20)+attrs.体, 40, 85);                           /* D-03 */
  const hmax = Math.min(100, 60+attrs.体*5);                                  /* D-04 */

  S = {
    gen: META.gens+1, baseYear: META.year, age:0,
    sex: origin.sex || (chance(.5)?'男':'女'),                                /* D-12 仅影响称谓 */
    originId: origin.id, originName: origin.n, tier: origin.t, royal: !!origin.royal,
    attrs: attrs, mind:5, moral:5, lifespan:life,
    health: hmax, healthMax: hmax, money: origin.debt ? -1 : (origin.pauper ? 0 : 20 + attrs.财*15),
    rank: rank, tags: origin.tags.concat(inhTags), flags:{}, pauper:!!origin.pauper, debt:!!origin.debt,
    world: chance(.3)?'乱世':'治世',
    merit:0, incense:0, cult:0, xianTier:-1,
    married:false, children:[],
    routes:{}, phase:'idle', queue:[], actionDone:false, ended:false, pendingEnd:null,
    fate:null, fateLastYear:-1,                              /* 机遇卡槽 */
    evLast:{},                                               /* 事件上次触发年龄（统计用；冷却以 flags.cd_* 为准） */
    /* ── 身份生涯（规格 §3.1）：身份达成 ≠ 游戏结束，只有死亡才结算 ── */
    identity:null,                                           /* 当前身份 id（IDENTITIES 键） */
    identityAge:-1,                                          /* 达成身份时的年龄 */
    reignYears:0,                                            /* 居此位年数（帝王即在位年数） */
    log:[], houseLog: houseLog, narr:{t:'', b:''}, deaths:[]
  };
  if(origin.beggar) S.flags.乞儿=true;
  return S;
}

/* ───────── 幼年（0–5 蒙太奇 / 乞丐 0–14 逐年检定） ───────── */
function runChildhood(origin){
  if(origin.beggar) return runBeggarGauntlet(origin);

  const lines = [
    '襁褓之中，冬夜的风从窗纸破处灌进来。',
    '「'+origin.hook+'」——你睁眼看见的第一片天，就是这个样子。',
    '五岁上能记住三十个字，也能记住谁家的狗最凶。'
  ];
  pushLog(0,'生于'+(S.world==='乱世'?'乱世':'治世')+'，出身'+origin.n,'key');
  pushLog(3, lines[1], '');
  S.age = 6;
  pushLog(6, '六岁。蒙学既启，人生自此逐年计。', 'key');
  S.narr = { t:'幼　年', b:'<p>'+lines[0]+'</p><p>'+lines[1]+'</p><p>'+lines[2]+'</p>' };
  return {alive:true};
}

/* P0-8 孤儿乞丐：0–14 逐年独立死亡检定，累计存活 ≈1%（?fate=lucky → ≈20%） */
function runBeggarGauntlet(origin){
  const target = LUCKY ? 0.20 : 0.01;
  const p = Math.pow(target, 1/15);                    /* 每年独立存活率 */
  const rows = []; let alive = true, dieAge = -1;
  const causes = ['冻毙于破庙','疫死于流民棚','饿殍于市口','为官差杖毙','溺于取水的河','为野犬所噬'];
  pushLog(0, '生于'+(S.world==='乱世'?'乱世':'治世')+'，孤儿乞丐。父母俱不可考。', 'key');
  for(let a=0;a<=14;a++){
    if(chance(p)){ rows.push({age:a, txt:pick(['讨到半块冷炊饼','在灶灰里睡了一夜','捡到一只破碗','躲过了收容的官差','分到一勺庙里的粥','跟着流民走了三十里']), live:true}); }
    else { alive=false; dieAge=a; rows.push({age:a, txt:pick(causes), live:false}); break; }
  }
  S.age = alive ? 15 : dieAge;
  rows.forEach(function(r){ pushLog(r.age, r.txt, r.live?'':'bad'); });
  S.gauntlet = { rows: rows, alive: alive, target: target };
  if(alive){
    S.flags.乞儿存活 = true;
    pushLog(15, '活过了十五岁。同庙的七个孩子，只剩你一个。', 'key');
    S.narr = { t:'乞儿求生', b:'<p>十五年，一千八百次讨食，七次濒死。破庙里的七个孩子，如今只剩你一个。</p><p>这本身已是一桩不可思议的事。</p>' };
  }
  return {alive:alive, dieAge:dieAge};
}

/* ───────── 日志 ───────── */
function pushLog(age, txt, kind){ S.log.push({age:age, txt:txt, kind:kind||''}); }

/* ───────── 效果应用（唯一写入口） ───────── */
function applyEff(eff, ctx){
  if(!eff) return [];
  const deltas = [];
  if(eff.a){ for(const k in eff.a){
    const before = S.attrs[k];
    let delta = eff.a[k];
    /* §2.5 规则 B · 边际递减：高位（≥7）正增益减半，7→8 需两次 +1，上限方有含金量。
       负向不减，财帛以银计另走 eff.money，不受此限。 */
    if(before>=7 && delta>0) delta = Math.max(1, Math.floor(delta/2));
    S.attrs[k] = clamp(S.attrs[k]+delta, 0, 10);
    const real = S.attrs[k]-before;
    if(real!==0) deltas.push({k:k, v:real});
  }}
  if(eff.h){ const b=S.health; S.health = clamp(S.health+eff.h, -999, S.healthMax);
             if(S.health-b!==0) deltas.push({k:'健康', v:S.health-b}); }
  if(eff.mind){ const b=S.mind; S.mind=clamp(S.mind+eff.mind,0,10);
                if(S.mind-b!==0) deltas.push({k:'心境', v:S.mind-b}); }
  if(eff.moral){ const b=S.moral; S.moral=clamp(S.moral+eff.moral,0,10);
                 if(S.moral-b!==0) deltas.push({k:'道德', v:S.moral-b}); }
  if(eff.life){ S.lifespan+=eff.life; deltas.push({k:'寿数', v:eff.life}); }
  if(eff.merit){ S.merit=Math.max(0,S.merit+eff.merit); deltas.push({k:'军功', v:eff.merit}); }
  if(eff.incense){ S.incense=Math.max(0,S.incense+eff.incense); deltas.push({k:'香火', v:eff.incense}); }
  if(eff.cult){ S.cult=Math.max(0,S.cult+eff.cult); deltas.push({k:'修为', v:eff.cult}); }
  if(eff.money){ const b=S.money; S.money=clampMoney(S, S.money+eff.money); if(S.money-b!==0) deltas.push({k:'财帛', v:S.money-b}); }
  if(eff.rank!==undefined && eff.rank>S.rank){ S.rank=eff.rank; pushLog(S.age,'身份升至「'+RANKS[S.rank]+'」','key'); }
  if(eff.tags) eff.tags.forEach(function(t){ if(S.tags.indexOf(t)<0) S.tags.push(t); });
  if(eff.flags) eff.flags.forEach(function(f){
    S.flags[f]=true;
    /* P0-2 已婚 Bug（规格 §2.1）：全引擎判定读 S.married，而事件只写 flags['已婚']。
       此处同步置位，一并修复「婚配年年可触发／子嗣永不出生／徽章不显／岁出少计 4 银」。 */
    if(f==='已婚') S.married = true;
  });

  /* 贬为庶民（D-17：留 50% 人脉、清零 70% 财力、声望降至 1） */
  if(eff.demote){
    S.rank = 1;
    S.attrs.脉 = Math.floor(S.attrs.脉*0.5);
    S.attrs.财 = Math.floor(S.attrs.财*0.3);
    S.attrs.望 = 1;
    S.flags.获罪 = true;
    pushLog(S.age,'削职为民。旧日门生故吏，十去其半。','bad');
    deltas.push({k:'望',v:-1});
  }
  /* 抄家 */
  if(eff.ruin){
    S.attrs.财 = 0; S.attrs.望 = 0; S.rank = Math.min(S.rank,1);
    S.flags.家族破败 = true; S.flags.抄家 = true;
    pushLog(S.age,'抄没家产，籍其田宅。','bad');
  }
  /* 子嗣 */
  if(eff.child){ addChild(eff.child); }
  /* 奇遇引仙缘（极小概率） */
  if(eff.maybeXian && S.flags.家族破败 && S.flags.九死一生 && !S.flags.仙缘 && chance(.35)){
    S.flags.仙缘 = true; pushLog(S.age,'那册无题抄本，夜里似乎自己翻了一页。','key');
  }
  /* 修仙突破 */
  if(eff.breakthrough) doBreakthrough();
  /* 开启路线 */
  if(eff.route) activateRoute(eff.route, true);
  /* 推进主线节点：goto 为绝对跳转（分支线用，优先级高于 adv），adv 为相对推进 */
  if(eff.goto!==undefined && ctx && ctx.rid && S.routes[ctx.rid]){
    S.routes[ctx.rid].node = eff.goto; S.routes[ctx.rid].lastAge = S.age;
  }else if(eff.adv && ctx && ctx.rid && S.routes[ctx.rid]){
    S.routes[ctx.rid].node += 1; S.routes[ctx.rid].lastAge = S.age;
  }
  /* 显式退出路线（v1.6）：无 adv 的「退出」选项会让节点原地空转、事件年年复现。
     置 quit 后本路线离线，链上事件不再派发；相关 flags 仍保留，供身份／结局判定读取。 */
  if(eff.quit && ctx && ctx.rid && S.routes[ctx.rid]){
    S.routes[ctx.rid].active = false;
    const rq = ROUTES.filter(function(x){return x.id===ctx.rid;})[0];
    if(rq) pushLog(S.age, '自此不复问「'+rq.n+'」事。', '');
  }
  /* 身份达成（规格 §2.6-2）：只立身份，不置 pendingEnd —— 身份达成 ≠ 游戏结束 */
  if(eff.identity) setIdentity(eff.identity);
  /* 结局（仅死亡向） */
  if(eff.end) S.pendingEnd = eff.end;
  /* 效果落定后统一巡检身份达成条件（规格 §3.2 注） */
  if(!S.ended && !S.pendingEnd) checkIdentity();
  return deltas;
}

/* ═════════ 身份生涯系统（规格 §2.6 / §3） ═════════ */

/* 立身份：pri 越小越尊，低阶不覆盖高阶；不置 pendingEnd */
function setIdentity(id){
  if(!S) return false;
  const ent = (typeof IDENTITIES!=='undefined') ? IDENTITIES[id] : null;
  if(!ent) return false;
  if(S.identity===id) return false;
  const cur = S.identity ? IDENTITIES[S.identity] : null;
  if(cur && cur.pri <= ent.pri) return false;
  S.identity = id; S.identityAge = S.age; S.reignYears = 0;
  pushLog(S.age, '一生达成：'+ent.n+'。'+(ent.log||''), 'key');
  return true;
}
/* 按 §3.2 达成条件表巡检（语义自 judgeNaturalDeath 原第一段迁移，未重写） */
function checkIdentity(){
  if(!S || typeof IDENTITIES==='undefined') return null;
  let best = null;
  for(const id in IDENTITIES){
    const ent = IDENTITIES[id];
    if(!ent.cond || !ent.cond(S)) continue;
    if(best===null || ent.pri < IDENTITIES[best].pri) best = id;
  }
  if(!best) return null;
  const cur = S.identity ? IDENTITIES[S.identity] : null;
  if(cur && cur.pri <= IDENTITIES[best].pri) return null;
  return setIdentity(best) ? best : null;
}
/* 成就铭文（结局键）：身份 → 善终型判词。
   草莽天子仅归「孤儿乞丐出身」者；非乞丐走帝王线者为雄主守成（规格 §2.6-4 注 + 用户诉求②）。 */
function achievementEnding(){
  if(!S || !S.identity || typeof IDENTITIES==='undefined') return null;
  /* 帝王五途（v1.6 · 青史）：同为「帝王」，得国之由不同，铭文亦不同。
     判定顺序即合法性由「无」到「有」：夺位 > 布衣开国 > 军阀开国 > 承袭守成。 */
  if(S.identity==='diwang'){
    if(S.flags.玄武门)   return 'xuanwu';         /* 嫡争 · 宫门之变 */
    if(S.flags.靖难即位) return 'jingnan';        /* 靖难 · 藩镇夺位 */
    if(S.flags.乞儿)     return 'caomangtianzi';  /* 布衣 · 草莽天子 */
    return 'xiongzhu';                            /* 军阀开国 / 承袭 · 雄主守成 */
  }
  const ent = IDENTITIES[S.identity];
  if(!ent) return null;
  const a = (typeof ent.ach==='function') ? ent.ach(S) : ent.ach;
  return (a && typeof ENDINGS!=='undefined' && ENDINGS[a]) ? a : null;
}

function addChild(tag){
  const g = chance(.5)?'子':'女';
  S.children.push({ name:'第'+(S.children.length+1)+g+' · '+pick(NAMES), tag:tag,
    talent: pick(['早慧','敦厚','机敏','沉毅','疏阔']) });
  pushLog(S.age, '添'+g+'一人，携 [' +tag+ '] 之质。', '');
}

function doBreakthrough(){
  if(S.xianTier>=5) return;
  const need = xianNeed(S.xianTier);
  if(S.cult<need) return;
  S.cult -= need; S.xianTier += 1;
  S.healthMax = XIAN_CAP[S.xianTier];
  S.health = S.healthMax;
  S.lifespan = Math.max(S.lifespan, XIAN_LIFE[S.xianTier]);
  pushLog(S.age, '境界破至「'+XIAN_TIERS[S.xianTier]+'」，寿元与形骸俱易。', 'key');
}

/* ───────── 机遇卡派发 / 渲染 / 触发 ───────── */
const KIND_TAG = {商:'商贾',文:'文士',武:'武勇',医:'医道',堂:'庙堂',心:'心境',灾:'祸福',奇:'奇遇'};
function drawFate(){
  const groups = fateGroupWeights(S);
  /* 过滤掉不满足 show 的卡 */
  const pool = FATE_CARDS.filter(function(c){ return !c.show || c.show(S); });
  if(!pool.length) return;
  /* 加权抽取 */
  let total = 0;
  pool.forEach(function(c){ total += (c.weight||1) * (groups[c.kind]||1); });
  let r = Math.random()*total, chosen = pool[0];
  for(let i=0;i<pool.length;i++){
    r -= (pool[i].weight||1) * (groups[pool[i].kind]||1);
    if(r<=0){ chosen = pool[i]; break; }
  }
  S.fate = { id: chosen.id, n: chosen.n, d: chosen.d, eff: chosen.eff, kind: chosen.kind, drawnAge: S.age };
}
function fateEffText(eff){
  const parts = [];
  if(eff.a){ for(const k in eff.a){ const v=eff.a[k]; parts.push((v>0?'＋':'－')+ATTR_FULL[k]+' '+Math.abs(v)); } }
  if(eff.h){ parts.push((eff.h>0?'＋':'－')+'健康 '+Math.abs(eff.h)); }
  if(eff.mind){ parts.push((eff.mind>0?'＋':'－')+'心境 '+Math.abs(eff.mind)); }
  if(eff.moral){ parts.push((eff.moral>0?'＋':'－')+'道德 '+Math.abs(eff.moral)); }
  if(eff.cult){ parts.push('＋修为 '+eff.cult); }
  if(eff.tags && eff.tags.length){ parts.push('词条：'+eff.tags.join('／')); }
  if(eff.flags && eff.flags.length){ parts.push('秘：'+eff.flags.join('／')); }
  return parts.join(' · ');
}
function onFateClick(){
  if(S.phase!=='idle' || S.ended || !S.fate) return;
  const c = S.fate;
  const eff = c.eff;
  const deltas = applyEff(eff, null);
  pushLog(S.age, '机遇「'+c.n+'」：'+c.d, 'key');
  toast('机遇 · '+c.n, deltas.map(function(d){ return (d.v>0?'＋':'－')+d.k+' '+Math.abs(d.v); }).join(' · '), 'gain');
  S.fate = null;
  if(S.pendingEnd){ setTimeout(finishToEnding, 500); return; }
  render();
}

/* ───────── 路线三因子判定 ───────── */
function routeState(r){
  const st = S.routes[r.id];
  if(st && st.active) return 'active';
  if(!r.vis(S)) return 'hidden';
  if(r.id==='zheng' && S.rank===0) return 'locked';
  const okAge  = S.age >= r.age;
  const req = routeReqAt(r, S.age);
  const okAttr = Object.keys(req).every(function(k){ return S.attrs[k] >= req[k]; });
  const okCond = r.cond(S);
  return (okAge && okAttr && okCond) ? 'ready' : 'locked';
}
function routeGap(r){
  const parts = [];
  if(r.id==='zheng' && S.rank===0) return r.denyText;
  if(S.age < r.age) parts.push('年龄未至 [['+r.age+']]');
  const req = routeReqAt(r, S.age);
  for(const k in req){ const d = req[k]-S.attrs[k]; if(d>0) parts.push('缺 '+k+' [['+d+']]'); }
  if(!r.cond(S)) parts.push(r.condText);
  return parts.length?parts.join(' · '):'条件已足';
}
/* ── 专精约束（v1.6 F-R3）───────────────────────────────────────────
   明线（jun/shang/zheng/yi）同刻至多 2 条，且须为 COMBO_WHITELIST 中的合法组合；
   非法组合触发「转途」：旧明线离线、节点归零，一生只在履历上留个痕。
   暗线（xian/zong/duodi/zhanw/caom）不占明线额度。 */
const BRIGHT_ROUTES = ['jun','shang','zheng','yi'];
function isBright(id){ return BRIGHT_ROUTES.indexOf(id) >= 0; }
function activeBrightIds(){
  return BRIGHT_ROUTES.filter(function(id){ return S.routes[id] && S.routes[id].active; });
}
function comboAllowed(a, b){
  return COMBO_WHITELIST.some(function(pair){
    return (pair[0]===a && pair[1]===b) || (pair[0]===b && pair[1]===a);
  });
}
/* 返回：'ok' 可直接兼修 · 'switch' 需转途（会顶掉旧明线） · null 非明线 */
function comboCheck(id){
  if(!isBright(id)) return null;
  const cur = activeBrightIds().filter(function(x){ return x!==id; });
  if(cur.length===0) return 'ok';
  if(cur.length===1 && comboAllowed(cur[0], id)) return 'ok';
  return 'switch';
}
function activateRoute(id, silent){
  if(S.routes[id] && S.routes[id].active) return;
  /* F-R3：明线超额或组合非法 → 转途，旧明线离线 */
  if(comboCheck(id)==='switch'){
    activeBrightIds().forEach(function(old){
      if(old===id) return;
      S.routes[old].active = false;
      S.routes[old].node   = 0;
      const ro = ROUTES.filter(function(x){return x.id===old;})[0];
      if(ro) pushLog(S.age, '转途：舍「'+ro.n+'」而就他业。前功尽在履历，不在手上。', 'bad');
    });
  }
  S.routes[id] = { active:true, node:0, lastAge:-99 };
  S.flags.mundane = false;                          /* 入仕途即脱离「碌碌」 */
  const r = ROUTES.filter(function(x){return x.id===id;})[0];
  if(r) pushLog(S.age, '入「'+r.n+'」之途。', 'key');
  if(id==='xian') S.flags.修仙入门 = true;
}
/* 从业要求随年龄变严（v1.6 F-R2：7 岁 → 6 岁一档，收紧大器晚成）：
   每过 6 岁，各属性门槛 +1，至 ATTR_CAP 封顶 */
function routeReqAt(r, age){
  const out = {};
  for(const k in r.attr){
    const extra = Math.floor(Math.max(0, age - (r.age||18)) / 6);
    out[k] = Math.min(ATTR_CAP, r.attr[k] + extra);
  }
  return out;
}
function activeRouteId(){
  for(const id in S.routes){ if(S.routes[id] && S.routes[id].active) return id; }
  return null;
}
/* 主业：明线取节点推进最深者，无明线则取任一在线暗线 */
function primaryRouteId(){
  const br = activeBrightIds();
  if(br.length){
    return br.sort(function(x,y){ return (S.routes[y].node||0)-(S.routes[x].node||0); })[0];
  }
  return activeRouteId();
}
/* 岁入 / 岁出（引入金钱，为后续「用钱买道具/属性」铺垫） */
/* 单条路线的岁入贡献（F-6 岁入合并的基元） */
function routeIncome(r){
  if(r==='shang') return 18 + S.attrs.财*10;
  if(r==='zheng') return 12 + S.attrs.望*4;
  if(r==='jun')   return 10 + S.merit*2;
  if(r==='yi')    return 8  + S.attrs.才*3;
  if(r==='xian')  return 4;
  if(r==='zong')  return 6  + S.incense;
  if(r==='caom'||r==='duodi'||r==='zhanw') return 30;
  return 0;
}
function yearEconomy(){
  /* F-6 岁入合并：主业全额 + 其余在线路线各 60%。
     兼修的收益优势由此显性化，同时不至于让两条线简单翻倍。 */
  const main = primaryRouteId();
  let inc = S.attrs.财 * 6;
  if(main) inc += routeIncome(main);
  for(const id in S.routes){
    if(!S.routes[id] || !S.routes[id].active || id===main) continue;
    inc += Math.round(routeIncome(id) * 0.6);
  }
  if(S.flags.mundane) inc = 4 + Math.floor(S.attrs.财*1.5);   /* 碌碌：几乎无进项 */
  inc += S.rank * 3;
  let exp = 6 + Math.floor(S.age/15)*3 + (S.married?4:0) + S.children.length*2;
  if(S.flags.mundane) exp += 8;                                 /* 无产业支撑，坐吃山空 */
  if(S.pauper||S.debt) exp += 4;                                /* 赤贫／负债：苛捐杂税、糊口之需 */
  const wf = (S.world==='乱世')?0.7:1;
  const incR = Math.round(inc*wf), expR = Math.round(exp*wf);
  return { inc:incR, exp:expR, net:incR-expR };
}

/* 银钱地板（§7）：贫户与罪籍可欠债至 −30，其余人止于 0。
   结算与即时效果必须共用同一套地板，否则罪籍（起始 −1）吃到扣钱反而回升到 0，惩罚变奖励。 */
function moneyFloor(s){ return (s.pauper || s.debt) ? -30 : 0; }
function clampMoney(s, v){ return Math.max(moneyFloor(s), v); }

/* ───────── 阶段 ①：结　算 ───────── */
function decayFor(age){
  if(age<15) return 0;
  if(age<=35) return ri(1,2);
  if(age<=55) return ri(3,4);
  return ri(5,8);
}
/* §2.4 年龄衰减：盛年一过，体魄与才思逐年折损，压制「越老越强」的曲线畸变。
   40 起 体 每 5 年 −1；50 起 武／魅 每 5 年 −1；60 起 才／智 每 5 年 −1；
   低于 3 不再扣（保底不至于让晚年角色瘫痪成 0）。返回本年实际衰减的维名。 */
function ageDecay(age, attrs){
  const hit = [];
  const cut = function(start, span, ks){
    if(age >= start && (age-start) % span === 0){
      ks.forEach(function(k){ if(attrs[k] > 3){ attrs[k] -= 1; hit.push(k); } });
    }
  };
  cut(40, 5, ['体']);
  cut(50, 5, ['武','魅']);
  cut(60, 5, ['才','智']);
  return hit;
}
function doSettle(){
  S.age += 1;
  const notes = [];
  /* 居位年数（§3.1）：身份既立，逐年累加，帝王即在位年数 */
  if(S.identity) S.reignYears += 1;

  /* 世界状态漂移（P1-3 治世／乱世） */
  if(chance(.07)){ S.world = (S.world==='治世')?'乱世':'治世';
    notes.push({t:'世道',x:'天下入'+S.world, c:(S.world==='乱世'?'danger':'gain')});
    pushLog(S.age, '天下入'+S.world+'。', 'key'); }

  /* 健康衰减（修仙境界降低衰减） */
  let dec = decayFor(S.age);
  if(S.xianTier>=0) dec = Math.max(0, Math.round(dec*(1-(S.xianTier+1)*0.22)));
  if(dec>0){ S.health = clamp(S.health-dec, -999, S.healthMax);
    notes.push({t:'年岁',x:'健康 －'+dec, c:'loss'}); }
  if(S.age>55 && S.xianTier<0 && chance(.22)){
    const ill = ri(3,9); S.health -= ill;
    notes.push({t:'病痛',x:'偶感风寒，健康 －'+ill, c:'loss'});
    pushLog(S.age, '偶感风寒，卧床旬日。', ''); }

  /* 年龄衰减（§2.4）：修仙者形骸已易，不受此限 */
  if(S.xianTier<0){
    const worn = ageDecay(S.age, S.attrs);
    if(worn.length){
      notes.push({t:'岁月', x:worn.map(function(k){return k+' －1';}).join(' · '), c:'loss'});
      pushLog(S.age, '镜中鬓已星星。'+worn.join('、')+'不复当年。', '');
    }
  }

  /* 寿命检定 */
  if(S.health<=0){ S.pendingEnd = judgeNaturalDeath(true); return notes; }
  if(S.age>=S.lifespan){ S.pendingEnd = judgeNaturalDeath(false); return notes; }

  /* 家族破败闸门 & 仙缘 */
  if(!S.flags.家族破败 && S.attrs.财<=1 && S.attrs.望<=1 && S.age>=16){
    S.flags.家族破败 = true; notes.push({t:'家门',x:'家道已尽', c:'danger'}); }
  if(S.flags.家族破败 && S.health<=Math.round(S.healthMax*0.22) && !S.flags.九死一生){
    S.flags.九死一生 = true; notes.push({t:'绝境',x:'九死一生', c:'danger'}); }
  if(S.flags.家族破败 && S.flags.九死一生 && !S.flags.仙缘 && !S.flags.弃仙缘 && chance(.12)){
    S.flags.仙缘 = true; notes.push({t:'？',x:'冥冥中似有所感', c:'gain'}); }
  /* 宗教顿悟闸门 */
  if(!S.flags.顿悟 && S.mind>=8 && S.age>=20 && chance(.10)){
    S.flags.顿悟 = true; notes.push({t:'心',x:'忽有所悟', c:'gain'}); }
  /* 野心 */
  if(!S.flags.野心 && S.merit>=5 && S.world==='乱世' && chance(.35)) S.flags.野心 = true;

  /* 财帛收支（岁入/岁出） */
  const eco = yearEconomy();
  S.money = clampMoney(S, S.money + eco.net);
  notes.push({t:'财帛', x:(eco.net>=0?('岁入 ＋'+eco.net):('岁出 －'+(-eco.net)))+' 银', c: eco.net>=0?'gain':'loss'});

  /* 机遇卡派发：每 3 年（age>=6 且距上次派发 ≥3 年）· 槽位空才发 */
  if(!S.fate && S.age>=6 && S.age-S.fateLastYear>=3){ drawFate(); S.fateLastYear=S.age; }

  return notes;
}

/* ───────── 阶段 ②：事　件（加权抽 0–2 条） ─────────
   §2.2 冷却：未显式声明 cd 者按类型取默认——危机 5 年，其余（通用／日常／奇遇／生涯）3 年。
   冷却以 flags['cd_'+id] 记「解禁年龄」，evLast 仅留作统计。once 事件另由 flags['ev_'+id] 永久锁。 */
const CD_CRISIS = 5, CD_NORMAL = 3;
function eventCD(e){
  if(e.once) return 0;                                   /* 一生一次者无须冷却 */
  if(typeof e.cd === 'number') return e.cd;
  return (e.type==='危机') ? CD_CRISIS : CD_NORMAL;
}
function eventReady(e){
  if(e.once && S.flags['ev_'+e.id]) return false;
  const until = S.flags['cd_'+e.id];
  if(until!==undefined && S.age < until) return false;
  return !e.when || e.when(S);
}
function markEvent(e){
  S.flags['ev_'+e.id] = true;
  S.evLast[e.id] = S.age;
  const cd = eventCD(e);
  if(cd>0) S.flags['cd_'+e.id] = S.age + cd;
}
/* 加权抽一条（w 缺省视作 1） */
function weightedPick(pool){
  let total=0; pool.forEach(function(e){ total += (typeof e.w==='function' ? e.w(S) : (e.w||1)); });
  if(total<=0) return pool[0];
  let r = Math.random()*total;
  for(let i=0;i<pool.length;i++){
    r -= (typeof pool[i].w==='function' ? pool[i].w(S) : (pool[i].w||1));
    if(r<=0) return pool[i];
  }
  return pool[pool.length-1];
}
function pickEvents(){
  const q = [];
  /* 主线节点（每年至多 1 条） */
  for(const rid in S.routes){
    const st = S.routes[rid]; if(!st.active) continue;
    const chain = CHAINS[rid]; if(!chain) continue;
    const node = chain.nodes[st.node]; if(!node) continue;
    if(S.age>=(node.minAge||0) && (S.age-(st.lastAge||-99))>=(node.gap||2)){
      q.push({kind:'main', rid:rid, ev:node}); break;
    }
  }
  /* 生涯事件（§3.4）：身份既立，其位其忧。每年至多 1 条，优先于通用池 */
  if(S.identity && typeof CAREER!=='undefined' && CAREER[S.identity] && CAREER[S.identity].length){
    const cp = CAREER[S.identity].filter(eventReady);
    if(cp.length && chance(q.length?0.55:0.90)){
      const chosen = weightedPick(cp);
      markEvent(chosen);
      q.push({kind:'career', ev:chosen});
    }
  }
  /* 通用事件 */
  if(q.length<2){
    const gp = GENERAL.filter(eventReady);
    if(gp.length && chance(q.length?0.5:0.85)){
      const chosen = weightedPick(gp);
      markEvent(chosen);
      q.push({kind:'gen', ev:chosen});
    }
  }
  /* 日常支线（每年保底 1 条 · 若以上皆空必出） */
  if(q.length<2){
    const dp = DAILY.filter(eventReady);
    if(dp.length){
      const need = q.length===0 ? 1 : (chance(0.7)?1:0);
      for(let i=0;i<need;i++){
        if(!dp.length) break;
        const idx = ri(0, dp.length-1);
        const ev = dp.splice(idx,1)[0];
        markEvent(ev);
        q.push({kind:'day', ev:ev});
      }
    }
  }
  /* 兜底：若全年仍空（冷却把日常池抽干），忽略冷却强出 1 条，保证「年年有事」 */
  if(q.length===0){
    const dp = DAILY.filter(function(e){ return !e.when || e.when(S); });
    if(dp.length){ const ev = pick(dp); markEvent(ev); q.push({kind:'day', ev:ev}); }
  }
  return q.slice(0,2);
}

/* ───────── 阶段 ④：更　新 ───────── */
function doUpdate(){
  S.actionDone = false;
  S.phase = 'idle';
}

/* ───────── 死法判定（规格 §2.6-3：只留「怎么死的」，成就另由身份轴给出） ─────────
   重构要点：原第一段「显性成就」（rank===5 → 草莽天子／雄主守成、医线国手、政线名臣……）
   整体迁往 IDENTITIES + achievementEnding()；此处只保留死亡形态：
   位高德薄的反噬、修行者的形神之终、贫病横死、绝嗣、寿终正寝。 */
function judgeNaturalDeath(byHealth){
  const a = S.attrs, R = S.routes;
  const on = function(id){ return !!(R[id] && R[id].active); };

  /* ① 位高而德薄 —— 死于反噬（皆属死法，不是成就） */
  if(S.identity==='diwang' && S.moral<4) return 'baozheng';       /* 暴虐被弑 */
  if(on('zheng') && S.rank>=3 && S.moral<4) return 'jianning';     /* 奸佞见诛 */
  if(on('jun') && S.flags.留京 && S.merit>=8 && !S.flags.急流勇退) return 'tusi';
  if(on('shang') && S.flags.垄断 && S.moral<4) return 'longduan';

  /* ② 修行者的归宿：形神俱损为走火，寿尽自蜕为兵解 */
  if(S.flags.修仙入门 || on('xian')) return byHealth ? 'zouhuo' : 'bingjie';

  /* ③ 拥兵自重者不入正史 */
  if(on('jun') && (S.flags.割据 || (S.merit>=10 && S.moral<4))) return 'fanzhen';

  /* ④ 商途倾覆 */
  if(on('shang') && a.财<=2 && S.identity!=='juaj') return 'zhongdao';

  /* ⑤ 贫病横死 / 家门与绝嗣（v1.6 F-3 精准化）
     原判据「rank===0」把「有手艺但没官身」的匠户、坐堂郎中一并判成饿殍，
     而 eguan 属 k:'bad'，会连带抹去一生成就。此处拆成两档：
       · 饿殍（bad）：无业 且 赤贫 且 无身份 —— 真正的横死；
       · 贫病（poor）：有业无产，困顿而终 —— 不抹成就，只是死得不体面。 */
  if(byHealth){
    const 无业 = !on('zheng') && !on('jun') && !on('shang') && !on('yi')
              && !on('zong') && !on('caom') && !on('duodi') && !on('zhanw')
              && !S.flags.修仙入门;
    const 赤贫 = (S.money < 0) || (a.财 <= 1);
    if(S.rank===0 && 无业 && 赤贫) return 'eguan';
    if(S.rank<=1 && 赤贫)          return 'pinbing';
  }
  if(META.gens>=3 && a.望>=6 && S.children.length>0) return 'jiamen';
  if(!S.children.length && !S.flags.修仙入门 && S.age>=45) return 'duanzi';

  /* ⑥ 兜底：寿终正寝 */
  return 'pingdan';
}

/* ───────── 终局收束（规格 §2.6-4）：成就 × 死法 双轨 ─────────
   primary 为落图鉴与计分的主键：死法属凶终（bad／cut）时以死法为准，
   否则成就铭文优先（善终者以其一生所立之身份论定）。 */
function resolveOutcome(){
  const death = (S && S.pendingEnd && ENDINGS[S.pendingEnd]) ? S.pendingEnd : 'pingdan';
  const ach   = achievementEnding();
  const dk    = ENDINGS[death] ? ENDINGS[death].k : 'good';
  /* 凶终（bad）抹去成就铭文——被弑者无「守成」之名；
     血脉断绝（cut）只关乎传承，不抵消一生所立，故仍保留成就。 */
  const fatal = (dk==='bad');
  const primary = (ach && !fatal && ach!==death) ? ach : death;
  return { death:death, ach: fatal ? null : ach, primary:primary,
           identity: S ? S.identity : null, years: S ? S.reignYears : 0 };
}
/* 成就卷录入（图鉴双维之一）：以身份为键，记次数／最高分／最长居位／最高寿 */
function recordIdentity(score){
  if(!S || !S.identity || typeof IDENTITIES==='undefined' || !IDENTITIES[S.identity]) return null;
  const id = S.identity;
  const sc = (typeof score==='number') ? score : 0;
  const v  = (id==='diwang') ? diwangVariant() : null;   /* 帝王五途：依得国之路取动态原型 */
  const prev = META.dexId[id];
  if(prev){
    prev.c = (prev.c||0)+1;
    if(sc > (prev.s||0)) prev.s = sc;
    if(S.reignYears > (prev.y||0)) prev.y = S.reignYears;
    if(S.age > (prev.a||0)) prev.a = S.age;
    if(v) prev.v = v;
  }else{
    META.dexId[id] = { c:1, s:sc, y:S.reignYears, a:S.age };
    if(v) META.dexId[id].v = v;
  }
  saveMeta();
  return META.dexId[id];
}
/* 帝王五途变体（v1.6 · 青史）：得国之路不同，史鉴原型亦异。
   优先级：玄武门夺位 ＞ 靖难 ＞ 布衣开国(乞儿) ＞ 承袭守成(宗籍) ＞ 军阀开国。 */
function diwangVariant(){
  if(!S) return 'inherit';
  if(S.flags.玄武门)   return 'duodi-A';
  if(S.flags.靖难即位) return 'duodi-B';
  if(S.flags.乞儿)     return 'caom';
  if(S.royal)          return 'inherit';
  return 'zhanw';
}
/* 死法卷录入（图鉴双维之二） */
function recordDeath(deathId){
  if(!deathId || !ENDINGS[deathId]) return null;
  META.dexDeath[deathId] = (META.dexDeath[deathId]||0) + 1;
  saveMeta();
  return META.dexDeath[deathId];
}
function dexIdStat(){
  const total = (typeof IDENTITIES!=='undefined') ? Object.keys(IDENTITIES).length : 0;
  const seen  = Object.keys(META.dexId||{}).filter(function(k){
    return typeof IDENTITIES!=='undefined' && !!IDENTITIES[k]; }).length;
  return { seen:seen, total:total };
}
function dexDeathStat(){
  const keys = Object.keys(ENDINGS).filter(function(k){ return ENDINGS[k].k!=='ascend'; });
  const seen = Object.keys(META.dexDeath||{}).filter(function(k){ return !!ENDINGS[k]; }).length;
  return { seen:seen, total:keys.length };
}

/* ───────── 结局评级与图鉴（P1-4） ─────────
   计分只读当前 S / META，不产生副作用；recordEnding 负责落盘。 */
function lifeScore(endId){
  if(!S) return 0;
  const e = ENDINGS[endId] || ENDINGS.pingdan;
  const a = S.attrs;
  let sc = 0;
  sc += Math.min(S.age, 90) * 3;                                   /* 寿数 ≤270 */
  sc += (S.rank || 0) * 55;                                        /* 身份 ≤275 */
  ATTRS.forEach(function(k){ sc += (a[k] || 0) * 7; });            /* 八维 ≤560 */
  sc += (S.mind || 0) * 6 + (S.moral || 0) * 6;                    /* 心境·道德 ≤120 */
  sc += Math.min(S.children.length, 3) * 25;                       /* 子嗣 ≤75 */
  sc += Math.min(Math.max(S.money, 0), 4000) / 40;                 /* 家资 ≤100 */
  sc += Math.min(S.merit || 0, 40) * 2.5;                          /* 军功 ≤100 */
  sc += Math.min(S.incense || 0, 40) * 2.5;                        /* 香火 ≤100 */
  if(S.xianTier >= 0) sc += (S.xianTier + 1) * 90;                 /* 境界 ≤540 */
  sc += Math.min(META.gens, 6) * 18;                               /* 门第 ≤108 */
  Object.keys(S.routes).forEach(function(id){                      /* 入线深度 */
    const r = S.routes[id];
    /* node 为主线推进到的节点序号（activateRoute 建档时置 0），非 step —— 
       用错字段会让「入线深度」恒为定额，主线通关与刚入线同分。 */
    if(r && r.active) sc += 26 + Math.min(r.node || 0, 6) * 11;
  });
  const kb = { ascend:520, good:180, grey:0, cut:-60, bad:-190 };
  sc += (kb[e.k] !== undefined ? kb[e.k] : 0);                     /* 结局性质 */
  return Math.max(0, Math.round(sc));
}
function endingRank(score){
  for(let i=0; i<ENDING_RANKS.length; i++){
    if(score >= ENDING_RANKS[i].min) return ENDING_RANKS[i];
  }
  return ENDING_RANKS[ENDING_RANKS.length - 1];
}
/* 录入图鉴：同一结局取历史最高分／最高品第，次数累加 */
function recordEnding(endId, score){
  if(!ENDINGS[endId]) return null;
  const sc = (typeof score === 'number') ? score : lifeScore(endId);
  const rk = endingRank(sc);
  const prev = META.dex[endId];
  if(prev){
    prev.c = (prev.c || 0) + 1;
    if(sc > (prev.s || 0)){ prev.s = sc; prev.g = rk.g; prev.a = S ? S.age : 0; }
  }else{
    META.dex[endId] = { c:1, s:sc, g:rk.g, a: S ? S.age : 0 };
  }
  META.lives = (META.lives || 0) + 1;
  META.lastEnding = endId;
  saveMeta();
  return rk;
}
function dexStat(){
  const total = Object.keys(ENDINGS).length;
  const seen  = Object.keys(META.dex).filter(function(k){ return !!ENDINGS[k]; }).length;
  return { seen: seen, total: total, lives: META.lives || 0 };
}

/* ───────── 传承折算 ───────── */
function computeInherit(childIdx){
  const c = S.children[childIdx];
  const cut = S.flags.抄家 ? 0 : 1;
  const inh = {
    财: cut ? clamp(Math.floor(S.attrs.财/3),0,2) : 0,
    望: cut ? clamp(Math.floor(S.attrs.望/4),0,2) : 0,
    脉: cut ? clamp(Math.floor(S.attrs.脉/4),0,2) : 0,
    tags: []
  };
  if(c && c.tag && chance(.8)) inh.tags.push(c.tag);
  S.tags.forEach(function(t){ if(chance(.25) && inh.tags.indexOf(t)<0 && inh.tags.length<2) inh.tags.push(t); });
  return inh;
}
function commitLegacy(childIdx){
  INHERIT = computeInherit(childIdx);
  META.gens += 1;
  META.year = S.baseYear + S.age;
  if(!META.trainAttr){
    let best='体', bv=-1;
    ATTRS.forEach(function(k){ if(S.attrs[k]>bv){ bv=S.attrs[k]; best=k; } });
    META.trainAttr = best;
  }
  META.lastEnding = S.pendingEnd;
  saveMeta();
}

/* ═══ 事件池空 opts 归一（规格 §4 注：生涯事件为机生成，部分缺选项） ═══
   加载后统一为缺选项的 event 补一个「继续」默认选项，避免 showEvent（ui.js:235 取
   opts[0].eff）与模拟器因 opts 为空而抛错 / 死锁。事件自身带 eff 则默认选项直接应用，
   否则为纯叙述无副作用。GENERAL / DAILY / FATE_CARDS / CAREER 全量兜底。 */
function normalizeEventPools(){
  const pools = [];
  if(typeof GENERAL   !== 'undefined') pools.push(GENERAL);
  if(typeof DAILY    !== 'undefined') pools.push(DAILY);
  if(typeof FATE_CARDS!== 'undefined') pools.push(FATE_CARDS);
  if(typeof CAREER   !== 'undefined') Object.keys(CAREER).forEach(function(k){ pools.push(CAREER[k]); });
  pools.forEach(function(pool){
    if(!Array.isArray(pool)) return;
    pool.forEach(function(ev){
      if(!ev || !Array.isArray(ev.opts) || ev.opts.length === 0){
        ev.opts = [{ l:'继续', hint:'', ok:{ txt: ev && ev.d ? '岁月如常，惊澜不兴。' : '无事发生。', eff: (ev && ev.eff) ? ev.eff : {} } }];
      }
    });
  });
}
normalizeEventPools();
