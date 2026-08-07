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
   lives ：累计游玩世数（含幼殇／乞丐夭折）
   v1.8 版本隔离：key 由 dayu_house_v1 → dayu_house_v18，旧档一律不读取（用户拍板）——
   旧 key 数据保留不删不覆盖，静默迁移为空档新档。 */
const META_KEY = 'dayu_house_v18';
function metaDefaults(){
  return { gens:0, year:17, trainAttr:null, houseTags:[], lastEnding:null, lastTier:null,
           dex:{}, dexId:{}, dexDeath:{}, lives:0 };
}
let META = metaDefaults();
function loadMeta(){
  try{ const raw = localStorage.getItem(META_KEY);
    if(raw){ const o=JSON.parse(raw); if(o&&typeof o==='object') META=Object.assign(META,o); }
  }catch(e){ /* file:// 下 localStorage 可能不可用，静默降级 */ }
  if(!META.dex || typeof META.dex!=='object') META.dex = {};   // 旧存档兼容
  /* 图鉴双维（规格 §3.5）：dexId＝成就卷（身份）· dexDeath＝死法卷。旧档缺字段则补空。 */
  if(!META.dexId || typeof META.dexId!=='object') META.dexId = {};
  if(!META.dexDeath || typeof META.dexDeath!=='object') META.dexDeath = {};
  if(typeof META.lives!=='number') META.lives = 0;
}
function saveMeta(){
  try{ localStorage.setItem(META_KEY, JSON.stringify(META)); }catch(e){}
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
  /* v1.7 增补一 · 继承出身筛选：
     首代（gens===0）：剔除 inheritOnly 专属出身，天然「只有继承才出现」；
     继承代（gens>=1）：按 META.lastEnding 命中 INHERIT_ORIGIN_RULES——
       · pool 函数存在 → 以其为候选池（fujia 仅商家）；
       · pool 为 null/未定义 → 默认「同阶层±1 且排除 乞丐/帝王」；
       · add 注入专属出身 id（始皇/玄奘修仙）。 */
  let pool = ORIGINS.slice();
  if(!META.gens){
    pool = pool.filter(function(o){ return !o.inheritOnly; });
  }else{
    const rule = (typeof INHERIT_ORIGIN_RULES!=='undefined' && META.lastEnding)
      ? INHERIT_ORIGIN_RULES[META.lastEnding] : null;
    if(rule && typeof rule.pool==='function'){
      pool = rule.pool();
    }else{
      const lt = (typeof META.lastTier==='number') ? META.lastTier : 3;
      pool = pool.filter(function(o){ return !o.beggar && !o.royal && Math.abs(o.t-lt)<=1; });
    }
    if(rule && rule.add){
      rule.add.forEach(function(id){
        const o = ORIGINS.find(function(x){ return x.id===id; });
        if(o && pool.indexOf(o)<0) pool.push(o);
      });
    }
  }
  const out = [];
  while(out.length<n && pool.length){
    let total=0; for(let i=0;i<pool.length;i++) total+=originWeight(pool[i]);
    let r=Math.random()*total, idx=0;
    for(let i=0;i<pool.length;i++){ r-=originWeight(pool[i]); if(r<=0){ idx=i; break; } }
    out.push(pool.splice(idx,1)[0]);
  }
  return out;
}

/* ───────── v1.8 PRD · 商铺界面辅助（UI 消费） ───────── */
function marketPrice(cat){ return (S.market && S.market[cat]) || (MARKET_CATS[cat] ? MARKET_CATS[cat].base : 0); }
/* 持有年限估值乘子：持有越久，行情越熟，出货价越好（上限 +30%） */
function holdCoef(cat){ return 1 + Math.min((S.stockHold[cat]||0), 10) * 0.03; }
/* 地产查封率（行业细分 §二）：guanxi 越高越低 */
function monopolySeizeRate(){ return Math.max(0.04, 0.18 - S.guanxi*0.03); }

/* ══ 商铺界面·纯逻辑（UI 薄壳调用，便于确定性单测） ══ */
/* 进货：投入 amt 银两，按市价购入整单位；返回 {ok, units, amt} */
function shopBuy(cat, amt){
  amt = Math.max(0, Math.floor(amt||0));
  const price = marketPrice(cat);
  const units = Math.floor(amt / price);
  if(amt<=0) return { ok:false, reason:'投入银钱不能为 0' };
  if(amt>S.money) return { ok:false, reason:'银钱不足' };
  if(units<=0) return { ok:false, reason:'不足以购入 1 单位' };
  S.money = clampMoney(S, S.money - amt);
  if(!S.stock[cat]) S.stock[cat] = {qty:0, cost:0};
  S.stock[cat].qty += units; S.stock[cat].cost += amt; S.stockHold[cat] = 0;
  return { ok:true, units:units, amt:amt };
}
/* 出货：卖 n 单位；返回 {ok, income} */
function shopSell(cat, n){
  n = Math.max(0, Math.floor(n||0));
  if(!S.stock[cat] || S.stock[cat].qty<=0) return { ok:false, reason:'仓中无货' };
  if(n<=0) return { ok:false, reason:'出货数量不能为 0' };
  if(n>S.stock[cat].qty) return { ok:false, reason:'持有数量不足' };
  const price = marketPrice(cat), coef = holdCoef(cat);
  const income = Math.round(price * n * coef);
  const avg = S.stock[cat].cost / S.stock[cat].qty;
  const costOut = Math.round(avg * n);
  S.money = clampMoney(S, S.money + income);
  S.stock[cat].qty -= n; S.stock[cat].cost -= costOut;
  if(S.stock[cat].qty<=0){ S.stock[cat] = {qty:0,cost:0}; S.stockHold[cat]=0; }
  return { ok:true, income:income };
}
/* 地产购置 / 变卖（八折回血） */
function shopEstateBuy(amt){
  amt = Math.max(0, Math.floor(amt||0));
  if(amt<=0) return { ok:false, reason:'购置金额不能为 0' };
  if(amt>S.money) return { ok:false, reason:'银钱不足' };
  S.money = clampMoney(S, S.money-amt); S.estates += amt;
  return { ok:true, amt:amt };
}
function shopEstateSell(){
  if(S.estates<=0) return { ok:false, reason:'无地产可卖' };
  const back = Math.floor(S.estates*0.8); S.money = clampMoney(S, S.money+back); S.estates=0;
  return { ok:true, back:back };
}
/* 打点立垄断（一次性）：耗银、官商关系+1、道德-1 */
function shopMonopoly(amt){
  amt = Math.max(0, Math.floor(amt||0));
  if(amt<=0) return { ok:false, reason:'打点银钱不能为 0' };
  if(amt>S.money) return { ok:false, reason:'银钱不足' };
  if(S.flags.垄断) return { ok:false, reason:'已立垄断' };
  S.money = clampMoney(S, S.money-amt); S.flags.垄断 = true; S.guanxi = Math.min(10, S.guanxi+1); S.moral = Math.max(0, S.moral-1);
  return { ok:true, amt:amt };
}

/* ══ v1.8 P1 · 六路线玩法纯逻辑（UI 薄壳调用，确定性单测） ══ */
/* 军·募兵（确定性定量）：投入 amt 银，按兵种单价得兵、兵权 +1；受银硬上限，可多次 */
function armyRecruit(amt, kind){
  amt = Math.max(0, Math.floor(amt||0));
  if(amt<=0) return { ok:false, reason:'投入银钱不能为 0' };
  if(amt>S.money) return { ok:false, reason:'银钱不足' };
  const ut = (kind && typeof BARRACK_UNITS!=='undefined' && BARRACK_UNITS[kind]) ? BARRACK_UNITS[kind] : {n:'兵', price:BARRACK_UNIT_PRICE};
  const got = Math.min(Math.floor(amt / ut.price), BARRACK_RECRUIT_CAP);   /* #9 单次成军上限，防一次拉爆 */
  if(got<=0) return { ok:false, reason:'不足以募 1 '+ut.n };
  const cost = got * ut.price;           /* 只扣实际成军的部分，余数退回（与界面预览口径一致） */
  S.money = clampMoney(S, S.money - cost);
  S.troops += got;
  /* #9 兵力递减：已达军阀规模后募兵不再涨兵权（兵权靠军功/操练而非无限买） */
  if(S.troops < TROOP_BINGQUAN_CAP) S.bingquan = Math.min(10, S.bingquan + 1);
  return { ok:true, troops:got, bingquan:(S.troops<TROOP_BINGQUAN_CAP?1:0), amt:cost, kind:kind };
}
/* 军·操练（风险）：耗兵力/健康，兵权+；受 playBudget 约束 */
function armyDrill(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  if(S.troops<10) return { ok:false, reason:'兵力不足，无法操练' };
  S.playBudget--; S.troops -= ri(2,6); S.health = clamp(S.health - ri(1,4), -999, S.healthMax);
  S.bingquan = Math.min(10, S.bingquan + 1);
  return { ok:true, drill:true };
}
/* 军·外伐（核心风险）：经济闭环修复3（2026-08-07）——敌力随兵力动态缩放
   E = ri(0.5t, 1.3t) 钳 [60, 4000]：始终存在「打得过的仗」（敌下限 0.5t < 兵，兵≥敌×0.6 恒成立）与
   「打不过的硬仗」（敌上限 1.3t），消除前期「兵少必败 → 更穷」死锁；胜得银对齐设计口径
   gain = max(ri(150,350), E×0.6)（修 A2：原实现仅 45~240 银，比设计 §7.2 的 150~350 低近半）。
   tactic 影响胜率/前置。 */
function armyCampaign(tactic){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  if(!S.troops || S.troops<20) return { ok:false, reason:'兵力不足，难以兴兵' };
  if(tactic==='奇袭' && !S.flags.谍报) return { ok:false, reason:'奇袭须先遣谍报' };
  const t = S.troops;
  const E = clamp(ri(Math.round(t*0.5), Math.round(t*1.3)), 60, 4000);
  let rate = (t < E*0.6) ? 0 : clamp((t - E*0.4)/(E*0.8), 0.2, 0.9);
  if(tactic==='奇袭') rate = clamp(rate+0.1, 0.2, 0.95);
  if(tactic==='坚壁') rate = clamp(rate-0.05, 0.15, 0.85);
  S.playBudget--;
  if(!chance(rate)){
    const loss = Math.floor(t * (0.2 + ri(0,20)/100));
    S.troops = Math.max(0, S.troops - loss); S.merit = Math.max(0,S.merit-1); S.attrs.望 = Math.max(0,S.attrs.望-1);
    addInfluence('jun', -1);   /* #7：军线败仗损军·influence */
    return { ok:true, win:false, E:E, rate:rate, loss:loss };
  }
  const gain = Math.max(ri(150,350), Math.floor(E*0.6));   /* 经济闭环修复3：对齐设计 §7.2 胜得 150~350，后期随 E 放大 */
  S.money = clampMoney(S, S.money + gain);
  S.troops = Math.max(0, S.troops - ri(5,20));
  S.merit += (S.warWins>=WARWINS_SOFT_CAP) ? ri(1,2) : ri(2,4);   /* #9 外伐胜场软上限：超此 merit 增益减半 */
  S.bingquan = Math.min(10, S.bingquan + 1); S.warWins += 1;
  addInfluence('jun', 1);   /* #7：军线胜仗涨军·influence（独立键，顶层聚合） */
  return { ok:true, win:true, E:E, rate:rate, gain:gain };
}
/* 医·坐堂（主线，风险）：cured+ri(1,3) rep+1；chance(0.08) 治死 rep-2 道德-1；rep≥8 由 checkIdentity 固化国手 */
function clinicTreat(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  S.playBudget--;
  if(chance(0.08)){
    S.rep = Math.max(0, S.rep - 2); S.moral = Math.max(0, S.moral - 1);
    return { ok:true, dead:true, rep:-2 };
  }
  const cured = ri(1,3);
  S.cured += cured; S.rep = Math.min(10, S.rep + 1);
  return { ok:true, dead:false, cured:cured, rep:1 };
}
/* 医·采药/炮制（确定性定量）：投入 amt 银 → meds；受银硬上限 */
function gatherHerb(amt){
  amt = Math.max(0, Math.floor(amt||0));
  if(amt<=0) return { ok:false, reason:'投入银钱不能为 0' };
  if(amt>S.money) return { ok:false, reason:'银钱不足' };
  const got = Math.min(Math.floor(amt / HERB_UNIT_PRICE), HERB_GATHER_CAP);   /* #9 单次采药上限，防一次拉爆 */
  if(got<=0) return { ok:false, reason:'不足以采 1 份' };
  const cost = got * HERB_UNIT_PRICE;    /* 余数退回，与界面预览口径一致 */
  S.money = clampMoney(S, S.money - cost); S.meds += got;
  return { ok:true, meds:got, amt:cost };
}
/* 医·倒卖丹药（风险）：meds→money，chance(0.3) 砸手亏 */
function clinicSell(n){
  n = Math.max(0, Math.floor(n||0));
  if(S.meds<=0) return { ok:false, reason:'无药可卖' };
  if(n<=0) return { ok:false, reason:'数量不能为 0' };
  if(n>S.meds) return { ok:false, reason:'存量不足' };
  S.meds -= n;
  if(chance(0.3)){ const loss = Math.floor(n * HERB_UNIT_PRICE * 0.5); return { ok:true, sold:true, gain:0, loss:loss }; }
  const gain = Math.round(n * HERB_UNIT_PRICE * ri(120,200)/100);
  S.money = clampMoney(S, S.money + gain);
  return { ok:true, sold:true, gain:gain };
}
/* 医·服丹（风险）：meds≥1 → chance(0.85) 延寿 h+ri(5,15)；否则 chance(0.15) 毒发 h-ri(15,40) */
function clinicElixir(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  if(S.meds<1) return { ok:false, reason:'无丹药可服' };
  S.meds -= 1; S.playBudget--;
  if(chance(0.85)){ const h = ri(5,15); S.health = clamp(S.health + h, -999, S.healthMax); S.lifespan += Math.floor(h/2); return { ok:true, poison:false, h:h }; }
  const h = ri(15,40); S.health = clamp(S.health - h, -999, S.healthMax); return { ok:true, poison:true, h:h };
}
/* 政·新政（风险）：成效大但可能遭攻讦；受 playBudget 约束 */
function yamenReform(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  S.playBudget--;
  if(chance(0.7)){ S.zhengji += ri(2,4); addInfluence('zheng', 1); return { ok:true, success:true }; }   /* #7：政线新政涨政·influence */
  S.zhengji = Math.max(0, S.zhengji - ri(0,2)); S.attrs.望 = Math.max(0, S.attrs.望-1);
  return { ok:true, success:false };
}
/* 政·举劾（风险）：弹劾权臣，成则升迁，败则损望 */
function yamenImpeach(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  S.playBudget--;
  if(chance(0.55)){ S.rank = Math.min(4, S.rank+1); S.zhengji += ri(1,3); addInfluence('zheng', 1); return { ok:true, success:true }; }   /* #7：政线举劾涨政·influence；封顶 rank4（勋贵），帝王 tier 仅由称帝事件授予，杜绝政线误刷帝王 */
  S.moral = Math.max(0, S.moral-1); S.attrs.望 = Math.max(0, S.attrs.望-1);
  return { ok:true, success:false };
}
/* 政·清点钱粮（经济闭环修复2：确定性收入，不耗行动点，每窗口限 1 次——doUpdate 重置 yamenChecked）
   money += 12 + 望×4 + 政绩×2：政绩主指标与经济收益挂钩，从政不再「白干」 */
function yamenCollect(){
  if(S.yamenChecked) return { ok:false, reason:'本窗口已清点过钱粮' };
  if(!(S.routes.zheng && S.routes.zheng.active)) return { ok:false, reason:'未入仕途' };
  const gain = 12 + (S.attrs.望||0)*4 + (S.zhengji||0)*2;
  S.money = clampMoney(S, S.money + gain);
  S.yamenChecked = true;
  return { ok:true, gain:gain };
}
/* 宗教·法会（风险）：按信徒涨香火，妖言被查则损 */
function templeRite(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  if((S.believers||0)<10) return { ok:false, reason:'信徒寥寥，法会不彰' };
  S.playBudget--;
  const cost = ri(5,20);
  S.money = clampMoney(S, S.money - cost);
  /* v1.8 重设计 §4.2 法会：香火按信徒数量；被查率随信徒涨、随道德跌 */
  const bustP = clamp(0.12 + (S.believers||0)*0.0002 - S.moral*0.01, 0.05, 0.4);
  if(chance(bustP)){
    S.incense   = Math.max(0, S.incense - ri(3,8));
    S.believers = Math.max(0, (S.believers||0) - ri(30,80));
    S.moral     = Math.max(0, S.moral - 1);
    S.sermonBusted = (S.sermonBusted||0) + 1;
    return { ok:true, success:false, bustP:bustP, cost:cost };
  }
  const inc = Math.floor((S.believers||0) * 0.05) + ri(2,6);
  S.incense += inc;
  return { ok:true, success:true, incense:inc, bustP:bustP, cost:cost };
}
/* 宗教·传教（确定性 · 不耗玩法点）：耗财帛养信徒；信徒>800 后 10% 官府查禁 */
function templePreach(){
  const cost = ri(20,80);
  if(S.money < cost) return { ok:false, reason:'银钱不足，难以开坛' };
  S.money = clampMoney(S, S.money - cost);
  const got = ri(30,120);
  S.believers = (S.believers||0) + got;
  if(S.believers > 800 && chance(0.10)){
    const loss = ri(150,300);
    S.believers = Math.max(0, S.believers - loss);
    S.moral = Math.max(0, S.moral - 1);
    return { ok:true, busted:true, got:got, loss:loss, cost:cost };
  }
  return { ok:true, busted:false, got:got, cost:cost };
}
/* 宗教·化斋（风险）：耗香火+信徒分成供奉换财帛；合作破裂则被权贵迫害（PROFIT_R 见 data.js） */
function templeAlms(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  if(S.incense<2 || (S.believers||0)<10) return { ok:false, reason:'香火信徒不足，难以化缘' };
  S.playBudget--;
  const ci = ri(2,6), cb = ri(10,40);
  S.incense   = Math.max(0, S.incense - ci);
  S.believers = Math.max(0, (S.believers||0) - cb);
  const P = clamp(0.15 - (S.attrs.脉||0)*0.01, 0.05, 0.2);
  if(chance(P)){
    const bl = ri(100,300);
    S.believers = Math.max(0, (S.believers||0) - bl);
    S.incense   = Math.max(0, S.incense - ri(1,3));
    S.health    = clamp(S.health - ri(5,15), -999, S.healthMax);
    return { ok:true, break:true, P:P, costIncense:ci, costBelievers:cb, bl:bl };
  }
  const gain = Math.floor((ci + cb) * ALMS_PROFIT_R);
  S.money = clampMoney(S, S.money + gain);
  return { ok:true, break:false, gain:gain, P:P, costIncense:ci, costBelievers:cb };
}

/* ══ v1.8 帝王线重设计 · 朝堂四政（纯逻辑，UI 薄壳调用；全部为风险类，受 playBudget 约束） ══ */
function isEmperor(s){ return s.identity==='diwang' || s.identity==='weimian'; }
/* 朝堂·御驾亲征（重写 §3.4）：敌力 E=ri(2万,6万)；兵<敌×0.6 必败；胜率公式与军线外伐同构。
   胜：领土 +ri(5,18)、兵力 -ri(3000,8000)、国库 -ri(20000,60000)（战争损耗）· campaignWins+1；
   败：兵力 -ri(8000,20000)、领土 -ri(2,10)、健康 -ri(5,15)。 */
function emperorCampaign(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  if(!isEmperor(S)) return { ok:false, reason:'非帝王不可行此政' };
  if(!S.troops || S.troops<12000) return { ok:false, reason:'兵力空虚，难以亲征' };
  S.playBudget--;
  const E = ri(20000, 60000);
  const rate = (S.troops < E*0.6) ? 0 : clamp((S.troops - E*0.4)/(E*0.8), 0.2, 0.9);
  if(!chance(rate)){
    const loss = ri(8000,20000), terr = ri(2,10), h = ri(5,15);
    S.troops    = Math.max(0, S.troops - loss);
    S.territory = Math.max(1, S.territory - terr);
    S.health    = clamp(S.health - h, -999, S.healthMax);
    S.attrs.望  = Math.max(0, S.attrs.望 - 1);
    return { ok:true, win:false, E:E, rate:rate, loss:loss, terr:terr, h:h };
  }
  const gain = ri(5,18), loss = ri(3000,8000), cost = ri(20000,60000);
  S.territory += gain;
  S.troops    = Math.max(0, S.troops - loss);
  S.treasury  = Math.max(0, S.treasury - cost);
  S.campaignWins = (S.campaignWins||0) + 1;
  S.attrs.望  = Math.min(10, S.attrs.望 + 1);
  S.merit     += ri(2,4);
  return { ok:true, win:true, E:E, rate:rate, gain:gain, loss:loss, cost:cost };
}
/* 朝堂·修养生息（§3.4）：国库 2万–4万 → 兵力 +2000~5000、望+；10% 疫病/逃兵折兵；
   国库<2万则征发不继，激起哗变（折兵+损德损望） */
function emperorRecuperate(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  if(!isEmperor(S)) return { ok:false, reason:'非帝王不可行此政' };
  S.playBudget--;
  if(S.treasury < 20000){
    const loss = ri(5000,12000);
    S.troops   = Math.max(0, S.troops - loss);
    S.moral    = Math.max(0, S.moral - 1);
    S.attrs.望 = Math.max(0, S.attrs.望 - 1);
    return { ok:true, mutiny:true, loss:loss };
  }
  const cost = ri(20000,40000);
  S.treasury -= cost;
  const got = ri(2000,5000);
  S.troops += got; S.attrs.望 = Math.min(10, S.attrs.望 + 1);
  if(chance(0.10)){
    const plague = ri(1000,3000);
    S.troops = Math.max(0, S.troops - plague);
    return { ok:true, mutiny:false, plague:true, cost:cost, got:got, plagueLoss:plague };
  }
  return { ok:true, mutiny:false, plague:false, cost:cost, got:got };
}
/* 朝堂·治国理政（§3.4）：群臣掣肘 vs 帝才对拼；胜：国库 +3万~9万、望+、governWins+1；
   败：国库微减、望-；小概率党争反噬损德 */
function emperorGovern(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  if(!isEmperor(S)) return { ok:false, reason:'非帝王不可行此政' };
  S.playBudget--;
  const zi = S.attrs.智||0;
  const court = ri(0,30) + zi*2;
  const me    = zi*8 + ri(0,15);
  if(me >= court){
    const gain = ri(30000,90000);
    S.treasury += gain;
    S.attrs.望 = Math.min(10, S.attrs.望 + 1);
    S.governWins = (S.governWins||0) + 1;
    return { ok:true, success:true, gain:gain };
  }
  const loss = ri(5000,20000);
  S.treasury = Math.max(0, S.treasury - loss);
  S.attrs.望 = Math.max(0, S.attrs.望 - 1);
  if(chance(0.2)){
    S.moral = Math.max(0, S.moral - 1);
    return { ok:true, success:false, loss:loss, faction:true };
  }
  return { ok:true, success:false, loss:loss };
}
/* 朝堂·酒池肉林（§3.4）：国库 1万–3万、兵力 -1000~4000、领土 -1~5 → 健康 +15~30（封顶）、心境+；
   道德-、立「酒色」、decadenceCount+1 */
function emperorDecadence(){
  if(S.playBudget<=0) return { ok:false, reason:'本窗口玩法次数已用尽' };
  if(!isEmperor(S)) return { ok:false, reason:'非帝王不可行此政' };
  if(S.treasury < 10000) return { ok:false, reason:'国库空虚，难以铺张' };
  S.playBudget--;
  const c = ri(10000,30000);
  S.treasury -= c;
  S.troops    = Math.max(0, S.troops - ri(1000,4000));
  S.territory = Math.max(1, S.territory - ri(1,5));
  S.health    = clamp(S.health + ri(15,30), -999, S.healthMax);
  S.mind      = Math.min(10, S.mind + 1);
  S.moral     = Math.max(0, S.moral - 1);
  S.flags.酒色 = true;
  S.decadenceCount = (S.decadenceCount||0) + 1;
  return { ok:true, cost:c, decadence:S.decadenceCount };
}
/* 帝王·支取内帑（经济闭环修复6：确定性，不耗行动点，每窗口限 1 次——doUpdate 重置 emperorWithdrawn）
   国库 → 个人 money：min(2000, floor(treasury×0.05))。个人 money 与国库解耦但有通道，帝王线也能参与黑市/商铺。 */
function emperorWithdraw(){
  if(S.emperorWithdrawn) return { ok:false, reason:'本窗口已支取过内帑' };
  if(!isEmperor(S)) return { ok:false, reason:'非帝王不可支取内帑' };
  const amt = Math.min(2000, Math.floor((S.treasury||0)*0.05));
  if(amt<=0) return { ok:false, reason:'国库空虚' };
  S.treasury -= amt;
  S.money = clampMoney(S, S.money + amt);
  S.emperorWithdrawn = true;
  return { ok:true, amt:amt };
}
/* 御驾亲征预计胜率（界面预览口径：以中位敌力估算；实际执行再随机 E） */
function emperorCampaignRate(s){
  if(!s.troops || s.troops < 12000) return 0;
  return clamp((s.troops - 40000*0.4)/(40000*0.8), 0.2, 0.9);
}
/* 帝王评语（重设计 §九 · 轻量实现：按当前国力实时评定，零数值增益；不作 IDENTITIES 以免与 diwang/weimian pri:1 互扰） */
function emperorEval(s){
  if(s.territory>=200 && s.treasury>=1000000) return {id:'yitong',   n:'一统之君'};
  if(s.territory>=50  && s.treasury>0)        return {id:'shoucheng',n:'守成之君'};
  if(s.territory>0    && s.territory<50)      return {id:'pianan',   n:'偏安之主'};
  return null;
}
/* 宗教评语（重设计 §十 · 轻量实现：按香火/信徒实时评定；开宗祖师需信徒≥1000） */
function sectEval(s){
  if(s.believers>=1000) return {id:'kaizu',  n:'开宗祖师'};
  if(s.flags.护国)      return {id:'huguo',  n:'国师 · 护国'};
  if(s.incense>=10)     return {id:'jiaozong',n:'教宗'};
  if(s.incense>=5 && s.believers>=300) return {id:'gaogong', n:'高功'};
  if(s.incense>=2)      return {id:'fashi',  n:'法师'};
  if(s.routes.zong && s.routes.zong.active) return {id:'shami', n:'道童'};
  return null;
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
    merit:0, incense:0, cult:0, xianTier:-1, hanghai:0,     /* v1.7 C线：航海外交计数（郑和锁 7） */
    blackMarketChance:0,                                     /* v1.8：黑市窗口判定命中置 1（行事页按钮化） */
    /* v1.8 PRD · 商铺界面资源（自主定量） */
    stock:{},          /* 囤货：{ 品类id: {qty, cost} }，qty=持有单位数，cost=累计投入银两 */
    stockHold:{},      /* 持有年限：{ 品类id: 年数 }，逐年 +1，出货估值乘子用 */
    market: MARKET_KEYS.reduce(function(o,k){ o[k]=MARKET_CATS[k].base; return o; }, {}), /* 行情现价（每年游走） */
    estates:0,         /* 商·地产（已投银两，被动收入；有查封/灾害清零风险） */
    guanxi:0,          /* 商·官商关系 0~10（买官勾结获得；降查封率、解锁垄断） */
    /* v1.8 P1 · 六路线资源字段（自主定量界面） */
    troops:0, bingquan:0, influence:0, warWins:0,   /* 军 */
    rep:0, cured:0, meds:0,                         /* 医 */
    zhengji:0, minxin:0,                            /* 政 */
    believers:0,                                   /* 宗教 */
    treasury:0, territory:0,                         /* 帝王（称帝初始化由 setIdentity 钩子注入） */
    campaignWins:0, governWins:0, decadenceCount:0, /* 帝王 · 功业计数（档位/青史判定用） */
    sermonBusted:0,                                 /* 宗教 · 法会被查累计（档位判定用） */
    yamenChecked:false, emperorWithdrawn:false,     /* 经济闭环修复2/6：清点钱粮/支取内帑 窗口内限次标志（doUpdate 重置） */
    playBudget: Math.max(2, stageN(0)), /* 玩法界面窗口行动点（窗口边界按 stageN 缩放重置，见 doUpdate；保底 2 次/窗口） */
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
  /* v1.7 增补一：继承专属出身开局即带修仙 flag（xian.vis 直接可见，绕破败闸门） */
  if(origin.id==='yingzheng_xiu'){ S.flags.始皇遗脉 = true; S.flags.修仙入门 = true; S.cult = 40; }
  if(origin.id==='xuanzang_xiu'){ S.flags.金蝉遗蜕 = true; S.flags.修仙入门 = true; S.cult = 40; }
  /* v1.7 增补二：轻量背包（只存持有型道具，不跨世继承） */
  S.bag = [];
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
  S.gauntlet = { rows: rows, alive: alive, target: target, dieAge: dieAge };
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
  /* v1.8 P1 · 六路线资源（统一单写入口，不直改 S.xxx） */
  if(eff.troops)    S.troops    = Math.max(0, S.troops + eff.troops);
  if(eff.bingquan)  S.bingquan  = clamp(S.bingquan + eff.bingquan, 0, 10);
  if(eff.influence){
    /* #7：带 influenceLine 则写入对应路线独立键并聚合；否则直写顶层（向后兼容） */
    if(eff.influenceLine && S.routes[eff.influenceLine]) addInfluence(eff.influenceLine, eff.influence);
    else S.influence = clamp(S.influence + eff.influence, 0, 10);
  }
  if(eff.rep)       S.rep       = clamp(S.rep + eff.rep, 0, 10);
  if(eff.cured)     S.cured     = Math.max(0, S.cured + eff.cured);
  if(eff.meds)      S.meds      = Math.max(0, S.meds + eff.meds);
  if(eff.zhengji)   S.zhengji   = Math.max(0, S.zhengji + eff.zhengji);
  if(eff.minxin)    S.minxin    = clamp(S.minxin + eff.minxin, 0, 10);
  if(eff.believers) S.believers = Math.max(0, S.believers + eff.believers);
  /* v1.8 帝王线重设计 · 国库/领土（兵力已在 eff.troops 覆盖；territory 保底 1 州，称帝后不失国本） */
  if(eff.treasury)  S.treasury  = Math.max(0, S.treasury + eff.treasury);
  if(eff.territory) S.territory = Math.max(1, S.territory + eff.territory);
  /* v1.8 黑市：健康上限 ±N（蛇酒/符水/延寿丹；上限下调时 health 随之封顶） */
  if(eff.healthMax){
    const b=S.healthMax;
    S.healthMax = clamp(S.healthMax + eff.healthMax, 1, 999);
    if(S.health > S.healthMax) S.health = S.healthMax;
    if(S.healthMax - b !== 0) deltas.push({k:'寿元上限', v:S.healthMax - b});
  }
  if(eff.money){ const b=S.money; S.money=clampMoney(S, S.money+eff.money); if(S.money-b!==0) deltas.push({k:'财帛', v:S.money-b}); }
  if(eff.rank!==undefined && eff.rank>S.rank){ S.rank=eff.rank; pushLog(S.age,'身份升至「'+RANKS[S.rank]+'」','key'); }
  if(eff.tags) eff.tags.forEach(function(t){ if(S.tags.indexOf(t)<0) S.tags.push(t); });
  if(eff.flags) eff.flags.forEach(function(f){
    S.flags[f]=true;
    /* P0-2 已婚 Bug（规格 §2.1）：全引擎判定读 S.married，而事件只写 flags['已婚']。
       此处同步置位，一并修复「婚配年年可触发／子嗣永不出生／徽章不显／岁出少计 4 银」。 */
    if(f==='已婚') S.married = true;
    /* v1.7 增补一：染花柳记下染龄（b22 直判 Math.max(35, ageAt染) 用） */
    if(f==='花柳' && S.ageAt染===undefined) S.ageAt染 = S.age;
  });

  /* v1.7 C线 · 航海外交计数：eff.hanghaiInc → S.hanghai++，达 7 置「七下西洋」（郑和锁 7） */
  if(eff.hanghaiInc){
    S.hanghai = (S.hanghai||0) + 1;
    if(S.hanghai >= 7 && !S.flags.七下西洋){
      S.flags.七下西洋 = true;
      pushLog(S.age, '七下西洋，海图初成。','key');
    }
  }

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
  /* v1.8 帝王线重设计 · 称帝初始化（仅此一次：setIdentity 的 cur.pri<=ent.pri 守卫保证帝位不重复立）：
     个人财帛全部转化国库，初兵初土落位——此后主指标为国库/兵力/领土（朝堂界面） */
  if(id==='diwang' || id==='weimian'){
    S.treasury  = 500000 + Math.max(0, S.money||0);
    S.money     = 0;
    S.troops    = 30000 + (S.attrs.武||0) * 2000;
    S.territory = 100;
    pushLog(S.age, '践祚，国库初备五十万两，兵民归心。', 'key');
  }
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
    /* v1.7 A线：汉胄（刘秀）以「光武中兴」论定，优先于军阀开国/承袭守成 */
    if(S.flags.陨石助战 || S.flags.光武 || S.flags.中兴) return 'guangwu';
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
  /* v1.8 黑市改造：突破不再 100% 成功——基础概率 70%（有仙缘/仙胄/始皇求仙/取经悟道），
     凡人 50%；持破婴丹 → 统一 70%；凡人 + 持空白书籍 + 无破婴丹 → 必失败（概率归 0）。 */
  const hasXianRoot = !!(S.flags.仙缘||S.flags.始皇求仙||S.flags.取经悟道
                          ||S.flags.始皇遗脉||S.flags.金蝉遗蜕||S.flags.仙帝);
  const hasPoying = Array.isArray(S.bag) && S.bag.indexOf('poying')>=0;
  const hasBlankbook = Array.isArray(S.bag) && S.bag.indexOf('blankbook')>=0;
  /* 凡人（无仙缘根）持空白书籍且无破婴丹 → 强行入道者根基虚浮，突破必败；
     注意不依赖 inXianRoute——凡人强入 xian 后 inXianRoute 即 true，若依赖它则必败永不触发 */
  const isBlankBookMortal = hasBlankbook && !hasPoying && !hasXianRoot;
  const p = isBlankBookMortal ? 0 : (hasPoying ? 0.70 : (hasXianRoot ? 0.70 : 0.50));
  if(!chance(p)){
    pushLog(S.age, '突破失败——真气逆散，尚需沉淀。', 'danger');
    return;
  }
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
  /* v1.8 修复：机遇卡（机缘）点击门槛放行 v1.8 可交互相位 'action'
     （旧 'idle' 与 v1.8 时间步进后的实际相位永不相交，导致机缘整局点不动） */
  if((S.phase!=='action' && S.phase!=='idle') || S.ended || !S.fate) return;
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
  if(S.flags['圣旨']){                       // 奉旨：恢复多线逻辑（COMBO_WHITELIST，至多 2 条）
    if(cur.length===1 && comboAllowed(cur[0], id)) return 'ok';
    return 'switch';
  }
  return 'deny';                             // 无圣旨：第 2 条明线一律禁止
}
function activateRoute(id, silent){
  if(S.routes[id] && S.routes[id].active) return;
  /* v1.8 圣旨：无圣旨第 2 条明线硬阻（deny）——引擎层最后防线，不依赖 UI 提示分支 */
  if(comboCheck(id)==='deny') return;
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
  S.routes[id] = { active:true, node:0, lastAge:-99, influence:0 };   /* v1.8 P1 · #7：每线独立影响力键，顶层 S.influence 仅聚合展示 */
  S.flags.mundane = false;                          /* 入仕途即脱离「碌碌」 */
  const r = ROUTES.filter(function(x){return x.id===id;})[0];
  if(r) pushLog(S.age, '入「'+r.n+'」之途。', 'key');
  if(id==='xian') S.flags.修仙入门 = true;
}
/* v1.8 P1 · #7：影响力按路线独立记账（军·influence / 政·influence / 宗教·influence 各自一档），
   顶层 S.influence 仅作聚合展示并封顶 10，避免军+政零成本双向叠加突破 F-R3。 */
function addInfluence(line, amt){
  const r = S.routes[line] || (S.routes[line] = { active:false, node:0, lastAge:-99, influence:0 });
  r.influence = clamp((r.influence||0) + amt, 0, 10);
  const sum = (S.routes.jun && S.routes.jun.influence||0)
             + (S.routes.zheng && S.routes.zheng.influence||0)
             + (S.routes.zong && S.routes.zong.influence||0);
  S.influence = clamp(sum, 0, 10);
}
/* 从业要求随年龄变严（v1.8：6 岁一档 → 4 岁一档，进一步收紧大器晚成）：
   每过 4 岁，各属性门槛 +1，至 ATTR_CAP 封顶 */
function routeReqAt(r, age){
  const out = {};
  for(const k in r.attr){
    const extra = Math.floor(Math.max(0, age - (r.age||18)) / 4);
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
  if(r==='jun')   return 10 + S.merit*2 + Math.floor((S.troops||0)*0.1);   /* 经济闭环修复1：军饷按兵力发，兵越多越养得起 */
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

/* ───────── v1.7 增补二 · 黑市商人（正向日常 · 33% 年判定） ─────────
   由 advanceYear（正常年）与 fastForward（快进年）调用；命中返回 {goods:3, refresh:1, buy:2}，
   未命中返回 null。不占主事件名额（独立于 pickEvents 队列）。 */
function blackMarketRoll(force){
  if(typeof BLACKMARKET_GOODS==='undefined' || !BLACKMARKET_GOODS.length) return null;
  if(!force && !chance(.33)) return null;
  const pool = BLACKMARKET_GOODS.slice(), goods = [];
  while(goods.length<3 && pool.length){
    goods.push(pool.splice(ri(0,pool.length-1),1)[0]);
  }
  return { goods:goods, refresh:1, buy:2 };
}

/* ───────── 阶段 ①：结　算 ───────── */
function decayFor(age){
  if(age<15) return 0;
  if(age<=40) return ri(0,1);   /* v1.8 修复1：发育/壮年快进每 2 年约掉 1，留容错（原 15-35 ri(1,2)） */
  if(age<=55) return ri(2,3);   /* 原 ri(3,4) */
  return ri(3,5);               /* 原 ri(5,8)，晚年仍陡峭保命运感 */
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

  /* 健康衰减（修仙境界降低衰减；永生不老则形神不腐，豁免全部衰减与寿命检定） */
  if(S.flags.永生不老){
    notes.push({t:'仙缘',x:'服丹得道，肉身不腐', c:'gain'});
  } else {
    let dec = decayFor(S.age);
    if(S.xianTier>=0) dec = Math.max(0, Math.round(dec*(1-(S.xianTier+1)*0.22)));
    if(dec>0){ S.health = clamp(S.health-dec, -999, S.healthMax);
      notes.push({t:'年岁',x:'健康 －'+dec, c:'loss'}); }
    if(S.age>55 && S.xianTier<0 && chance(.22)){
      const ill = ri(3,9); S.health -= ill;
      notes.push({t:'病痛',x:'偶感风寒，健康 －'+ill, c:'loss'});
      pushLog(S.age, '偶感风寒，卧床旬日。', ''); }
  }

  /* 年龄衰减（§2.4）：修仙者形骸已易，永生不老者亦不受此限 */
  if(S.xianTier<0 && !S.flags.永生不老){
    const worn = ageDecay(S.age, S.attrs);
    if(worn.length){
      notes.push({t:'岁月', x:worn.map(function(k){return k+' －1';}).join(' · '), c:'loss'});
      pushLog(S.age, '镜中鬓已星星。'+worn.join('、')+'不复当年。', '');
    }
  }

  /* 寿命检定（v1.8 黑市改造：保命符已从商品池移除，濒死免死机制一并删除） */
  if(!S.flags.永生不老 && S.health<=0){
    S.pendingEnd = judgeNaturalDeath(true); return notes;
  }
  /* v1.7 增补一 · 花柳直判（用户拍板：不走危机事件，结算期直接判死）：
     染花柳后，年满 max(35, 染龄) 即腐朽而终（b22）。 */
  if(S.flags.花柳 && S.age>=Math.max(35, S.ageAt染||35)){ S.pendingEnd = 'b22'; return notes; }
  if(!S.flags.永生不老 && S.age>=S.lifespan){ S.pendingEnd = judgeNaturalDeath(false); return notes; }

  /* 家族破败闸门 & 仙缘 */
  if(!S.flags.家族破败 && S.attrs.财<=1 && S.attrs.望<=1 && S.age>=16){
    S.flags.家族破败 = true; notes.push({t:'家门',x:'家道已尽', c:'danger'}); }
  if(S.flags.家族破败 && S.health<=Math.round(S.healthMax*0.22) && !S.flags.九死一生){
    S.flags.九死一生 = true; notes.push({t:'绝境',x:'九死一生', c:'danger'}); }
  if(S.flags.家族破败 && S.flags.九死一生 && !S.flags.仙缘 && !S.flags.弃仙缘 && chance(.12)){
    S.flags.仙缘 = true; notes.push({t:'？',x:'冥冥中似有所感', c:'gain'}); }
  /* 宗教顿悟闸门（v1.7 增补二：黑市经卷「向道」可提升悟道概率） */
  if(!S.flags.顿悟 && S.mind>=8 && S.age>=20 && chance(.10 + (S.flags.向道?0.12:0))){
    S.flags.顿悟 = true; notes.push({t:'心',x:'忽有所悟', c:'gain'}); }
  /* 野心 */
  if(!S.flags.野心 && S.merit>=5 && S.world==='乱世' && chance(.35)) S.flags.野心 = true;

  /* 财帛收支（岁入/岁出） */
  const eco = yearEconomy();
  S.money = clampMoney(S, S.money + eco.net);
  notes.push({t:'财帛', x:(eco.net>=0?('岁入 ＋'+eco.net):('岁出 －'+(-eco.net)))+' 银', c: eco.net>=0?'gain':'loss'});

  /* v1.8 PRD · 商铺界面：年度被动结算（地产/垄断/行情游走/持有年限） */
  if(S.estates > 0){
    const inc = Math.floor(S.estates * 0.08);
    if(inc > 0){ S.money = clampMoney(S, S.money + inc); notes.push({t:'地产', x:'田宅岁入 ＋'+inc+' 银', c:'gain'}); }
    /* 查封/灾害清零（行业细分 §二）：率 = max(0.04, 0.18 - guanxi*0.03) */
    const seize = Math.max(0.04, 0.18 - S.guanxi*0.03);
    if(chance(seize)){ S.estates = 0; notes.push({t:'地产', x:'田宅遭查封籍没，片瓦无存', c:'danger'}); }
  }
  if(S.flags.垄断){
    /* 垄断利润（行业细分 §二）：chance(0.7)→money+W*(0.3~0.6)；否则被查 chance(0.3) 道德 -1 */
    if(chance(0.7)){
      const W = Math.max(20, S.attrs.脉*15 + S.attrs.财*10);
      const profit = Math.floor(W * (0.3 + ri(0,30)/100));
      S.money = clampMoney(S, S.money + profit); notes.push({t:'垄断', x:'垄断货利 ＋'+profit+' 银', c:'gain'});
    } else if(chance(0.3)){
      S.moral = Math.max(0, S.moral - 1); notes.push({t:'垄断', x:'垄断事泄，声名受损（道德 －1）', c:'loss'});
    }
  }
  /* 行情游走（0.9~1.1 乘子，钳于 [base*0.5, base*1.6]）+ 持有年限 +1（仅持有时） */
  MARKET_KEYS.forEach(function(k){
    const base = MARKET_CATS[k].base;
    let p = S.market[k] * (0.9 + ri(0,20)/100);
    p = clamp(p, base*0.5, base*1.6);
    /* 先取整再钳整数边界：避免 Math.round 把上限(如 12.8)顶成 13 而越界 */
    S.market[k] = clamp(Math.round(p), Math.ceil(base*0.5), Math.floor(base*1.6));
    if(S.stock[k] && S.stock[k].qty > 0){ S.stockHold[k] = (S.stockHold[k]||0) + 1; }
  });

  /* v1.8 P1 · 六路线年度被动结算（一律走 applyEff 单写入口，不直改 S.xxx） */
  if(S.money < 0) applyEff({troops:-ri(20,50)});                                  /* 军·粮饷不继兵力流失 */
  /* 经济闭环修复4（2026-08-07）：删除医声望 drift / 囤药年度砸手 / 宗香火 drift——
     三处均为设计文档无依据的「系统反向抵消」（坐堂/法会努力被每年白扣，且囤药与 clinicSell 倒卖 30% 砸手重复叠加），
     纯负面直接删除；国手 rep≥8 / 教宗 incense≥10 门槛不再被系统反向抵消。 */

  /* v1.8 帝王线重设计 · 在位被动：每年按领土征税补国库 + 小概率边境侵扰（武力对拼）
     数值口径见《v1.8_帝王与宗教线重设计方案》§3.2/§3.3（TAX_PER_TERR / BORDER_RAID_P） */
  if(S.identity==='diwang' || S.identity==='weimian'){
    const tax = Math.floor((S.territory||0) * TAX_PER_TERR);
    if(tax>0){ S.treasury = (S.treasury||0) + tax; notes.push({t:'岁入', x:'国库 ＋'+tax, c:'gain'}); }
    if(chance(BORDER_RAID_P)){
      const E  = ri(20, 60);
      const me = (S.attrs.武||0) + ri(0, 20);
      if(me >= E){ const g = ri(2,8); S.territory = Math.max(1, (S.territory||0) + g);
        notes.push({t:'边捷', x:'击退来犯，领土 ＋'+g, c:'gain'}); }
      else { const l = ri(3,12); S.territory = Math.max(1, (S.territory||0) - l);
        notes.push({t:'边警', x:'失地，领土 －'+l, c:'loss'}); }
    }
  }

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

/* ═══════════════ v1.8 · 时间步进重构（1 行动 = N 年窗口） ═══════════════
   机制：内部逐年结算不动（doSettle×N / pickEvents×N 原样调用），只压缩玩家停点粒度。
   分阶段步长（用户拍板 5/3/2/1 · 前疏后密）：6–15 → 5 年；16–40 → 3 年；41–60 → 2 年；61–90 → 1 年。
   唯一中途停点：死亡（逐年检定，pendingEnd 置位即中断窗口）。
   事件分层复用 evSig（自 ui.js 移入）：stop → 特殊事件（窗口末弹窗）；swallow → 日常默认给（toast）。 */
function stageN(age){
  if(age<=15) return 5;
  if(age<=40) return 3;
  if(age<=60) return 2;
  return 1;
}
/* 事件分层（R-2 · 默认分级 + 显式 sig）：
   stop → 特殊事件（需玩家选择）：主线/生涯/危机/once/显式 sig:'stop'/任一分支持 end（有终局） */
function evHasEnd(ev){
  if(!ev || !ev.opts) return false;
  return ev.opts.some(function(o){
    return (o.ok && o.ok.eff && o.ok.eff.end) || (o.ko && o.ko.eff && o.ko.eff.end);
  });
}
function evSig(item){
  const ev = item.ev;
  if(ev.sig === 'stop') return 'stop';
  if(item.kind==='main' || item.kind==='career') return 'stop';
  if(ev.once || ev.type==='危机') return 'stop';
  if(evHasEnd(ev)) return 'stop';
  return 'swallow';
}
/* 日常事件「默认给」结算：variants 分支 + 首条可用选项 + 成败二元照常；效果落盘，返回 {t,txt} 供 toast */
function resolveEventDefault(item){
  const ev = item.ev;
  if(ev.variants && ev.variants.length){
    for(let vi=0; vi<ev.variants.length; vi++){
      const v = ev.variants[vi];
      if(v.hook && v.hook(S)){
        if(v.d) ev.d = v.d;
        if(v.eff){ if(!ev.opts[0].eff) ev.opts[0].eff={}; Object.assign(ev.opts[0].eff, v.eff); }
        if(v.l) ev.opts[0].l = v.l;
        break;
      }
    }
  }
  const isMain = item.kind==='main';
  let opt = null;
  for(let i=0; i<ev.opts.length; i++){
    const o = ev.opts[i];
    const attrMet = !o.req || Object.keys(o.req).every(function(k){ return S.attrs[k]>=o.req[k]; });
    const fnMet   = !o.reqFn || !!o.reqFn(S);
    if(attrMet && fnMet){ opt = o; break; }
  }
  if(!opt) return null;
  let chosen;
  if(opt.p!==undefined){ const p=(typeof opt.p==='function')?opt.p(S):opt.p; chosen = chance(p)?opt.ok:opt.ko; }
  else chosen = opt.ok;
  if(!chosen) return null;
  const deltas = applyEff(chosen.eff, isMain ? {rid:item.rid} : null);
  return { t: ev.t, txt: chosen.txt || ev.t, deltas: deltas };
}
function snapStageFlags(){
  const out = {};
  ['家族破败','九死一生','仙缘','顿悟','野心','七下西洋'].forEach(function(k){ out[k] = !!S.flags[k]; });
  return out;
}
function stageFlagsDiff(before){
  const out = {};
  for(const k in before){ if(!!S.flags[k] !== before[k]) out[k] = true; }
  return out;
}
/* v1.8 · 窗口结算主函数：内部逐年跑 doSettle×N + pickEvents×N，收集事件队列；
   步中死亡强制停（唯一中途停点）；窗口末黑市判定 1 次（33%，命中置 S.blackMarketChance=1，不打断）。 */
function advanceByStage(){
  const N = stageN(S.age);
  const q = { years:0, notes:[], dailies:[], specials:[], mains:[], death:null, flags:{}, blackMarket:false };
  const before = snapStageFlags();
  const h0 = S.health, m0 = S.money;
  const dispatchedMains = new Set();               /* v1.8 修复：同窗口内同路线主线只触发一次，避免时间步进压缩导致同一节点重复弹窗 */
  for(let i=0;i<N;i++){
    const notes = doSettle();
    q.notes = q.notes.concat(notes);
    q.years++;
    if(S.pendingEnd){ q.death = S.pendingEnd; break; }
    const evs = pickEvents();
    for(const it of evs){
      if(evSig(it)==='stop'){
        if(it.kind==='main' && dispatchedMains.has(it.rid)) continue; /* 已在本窗口派发同路线主线，跳过 */
        q.specials.push(it);
        if(it.kind==='main'){ dispatchedMains.add(it.rid); q.mains.push(it); }
      }else{
        const r = resolveEventDefault(it);
        if(r){ r.age = S.age; q.dailies.push(r); }   /* age：事件发生年（toast 展示） */
      }
    }
  }
  q.hd = S.health - h0; q.md = S.money - m0;
  q.flags = stageFlagsDiff(before);
  if(chance(.33)){ S.blackMarketChance = 1; q.blackMarket = true; }
  return q;
}

/* ───────── 阶段 ④：更　新 ─────────
   v1.8 P1 · #11 修复：窗口边界重置玩法界面行动点（风险操作预算）。
   原 doUpdate 从未被调用 → playBudget 自 newLife 初始化为 1 后永不重置，
   实际变成「整局只能玩一次」。现改为随窗口长度缩放并在 enterActionPhase（每次回到主界面）调用。
   2026-08-07 用户反馈修正：原公式 Math.max(1, round(stageN/3)) 令 16 岁后所有窗口预算=1，
   成年后每窗口风险操作仍只能 1 次。改为 Math.max(2, stageN)：窗口内每年可做 1 次、保底 2 次。 */
function doUpdate(){
  S.playBudget = Math.max(2, stageN(S.age));
  /* 经济闭环修复2/6：清点钱粮/支取内帑 的窗口内限次标志随窗口重置（enterActionPhase 每窗口调用 doUpdate） */
  S.yamenChecked = false; S.emperorWithdrawn = false;
}

/* ───────── 死法判定（规格 §2.6-3：只留「怎么死的」，成就另由身份轴给出） ─────────
   重构要点：原第一段「显性成就」（rank===5 → 草莽天子／雄主守成、医线国手、政线名臣……）
   整体迁往 IDENTITIES + achievementEnding()；此处只保留死亡形态：
   位高德薄的反噬、修行者的形神之终、贫病横死、绝嗣、寿终正寝。 */
function judgeNaturalDeath(byHealth){
  const a = S.attrs, R = S.routes;
  const on = function(id){ return !!(R[id] && R[id].active); };

  /* ① 位高而德薄 —— 死于反噬（皆属死法，不是成就） */
  if((S.identity==='diwang'||S.identity==='weimian') && S.moral<4) return 'baozheng';       /* 暴虐被弑 */
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

  /* ⑥ v1.8 修复：身份感知型善终——高官/名将/国手/巨贾等不应死于「布衣」（pingdan 文案自带阶层暗示）。
     仅无特殊死法、非凶终、非修仙的兜底路径走到此处；直接复用对应善终结局（含历史原型）。 */
  if(S.identity && typeof ENDINGS!=='undefined'){
    const map = {
      chujiangrux:'chujiang',   /* 出将入相 */
      mingchen:   'mingchen',    /* 名臣 */
      mingjiang:  'mingjiang',   /* 名将 */
      guoshou:    'xinglin',     /* 国手 */
      taiyiling:  'taiyi',       /* 太医令 */
      yaowang:    'yaowang',     /* 药王 */
      hongding:   'hongding',    /* 红顶商人 */
      juaj:       'fujia',       /* 巨贾 */
      jiaozong:   'jiaozong',    /* 教宗 */
      huguo:      'huguo',       /* 护国 */
      zhenren:    'zhenren',     /* 真人 */
      sanxiu:     'sanxiu',      /* 散修 */
      daoren:     'daoren',      /* 道人 */
      zhenjun:    'zhenjun',     /* 真君 */
      dixian:     'dixian',      /* 地仙 */
      zhixian:    'zhixian',     /* 谪仙 */
      diwang:     'xiongzhu',    /* 帝王（非凶终时） */
      weimian:    'guangwu'      /* 位面之子（刘秀） */
    };
    const mapped = map[S.identity];
    if(mapped && ENDINGS[mapped]) return mapped;
  }

  /* ⑦ 兜底：寿终正寝 */
  return 'pingdan';
}

/* ───────── 终局收束（规格 §2.6-4）：成就 × 死法 双轨 ─────────
   primary 为落图鉴与计分的主键：死法属凶终（bad／cut）时以死法为准，
   否则成就铭文优先（善终者以其一生所立之身份论定）。 */
/* v1.8 结局闭环·修复1：仅"身败名裂 / 被定罪 / 被诛"类死法才抹成就；
   战死（马革裹尸/首战阵亡/兵败被俘/军法斩）、因公（大疫染病/庸医误人/医死贵人）、
   修行陨落（走火入魔/渡劫失道/心魔反噬/秘境陨落/兵解化道）一律保留成就。
   ⚠ 注意：b14 功高毒杀（韩信式，亦属"以军旅终"）按军功类逻辑同样保留，不在此集合。 */
const ENDING_ERASE_ACH = new Set([
  'baozheng','jianning','tusi','longduan','zhongdao','eguan','xingchang',
  'b19','b20','b20b','b04x','b04','b03','b07','b02','b21','b21b',
  'b23','b22','b24','danbi','miefa','b05','b06','b01'
]);

function resolveOutcome(){
  let death = (S && S.pendingEnd && ENDINGS[S.pendingEnd]) ? S.pendingEnd : 'pingdan';
  /* v1.8 结局闭环·修复2：帝王/位面之子 的夺权坏结局重映射——避免"帝王却显示谋反/起事"矛盾文案。
     仅作用于 pendingEnd 直写的夺权坏结局；自然善终（judgeNaturalDeath ⑥ 已映射 xiongzhu/guangwu）不受此影响。 */
  if(S && (S.identity==='diwang'||S.identity==='weimian')){
    if(death==='b19' || death==='b20b') death = 'longYu';   /* 起事枭首 / 夺嫡幽死 → 龙驭宾天 */
    else if(death==='b20')             death = 'qinZheng';  /* 谋反事泄 → 御驾亲征殒阵（如用户截图场景） */
  }
  /* v1.7 主文档 B-4 / D-4：弃帝修仙 / 弃名修仙 的虚拟修仙落点（优先级高于普通飞升与帝王铭文）。
     金蝉子由取经链末节点 end 直结，此处为保险兜底（如后续年份自然寿终前仍持双旗标）。 */
  if(S && S.flags.弃帝修仙 && S.xianTier>=2 && ENDINGS['xianyingzheng']) death = 'xianyingzheng';
  if(S && S.flags.弃名修仙 && S.flags.取经悟道 && ENDINGS['jinchanzi']) death = 'jinchanzi';
  /* v1.7 C线 · 郑和远航：从政 + 七下西洋 + rank≥3（官身，与 waijiao/G_hanghai 门槛一致）
     → 善终落点（bad 死亡保留死法，不覆盖凶终） */
  if(S && S.flags.七下西洋 && S.routes.zheng && S.routes.zheng.active && S.rank>=3
     && ENDINGS['zhenghe'] && ENDINGS[death] && ENDINGS[death].k!=='bad'){
    death = 'zhenghe';
  }
  const ach   = achievementEnding();
  const dk    = ENDINGS[death] ? ENDINGS[death].k : 'good';
  const fatal = (dk==='bad');
  /* v1.8 结局闭环·修复1：仅身败类（ENDING_ERASE_ACH）抹成就；honorable 凶终保留成就。 */
  const eraseAch = fatal && ENDING_ERASE_ACH.has(death);
  const aOut = eraseAch ? null : ach;
  /* v1.7：虚拟修仙结局（ascend·史无其人）为主键落点——不因已立身份（教宗/真人）被覆盖，进图鉴异闻分区 */
  const virtual = (death==='xianyingzheng' || death==='jinchanzi');
  /* v1.7 C线：郑和远航为主键（玩家以远航善终论定，不因从政名臣身份被覆盖） */
  const forced  = (death==='zhenghe');
  /* v1.8 结局闭环·修复3：主键以成就为主（honorable 凶终仍取成就）；仅被抹（身败类）或成就与死法同名时回退死法。 */
  const primary = (ach && !eraseAch && !virtual && !forced && ach!==death) ? ach : death;
  return { death:death, ach: aOut, primary:primary, eraseAch:eraseAch,
           identity: S ? S.identity : null, years: S ? S.reignYears : 0 };
}
/* 成就卷录入（图鉴双维之一）：以身份为键，记次数／最高分／最长居位／最高寿 */
function recordIdentity(score){
  if(!S || !S.identity || typeof IDENTITIES==='undefined' || !IDENTITIES[S.identity]) return null;
  const id = S.identity;
  const sc = (typeof score==='number') ? score : 0;
  /* v1.8 修复：列传门槛分——人生评分 < 550（下品底线）不录入青史列传，避免「一生平庸却强行上榜」 */
  if(sc < 550) return null;
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
  /* v1.7 A线/B线：刘秀（陨石/光武/中兴）、嬴政（灭群雄/大一统）专属史鉴原型 */
  if(S.flags.陨石助战 || S.flags.光武 || S.flags.中兴) return 'liuxiu';
  if(S.flags.灭群雄 || S.flags.大一统) return 'qin';
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
  META.lastTier = S.tier;   /* v1.7 增补一：记录上一世出身阶层（继承出身「同阶层±1」收窄的依据） */
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
