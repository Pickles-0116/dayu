/* ═══════════════════════════════════════════════════════════════════
   第三层 · 界面与闭环（UI）——五界面切换、年回合循环、模态、结局/传承
   ═══════════════════════════════════════════════════════════════════ */

/* ───────── 基础工具 ───────── */
function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }
function badge(text, cls){ return '<span class="badge '+(cls||'')+'">'+esc(text)+'</span>'; }
function optLetter(i){ return '甲乙丙丁戊己庚辛壬癸'[i] || (i+1); }
function parseQty(el){ return Math.max(0, parseInt((el.value||'').replace(/\D/g,''),10)||0); }

/* ───────── DOM 速查 ───────── */
const $ = function(id){ return document.getElementById(id); };
let dom = {};
function cacheDom(){
  dom = {
    scrOrigin:$('scr-origin'), scrHud:$('scr-hud'), scrEnding:$('scr-ending'), scrLegacy:$('scr-legacy'),
    originEra:$('origin-era'), houseBar:$('house-bar'), originGrid:$('origin-grid'),
    btnReroll:$('btn-reroll'), rerollMeta:$('reroll-meta'), btnConfirm:$('btn-confirm-origin'),
    hudEra:$('hud-era'), hudAge:$('hud-age'), hudBadges:$('hud-badges'),
    floatLayer:$('float-layer'), attrList:$('attr-list'), axisList:$('axis-list'),
    healthNum:$('health-num'), healthBar:$('health-bar'), healthFill:$('health-fill'), healthNote:$('health-note'), moneyNum:$('money-num'), moneyNote:$('money-note'),
    cultBlock:$('cult-block'), cultTier:$('cult-tier'), cultNum:$('cult-num'), cultFill:$('cult-fill'), cultNote:$('cult-note'),
    tagList:$('tag-list'), narrTitle:$('narr-title'), narrBody:$('narr-body'), logList:$('log-list'),
    routeList:$('route-list'), routeFoot:$('route-foot'),
    actGroup:$('act-group'), fateSlot:$('fate-slot'), actHint:$('act-hint'), btnNext:$('btn-next-year'),
    endingBody:$('ending-body'), legacyBody:$('legacy-body'),
    backdrop:$('backdrop'), modalRoot:$('modal-root'), toastRoot:$('toast-root'), veil:$('veil')
  };
}

/* ───────── 右栏双 tab：路线 / 行事（v1.7 信息架构重构） ─────────
   行动组从底部 actionbar 移入右栏「行事」页；本会话记住上次 tab（内存级） */
let RT_TAB = 'act';   /* v1.7.1:默认行事(开局+每岁均从行事开始) */
function setRtTab(pane){
  RT_TAB = (pane==='act') ? 'act' : 'route';
  const tr = document.getElementById('tab-route');
  const ta = document.getElementById('tab-act');
  const pr = document.getElementById('pane-route');
  const pa = document.getElementById('pane-act');
  if(!tr || !ta || !pr || !pa) return;
  const act = (RT_TAB==='act');
  tr.classList.toggle('is-on', !act); ta.classList.toggle('is-on', act);
  tr.setAttribute('aria-selected', act?'false':'true');
  ta.setAttribute('aria-selected', act?'true':'false');
  pr.hidden = act; pa.hidden = !act;
}

/* ───────── 模态系统（含焦点陷阱 / Esc） ───────── */
let MODAL_ONESC = null;
function trapKey(e){
  if(e.key==='Escape'){ if(MODAL_ONESC){ e.preventDefault(); MODAL_ONESC(); } return; }
  if(e.key!=='Tab') return;
  const f = dom.modalRoot.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])');
  if(!f.length) return;
  const first=f[0], last=f[f.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
}
function openModal(node, opt){
  opt = opt || {};
  dom.modalRoot.innerHTML='';
  dom.modalRoot.appendChild(node);
  dom.backdrop.classList.add('is-on');
  dom.modalRoot.classList.add('is-on');
  MODAL_ONESC = opt.onEsc || null;
  document.addEventListener('keydown', trapKey, true);
  const f = (opt.focusSel && node.querySelector(opt.focusSel)) || node.querySelector('button');
  if(f) f.focus();
}
function closeModal(){
  dom.modalRoot.classList.remove('is-on');
  dom.backdrop.classList.remove('is-on');
  dom.modalRoot.innerHTML='';
  document.removeEventListener('keydown', trapKey, true);
  MODAL_ONESC = null;
}
function toast(t, x, c){
  const d = el('div','toast'+(c==='loss'?' toast--loss':c==='gain'?' toast--gain':c==='danger'?' toast--danger':''));
  /* t 由调用方以代码构造（含 L() 包裹的 .lat 数字），视为可信 HTML；x 为动态文本，仍需 esc */
  d.innerHTML = '<span class="toast__t">'+t+'</span>'+(x?'<span>'+esc(x)+'</span>':'');
  dom.toastRoot.appendChild(d);
  setTimeout(function(){ d.style.transition='opacity .4s'; d.style.opacity='0'; setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 420); }, 2400);
}

/* ═══════════════════════════════════════════════════════════════════
   界面切换
   ═══════════════════════════════════════════════════════════════════ */
function switchScreen(id){
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.toggle('is-on', s.id===id); });
}

/* ═══════════════════════════════════════════════════════════════════
   出身抽取
   ═══════════════════════════════════════════════════════════════════ */
function startNewDraw(){
  DRAW = { pool:[], round:1, maxRound:3, selected:null };
  DRAW.pool = drawOrigins(3);
  renderHouseBar();
  renderOriginCards();
  updateRerollMeta();
  renderDexProgressOrigin();
  dom.btnConfirm.disabled = true;
}
/* v1.7 图鉴常驻入口 · 开局出身屏进度条（F-8 已有披阅青史按钮，补「已录 x / 总」实时进度） */
function renderDexProgressOrigin(){
  const el = document.getElementById('dex-progress-origin');
  if(!el) return;
  const st = dexStat();
  el.textContent = '图鉴已录 '+st.seen+' / '+st.total;
}
function renderHouseBar(){
  const gen = META.gens + 1;
  let tiers = '';
  if(META.gens>=2) tiers += ' · <span class="tier t1">家训初立</span>';
  if(META.gens>=4) tiers += ' · <span class="tier t2">门第有声</span>';
  if(META.gens>=6) tiers += ' · <span class="tier t5">世家气象</span>';
  let html = '<div class="house-bar__row"><span>家族 · 第 <b class="lat">'+gen+'</b> 代</span>'
           + '<span>景元 <b class="lat">'+META.year+'</b> 年</span></div>';
  if(META.gens>0) html += '<div class="house-bar__row"><span class="meta">承前代余荫'+tiers+'</span></div>';
  html += '<div class="house-bar__row" style="margin-top:6px"><button class="btn btn--sm" id="btn-reset" type="button">重立家谱</button></div>';
  dom.houseBar.innerHTML = html;
  const rb = dom.houseBar.querySelector('#btn-reset');
  if(rb) rb.addEventListener('click', function(){ resetMeta(); startNewDraw(); });
}
function renderOriginCards(){
  dom.originGrid.innerHTML='';
  DRAW.pool.forEach(function(o){
    /* P0-1 层级视觉：T3 朱砂顶边 / T4 赭框金角 / T5 泥金描边 + 流光 */
    let tierCls = '';
    if(o.t===5)      tierCls = ' origin-card--t5 gilt gilt--shimmer';
    else if(o.t===4) tierCls = ' origin-card--t4 ochre-corner';
    else if(o.t===3) tierCls = ' origin-card--t3';
    const card = el('div','origin-card'+tierCls);
    card.setAttribute('role','option');
    card.dataset.id = o.id;
    card.dataset.tier = String(o.t);
    card.tabIndex = 0;
    const off = Object.keys(o.off).map(function(k){
      const v=o.off[k], cls = v>0?'off-cell--gain':v<0?'off-cell--loss':'';
      return '<span class="off-cell '+cls+'">'+k+(v>0?'＋':'')+v+'</span>';
    }).join('');
    card.innerHTML =
      '<span class="origin-card__tier"><span class="badge t'+o.t+'">T'+o.t+'</span></span>'
      + '<h3 class="origin-card__name">'+esc(o.n)+'</h3>'
      + '<div class="origin-card__rank">'+esc(o.rn)+'</div>'
      + '<hr class="ink-rule">'
      + '<div class="off-grid">'+off+'</div>'
      + '<p class="origin-card__hook">'+esc(o.hook)+'</p>'
      + '<p class="origin-card__lean">偏途：'+esc(o.lean)+'</p>';
    card.addEventListener('click', function(){ selectOrigin(o.id, card); });
    card.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); selectOrigin(o.id, card); } });
    dom.originGrid.appendChild(card);
  });
}
function selectOrigin(id, card){
  /* card 可省略：未传入时按 id 回查，避免外部调用（含键盘/脚本驱动）时崩溃 */
  const target = card || dom.originGrid.querySelector('.origin-card[data-id="'+id+'"]');
  if(!target) return;
  DRAW.selected = id;
  dom.originGrid.querySelectorAll('.origin-card').forEach(function(c){ c.setAttribute('aria-selected','false'); });
  target.setAttribute('aria-selected','true');
  dom.btnConfirm.disabled = false;
}
function reroll(){
  if(DRAW.round>=DRAW.maxRound) return;
  DRAW.round++; DRAW.selected=null; dom.btnConfirm.disabled=true;
  DRAW.pool = drawOrigins(3);
  renderOriginCards(); updateRerollMeta();
}
function updateRerollMeta(){
  const left = DRAW.maxRound - DRAW.round;
  dom.rerollMeta.textContent = left>0 ? ('尚可换批 '+left+' 次') : '已无可换之批';
  dom.btnReroll.disabled = left<=0;
}
function confirmOrigin(){
  const o = DRAW.pool.find(function(x){ return x.id===DRAW.selected; });
  if(!o) return;
  newLife(o);
  const res = runChildhood(o);
  if(o.beggar && !res.alive){
    S.ended = true; S.pendingEnd = 'eguan';
    showGauntletDeath();
    return;
  }
  /* 开局派发第 1 张机遇卡 */
  drawFate();
  S.fateLastYear = S.age;
  switchScreen('scr-hud');
  setRtTab(RT_TAB);   /* v1.7.1:开局默认「行事」(RT_TAB 初值 act) */
  render();
}

/* ═══════════════════════════════════════════════════════════════════
   年回合循环（v1.8 重构）：行动 → N 年窗口（引擎 advanceByStage）→ 事件弹窗流 → 行动
   「度过此 N 年」按钮 = 直接进窗口（无行动可做时的收尾）；行动后自动进窗口（doAction 内）
   ═══════════════════════════════════════════════════════════════════ */
function advanceYear(){
  passStage();
}
/* v1.8 增补 · 行动按钮 bug 根治（方案 B · 综合弹窗）
   旧 runEventQueue 同步递归 showEvent + openModal 的 modalRoot.innerHTML='' 会清空前一个弹窗的
   DOM 与其 click 监听器 → 前一个 onDone 永不触发 → 递归链断裂 → enterActionPhase 永不调用 →
   phase 永远 busy → 行动按钮永久 disabled（窗口内 specials≥2 必触发）。
   改为：窗口内所有特殊事件合并进「单」综合弹窗，按发生顺序逐个决策区，底部「完成」统一触发 onDone。
   彻底绕开 openModal 清空 bug，且无递归链。 */
function renderBatchEventModal(queue, onDone){
  const modal = el('div','modal modal--batch');
  modal.innerHTML =
    '<div class="modal__type"><span class="badge badge--gilt">窗口要事</span></div>'
    + '<h2 class="modal__title">此 '+L(stageN(S.age))+' 年间，有几桩要事须你决断</h2>'
    + '<div class="batch-list" id="batch-list"></div>'
    + '<div class="modal__foot"><button class="btn btn--primary" id="batch-done" type="button" disabled>完成</button></div>';
  const list = modal.querySelector('#batch-list');
  let pending = queue.length;
  queue.forEach(function(item, qi){
    const ev = item.ev;
    /* variants 分支解析（同原 showEvent：命中第一个 hook 满足条件的分支即采用其 d/eff/l） */
    if(ev.variants && ev.variants.length){
      for(let vi=0; vi<ev.variants.length; vi++){
        const v=ev.variants[vi];
        if(v.hook && v.hook(S)){
          if(v.d) ev.d=v.d;
          if(v.eff){ if(!ev.opts[0].eff) ev.opts[0].eff={}; Object.assign(ev.opts[0].eff, v.eff); }
          if(v.l) ev.opts[0].l=v.l;
          break;
        }
      }
    }
    const isMain = item.kind==='main';
    const typeLabel = (ev.type || '通用');
    const mainSuffix = isMain && typeLabel !== '主线' ? ' · 主线' : '';
    const block = el('div','batch-block'+(isMain?' batch-block--main':''));
    block.innerHTML =
      '<div class="batch-block__hd"><span class="badge ev-'+(ev.type||'通用')+'">'+typeLabel+mainSuffix+'</span><h3>'+esc(ev.t)+'</h3></div>'
      + '<p class="batch-block__lead">'+esc(ev.d)+'</p>'
      + '<div class="opts" data-block="'+qi+'"></div>';
    const optsBox = block.querySelector('.opts');
    ev.opts.forEach(function(opt, i){
      const attrMet = !opt.req || Object.keys(opt.req).every(function(k){ return S.attrs[k]>=opt.req[k]; });
      const fnMet   = !opt.reqFn || !!opt.reqFn(S);
      const reqMet  = attrMet && fnMet;
      let hint = opt.hint||'';
      if(opt.p!==undefined){ const p=(typeof opt.p==='function')?opt.p(S):opt.p; hint = (hint?hint+' · ':'')+'成败 '+Math.round(p*100)+'%'; }
      if(!attrMet){ hint = (hint?hint+' · ':'')+'需 '+Object.keys(opt.req).map(function(k){return k+'≥'+opt.req[k];}).join(' '); }
      if(!fnMet){ hint = (hint?hint+' · ':'')+'需 '+(opt.reqText||'条件未足'); }
      const o = el('button','opt'+(opt.danger?' opt--danger':''));
      o.innerHTML = '<span class="opt__no">'+optLetter(i)+'</span>'
                  + '<span><span>'+esc(opt.l)+'</span><span class="opt__hint">'+esc(hint)+'</span></span>';
      if(!reqMet) o.disabled = true;
      o.addEventListener('click', function(){
        if(o.disabled) return;
        const r = resolveOpt(opt, isMain?{rid:item.rid}:null);
        optsBox.querySelectorAll('.opt').forEach(function(b){ b.disabled = true; });
        o.classList.add('opt--chosen');
        const resEl = el('div','result '+resClass(r.deltas));
        resEl.innerHTML = '<p class="result__txt">'+esc(r.txt)+'</p>';
        block.appendChild(resEl);
        pending--; updateDoneBtn();
        if(S.pendingEnd){ closeModal(); finishToEnding(); return; }
      });
      optsBox.appendChild(o);
    });
    /* 全选项不可选（时势未至）→ 自动跳过该块，避免卡死 */
    if(!optsBox.querySelector('.opt:not(:disabled)')){
      pending--;
      const resEl = el('div','result');
      resEl.innerHTML = '<p class="result__txt">时势未至，此事无从着手。</p>';
      block.appendChild(resEl);
    }
    list.appendChild(block);
  });
  const doneBtn = modal.querySelector('#batch-done');
  function updateDoneBtn(){ doneBtn.disabled = pending > 0; }
  updateDoneBtn();
  doneBtn.addEventListener('click', function(){
    closeModal();
    if(S.pendingEnd) finishToEnding();
    else onDone();
  });
  openModal(modal, { focusSel:'#batch-done', onEsc:null });
}
function enterActionPhase(){
  doUpdate();   /* v1.8 P1 · #11 修复：回到主界面即刷新玩法行动点（随窗口长度缩放） */
  S.phase = 'action'; S.actionDone = false;
  setRtTab('act');   /* v1.7.1:每岁进入行动阶段自动切「行事」 */
  render();
}

/* ═══════════════ v1.8 · 时间步进重构（窗口结算 + 事件弹窗流） ═══════════════
   1 行动 = N 年窗口（stageN 由引擎结算）；行动后自动进入窗口，无需「推进」逐岁点击。
   窗口末渲染事件弹窗流：
   ① 日常事件 toast 流（每事件 1 条轻量 toast · 默认给 · 无需选择，applyEff+日志已由引擎落盘）
   ② 特殊事件弹窗队列（主线全弹 · 非主线封顶 2 个，按发生顺序逐个弹，玩家决策）
   弹窗流处理完 → 进入行动阶段；步中死亡为唯一中途停点（直接进结局）。 */
function renderStageWindow(q){
  if(!S || !q){ enterActionPhase(); return; }
  if(q.death){ setTimeout(finishToEnding, 900); return; }
  /* ① 日常 toast 流：每事件 1 条，快速连续（650ms 间隔），非阻塞 */
  q.dailies.forEach(function(d, i){
    setTimeout(function(){
      const loss = (d.deltas||[]).some(function(x){ return x.v<0; });
      toast('第 '+L(d.age)+' 年 · '+esc(d.t), d.txt || '', loss?'loss':'');
    }, i*650);
  });
  /* ② 特殊事件弹窗队列：主线全弹（不丢路线分歧选择），非主线封顶 2（超出静默结算默认分支） */
  const queue = [];
  q.specials.forEach(function(it){
    if(it.kind==='main'){ queue.push(it); return; }
  });
  let cap = 0;
  q.specials.forEach(function(it){
    if(it.kind==='main') return;
    if(cap >= 2){ resolveEventDefault(it); return; }   /* 超封顶非主线：默认分支结算 */
    cap++; queue.push(it);
  });
  if(queue.length){
    renderBatchEventModal(queue, function(){ enterActionPhase(); });
  }else{
    setTimeout(enterActionPhase, Math.max(350, q.dailies.length*650));
  }
}
/* 「度过此 N 年」按钮（原「推进一年」位置）：无合适行动/不想行动时点击 = 直接进 N 年窗口 */
function passStage(){
  if(!S || S.ended || S.phase!=='idle') return;
  S.phase = 'busy'; render();
  renderStageWindow(advanceByStage());
}
function onActionClick(act){
  if(S.phase!=='action' || S.actionDone || S.ended) return;
  if(act.confirm) showConfirm(act, function(){ doAction(act); });
  else doAction(act);
}
function doAction(act){
  const r = act.run(S);
  applyEff(r.eff, null);
  if(r.txt) pushLog(S.age, r.txt, '');
  S.actionDone = true;
  setRtTab('route');   /* v1.7:行动后自动切回「路线」,看路线进度反馈 */
  render();
  if(S.pendingEnd){ setTimeout(finishToEnding, 500); return; }
  S.phase = 'idle'; S.actionDone = false;
  render();
  /* v1.8 · 行动后自动进入 N 年窗口（无需再点「推进」）；doAction 是核心回合决策，先短暂展示结果再推进 */
  setTimeout(function(){ renderStageWindow(advanceByStage()); }, 200);
}

/* ───────── 事件弹窗 ───────── */
function resolveOpt(opt, ctx){
  let chosen;
  /* v1.8 黑市改造：左轮必胜——jun 链 active + 包里有 revolver + 选项有 p → 强制成功并消耗子弹 */
  const hasRevolver = Array.isArray(S.bag) && S.bag.indexOf('revolver')>=0;
  const junActive = !!(S.routes.jun && S.routes.jun.active);
  if(hasRevolver && junActive && opt.p!==undefined){
    chosen = opt.ok;
    S.bag.splice(S.bag.indexOf('revolver'), 1);
    pushLog(S.age, '「砰」——你抬腕扣动左轮，枪响处敌已倒地。', 'key');
  } else if(opt.p!==undefined){
    const p=(typeof opt.p==='function')?opt.p(S):opt.p; chosen = chance(p)?opt.ok:opt.ko;
  }
  else chosen = opt.ok;
  const deltas = applyEff(chosen.eff, ctx);
  return { txt:chosen.txt, deltas:deltas };
}
function resClass(deltas){
  if(!deltas || !deltas.length) return '';
  const g=deltas.filter(function(d){return d.v>0;}).length, l=deltas.filter(function(d){return d.v<0;}).length;
  if(g>l) return 'result--gain'; if(l>g) return 'result--loss'; return '';
}
/* v1.8 增补：showEvent / runEventQueue / showEventResult 已删除——
   原 runEventQueue 同步递归 showEvent + openModal 的 innerHTML='' 会清空前弹窗监听器，
   导致 onDone 链断裂、phase 卡 busy、行动按钮永久 disabled。
   由 renderBatchEventModal（单综合弹窗多决策区）取代，见 enterActionPhase 上方。 */
function showConfirm(act, onYes){ showConfirmBox(act.confirm(S), onYes); }
/* 通用二次确认：任何不可逆操作（行动 confirm / 路线转途）共用一套仪轨 */
function showConfirmBox(c, onYes){
  const modal = el('div','modal modal--confirm');
  modal.innerHTML =
    '<div class="confirm__hd"><span class="seal seal--danger">慎</span>'
    + '<h2 class="confirm__title">'+esc(c.title)+'</h2></div>'
    + '<dl class="dl">'
    + '<dt>预期</dt><dd>'+esc(c.expect||'—')+'</dd>'
    + '<dt>成功率</dt><dd class="is-rate">'+esc(c.rate||'—')+'</dd>'
    + '<dt>代价</dt><dd class="is-cost">'+esc(c.cost||'—')+'</dd>'
    + (c.left!==null && c.left!==undefined ? '<dt>余下</dt><dd class="is-loss">'+esc(c.left)+'</dd>' : '')
    + '</dl>'
    + '<div class="danger-zone">'+esc(c.warn||'此举一去不返')+'</div>'
    + '<div class="modal__foot">'
    + '<button class="btn" data-focus="1" id="cf-no">作罢</button>'
    + '<button class="btn btn--danger" id="cf-yes">决行</button></div>';
  modal.querySelector('#cf-no').addEventListener('click', function(){ closeModal(); });
  modal.querySelector('#cf-yes').addEventListener('click', function(){ closeModal(); onYes(); });
  openModal(modal, { focusSel:'#cf-no', onEsc:function(){ closeModal(); } });
}

/* ═══════════════ v1.7 增补二 · 黑市商人弹层（3 件 · 刷新 1 次 · 买 2 次） ═══════════════ */
/* 黑市购买核心（纯逻辑，UI 事件委托只负责触发；探针可直测）：
   每件商品库存 1（bought 标记，同一商品最多买 1 次）；全局最多买 2 件（从不同商品中挑）。
   命名 blackMarketBuy：避免与 engine.js 商铺版 shopBuy(cat,amt) 同名覆盖（2026-08-07 修复——
   此前 ui.js 后加载覆盖 engine，导致商铺「确认进货」误入黑市签名抛 TypeError）。 */
function blackMarketBuy(shop, i){
  const g = shop.goods[i];
  if(!g || g.bought || S.money < g.price || shop.buy<=0) return { ok:false };
  S.money = clampMoney(S, S.money - g.price);
  shop.buy--; g.bought = true;
  if(g.use==='hold'){
    S.bag.push(g.id);
    return { ok:true, hold:true, txt:'存入包袱' };
  }
  const deltas = applyEff(g.eff, null);
  return { ok:true, txt:deltas.map(function(d){ return (d.v>0?'+':'')+d.k+' '+Math.abs(d.v); }).join(' · ')||'即时生效' };
}
function showShop(shop, onClose){
  const modal = el('div','modal');
  modal.innerHTML =
    '<div class="modal__type"><span class="badge badge--gilt">黑市商人</span></div>'
    + '<h2 class="modal__title">夜航船 · 黑市</h2>'
    + '<p class="modal__lead">「客官，货在此，银在此，缘分也在此。」</p>'
    + '<div class="shop-money meta" id="shop-money"></div>'
    + '<div class="shop-grid" id="shop-goods"></div>'
    + '<div class="modal__foot">'
    + '<button class="btn" id="shop-refresh" type="button">刷新货品（余 1 次）</button>'
    + '<button class="btn btn--primary" id="shop-done" type="button">收摊</button></div>';
  openModal(modal, { focusSel:'#shop-done', onEsc:function(){ closeModal(); onClose(); } });
  /* 商品浅拷贝为「每件实例」：bought 标记不污染共享 BLACKMARKET_GOODS 池 */
  shop.goods = shop.goods.map(function(g){ return Object.assign({}, g, { bought:false }); });
  const goodsBox = dom.modalRoot.querySelector('#shop-goods');
  const renderGoods = function(){
    dom.modalRoot.querySelector('#shop-money').innerHTML = '囊中 <b class="lat">'+L(S.money)+'</b> 银 · 尚可购 <b class="lat">'+shop.buy+'</b> 件';
    goodsBox.innerHTML = shop.goods.map(function(g, i){
      const afford = !g.bought && S.money >= g.price && shop.buy > 0;
      return '<div class="shop-item'+(afford?'':' shop-item--sold')+'">'
        + '<div class="shop-item__n">'+esc(g.n)+'</div>'
        + '<p class="shop-item__d">'+esc(g.d)+'</p>'
        + '<div class="shop-item__row"><span class="shop-item__price">'+L(g.price)+' 银</span>'
        + '<button class="btn btn--sm" data-buy="'+i+'" '+(afford?'':'disabled')+' type="button">'+(g.bought?'已购':'购')+'</button></div></div>';
    }).join('');
  };
  /* 事件委托：监听挂商品容器上，renderGoods 重建按钮后监听不丢；
     同一商品库存 1（bought 后置灰「已购」），全局 2 次从不同商品中挑。 */
  goodsBox.addEventListener('click', function(ev){
    const t = ev.target;
    const btn = (t && t.closest) ? t.closest('[data-buy]') : null;
    if(!btn || btn.disabled) return;
    const i = parseInt(btn.getAttribute('data-buy'),10);
    const r = blackMarketBuy(shop, i);
    if(!r.ok) return;
    const g = shop.goods[i];
    pushLog(S.age, '黑市购得「'+g.n+'」。', '');
    toast('购入 · '+g.n, r.txt, 'gain');
    if(shop.buy<=0){ const rf = dom.modalRoot.querySelector('#shop-refresh'); if(rf) rf.disabled = true; }
    renderGoods(); render();
  });
  renderGoods();
  const ref = dom.modalRoot.querySelector('#shop-refresh');
  ref.addEventListener('click', function(){
    if(shop.refresh<=0) return;
    shop.refresh--; shop.buy = 2;
    const pool = BLACKMARKET_GOODS.slice(), out = [];
    while(out.length<3 && pool.length){ out.push(pool.splice(ri(0,pool.length-1),1)[0]); }
    shop.goods = out.map(function(g){ return Object.assign({}, g, { bought:false }); });
    ref.disabled = true; ref.textContent = '货已换过一茬';
    renderGoods();
  });
  dom.modalRoot.querySelector('#shop-done').addEventListener('click', function(){ closeModal(); onClose(); });
}
/* 持有型道具使用（行事页「包袱」）：applyEff 生效并移出背包 */
function useBagItem(gid){
  const g = BLACKMARKET_GOODS.find(function(x){ return x.id===gid; });
  if(!g || !S.bag) return;
  const idx = S.bag.indexOf(gid);
  if(idx<0) return;

  /* v1.8 增补：mech 特殊道具分支（长生不老丹药·半成品） */
  if(g.mech==='changsheng'){
    S.bag.splice(idx,1);
    if(chance(.2)){                         /* 20% 永生不老：从此不消耗健康值 */
      S.flags.永生不老 = true;
      applyEff({h: 9999}, null);            /* 回满当前健康 */
      const txt = '丹气氤氲，须发返青——火候虽欠，竟蒙天眷，肉身不腐，寿元无尽！';
      pushLog(S.age, '服「长生不老丹药·半成品」：'+txt, 'key');
      toast('服 · 半成品丹药', txt, 'gain');
      render();
    } else {                               /* 80% 丹毒暴毙：直接死亡 */
      pushLog(S.age, '服「长生不老丹药·半成品」：丹毒翻涌，七窍流血，立毙。', 'key');
      S.pendingEnd = 'danbi';
      finishToEnding();                     /* 立即进入终局 */
    }
    return;
  }

  const deltas = applyEff(g.eff, null);
  S.bag.splice(idx,1);
  pushLog(S.age, '用「'+g.n+'」：'+(g.useTxt||'—'), '');
  toast('用 · '+g.n, deltas.map(function(d){ return (d.v>0?'+':'')+d.k+' '+Math.abs(d.v); }).join(' · ')||'收讫', 'gain');
  render();
}

/* ═══════════════════════════════════════════════════════════════════
   主界面渲染
   ═══════════════════════════════════════════════════════════════════ */
function render(){
  if(!S) return;
  dom.hudEra.innerHTML = '大虞 · 景元 '+L(S.baseYear+S.age)+' 年';
  dom.hudAge.textContent = S.age;
  dom.hudAge.classList.remove('is-tick'); void dom.hudAge.offsetWidth; dom.hudAge.classList.add('is-tick');
  renderBadges(); renderAttr(); renderAxis(); renderHealth(); renderCult(); renderMoney();
  renderTags(); renderRoutes(); renderNarr(); renderLog();
  renderFate(); renderActions(); renderBag(); renderRouteFoot(); renderBlackMarket(); renderPlayScreens();
  dom.btnNext.disabled = !(S.phase==='idle' && !S.ended);
  /* v1.8 · 「度过此 N 年」按钮文案随阶段步长变化 */
  if(dom.btnNext && typeof stageN==='function'){
    dom.btnNext.textContent = '度过此 '+stageN(S.age)+' 年';
  }
}
function renderBadges(){
  const b = [];
  b.push(badge(S.world==='乱世'?'乱世':'治世', S.world==='乱世'?'badge--solid':''));
  b.push(badge(RANKS[S.rank]||'—',''));
  /* v1.7.1:性别徽章暂隐藏 — 女性路线/原型适配后续更新再加(女性走男帝王史鉴不对) */
  // if(S.sex) b.push(badge(S.sex,''));
  if(S.flags.修仙入门) b.push(badge('修仙','badge--gilt'));
  if(S.flags.野心) b.push(badge('野心',''));
  if(S.married) b.push(badge('已婚',''));
  if(S.flags.夺嫡入局) b.push(badge('夺嫡',''));
  if(S.identity && typeof IDENTITIES!=='undefined' && IDENTITIES[S.identity]){
    const idb=IDENTITIES[S.identity];
    b.push(badge((idb.b? idb.b+' · ':'')+idb.n,'badge--gilt'));
  }
  dom.hudBadges.innerHTML = b.join('');
}
const ATTR_GLYPH = {体:'气',智:'智',才:'文',武:'刃',魅:'妍',财:'财',望:'望',脉:'脉'};
function routeTargets(){
  /* 聚合所有「已可视」路线对该维的最高要求，作为达标线 */
  const map = {};
  ROUTES.forEach(function(r){
    if(!r.vis(S)) return;
    if(r.kind!=='暗线'){
      for(const k in r.attr){ map[k] = Math.max(map[k]||0, r.attr[k]); }
    }
  });
  return map;
}
function renderAttr(){
  const targets = routeTargets();
  dom.attrList.innerHTML = ATTRS.map(function(k){
    const v=S.attrs[k], pct=clamp(v/ATTR_CAP*100,0,100);
    const target = targets[k]||0;
    const ready  = target>0 && v>=target;
    let inner = '<span class="attr-track">'
      + '<span class="attr-fill" style="width:'+pct+'%"></span>';
    if(target>0){
      inner += '<span class="attr-target'+(ready?' attr-target--reached':'')+'" style="left:'+clamp(target/ATTR_CAP*100,0,100)+'%" title="路线达标 '+target+'"></span>';
    }
    inner += '<span class="attr-cap" title="上限 '+ATTR_CAP+'"></span>';
    inner += '</span>';
    return '<div class="attr-row'+(ready?' attr-row--ready':'')+'">'
      + '<span class="attr-name">'+k+'<span class="attr-glyph" aria-hidden="true">'+ATTR_GLYPH[k]+'</span></span>'
      + inner
      + '<span class="attr-val">'+L(v)+'</span></div>';
  }).join('');
}
function renderAxis(){
  const axes=[['心境',S.mind],['道德',S.moral],['寿元',S.lifespan]];
  dom.axisList.innerHTML = axes.map(function(a){
    return '<button class="axis-hidden" type="button"><span>'+a[0]+'</span><b class="lat">'+a[1]+'</b>'
      + '<span class="axis-tip">'+a[0]+' · '+a[1]+'</span></button>';
  }).join('');
}
function renderHealth(){
  const pct = clamp(S.health/S.healthMax*100,0,100);
  dom.healthNum.innerHTML = L(Math.max(0,S.health))+'<span style="font-size:.7em;color:var(--ink-300)"> / '+L(S.healthMax)+'</span>';
  dom.healthFill.style.width = pct+'%';
  dom.healthBar.classList.toggle('health--low', S.health>0 && pct<25);
  dom.healthBar.classList.toggle('health--xian', S.xianTier>=0);
  dom.healthNote.textContent = S.health<=0?'命悬一线':(pct<25?'羸弱':(pct>75?'康健':'寻常'));
}
function renderMoney(){
  /* v1.8 帝王线重设计 · 称帝后主指标为国库/领土/兵力：银行变国库行 */
  if(S.identity==='diwang' || S.identity==='weimian'){
    dom.moneyNum.innerHTML = '<span style="color:var(--st-gain)">'+L(S.treasury||0)+'</span><span style="font-size:.7em;color:var(--ink-300)"> 银 · 国库</span>';
    dom.moneyNote.textContent = '领土 '+L(S.territory||0)+' 州 · 兵力 '+L(S.troops||0);
    return;
  }
  dom.moneyNum.innerHTML = '<span style="color:'+(S.money<0?'var(--st-danger)':'inherit')+'">'+L(S.money)+'</span><span style="font-size:.7em;color:var(--ink-300)"> 银</span>';
  dom.moneyNote.textContent = S.debt ? (S.money<0?'债台高筑':'勉力还债')
    : S.flags.mundane ? '坐吃山空'
    : (S.money<0 ? '衣食无着' : (S.money<=12?'囊中羞涩':(S.money>=120?'家资颇丰':'家境尚可')));
}
function renderCult(){
  /* 未入修仙之门则不显；已入门但尚未结丹（tier -1 凡人）也须显示「引气入体」进度 */
  if(!S.flags.修仙入门 && S.xianTier<0){ dom.cultBlock.hidden = true; return; }
  dom.cultBlock.hidden = false;
  dom.cultTier.textContent = S.xianTier<0 ? '凡　胎' : (XIAN_TIERS[S.xianTier]||'练气');
  const need = S.xianTier<5 ? xianNeed(S.xianTier) : null;
  const pct  = S.xianTier<5 ? clamp(S.cult/need*100,0,100) : 100;
  dom.cultNum.innerHTML = L(S.cult)+(need?(' / '+L(need)):'');
  dom.cultFill.style.width = pct+'%';
  /* 数字须由 .lat 包裹（DESIGN §5 表格数字），故用 innerHTML 而非 textContent */
  dom.cultNote.innerHTML = S.xianTier<5
    ? ('距「'+esc(XIAN_TIERS[S.xianTier+1]||'练气')+'」尚差 '+L(Math.max(0, need-S.cult)))
    : '已至渡劫 · 可飞升';
}
function renderTags(){
  dom.tagList.innerHTML = S.tags.length
    ? S.tags.map(function(t){ return '<span class="chip">'+esc(t)+'</span>'; }).join('')
    : '<span class="meta">— 尚无 —</span>';
}
function renderFate(){
  if(S.ended){ dom.fateSlot.innerHTML = ''; return; }
  if(S.fate){
    const c = S.fate;
    dom.fateSlot.innerHTML =
      '<button class="fate-card" id="btn-fate" type="button" title="点击触发此卡">'
      + '<span class="fate-card__tag">机遇 · '+(KIND_TAG[c.kind]||c.kind)+'</span>'
      + '<div class="fate-card__t">'+esc(c.n)+'</div>'
      + '<p class="fate-card__d">'+esc(c.d)+'</p>'
      + '<div class="fate-card__eff">'+esc(fateEffText(c.eff))+'</div>'
      + '<div class="fate-card__cta">点 此 触 发</div>'
      + '</button>';
    const btn = document.getElementById('btn-fate');
    if(btn) btn.addEventListener('click', onFateClick);
  } else {
    const next = Math.max(0, 3 - (S.age - (S.fateLastYear||0)));
    const txt = next===0 ? '下岁将至'
      : '下张将于 '+L(S.age+next)+' 岁至';
    dom.fateSlot.innerHTML =
      '<div class="fate-slot__empty" aria-label="当前无机遇卡">'
      + '<span>本岁未有可发之卡</span>'
      + '<b>'+txt+'</b>'
      + '</div>';
  }
}
/* 入 id 这条明线，将被顶掉的在营明线名（F-R3 转途） */
function switchVictimNames(id){
  return activeBrightIds().filter(function(x){ return x!==id; }).map(function(x){
    const o = ROUTES.find(function(y){ return y.id===x; });
    return o ? o.n : x;
  });
}
function renderRoutes(){
  /* 收集 + 排序：行 → 可入 → 近达标(差 ≤ 1 步) → 未启(其他) */
  const list = ROUTES.map(function(r){
    const st = routeState(r);
    return { r:r, st:st };
  }).filter(function(x){ return x.st!=='hidden'; });

  const score = function(x){
    if(x.st==='active') return 0;
    if(x.st==='ready')  return 1;
    /* 计算差距：差 1 步以内算「近」 */
    const r = x.r; const gaps = [];
    if(S.age < r.age) gaps.push(1);
    const req = routeReqAt(r, S.age);
    for(const k in req){ const d = req[k]-S.attrs[k]; if(d>0) gaps.push(d); }
    if(!r.cond(S)) gaps.push(1);
    const totalGap = gaps.reduce(function(a,b){ return a+b; }, 0);
    if(totalGap>0 && totalGap<=1) return 2;
    return 3;
  };
  list.sort(function(a,b){
    const sa = score(a), sb = score(b);
    if(sa!==sb) return sa-sb;
    return (b.r.kind==='暗线'?1:0) - (a.r.kind==='暗线'?1:0);
  });

  /* 路线三层分组（F-8）：立身 → 夺权 → 出世 */
  function routeCardHTML(x){
    const r = x.r, st = x.st;
    let cls='route-card ', mark='', gap='', prog='', tag='';
    if(r.kind==='暗线') tag = '<span class="route-card__tag">暗线</span>';
    if(st==='active'){
      cls+='route-card--active';
      if(r.kind==='暗线') cls+=' route-card--dark';
      mark='行';
      const chain = CHAINS[r.id];
      const total = chain?chain.nodes.length:0;
      const node = S.routes[r.id]?S.routes[r.id].node:0;
      if(total>0){
        gap='第 [['+node+1+']] / [['+total+']] 节';
        let steps='';
        for(let i=0;i<total;i++){
          const cls2 = (i<node)?'on':(i===node?'cur':'');
          steps += '<i class="'+cls2+'"></i>';
        }
        prog='<div class="route-prog-steps">'+steps+'</div>';
      } else { gap='起事在即 · 待决'; }
    } else if(st==='ready'){
      cls+='route-card--ready';
      if(r.kind==='暗线') cls+=' route-card--dark';
      mark='可入'; gap=routeGap(r);
      /* F-R3：此路会顶掉在营明线（旧业节点归零）→ 明示「转途」，点击时二次确认 */
      if(comboCheck(r.id)==='switch'){
        cls+='route-card--switch ';
        mark='转途';
        gap='须舍「'+switchVictimNames(r.id).join('、')+'」· 旧业节点归零';
      }
    } else if(score(x)===2){
      cls+='route-card--near';
      if(r.kind==='暗线') cls+=' route-card--dark';
      mark='近'; gap='差 1 步 · '+routeGap(r);
    } else {
      cls+='route-card--locked';
      if(r.kind==='暗线') cls+=' route-card--dark';
      mark='未启'; gap=routeGap(r);
    }
    return '<button class="'+cls+'" data-rid="'+r.id+'" '+(st==='ready'?'':'disabled')+' type="button">'
      + tag
      + '<span class="route-card__name">'+esc(r.n)+'</span>'
      + '<span class="route-card__mark">'+mark+'</span>'
      + '<div class="route-card__gap">'+esc(gap).replace(/\[\[(\d+)\]\]/g, '<span class="lat">$1</span>')+'</div>'+prog+'</button>';
  }
  let html = '';
  ROUTE_LAYERS.forEach(function(L){
    const items = list.filter(function(x){ return x.r.layer===L.id; });
    if(!items.length) return;
    html += '<div class="route-layer"><div class="route-layer__hd">'+esc(L.id)
          + '<span class="meta">'+esc(L.d)+'</span></div>';
    items.forEach(function(x){ html += routeCardHTML(x); });
    html += '</div>';
  });

  /* 碌碌无为：不事产业之选项（不入路线三层，单列） */
  {
    const mundane = !!S.flags.mundane;
    const hasActive = Object.keys(S.routes).some(function(id){ return S.routes[id] && S.routes[id].active; });
    let cls='route-card ', mark='', gap='';
    if(mundane){ cls+='route-card--active route-card--mundane'; mark='闲居'; gap='坐吃山空 · 财帛逐年耗散 · 可重入仕途'; }
    else if(hasActive){ cls+='route-card--locked route-card--mundane'; mark='已业'; gap='已入仕途，不可半途闲居'; }
    else { cls+='route-card--ready route-card--mundane'; mark='可选'; gap='不事产业，安于碌碌 · 财帛逐年减'; }
    html += '<div class="route-layer"><div class="route-layer__hd">闲居<span class="meta">不事产业 · 安于碌碌</span></div>';
    html += '<button class="'+cls+'" data-mundane="1" '+(mundane||!hasActive?'':'disabled')+' type="button">'
      + '<span class="route-card__name">闲居 · 碌碌无为</span>'
      + '<span class="route-card__mark">'+mark+'</span>'
      + '<div class="route-card__gap">'+esc(gap)+'</div></button></div>';
  }

  dom.routeList.innerHTML = html || '<div class="meta">— 尚无可用之路 —</div>';
  dom.routeList.querySelectorAll('.route-card--ready').forEach(function(btn){
    btn.disabled = false;
    btn.addEventListener('click', function(){
      const rid = btn.dataset.rid;
      const r = ROUTES.find(function(x){ return x.id===rid; });
      /* 无圣旨：第 2 条明线硬阻（deny）——不激活、不毁旧线，仅提示 */
      if(comboCheck(rid)==='deny'){
        showConfirmBox({
          title:'需奉旨方可兼修',
          expect:'你尚未持有「圣旨」，一生只能择一明线而行。',
          rate:'不可为',
          cost:'先去黑市寻得圣旨，方能接取其他线路。',
          left:null, warn:'此路暂不通。'
        }, function(){});   // 空回调：仅提示，不激活
        return;
      }
      /* 转途不可逆：旧明线离线且节点归零，先请示再落子（入线日志由 activateRoute 统一打） */
      if(comboCheck(rid)==='switch'){
        const olds = switchVictimNames(rid).join('、');
        showConfirmBox({
          title: '转途 · 舍「'+olds+'」而就「'+(r?r.n:rid)+'」',
          expect: '入「'+(r?r.n:rid)+'」之途，自第一节重起。',
          rate:   '必成',
          cost:   '「'+olds+'」即刻离线，已行节点尽数归零。',
          left:   null,
          warn:   '前功只留在履历上，不在手上。此举一去不返。'
        }, function(){ activateRoute(rid); render(); });
        return;
      }
      activateRoute(rid);
      render();
    });
  });
  dom.routeList.querySelectorAll('[data-mundane]').forEach(function(btn){
    btn.addEventListener('click', function(){
      if(S.flags.mundane){ S.flags.mundane=false; }
      else { S.flags.mundane=true; for(const id in S.routes) S.routes[id].active=false; }
      pushLog(S.age, S.flags.mundane?'弃了事业，闲居度日。':'重拾生计，再谋出路。', 'key');
      render();
    });
  });
}
function renderNarr(){
  if(!S.narr){ dom.narrTitle.textContent='—'; dom.narrBody.innerHTML=''; return; }
  dom.narrTitle.textContent = S.narr.t||'—';
  dom.narrBody.innerHTML = S.narr.b||'';
}
function renderLog(){
  const rows = S.log.slice().sort(function(a,b){ return a.age-b.age; });
  dom.logList.innerHTML = rows.map(function(l){
    return '<div class="logline '+(l.kind==='key'?'logline--key':l.kind==='bad'?'logline--bad':'')+'">'
      + '<span class="logline__age">'+L(l.age)+'</span><span class="logline__txt">'+esc(l.txt)+'</span></div>';
  }).join('') || '<div class="meta">— 尚无纪事 —</div>';
}
/* F-7 · 行动栏五分组：修身／营生／人事／路线／特殊。条件未足者默认隐于「未启」展开条 */
const ACTION_CATS = ['修身','营生','人事','路线','特殊'];
function actWrapHTML(act, canAct, forceLocked){
  const ok = act.ok(S);
  let why='', dis=true, cls='btn';
  if(forceLocked){ dis=true; why=(typeof act.why==='function')?act.why(S):(act.why||'条件未足'); }
  else if(!ok){ dis=true; why=(typeof act.why==='function')?act.why(S):(act.why||'条件未足'); }
  else if(!canAct){ dis=true; why=(S.phase==='action'&&S.actionDone)?'今年已行事':'待推进一岁'; }
  else { dis=false; }
  if(act.danger) cls+=' btn--danger';
  const hint = (typeof act.hint==='function') ? act.hint(S) : (act.hint||'');
  return '<div class="act-wrap" data-act="'+act.id+'"><button class="'+cls+'" data-act="'+act.id+'" '+(dis?'disabled':'')+' type="button" aria-describedby="act-desc-'+act.id+'">'+esc(act.n)+'</button>'
    + (why?'<span class="act-why">'+esc(why)+'</span>':'<span class="act-why act-why--ok">'+esc(hint||'—')+'</span>')
    + '<span class="act-desc" id="act-desc-'+act.id+'" role="tooltip" hidden>'+esc(hint)+'</span></div>';
}
function renderActions(){
  const canAct = (S.phase==='action' && !S.actionDone && !S.ended);
  let html='';
  let shown = 0;
  ACTION_CATS.forEach(function(cat){
    const acts = ACTIONS.filter(function(a){ return a.cat===cat && a.show(S); });
    if(!acts.length) return;
    const avail  = acts.filter(function(a){ return a.ok(S); });
    const locked = acts.filter(function(a){ return !a.ok(S); });
    if(!avail.length && !locked.length) return;
    html += '<div class="act-group__sec" data-cat="'+esc(cat)+'">';
    html += '<div class="act-group__hd"><span class="ink-dot"></span>'+esc(cat)+'</div>';
    avail.forEach(function(a){ html += actWrapHTML(a, canAct); shown++; });
    if(locked.length){
      const lid = 'actlock-'+cat;
      html += '<button class="act-group__more" type="button" aria-expanded="false" aria-controls="'+lid+'" data-more="'+lid+'" data-n="'+locked.length+'">未启 '+locked.length+' 项 · 展开</button>';
      html += '<div class="act-group__locked" id="'+lid+'" hidden>';
      locked.forEach(function(a){ html += actWrapHTML(a, false, true); });
      html += '</div>';
    }
    html += '</div>';
  });
  dom.actGroup.innerHTML = html || '<div class="meta">— 今年无可行之事 —</div>';
  dom.actGroup.querySelectorAll('button[data-act]:not([disabled])').forEach(function(b){
    b.addEventListener('click', function(){ onActionClick(ACTIONS.find(function(a){ return a.id===b.dataset.act; })); });
  });
  /* 未启 展开／收起 */
  dom.actGroup.querySelectorAll('[data-more]').forEach(function(b){
    b.addEventListener('click', function(){
      const body = document.getElementById(b.dataset.more);
      if(!body) return;
      const on = body.hasAttribute('hidden');
      if(on){ body.removeAttribute('hidden'); b.setAttribute('aria-expanded','true'); b.textContent='未启 '+b.dataset.n+' 项 · 收起'; b.classList.add('is-open'); }
      else  { body.setAttribute('hidden',''); b.setAttribute('aria-expanded','false'); b.textContent='未启 '+b.dataset.n+' 项 · 展开'; b.classList.remove('is-open'); }
    });
  });
  /* hover/focus：临时显示描述浮窗 */
  let lastDesc = null;
  const showDesc = function(wrap, on){
    const d = wrap.querySelector('.act-desc'); if(!d) return;
    if(on){
      if(lastDesc && lastDesc!==d) lastDesc.hidden = true;
      d.hidden = false; lastDesc = d;
      wrap.classList.add('act-wrap--hover');
    } else {
      if(!wrap.matches(':hover') && !wrap.querySelector('button:focus')){
        d.hidden = true; if(lastDesc===d) lastDesc=null;
        wrap.classList.remove('act-wrap--hover');
      }
    }
  };
  dom.actGroup.querySelectorAll('.act-wrap').forEach(function(wrap){
    wrap.addEventListener('mouseenter', function(){ showDesc(wrap, true); });
    wrap.addEventListener('mouseleave', function(){ showDesc(wrap, false); });
    const btn = wrap.querySelector('button');
    if(btn) btn.addEventListener('focus', function(){ showDesc(wrap, true); });
    if(btn) btn.addEventListener('blur', function(){ showDesc(wrap, false); });
  });
  dom.actHint.textContent = S.ended ? '—'
    : (S.phase==='action' ? (S.actionDone?'今年已行事':'择一事以度此年')
    : '（度过此 '+(typeof stageN==='function'?stageN(S.age):'N')+' 年）');
}
/* v1.7 增补二 · 包袱：行事页展示持有型道具（点击即用） */
function renderBag(){
  const wrap = document.getElementById('bag-list');
  if(!wrap || !S) return;
  if(!S.bag || !S.bag.length){ wrap.hidden = true; return; }
  wrap.hidden = false;
  wrap.innerHTML = '<div class="hd3" style="font-size:var(--fs-sm);letter-spacing:.2em;margin-top:var(--sp-3)"><span class="ink-dot"></span>包袱 · 持有</div>'
    + '<div class="chips">' + S.bag.map(function(id){
        const g = BLACKMARKET_GOODS.find(function(x){ return x.id===id; });
        return g ? '<button class="chip chip--bag" data-bag="'+id+'" type="button" title="点击使用">'+esc(g.n)+' · 用</button>' : '';
      }).join('') + '</div>';
  wrap.querySelectorAll('[data-bag]').forEach(function(b){
    b.addEventListener('click', function(){ useBagItem(b.dataset.bag); });
  });
}
/* v1.8 · 行事页「黑市 ×1」按钮：窗口判定命中置 S.blackMarketChance=1 → 按钮出现；
   点击强制出摊（blackMarketRoll(true)），关窗后计数归零按钮消失 */
function renderBlackMarket(){
  const wrap = document.getElementById('bm-slot');
  if(!wrap || !S) return;
  if(!S.blackMarketChance){ wrap.hidden = true; return; }
  wrap.hidden = false;
  wrap.innerHTML = '<button class="btn btn--bm" id="btn-bm" type="button">黑市 ×1</button>';
  const b = document.getElementById('btn-bm');
  if(b) b.addEventListener('click', function(){
    const shop = blackMarketRoll(true);
    if(!shop){ S.blackMarketChance = 0; render(); return; }
    showShop(shop, function(){ S.blackMarketChance = 0; render(); });
  });
}
function renderRouteFoot(){
  const active = Object.keys(S.routes).filter(function(id){ return S.routes[id].active; });
  dom.routeFoot.innerHTML = active.length
    ? ('已入：'+active.map(function(id){ const r=ROUTES.find(function(x){return x.id===id;}); return r?r.n:''; }).join('、'))
    : '尚无既定之途 · 静待时机';
}

/* v1.8 PRD · 通用玩法界面（openPlayScreen）
   cfg = { badge, title, lead, status:()=>html,
           sections:[ {title, render:(ctx)=>({html, wire:(body)=>{}}) } ], onClose }
   ctx.refresh() 重渲状态条 + 所有分区（每次操作后可调用）。 */
function openPlayScreen(cfg){
  const modal = el('div','modal modal--play');
  modal.innerHTML =
    '<div class="modal__type"><span class="badge badge--gilt">'+esc(cfg.badge||'玩法')+'</span></div>'
    + '<h2 class="modal__title">'+esc(cfg.title||'玩法界面')+'</h2>'
    + (cfg.lead ? '<p class="modal__lead">'+esc(cfg.lead)+'</p>' : '')
    + '<div class="play-status meta" id="play-status"></div>'
    + '<div class="play-sections" id="play-sections"></div>'
    + '<div class="modal__foot"><button class="btn btn--primary" id="play-close" type="button">返回行事</button></div>';
  openModal(modal, { focusSel:'#play-close', onEsc:function(){ closeModal(); if(cfg.onClose) cfg.onClose(); } });
  const statusEl = dom.modalRoot.querySelector('#play-status');
  const secEl = dom.modalRoot.querySelector('#play-sections');
  const ctx = { refresh:function(){
    statusEl.innerHTML = cfg.status();
    secEl.innerHTML = cfg.sections.map(function(s,i){
      return '<section class="play-sec"><h3 class="play-sec__hd">'+esc(s.title)+'</h3><div class="play-sec__body" data-sec="'+i+'"></div></section>';
    }).join('');
    cfg.sections.forEach(function(s,i){
      const body = secEl.querySelector('[data-sec="'+i+'"]');
      const r = s.render(ctx);
      body.innerHTML = r.html;
      if(r.wire) r.wire(body);
    });
  } };
  ctx.refresh();
  dom.modalRoot.querySelector('#play-close').addEventListener('click', function(){ closeModal(); if(cfg.onClose) cfg.onClose(); });
}
/* v1.8 P1 · #11：玩法行动点 chip（随窗口长度缩放，见 engine.doUpdate） */
function playBudgetChip(){
  return S.playBudget>0
    ? ' · <span class="badge">本窗口余 <b>'+S.playBudget+'</b> 次玩法</span>'
    : ' · <span class="badge">本窗口玩法已尽</span>';
}

/* ══ 商贾 · 商铺界面（PRD §4，自主定量） ══ */
function openShopScreen(){ openPlayScreen(shopScreenCfg()); }
function shopStockValue(){
  let v = 0;
  MARKET_KEYS.forEach(function(k){ const s = S.stock[k]; if(s && s.qty>0) v += marketPrice(k)*s.qty*holdCoef(k); });
  return Math.round(v);
}
function shopScreenCfg(){
  return {
    badge:'商铺', title:'商贾 · 商铺', lead:'盘货、置产、垄断，皆由你定。',
    status:function(){
      return '囊中 <b class="lat">'+L(S.money)+'</b> 银 · 囤货估值 <b class="lat">'+L(shopStockValue())+'</b> 银 · 地产 <b class="lat">'+L(S.estates)+'</b> 两'
        + (S.flags.垄断 ? ' · <span class="badge">已立垄断</span>' : '');
    },
    sections:[ secBuy(), secSell(), secInventory(), secEstate(), secMonopoly() ],
    onClose:function(){ render(); }
  };
}
/* 进货：选品类 + 投入银两（步长 50）→ 按市价购入整单位 */
function secBuy(){
  return { title:'进货（买货 · 自主定量）', render:function(ctx){
    const cats = MARKET_KEYS.map(function(k){ return {k:k, n:MARKET_CATS[k].n, price:marketPrice(k)}; });
    const html =
      '<div class="qty-row"><span class="qty-label">品类</span><div class="chips" id="buy-cats">'
      + cats.map(function(c,i){ return '<button class="chip'+(i===0?' chip--on':'')+'" data-cat="'+c.k+'" type="button">'+esc(c.n)+' <i class="lat">'+L(c.price)+'银/单位</i></button>'; }).join('')
      + '</div></div>'
      + '<div class="qty-row"><span class="qty-label">投入</span>'
      + '<button class="btn btn--sm qty-dec" type="button">−</button>'
      + '<input class="qty-input" id="buy-qty" type="text" inputmode="numeric" pattern="\\d*" value="0" />'
      + '<button class="btn btn--sm qty-inc" type="button">＋</button>'
      + '<button class="btn btn--sm" id="buy-max" type="button">拉满</button></div>'
      + '<div class="qty-preview" id="buy-prev"></div>'
      + '<button class="btn btn--primary" id="buy-go" type="button">确认进货</button>';
    return { html:html, wire:function(body){
      let cat = MARKET_KEYS[0];
      const qty = body.querySelector('#buy-qty');
      const prev = body.querySelector('#buy-prev');
      const refresh = function(){
        const amt = Math.max(0, parseQty(qty));
        const price = marketPrice(cat);
        const units = Math.floor(amt / price);
        const ok = amt>0 && amt<=S.money && units>0;
        prev.innerHTML = '市价 <b class="lat">'+L(price)+'</b> 银/单位 → 可购 <b class="lat">'+L(units)+'</b> 单位（耗 '+L(units*price)+' 银）'
          + (amt>S.money?'<span class="qty-warn"> · 银钱不足，上限 '+L(S.money)+'</span>':'');
        const go = body.querySelector('#buy-go'); if(go) go.disabled = !ok;
      };
      body.querySelectorAll('#buy-cats .chip').forEach(function(b){ b.addEventListener('click', function(){
        body.querySelectorAll('#buy-cats .chip').forEach(function(x){ x.classList.remove('chip--on'); });
        b.classList.add('chip--on'); cat = b.getAttribute('data-cat'); refresh();
      }); });
      body.querySelector('.qty-dec').addEventListener('click', function(){ qty.value = Math.max(0,(parseQty(qty))-50); refresh(); });
      body.querySelector('.qty-inc').addEventListener('click', function(){ qty.value = (parseQty(qty))+50; refresh(); });
      body.querySelector('#buy-max').addEventListener('click', function(){ const p=marketPrice(cat); qty.value = Math.floor(S.money/p)*p; refresh(); });
      qty.addEventListener('input', refresh);
      body.querySelector('#buy-go').addEventListener('click', function(){
        const r = shopBuy(cat, parseQty(qty));
        if(!r.ok){ toast('进货失败', r.reason||'数量无效', 'danger'); return; }
        pushLog(S.age, '商铺进货：'+MARKET_CATS[cat].n+' '+r.units+' 单位（耗 '+r.amt+' 银）。', '');
        toast('进货 · '+MARKET_CATS[cat].n, '购入 '+r.units+' 单位', 'gain');
        render(); ctx.refresh();
      });
      refresh();
    }};
  }};
}
/* 出货：选持有品类 + 数量（上限=持有量）→ 实时显示预计收入/亏损 */
function secSell(){
  return { title:'出货（卖货 · 自主定量）', render:function(ctx){
    const held = MARKET_KEYS.filter(function(k){ return S.stock[k] && S.stock[k].qty>0; });
    if(held.length===0) return { html:'<p class="play-empty">仓中无货可卖。</p>' };
    const html =
      '<div class="qty-row"><span class="qty-label">品类</span><div class="chips" id="sell-cats">'
      + held.map(function(k,i){ return '<button class="chip'+(i===0?' chip--on':'')+'" data-cat="'+k+'" type="button">'+esc(MARKET_CATS[k].n)+' <i class="lat">'+L(S.stock[k].qty)+'单位</i></button>'; }).join('')
      + '</div></div>'
      + '<div class="qty-row"><span class="qty-label">数量</span>'
      + '<button class="btn btn--sm qty-dec" type="button">−</button>'
      + '<input class="qty-input" id="sell-qty" type="text" inputmode="numeric" pattern="\\d*" value="0" />'
      + '<button class="btn btn--sm qty-inc" type="button">＋</button>'
      + '<button class="btn btn--sm" id="sell-max" type="button">全抛</button></div>'
      + '<div class="qty-preview" id="sell-prev"></div>'
      + '<button class="btn btn--primary" id="sell-go" type="button">确认出货</button>';
    return { html:html, wire:function(body){
      let cat = held[0];
      const qty = body.querySelector('#sell-qty');
      const prev = body.querySelector('#sell-prev');
      const refresh = function(){
        const n = Math.max(0, parseQty(qty));
        const max = S.stock[cat].qty;
        const price = marketPrice(cat), coef = holdCoef(cat);
        const income = Math.round(price * n * coef);
        const avg = max>0 ? S.stock[cat].cost/max : 0;
        const profit = income - Math.round(avg * n);
        const ok = n>0 && n<=max;
        prev.innerHTML = '市价 <b class="lat">'+L(price)+'</b> × '+L(n)+' 单位 × 持有系数 <b class="lat">'+coef.toFixed(2)+'</b> → 预计 <b class="lat">'+L(income)+'</b> 银'
          + (profit<0 ? '<span class="qty-warn"> · 预计亏损 '+L(-profit)+' 银</span>' : ' · 获利 '+L(profit)+' 银');
        const go = body.querySelector('#sell-go'); if(go) go.disabled = !ok;
      };
      body.querySelectorAll('#sell-cats .chip').forEach(function(b){ b.addEventListener('click', function(){
        body.querySelectorAll('#sell-cats .chip').forEach(function(x){ x.classList.remove('chip--on'); });
        b.classList.add('chip--on'); cat = b.getAttribute('data-cat'); qty.value=0; refresh();
      }); });
      body.querySelector('.qty-dec').addEventListener('click', function(){ qty.value = Math.max(0,(parseQty(qty))-1); refresh(); });
      body.querySelector('.qty-inc').addEventListener('click', function(){ qty.value = (parseQty(qty))+1; refresh(); });
      body.querySelector('#sell-max').addEventListener('click', function(){ qty.value = S.stock[cat].qty; refresh(); });
      qty.addEventListener('input', refresh);
      body.querySelector('#sell-go').addEventListener('click', function(){
        const r = shopSell(cat, parseQty(qty));
        if(!r.ok){ toast('出货失败', r.reason||'数量无效', 'danger'); return; }
        pushLog(S.age, '商铺出货：'+MARKET_CATS[cat].n+' 单位（得 '+r.income+' 银）。', '');
        toast('出货 · '+MARKET_CATS[cat].n, '得 '+r.income+' 银', 'gain');
        render(); ctx.refresh();
      });
      refresh();
    }};
  }};
}
/* 库存：只读 + 全部抛售 */
function secInventory(){
  return { title:'库存（只读 + 管理）', render:function(ctx){
    const held = MARKET_KEYS.filter(function(k){ return S.stock[k] && S.stock[k].qty>0; });
    if(held.length===0) return { html:'<p class="play-empty">仓中无货。</p>' };
    const html = held.map(function(k){
      const s = S.stock[k]; const price = marketPrice(k), coef = holdCoef(k);
      const val = Math.round(price * s.qty * coef);
      return '<div class="inv-row"><span class="inv-name">'+esc(MARKET_CATS[k].n)+'</span>'
        + '<span class="inv-num">持有 '+L(s.qty)+' · 成本 '+L(s.cost)+' · 持 '+L(S.stockHold[k]||0)+'年</span>'
        + '<span class="inv-val">估值 '+L(val)+' 银</span></div>';
    }).join('')
    + '<button class="btn" id="inv-dump" type="button">全部抛售</button>';
    return { html:html, wire:function(body){
      const dump = body.querySelector('#inv-dump');
      if(dump) dump.addEventListener('click', function(){
        let got=0;
        MARKET_KEYS.forEach(function(k){ const s=S.stock[k]; if(s && s.qty>0){ const r=shopSell(k, s.qty); if(r.ok) got+=r.income; } });
        if(got>0){ pushLog(S.age,'商铺清仓，得 '+got+' 银。',''); toast('清仓','得 '+got+' 银','gain'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
/* 地产：购置 / 变卖，实时显示查封率 */
function secEstate(){
  return { title:'地产（买地卖地 · 自主定量）', render:function(ctx){
    const seize = monopolySeizeRate();
    const html =
      '<div class="qty-row"><span class="qty-label">购置</span>'
      + '<button class="btn btn--sm qty-dec" type="button">−</button>'
      + '<input class="qty-input" id="est-buy" type="text" inputmode="numeric" pattern="\\d*" value="0" />'
      + '<button class="btn btn--sm qty-inc" type="button">＋</button>'
      + '<button class="btn btn--sm" id="est-max" type="button">拉满</button></div>'
      + '<div class="qty-preview" id="est-prev"></div>'
      + '<button class="btn btn--primary" id="est-go" type="button">购置地产</button>'
      + '<button class="btn" id="est-sell" type="button">变卖地产（八折回血）</button>';
    return { html:html, wire:function(body){
      const qty = body.querySelector('#est-buy'); const prev = body.querySelector('#est-prev');
      const refresh = function(){
        const amt = Math.max(0, parseQty(qty));
        const ok = amt>0 && amt<=S.money;
        prev.innerHTML = '当前地产 <b class="lat">'+L(S.estates)+'</b> 两 · 每年岁入约 <b class="lat">'+L(Math.floor(S.estates*0.08))+'</b> 银 · 当年查封率 <b class="lat">'+Math.round(seize*100)+'%</b>'
          + (amt>S.money?'<span class="qty-warn"> · 银钱不足</span>':'');
        const go = body.querySelector('#est-go'); if(go) go.disabled = !ok;
      };
      body.querySelector('.qty-dec').addEventListener('click', function(){ qty.value=Math.max(0,(parseQty(qty))-50); refresh(); });
      body.querySelector('.qty-inc').addEventListener('click', function(){ qty.value=(parseQty(qty))+50; refresh(); });
      body.querySelector('#est-max').addEventListener('click', function(){ qty.value=S.money; refresh(); });
      qty.addEventListener('input', refresh);
      body.querySelector('#est-go').addEventListener('click', function(){
        const r = shopEstateBuy(parseQty(qty));
        if(!r.ok){ toast('购置失败', r.reason||'金额无效', 'danger'); return; }
        pushLog(S.age,'置办地产，耗 '+r.amt+' 银。',''); toast('地产','+'+r.amt+' 两','gain');
        render(); ctx.refresh();
      });
      body.querySelector('#est-sell').addEventListener('click', function(){
        const r = shopEstateSell();
        if(!r.ok){ toast('变卖失败', r.reason||'无地产', 'danger'); return; }
        pushLog(S.age,'变卖地产，回 '+r.back+' 银。',''); toast('变卖地产','+'+r.back+' 银','gain');
        render(); ctx.refresh();
      });
      refresh();
    }};
  }};
}
/* 垄断：打点立垄断（一次性解锁，年利在 doSettle 结算） */
function secMonopoly(){
  return { title:'垄断物料（打点 · 自主定量）', render:function(ctx){
    if(S.flags.垄断) return { html:'<p class="play-empty">已立垄断，每年坐收货利（被查率约 30%，事发则损道德）。</p>' };
    const W = Math.max(20, S.attrs.脉*15 + S.attrs.财*10);
    const html =
      '<p class="play-note">打点官府、把持货路，可立垄断，每年稳收货利；事发则声名受损。</p>'
      + '<div class="qty-row"><span class="qty-label">打点</span>'
      + '<button class="btn btn--sm qty-dec" type="button">−</button>'
      + '<input class="qty-input" id="mon-amt" type="text" inputmode="numeric" pattern="\\d*" value="50" />'
      + '<button class="btn btn--sm qty-inc" type="button">＋</button></div>'
      + '<div class="qty-preview" id="mon-prev"></div>'
      + '<button class="btn btn--primary" id="mon-go" type="button">打点立垄断</button>';
    return { html:html, wire:function(body){
      const qty = body.querySelector('#mon-amt'); const prev = body.querySelector('#mon-prev');
      const refresh = function(){
        const amt = Math.max(0, parseQty(qty));
        const ok = amt>0 && amt<=S.money;
        prev.innerHTML = '耗 <b class="lat">'+L(amt)+'</b> 银打点 → 官商关系 ＋1、道德 －1；此后每年约 70% 获货利（约 '+L(W)+'~'+L(Math.floor(W*0.6))+' 银），被查率约 30%'
          + (amt>S.money?'<span class="qty-warn"> · 银钱不足</span>':'');
        const go = body.querySelector('#mon-go'); if(go) go.disabled = !ok;
      };
      body.querySelector('.qty-dec').addEventListener('click', function(){ qty.value=Math.max(0,(parseQty(qty))-10); refresh(); });
      body.querySelector('.qty-inc').addEventListener('click', function(){ qty.value=(parseQty(qty))+10; refresh(); });
      qty.addEventListener('input', refresh);
      body.querySelector('#mon-go').addEventListener('click', function(){
        const r = shopMonopoly(parseQty(qty));
        if(!r.ok){ toast('打点失败', r.reason||'条件不足', 'danger'); return; }
        pushLog(S.age,'打点立垄断，耗 '+r.amt+' 银。',''); toast('垄断','已立 · 官商关系+1','gain');
        render(); ctx.refresh();
      });
      refresh();
    }};
  }};
}
/* ══ v1.8 P1 · 六路线玩法界面（军/医/政/宗教；修仙在行动栏不入道场） ══ */

/* ── 军帐 ── */
function openArmyScreen(){ openPlayScreen(armyScreenCfg()); }
function armyScreenCfg(){
  return {
    badge:'军帐', title:'行军 · 军帐', lead:'募兵、操练、外伐，皆由你定。',
    status:function(){
      return '兵力 <b class="lat">'+L(S.troops)+'</b> · 兵权 <b class="lat">'+S.bingquan+'/10</b> · 影响力 <b class="lat">'+S.influence+'/10</b>'
        + ' · 胜场 <b class="lat">'+S.warWins+'</b> · 银 <b class="lat">'+L(S.money)+'</b>'
        + playBudgetChip();
    },
    sections:[ secRecruit(), secDrill(), secCampaign() ],   /* 经济闭环修复5：删屯兵（募兵劣化版：贵一倍无兵权，假选择砍掉） */
    onClose:function(){ render(); }
  };
}
function secRecruit(){
  /* v1.8 用户拍板「最简单」：单一兵种募兵，无兵种选择（原 器械/粮秣 已删） */
  return { title:'募兵（确定性定量）', render:function(ctx){
    const price = BARRACK_UNITS.bing.price;
    const html =
      '<p class="play-note">招兵买马，耗银得兵，兵权随规模渐固。</p>'
      + '<div class="qty-row"><span class="qty-label">投入</span>'
      + '<button class="btn btn--sm qty-dec" type="button">−</button>'
      + '<input class="qty-input" id="rec-amt" type="text" inputmode="numeric" pattern="\\d*" value="0" />'
      + '<button class="btn btn--sm qty-inc" type="button">＋</button>'
      + '<button class="btn btn--sm" id="rec-max" type="button">拉满</button></div>'
      + '<div class="qty-preview" id="rec-prev"></div>'
      + '<button class="btn btn--primary" id="rec-go" type="button">确认募兵</button>';
    return { html:html, wire:function(body){
      const amt = body.querySelector('#rec-amt'); const prev = body.querySelector('#rec-prev');
      const refresh = function(){
        const v = Math.max(0, parseQty(amt));
        const raw = Math.floor(v/price);
        const got = Math.min(raw, BARRACK_RECRUIT_CAP);   /* #9 单次成军上限 */
        const capped = raw > BARRACK_RECRUIT_CAP;
        const noBq = S.troops >= TROOP_BINGQUAN_CAP;       /* #9 兵力递减：已达军阀规模 */
        const ok = v>0 && v<=S.money && got>0;
        prev.innerHTML = '单价 <b class="lat">'+price+'</b> 银/人 → 可募 <b class="lat">'+got+'</b> 人（耗 '+got*price+' 银）'
          + (capped?'<span class="qty-warn"> · 单次上限 '+BARRACK_RECRUIT_CAP+' 人</span>':'')
          + (noBq?'<span class="qty-warn"> · 兵已极盛，兵权不再涨</span>':'')
          + (v>S.money?'<span class="qty-warn"> · 银钱不足</span>':'');
        const go = body.querySelector('#rec-go'); if(go) go.disabled = !ok;
      };
      body.querySelector('.qty-dec').addEventListener('click', function(){ amt.value=Math.max(0,parseQty(amt)-price); refresh(); });
      body.querySelector('.qty-inc').addEventListener('click', function(){ amt.value=(parseQty(amt))+price; refresh(); });
      body.querySelector('#rec-max').addEventListener('click', function(){ amt.value=Math.floor(S.money/price)*price; refresh(); });
      amt.addEventListener('input', refresh);
      body.querySelector('#rec-go').addEventListener('click', function(){
        const r = armyRecruit(parseQty(amt), 'bing');
        if(!r.ok){ toast('募兵失败', r.reason||'无效', 'danger'); return; }
        pushLog(S.age,'军帐募兵：募兵 '+r.troops+' 人（耗 '+r.amt+' 银）。','');
        toast('募兵','得 '+r.troops+' 人'+(r.bingquan?' · 兵权+'+r.bingquan:''),'gain');
        render(); ctx.refresh();
      });
      refresh();
    }};
  }};
}
function secDrill(){
  return { title:'操练（风险 · 耗兵/健康）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const html = '<p class="play-note">操练提升兵权，但折损兵力与健康。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="dr-prev"></div>'
      + '<button class="btn btn--primary" id="dr-go" type="button"'+(exhausted?' disabled':'')+'>操练士卒</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#dr-prev');
      prev.innerHTML = '当前兵力 <b class="lat">'+S.troops+'</b> · 兵权 <b class="lat">'+S.bingquan+'/10</b>'
        + (exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#dr-go');
      if(go) go.addEventListener('click', function(){
        const r = armyDrill();
        if(!r.ok){ toast('操练失败', r.reason||'无效', 'danger'); return; }
        pushLog(S.age,'军帐操练，兵权益固。',''); toast('操练','兵权 +1','gain');
        render(); ctx.refresh();
      });
    }};
  }};
}
function secCampaign(){
  return { title:'外伐（核心风险 · 选战法）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const tactics = CAMPAIGN_TACTICS;
    const html =
      '<div class="qty-row"><span class="qty-label">战法</span><div class="chips" id="cam-tac">'
      + tactics.map(function(t,i){ const dis = t.req && !t.req(S); return '<button class="chip'+(i===0?' chip--on':'')+(dis?' chip--off':'')+'" data-t="'+t.id+'" type="button" '+(dis?'disabled':'')+'>'+esc(t.n)+'</button>'; }).join('')
      + '</div></div>'
      + '<p class="play-note" id="cam-hint"></p>'
      + '<div class="qty-preview" id="cam-prev"></div>'
      + '<button class="btn btn--primary" id="cam-go" type="button"'+(exhausted?' disabled':'')+'>兴兵外伐</button>';
    return { html:html, wire:function(body){
      let tac = tactics[0].id;
      const prev = body.querySelector('#cam-prev'); const hint = body.querySelector('#cam-hint');
      const refresh = function(){
        const t = tactics.filter(function(x){return x.id===tac;})[0];
        hint.innerHTML = esc(t.hint);
        /* 经济闭环修复3：敌力随兵力动态缩放（与 engine.armyCampaign 同口径：E=ri(0.5t,1.3t) 钳 60~4000） */
        const troops = S.troops||0;
        const Emin = Math.max(60, Math.floor(troops*0.5));
        const Emax = Math.min(4000, Math.ceil(troops*1.3));
        const Emid = clamp(Math.round(troops*0.9), 60, 4000);
        const rate = (troops<Emid*0.6)?0:clamp((troops-Emid*0.4)/(Emid*0.8),0.2,0.9);
        prev.innerHTML = '敌力约 <b class="lat">'+Emin+'–'+Emax+'</b>（随兵力浮动） · 兵<敌×0.6 必败 · 预计胜率 <b class="lat">'+Math.round(rate*100)+'%</b>'
          + (troops<20?'<span class="qty-warn"> · 兵力不足（需≥20）</span>':'')
          + (exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      };
      body.querySelectorAll('#cam-tac .chip').forEach(function(b){ if(b.disabled) return; b.addEventListener('click', function(){
        body.querySelectorAll('#cam-tac .chip').forEach(function(x){ x.classList.remove('chip--on'); });
        b.classList.add('chip--on'); tac = b.getAttribute('data-t'); refresh();
      }); });
      refresh();
      const go = body.querySelector('#cam-go');
      if(go) go.addEventListener('click', function(){
        const r = armyCampaign(tac);
        if(!r.ok){ toast('外伐未行', r.reason||'无效', 'danger'); return; }
        if(r.win){ pushLog(S.age,'外伐克捷，斩获 '+r.gain+' 银，威名远播。',''); toast('外伐·胜','得 '+r.gain+' 银 · 胜场+1','gain'); }
        else { pushLog(S.age,'外伐失利，折兵 '+r.loss+'。','bad'); toast('外伐·败','折兵 '+r.loss,'danger'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
/* ── 医馆 ── */
function openClinicScreen(){ openPlayScreen(clinicScreenCfg()); }
function clinicScreenCfg(){
  return {
    badge:'医馆', title:'行医 · 医馆', lead:'坐堂、采药、游历、服丹，皆由你定。',
    status:function(){
      return '医术声望 <b class="lat">'+S.rep+'/10</b>'+(S.rep>=8?' <span class="badge">国手</span>':'')
        + ' · 治人 <b class="lat">'+S.cured+'</b> · 存药 <b class="lat">'+S.meds+'</b> · 银 <b class="lat">'+L(S.money)+'</b>'
        + playBudgetChip();
    },
    sections:[ secTreat(), secGather(), secRoamSell(), secElixir() ],
    onClose:function(){ render(); }
  };
}
function secTreat(){
  return { title:'坐堂（主线 · 风险）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const html = '<p class="play-note danger-note">坐堂行医，可积声望与人望；然 <span class="qty-warn">约 8% 治死</span>，损声望与道德。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="tr-prev"></div>'
      + '<button class="btn btn--primary" id="tr-go" type="button"'+(exhausted?' disabled':'')+'>坐堂行医</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#tr-prev');
      prev.innerHTML = '当前声望 <b class="lat">'+S.rep+'/10</b>'+(S.rep>=8?'（已达国手门槛）':'')+(exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#tr-go');
      if(go) go.addEventListener('click', function(){
        const r = clinicTreat();
        if(!r.ok){ toast('坐堂失败', r.reason||'无效','danger'); return; }
        if(r.dead){ pushLog(S.age,'坐堂失误，医死人命，声名受损。','bad'); toast('治死','声望-2 道德-1','danger'); }
        else { pushLog(S.age,'坐堂行医，活人 '+r.cured+'，声望渐起。',''); toast('坐堂','活人 '+r.cured+' · 声望+1','gain'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
function secGather(){
  return { title:'采药/炮制（确定性定量）', render:function(ctx){
    const html = '<div class="qty-row"><span class="qty-label">投入</span>'
      + '<button class="btn btn--sm qty-dec" type="button">−</button>'
      + '<input class="qty-input" id="ga-amt" type="text" inputmode="numeric" pattern="\\d*" value="0" />'
      + '<button class="btn btn--sm qty-inc" type="button">＋</button>'
      + '<button class="btn btn--sm" id="ga-max" type="button">拉满</button></div>'
      + '<div class="qty-preview" id="ga-prev"></div>'
      + '<button class="btn btn--primary" id="ga-go" type="button">采药</button>';
    return { html:html, wire:function(body){
      const amt = body.querySelector('#ga-amt'); const prev = body.querySelector('#ga-prev');
      const refresh = function(){
        const v = Math.max(0, parseQty(amt)); const raw = Math.floor(v/HERB_UNIT_PRICE);
        const got = Math.min(raw, HERB_GATHER_CAP);   /* #9 单次采药上限 */
        const ok = v>0 && v<=S.money && got>0;
        prev.innerHTML = '单价 <b class="lat">'+HERB_UNIT_PRICE+'</b> 银/份 → 得 <b class="lat">'+got+'</b> 份（耗 '+got*HERB_UNIT_PRICE+' 银）'
          + (raw>HERB_GATHER_CAP?'<span class="qty-warn"> · 单次上限 '+HERB_GATHER_CAP+' 份</span>':'')
          + (v>S.money?'<span class="qty-warn"> · 银钱不足</span>':'');
        const go = body.querySelector('#ga-go'); if(go) go.disabled = !ok;
      };
      body.querySelector('.qty-dec').addEventListener('click', function(){ amt.value=Math.max(0,parseQty(amt)-HERB_UNIT_PRICE); refresh(); });
      body.querySelector('.qty-inc').addEventListener('click', function(){ amt.value=(parseQty(amt))+HERB_UNIT_PRICE; refresh(); });
      body.querySelector('#ga-max').addEventListener('click', function(){ amt.value=Math.floor(S.money/HERB_UNIT_PRICE)*HERB_UNIT_PRICE; refresh(); });
      amt.addEventListener('input', refresh);
      body.querySelector('#ga-go').addEventListener('click', function(){
        const r = gatherHerb(parseQty(amt));
        if(!r.ok){ toast('采药失败', r.reason||'无效','danger'); return; }
        pushLog(S.age,'采药炮制，得药 '+r.meds+' 份。',''); toast('采药','+'+r.meds+' 份','gain');
        render(); ctx.refresh();
      });
      refresh();
    }};
  }};
}
function secRoamSell(){
  return { title:'游历 / 倒卖（多选一支线）', render:function(ctx){
    const html = '<div class="chips" id="rs-mode">'
      + '<button class="chip chip--on" data-m="roam" type="button">远行采药</button>'
      + '<button class="chip" data-m="sell" type="button">倒卖丹药</button></div><div id="rs-body"></div>';
    return { html:html, wire:function(body){
      const rsBody = body.querySelector('#rs-body'); let mode = 'roam';
      function renderSub(){
        if(mode==='roam'){
          rsBody.innerHTML = '<p class="play-note">远行采药：耗银 + 健康，遇险可得珍稀药材。</p>'
            + '<div class="qty-row"><span class="qty-label">投入</span>'
            + '<button class="btn btn--sm qty-dec" type="button">−</button>'
            + '<input class="qty-input" id="ro-amt" type="text" inputmode="numeric" pattern="\\d*" value="0" />'
            + '<button class="btn btn--sm qty-inc" type="button">＋</button></div>'
            + '<div class="qty-preview" id="ro-prev"></div>'
            + '<button class="btn btn--primary" id="ro-go" type="button">远行采药</button>';
          const amt = rsBody.querySelector('#ro-amt'); const prev = rsBody.querySelector('#ro-prev');
          const refresh = function(){
            const v = Math.max(0, parseQty(amt)); const raw = Math.floor(v/HERB_UNIT_PRICE);
            const got = Math.min(raw, HERB_GATHER_CAP);   /* #9 单次采药上限 */
            const ok = v>0 && v<=S.money && got>0;
            prev.innerHTML = '得药 <b class="lat">'+got+'</b> 份（耗 '+got*HERB_UNIT_PRICE+' 银 · 健康略损）'
              + (raw>HERB_GATHER_CAP?'<span class="qty-warn"> · 单次上限 '+HERB_GATHER_CAP+' 份</span>':'')
              + (v>S.money?'<span class="qty-warn"> · 银钱不足</span>':'');
            const go = rsBody.querySelector('#ro-go'); if(go) go.disabled = !ok;
          };
          rsBody.querySelector('.qty-dec').addEventListener('click', function(){ amt.value=Math.max(0,parseQty(amt)-HERB_UNIT_PRICE); refresh(); });
          rsBody.querySelector('.qty-inc').addEventListener('click', function(){ amt.value=(parseQty(amt))+HERB_UNIT_PRICE; refresh(); });
          amt.addEventListener('input', refresh);
          rsBody.querySelector('#ro-go').addEventListener('click', function(){
            const v = Math.max(0, parseQty(amt));
            if(v<=0||v>S.money){ toast('远行失败','银钱不足','danger'); return; }
            const got = Math.min(Math.floor(v/HERB_UNIT_PRICE), HERB_GATHER_CAP); if(got<=0){ toast('远行失败','无效','danger'); return; }   /* #9 单次上限 */
            S.money = clampMoney(S, S.money-v); S.meds += got; S.health = clamp(S.health-ri(2,6),-999,S.healthMax);
            pushLog(S.age,'远行采药，历险得药 '+got+' 份。',''); toast('远行采药','+'+got+' 份','gain');
            render(); ctx.refresh();
          });
          refresh();
        } else {
          rsBody.innerHTML = '<p class="play-note danger-note">倒卖丹药：<span class="qty-warn">约 30% 砸手</span>亏本。当前存药 <b class="lat">'+S.meds+'</b>。</p>'
            + '<div class="qty-row"><span class="qty-label">数量</span>'
            + '<button class="btn btn--sm qty-dec" type="button">−</button>'
            + '<input class="qty-input" id="sl-amt" type="text" inputmode="numeric" pattern="\\d*" value="0" />'
            + '<button class="btn btn--sm qty-inc" type="button">＋</button>'
            + '<button class="btn btn--sm" id="sl-max" type="button">全卖</button></div>'
            + '<div class="qty-preview" id="sl-prev"></div>'
            + '<button class="btn btn--primary" id="sl-go" type="button">倒卖</button>';
          const amt = rsBody.querySelector('#sl-amt'); const prev = rsBody.querySelector('#sl-prev');
          const refresh = function(){
            const n = Math.max(0, parseQty(amt)); const ok = n>0 && n<=S.meds;
            prev.innerHTML = '预计收入随行就市'+(n>S.meds?'<span class="qty-warn"> · 超出存量</span>':'');
            const go = rsBody.querySelector('#sl-go'); if(go) go.disabled = !ok;
          };
          rsBody.querySelector('.qty-dec').addEventListener('click', function(){ amt.value=Math.max(0,parseQty(amt)-1); refresh(); });
          rsBody.querySelector('.qty-inc').addEventListener('click', function(){ amt.value=(parseQty(amt))+1; refresh(); });
          rsBody.querySelector('#sl-max').addEventListener('click', function(){ amt.value=S.meds; refresh(); });
          amt.addEventListener('input', refresh);
          rsBody.querySelector('#sl-go').addEventListener('click', function(){
            const r = clinicSell(parseQty(amt));
            if(!r.ok){ toast('倒卖失败', r.reason||'无效','danger'); return; }
            if(r.loss>0){ pushLog(S.age,'倒卖丹药砸手，亏 '+r.loss+' 银。','bad'); toast('砸手','亏 '+r.loss+' 银','danger'); }
            else { pushLog(S.age,'倒卖丹药，得 '+r.gain+' 银。',''); toast('倒卖','+'+r.gain+' 银','gain'); }
            render(); ctx.refresh();
          });
          refresh();
        }
      }
      body.querySelectorAll('#rs-mode .chip').forEach(function(b){ b.addEventListener('click', function(){
        body.querySelectorAll('#rs-mode .chip').forEach(function(x){ x.classList.remove('chip--on'); });
        b.classList.add('chip--on'); mode = b.getAttribute('data-m'); renderSub();
      }); });
      renderSub();
    }};
  }};
}
function secElixir(){
  return { title:'服丹（风险）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const html = '<p class="play-note danger-note">服丹：<span class="qty-warn">约 85% 延寿</span>，否则 <span class="qty-warn">15% 毒发</span>大损健康。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="el-prev"></div>'
      + '<button class="btn btn--primary" id="el-go" type="button"'+(exhausted?' disabled':'')+'>服丹</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#el-prev');
      prev.innerHTML = '存药 <b class="lat">'+S.meds+'</b>'+(S.meds<1?'<span class="qty-warn"> · 无丹可服</span>':'')+(exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#el-go');
      if(go) go.addEventListener('click', function(){
        const r = clinicElixir();
        if(!r.ok){ toast('服丹失败', r.reason||'无效','danger'); return; }
        if(r.poison){ pushLog(S.age,'服丹中毒，形体大损。','bad'); toast('毒发','健康-'+r.h,'danger'); }
        else { pushLog(S.age,'服丹得效，形体康健。',''); toast('延寿','健康+'+r.h,'gain'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
/* ── 衙署 ── */
function openYamenScreen(){ openPlayScreen(yamenScreenCfg()); }
function yamenScreenCfg(){
  return {
    badge:'衙署', title:'入仕 · 衙署', lead:'新政、举劾，皆由你定（日常政务在左侧行动栏）。',
    status:function(){
      return '政绩 <b class="lat">'+S.zhengji+'</b> · 民心 <b class="lat">'+S.minxin+'/10</b> · 影响力 <b class="lat">'+S.influence+'/10</b> · 官阶 <b class="lat">'+RANKS[S.rank]+'</b> · 银 <b class="lat">'+L(S.money)+'</b>'
        + playBudgetChip();
    },
    sections:[ secCollect(), secReform(), secImpeach() ],   /* 经济闭环修复2：+清点钱粮（确定性收入，每窗口 1 次） */
    onClose:function(){ render(); }
  };
}
/* 政·清点钱粮（经济闭环修复2：确定性收入，不耗行动点，每窗口限 1 次） */
function secCollect(){
  return { title:'清点钱粮（确定性收入 · 每窗口 1 次）', render:function(ctx){
    const done = S.yamenChecked;
    const gain = 12 + (S.attrs.望||0)*4 + (S.zhengji||0)*2;
    const html = '<p class="play-note">盘点府库、清结粮册，按政绩计征入库。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="cl-prev"></div>'
      + '<button class="btn btn--primary" id="cl-go" type="button"'+(done?' disabled':'')+'>清点钱粮</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#cl-prev');
      prev.innerHTML = '可得 <b class="lat">'+gain+'</b> 银（12 + 望×4 + 政绩×2）'
        + (done?'<span class="qty-warn"> · 本窗口已清点过</span>':'');
      const go = body.querySelector('#cl-go');
      if(go) go.addEventListener('click', function(){
        const r = yamenCollect();
        if(!r.ok){ toast('未行', r.reason||'无效','danger'); return; }
        pushLog(S.age,'清点钱粮，入账 '+r.gain+' 银。',''); toast('清点钱粮','+'+r.gain+' 银','gain');
        render(); ctx.refresh();
      });
    }};
  }};
}
function secReform(){
  return { title:'新政（风险 · 成效大但遭攻讦）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const html = '<p class="play-note">推行新政，政绩大涨；然触动了人，或遭攻讦损望。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="rf-prev"></div>'
      + '<button class="btn btn--primary" id="rf-go" type="button"'+(exhausted?' disabled':'')+'>推行新政</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#rf-prev');
      prev.innerHTML = '当前政绩 <b class="lat">'+S.zhengji+'</b>'+(exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#rf-go');
      if(go) go.addEventListener('click', function(){
        const r = yamenReform();
        if(!r.ok){ toast('新政失败', r.reason||'无效','danger'); return; }
        if(r.success){ pushLog(S.age,'推行新政，政绩斐然。',''); toast('新政','政绩+','gain'); }
        else { pushLog(S.age,'新政遭攻讦，声名受损。','bad'); toast('攻讦','望-1','danger'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
function secImpeach(){
  return { title:'举劾（风险 · 弹劾权臣）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const html = '<p class="play-note">举劾权臣，成则升迁；败则损望损德。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="im-prev"></div>'
      + '<button class="btn btn--primary" id="im-go" type="button"'+(exhausted?' disabled':'')+'>上疏举劾</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#im-prev');
      prev.innerHTML = '当前官阶 <b class="lat">'+RANKS[S.rank]+'</b>'+(exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#im-go');
      if(go) go.addEventListener('click', function(){
        const r = yamenImpeach();
        if(!r.ok){ toast('举劾失败', r.reason||'无效','danger'); return; }
        if(r.success){ pushLog(S.age,'举劾得直，擢升一级。',''); toast('举劾·胜','官阶+1','gain'); }
        else { pushLog(S.age,'举劾不成，反遭忌恨。','bad'); toast('举劾·败','望-1 德-1','danger'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
/* ── 朝堂（帝王 · v1.8 重设计 B2：主指标=国库/兵力/领土，四政全部风险类） ── */
function openThroneScreen(){ openPlayScreen(throneScreenCfg()); }
function throneScreenCfg(){
  return {
    badge:'朝堂', title:'帝王 · 朝堂', lead:'修养生息、御驾亲征、治国理政、酒池肉林，皆由你定。',
    status:function(){
      const ev2 = emperorEval(S);
      return '国库 <b class="lat">'+L(S.treasury)+'</b> 银 · 兵力 <b class="lat">'+L(S.troops)+'</b> · 领土 <b class="lat">'+L(S.territory)+'</b> 州'
        + (ev2 ? ' · <span class="badge">'+esc(ev2.n)+'</span>' : '')
        + ' · 在位 <b class="lat">'+S.reignYears+'</b> 年 · 影响力 <b class="lat">'+S.influence+'/10</b>'
        + playBudgetChip();
    },
    sections:[ secThroneWithdraw(), secThroneRecuperate(), secThroneCampaign(), secThroneGovern(), secThroneDecadence() ],
    onClose:function(){ render(); }
  };
}
/* 帝王·支取内帑（经济闭环修复6：确定性，不耗行动点，每窗口 1 次；国库→个人 money，补黑市/商铺出口） */
function secThroneWithdraw(){
  return { title:'支取内帑（确定性 · 每窗口 1 次）', render:function(ctx){
    const done = S.emperorWithdrawn;
    const amt = Math.min(2000, Math.floor((S.treasury||0)*0.05));
    const html = '<p class="play-note">从国库支取内帑入私囊，供黑市、商铺花销。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="tw-prev"></div>'
      + '<button class="btn btn--primary" id="tw-go" type="button"'+(done?' disabled':'')+'>支取内帑</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#tw-prev');
      prev.innerHTML = '可得 <b class="lat">'+amt+'</b> 银入私囊（min(2000, 国库×5%)）'
        + (amt<=0?'<span class="qty-warn"> · 国库空虚</span>':'')
        + (done?'<span class="qty-warn"> · 本窗口已支取过</span>':'');
      const go = body.querySelector('#tw-go');
      if(go) go.addEventListener('click', function(){
        const r = emperorWithdraw();
        if(!r.ok){ toast('未行', r.reason||'无效','danger'); return; }
        pushLog(S.age,'支取内帑，得银 '+r.amt+'。',''); toast('支取内帑','+'+r.amt+' 银','gain');
        render(); ctx.refresh();
      });
    }};
  }};
}
/* 修养生息（风险 · 国库换兵力） */
function secThroneRecuperate(){
  return { title:'修养生息（风险 · 补兵）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const html = '<p class="play-note">征发徭役、休整军伍，耗国库补兵力；<span class="qty-warn">10% 疫病/逃兵</span>折兵，国库空虚则激起哗变。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="tr2-prev"></div>'
      + '<button class="btn btn--primary" id="tr2-go" type="button"'+(exhausted?' disabled':'')+'>修养生息</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#tr2-prev');
      prev.innerHTML = '耗国库 <b class="lat">2万–4万</b> · 兵力 ＋2000~5000 · 望＋1'
        + (S.treasury<20000?'<span class="qty-warn"> · 国库空虚，恐哗变</span>':'')
        + (exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#tr2-go');
      if(go) go.addEventListener('click', function(){
        const r = emperorRecuperate();
        if(!r.ok){ toast('未行', r.reason||'无效','danger'); return; }
        if(r.mutiny){ pushLog(S.age,'征发不继，军中哗变，折兵 '+r.loss+'。','bad'); toast('哗变','折兵 '+r.loss,'danger'); }
        else if(r.plague){ pushLog(S.age,'修养生息，然疫病流行，折兵 '+r.plagueLoss+'。','bad'); toast('疫病','折兵 '+r.plagueLoss,'danger'); }
        else { pushLog(S.age,'修养生息，兵民归心，得兵 '+r.got+'。',''); toast('生息','+'+r.got+' 兵','gain'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
/* 御驾亲征（核心风险 · 拓土） */
function secThroneCampaign(){
  return { title:'御驾亲征（核心风险 · 拓土）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const rate = emperorCampaignRate(S);
    const html = '<p class="play-note danger-note">御驾亲征：敌力 <b class="lat">2万–6万</b>，<span class="qty-warn">兵<敌×0.6 必败</span>；胜则拓土但耗兵耗库。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="tc-prev"></div>'
      + '<button class="btn btn--primary" id="tc-go" type="button"'+(exhausted?' disabled':'')+'>御驾亲征</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#tc-prev');
      prev.innerHTML = '预计胜率 <b class="lat">'+Math.round(rate*100)+'%</b> · 胜：领土 ＋5~18 州、兵力 -3000~8000、国库 -2万~6万 · 败：折兵损地伤身'
        + ((S.troops||0)<12000?'<span class="qty-warn"> · 兵力不足（需≥12000）</span>':'')
        + (exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#tc-go');
      if(go) go.addEventListener('click', function(){
        const r = emperorCampaign();
        if(!r.ok){ toast('亲征未行', r.reason||'无效','danger'); return; }
        if(r.win){ pushLog(S.age,'御驾亲征克捷，拓土 '+r.gain+' 州，然兵疲财耗。',''); toast('亲征·胜','拓土+'+r.gain+' 州','gain'); }
        else { pushLog(S.age,'御驾亲征受挫，折兵 '+r.loss+'，失地 '+r.terr+'。','bad'); toast('亲征·败','折兵 '+r.loss,'danger'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
/* 治国理政（风险 · 国库收入） */
function secThroneGovern(){
  return { title:'治国理政（风险 · 生财）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const html = '<p class="play-note">与群臣对弈，成则国库充盈、政通人和；败则国库微减、威望受损。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="tg-prev"></div>'
      + '<button class="btn btn--primary" id="tg-go" type="button"'+(exhausted?' disabled':'')+'>治国理政</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#tg-prev');
      prev.innerHTML = '胜：国库 ＋3万~9万 · 望＋1 · 败：国库 -5000~2万 · 望－1（20% 党争损德）'
        + (exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#tg-go');
      if(go) go.addEventListener('click', function(){
        const r = emperorGovern();
        if(!r.ok){ toast('未行', r.reason||'无效','danger'); return; }
        if(r.success){ pushLog(S.age,'治国理政，府库渐充，得银 '+r.gain+'。',''); toast('理政·胜','国库+'+r.gain,'gain'); }
        else { pushLog(S.age,'治国理政不顺，国库减损'+r.loss+'。'+(r.faction?'党争又起，有清议攻讦。':''),'bad'); toast('理政·败','国库-'+r.loss,'danger'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
/* 酒池肉林（风险 · 享乐侵蚀国本） */
function secThroneDecadence(){
  return { title:'酒池肉林（享乐 · 侵蚀国本）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const html = '<p class="play-note danger-note">穷奢极欲，以国库换快活：<span class="qty-warn">耗国库、兵力、领土</span>，健康大涨而道德受损，立「酒色」之名。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="td-prev"></div>'
      + '<button class="btn btn--danger" id="td-go" type="button"'+(exhausted?' disabled':'')+'>酒池肉林</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#td-prev');
      prev.innerHTML = '耗国库 1万–3万 · 兵力 -1000~4000 · 领土 -1~5 → 健康 ＋15~30（封顶） · 心境＋1 · 道德－1'
        + (S.treasury<10000?'<span class="qty-warn"> · 国库空虚，难以铺张</span>':'')
        + (exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#td-go');
      if(go) go.addEventListener('click', function(){
        const r = emperorDecadence();
        if(!r.ok){ toast('未行', r.reason||'无效','danger'); return; }
        pushLog(S.age,'酒池肉林，彻夜笙歌，国本渐蚀。','bad'); toast('酒池肉林','耗国库 '+r.cost,'danger');
        render(); ctx.refresh();
      });
    }};
  }};
}

/* ── 道场（宗教；修仙占位不入） ── */
function openTempleScreen(){ openPlayScreen(templeScreenCfg()); }
function templeScreenCfg(){
  return {
    badge:'道场', title:'宗教 · 道场', lead:'传教、法会、化斋，皆由你定。',
    status:function(){
      const ev = sectEval(S);
      return '信徒 <b class="lat">'+S.believers+'</b> · 香火 <b class="lat">'+S.incense+'</b>'
        + (ev ? ' · <span class="badge">'+esc(ev.n)+'</span>' : '')
        + ' · 影响力 <b class="lat">'+S.influence+'/10</b>'
        + playBudgetChip();
    },
    sections:[ secPreach(), secRite(), secAlms(), secXianPlaceholder() ],
    onClose:function(){ render(); }
  };
}
function secPreach(){
  return { title:'传教（确定性 · 不耗玩法点）', render:function(ctx){
    const html = '<p class="play-note">开坛传教，耗财帛养信徒；<span class="qty-warn">信徒逾 800 后每年 10% 官府查禁</span>，损信徒损德。</p>'
      + '<div class="qty-preview" id="pr-prev"></div>'
      + '<button class="btn btn--primary" id="pr-go" type="button">传教</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#pr-prev');
      prev.innerHTML = '耗银 <b class="lat">20–80</b> · 信徒 ＋30~120' + (S.money<20?'<span class="qty-warn"> · 银钱不足</span>':'');
      const go = body.querySelector('#pr-go');
      if(go) go.addEventListener('click', function(){
        const r = templePreach();
        if(!r.ok){ toast('传教失败', r.reason||'无效','danger'); return; }
        if(r.busted){ pushLog(S.age,'传教过盛，官府查禁，信众散去 '+r.loss+' 人。','bad'); toast('查禁','-'+r.loss+' 信徒','danger'); }
        else { pushLog(S.age,'开坛传教，信众渐聚 '+r.got+' 人。',''); toast('传教','+'+r.got+' 信徒','gain'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
function secRite(){
  return { title:'法会（风险 · 香火按信徒）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const bustP = clamp(0.12 + (S.believers||0)*0.0002 - S.moral*0.01, 0.05, 0.4);
    const html = '<p class="play-note danger-note">举办法会，香火按信徒加成；然 <span class="qty-warn">妖言被查</span>则损香火信徒损德。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="ri-prev"></div>'
      + '<button class="btn btn--primary" id="ri-go" type="button"'+(exhausted?' disabled':'')+'>举办法会</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#ri-prev');
      prev.innerHTML = '耗银 5–20 · 香火 ＋约 '+Math.floor((S.believers||0)*0.05)+'+2~6 · 被查率 <b class="lat">'+Math.round(bustP*100)+'%</b>'
        + ((S.believers||0)<10?'<span class="qty-warn"> · 信徒太少（需≥10）</span>':'')
        + (exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#ri-go');
      if(go) go.addEventListener('click', function(){
        const r = templeRite();
        if(!r.ok){ toast('法会失败', r.reason||'无效','danger'); return; }
        if(r.success){ pushLog(S.age,'举办法会，香火鼎盛，香火 ＋'+r.incense+'。',''); toast('法会','香火+'+r.incense,'gain'); }
        else { pushLog(S.age,'法会被指妖言，香火信徒俱损。','bad'); toast('被查','德-1 · 信徒减','danger'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
function secAlms(){
  return { title:'化斋（风险 · 香火信徒换财）', render:function(ctx){
    const exhausted = S.playBudget<=0;
    const P = clamp(0.15 - (S.attrs.脉||0)*0.01, 0.05, 0.2);
    const html = '<p class="play-note danger-note">化斋募施，耗香火信徒分成供奉换财帛；<span class="qty-warn">与权贵合作破裂</span>则被迫害。每窗口限 1 次。</p>'
      + '<div class="qty-preview" id="al-prev"></div>'
      + '<button class="btn btn--primary" id="al-go" type="button"'+(exhausted?' disabled':'')+'>化斋</button>';
    return { html:html, wire:function(body){
      const prev = body.querySelector('#al-prev');
      prev.innerHTML = '耗信徒 10–40 · 香火 2–6 · 得财约 '+(ALMS_PROFIT_R*(10+2))+'~'+(ALMS_PROFIT_R*(40+6))+' 银 · 破裂率 <b class="lat">'+Math.round(P*100)+'%</b>'
        + (S.incense<2 || (S.believers||0)<10?'<span class="qty-warn"> · 香火信徒不足</span>':'')
        + (exhausted?'<span class="qty-warn"> · 本窗口玩法次数已用尽</span>':'');
      const go = body.querySelector('#al-go');
      if(go) go.addEventListener('click', function(){
        const r = templeAlms();
        if(!r.ok){ toast('化斋失败', r.reason||'无效','danger'); return; }
        if(r.break){ pushLog(S.age,'化斋遇权贵迫害，信众散去 '+r.bl+' 人。','bad'); toast('破裂','-'+r.bl+' 信徒 · 伤身','danger'); }
        else { pushLog(S.age,'化斋募施，得财 '+r.gain+' 银。',''); toast('化斋','+'+r.gain+' 银','gain'); }
        render(); ctx.refresh();
      });
    }};
  }};
}
function secXianPlaceholder(){
  return { title:'修仙（在行动栏）', render:function(ctx){
    return { html:'<p class="play-note">闭关、入秘境、突破、飞升等修仙动作在左侧行动栏，本界面不重复。道场只司宗教之事。</p>' };
  }};
}

/* v1.8 PRD · 行事页路线专属界面入口（同黑市按钮显隐逻辑） */
function renderPlayScreens(){
  const wrap = document.getElementById('play-slot');
  if(!wrap || !S) return;
  const shang = S.routes.shang && S.routes.shang.active;
  const jun   = S.routes.jun   && S.routes.jun.active;
  const zheng = S.routes.zheng && S.routes.zheng.active;
  const yi    = S.routes.yi    && S.routes.yi.active;
  const zong  = (S.routes.zong && S.routes.zong.active) || !!S.flags.修仙入门;
  const dw    = S.identity==='diwang' || S.identity==='weimian';
  if(!(shang||jun||zheng||yi||zong||dw)){ wrap.hidden = true; return; }
  wrap.hidden = false;
  let btns = '';
  if(shang) btns += '<button class="btn btn--bm" data-r="shang" type="button">商铺</button>';
  if(jun)   btns += '<button class="btn btn--bm" data-r="jun" type="button">军帐</button>';
  if(zheng) btns += '<button class="btn btn--bm" data-r="zheng" type="button">衙署</button>';
  if(yi)    btns += '<button class="btn btn--bm" data-r="yi" type="button">医馆</button>';
  if(dw)    btns += '<button class="btn btn--bm" data-r="throne" type="button">朝堂</button>';
  if(zong)  btns += '<button class="btn btn--bm" data-r="zong" type="button">道场</button>';
  wrap.innerHTML = btns;
  wrap.querySelectorAll('.btn--bm').forEach(function(b){
    b.addEventListener('click', function(){
      const r = b.getAttribute('data-r');
      if(r==='shang') openShopScreen();
      else if(r==='jun') openArmyScreen();
      else if(r==='zheng') openYamenScreen();
      else if(r==='yi') openClinicScreen();
      else if(r==='throne') openThroneScreen();
      else if(r==='zong') openTempleScreen();
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════
   结局 / 传承
   ═══════════════════════════════════════════════════════════════════ */
function finishToEnding(){
  const res = resolveOutcome();
  S.ended = true;
  renderEnding(res.ach, res.death, res.eraseAch);
}
function renderEnding(ach, death, eraseAch){
  const aE = (ach && typeof ENDINGS!=='undefined' && ENDINGS[ach]) ? ENDINGS[ach] : null;
  const dE = ENDINGS[death] || ENDINGS.pingdan;
  const fatal = (dE.k==='bad');
  /* primary 为落图鉴与计分主键，与 engine.resolveOutcome 一致：
     v1.8 结局闭环·修复3：honorable 凶终（eraseAch 为假）以成就为主键，仅被抹（身败类）或同名时回退死法 */
  const primary = (ach && aE && !eraseAch && ach!==death) ? ach : death;
  const primaryIsAch = (primary===ach && !!aE);
  /* P1-4 评级：先算分（此时 dex 尚未写入，isNew 判定才准确），再录双卷 */
  const score  = lifeScore(primary);
  const rank   = endingRank(score);
  const isNewAchId = (S.identity && typeof IDENTITIES!=='undefined' && IDENTITIES[S.identity]) ? !META.dexId[S.identity] : false;   /* 列传·成就卷 是否初载（按身份键） */
  const isNewDeath= !META.dexDeath[death];                      /* 殁录·死法卷 是否初载 */
  recordEnding(primary, score);
  recordIdentity(score);   /* 落 列传（一生所立之身份） */
  recordDeath(death);      /* 落 殁录（死生有命之死法） */

  /* 凶终以墨裂显之（P0-6）：裂纹底纹 + 自左向右揭示 */
  const frameCls = fatal ? ' ink-crack ink-crack--in' : ((dE.k==='good'||dE.k==='ascend') ? ' ending-frame--good' : '');
  const aGood = (aE && (aE.k==='good'||aE.k==='ascend'));
  const aDeath = (aE && aE.k==='bad');

  /* 双栏：左「成就」右「寿终」 */
  let cols = '<div class="ending-cols" style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center;align-items:flex-start">';
  /* —— 左栏 · 成就结局 —— */
  cols += '<section class="ending-col" style="flex:1 1 280px;min-width:260px">';
  cols += '<div class="ending-col__hd meta" style="text-align:center;margin-bottom:10px">成就 · 一生所立</div>';
  cols += '<div class="ending-rule"></div>';
  if(aE){
    cols += '<h1 class="ending-name '+(aDeath?'ending-name--death':'')+'">'+esc(aE.n)+'</h1>';
    cols += '<div class="ending-badges">'
      + '<span class="badge '+(aDeath?'badge--solid':aGood?'badge--gilt':'')+'">'+esc(aE.b)+'</span>'
      + (isNewAchId?'<span class="badge">青史新载</span>':'')+'</div>';
    cols += '<p class="epitaph">'+esc(aE.ep)+'</p>';
  } else {
    cols += '<h1 class="ending-name ending-name--plain">布衣终老</h1>';
    cols += '<div class="ending-badges"><span class="badge">未立显名</span></div>';
    cols += '<p class="epitaph">布衣终老，未立显名。</p>';
  }
  cols += '</section>';
  /* —— 右栏 · 寿终结局 —— */
  cols += '<section class="ending-col" style="flex:1 1 280px;min-width:260px">';
  cols += '<div class="ending-col__hd meta" style="text-align:center;margin-bottom:10px">寿终 · 死生有命</div>';
  cols += '<div class="ending-rule"></div>';
  cols += '<h1 class="ending-name '+(fatal?'ending-name--death':'')+'">'+esc(dE.n)+'</h1>';
  cols += '<div class="ending-badges">'
    + '<span class="badge '+(fatal?'badge--solid':(dE.k==='good'||dE.k==='ascend')?'badge--gilt':'')+'">'+esc(dE.b)+'</span>'
    + (S.rank>=5?'<span class="badge badge--gilt">帝王</span>':'')
    + (isNewDeath?'<span class="badge">青史新载</span>':'')+'</div>';
  cols += '<p class="epitaph">'+esc(dE.ep)+'</p>';
  cols += '</section>';
  cols += '</div>';

  let html = '<div class="ending-frame'+frameCls+'">';
  html += cols;
  html += ratingHTML(rank, score);
  html += snapshotHTML();
  html += timelineHTML(primary);
  const hasHeir = S.children.length>0 && !S.flags.抄家;
  html += '<div class="ending-actions">'
    + (hasHeir?'<button class="btn btn--primary" id="to-legacy" type="button">承此门楣</button>':'')
    + '<button class="btn" id="to-qingshi" type="button">披阅青史</button>'
    + '<button class="btn" id="to-restart" type="button">重开此命</button></div>';
  html += '<span class="ending-seal seal seal--lg '+(fatal?'seal--death':'')+'">'+esc(rank.g)+'品</span>';
  html += '</div>';
  dom.endingBody.innerHTML = html;
  switchScreen('scr-ending');
  const toL = dom.endingBody.querySelector('#to-legacy');
  if(toL) toL.addEventListener('click', showLegacy);
  dom.endingBody.querySelector('#to-restart').addEventListener('click', function(){ startNewDraw(); switchScreen('scr-origin'); });
  const qs = dom.endingBody.querySelector('#to-qingshi');
  if(qs) qs.addEventListener('click', function(){ openQingshi({ id: S.identity || null, death: death }); });
}
/* P1-4 · 品第评定条 */
function ratingHTML(rank, score){
  return '<div class="rating">'
    + '<div class="rating__hd"><span class="ink-dot ink-dot--cinnabar"></span>品　第</div>'
    + '<div class="rating__row">'
    +   '<span class="rating__grade">'+esc(rank.n)+'</span>'
    +   '<span class="rating__desc">'+esc(rank.d)+'</span>'
    +   '<span class="rating__score">评 <b class="lat">'+score+'</b></span>'
    + '</div>'
    + '<div class="rating__scale">'
    +   ENDING_RANKS.slice().reverse().map(function(r){
          return '<span class="rating__tick'+(r.g===rank.g?' rating__tick--on':'')+'">'+esc(r.g)+'</span>';
        }).join('')
    + '</div></div>';
}
/* v1.6 · 青史双卷：列传（成就轴 dexId）＋ 殁录（死法轴 dexDeath），点击可开史鉴抽屉 */
function qingshiHTML(hl){
  hl = hl || {};
  const si = dexIdStat(), sd = dexDeathStat();
  let html = '<div class="qs-scrolls">';
  /* —— 列传卷：一生所立之身份 —— */
  html += '<section class="qs-vol"><div class="qs-vol__hd"><span class="hd3"><span class="ink-dot ink-dot--gold"></span>列传 · 一生所立</span>'
        + '<span class="meta">已载 <b class="lat">'+si.seen+'</b> / <b class="lat">'+si.total+'</b></span></div><div class="dex-grid">';
  Object.keys(IDENTITIES).forEach(function(id){
    const rec = META.dexId[id], ent = IDENTITIES[id];
    const glow = (hl.id===id) ? ' dex-cell--hl' : '';
    if(rec){
      const h = (id==='diwang') ? diwangProto(rec.v||'inherit') : (ent.hist||null);
      const hasHist = !!(h && h.txt);
      html += '<button class="dex-cell dex-cell--got'+glow+'" type="button" data-kind="id" data-key="'+id+'"'
            + (hasHist?'':' disabled')+'>'
            + '<span class="dex-cell__g">'+esc(ent.n)+'</span>'
            + '<span class="dex-cell__n">'+esc(hasHist?h.who:ent.n)+'</span>'
            + '<span class="dex-cell__c">×<b class="lat">'+(rec.c||1)+'</b></span></button>';
    }else{
      html += '<div class="dex-cell dex-cell--locked"><span class="dex-cell__g">▨</span>'
            + '<span class="dex-cell__n">未　载</span><span class="dex-cell__c">—</span></div>';
    }
  });
  html += '</div></section>';
  /* —— 殁录卷：死生有命之死法（飞升不入死法卷） —— */
  html += '<section class="qs-vol"><div class="qs-vol__hd"><span class="hd3"><span class="ink-dot ink-dot--death"></span>殁录 · 死生有命</span>'
        + '<span class="meta">已载 <b class="lat">'+sd.seen+'</b> / <b class="lat">'+sd.total+'</b></span></div><div class="dex-grid">';
  Object.keys(ENDINGS).forEach(function(k){
    const en = ENDINGS[k];
    if(en.k==='ascend') return;
    const rec = META.dexDeath[k];
    const glow = (hl.death===k) ? ' dex-cell--hl' : '';
    if(rec){
      const hasHist = !!(en.hist && en.hist.txt);
      html += '<button class="dex-cell dex-cell--got'+(en.k==='bad'?' dex-cell--bad':'')+glow+'" type="button" data-kind="death" data-key="'+k+'"'
            + (hasHist?'':' disabled')+'>'
            + '<span class="dex-cell__g">'+esc(en.b||'—')+'</span>'
            + '<span class="dex-cell__n">'+esc(hasHist?en.hist.who:en.n)+'</span>'
            + '<span class="dex-cell__c">×<b class="lat">'+(rec||1)+'</b></span></button>';
    }else{
      html += '<div class="dex-cell dex-cell--locked"><span class="dex-cell__g">▨</span>'
            + '<span class="dex-cell__n">未　载</span><span class="dex-cell__c">—</span></div>';
    }
  });
  html += '</div></section></div>';
  return html;
}
/* 青史模态：顶栏／开局页／结局页三处均可唤起（F-8 常驻） */
function openQingshi(hl){
  const box = document.createElement('div');
  box.className = 'qs-modal';
  box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-label','青史');
  box.innerHTML = '<div class="qs-modal__hd"><span class="hd3"><span class="ink-dot ink-dot--cinnabar"></span>青史 · 双卷</span>'
    + '<button class="btn btn--sm" id="qs-close" type="button">掩卷</button></div>'
    + '<div class="qs-modal__body">'+qingshiHTML(hl)+'</div>'
    + '<aside class="qs-drawer" id="qs-drawer" hidden aria-label="史鉴"></aside>';
  openModal(box, { onEsc: closeQingshi, focusSel:'#qs-close' });
  box.querySelector('#qs-close').addEventListener('click', closeQingshi);
  box.querySelectorAll('.dex-cell[data-key]').forEach(function(b){
    if(b.disabled) return;
    b.addEventListener('click', function(){ openHist(b.dataset.kind, b.dataset.key); });
  });
}
function closeQingshi(){ closeModal(); }
/* 史鉴抽屉：展示该身份／死法的历史人物原型；无 hist（史无其人）者示以「史无其人」 */
function openHist(kind, key){
  const drawer = document.querySelector('#qs-drawer');
  if(!drawer) return;
  let title='', who='', era='', txt='';
  if(kind==='id'){
    const ent = IDENTITIES[key];
    title = ent ? ent.n : '';
    if(key==='diwang'){ const h = diwangProto((META.dexId[key]&&META.dexId[key].v)||'inherit'); who=h.who; era=h.era; txt=h.txt; }
    else if(ent && ent.hist){ who=ent.hist.who; era=ent.hist.era; txt=ent.hist.txt; }
    else { txt='史无其人。'; }
  }else{
    const en = ENDINGS[key];
    title = en ? en.n : '';
    if(en && en.hist){ who=en.hist.who; era=en.hist.era; txt=en.hist.txt; }
    else { txt='史无其人。'; }
  }
  drawer.innerHTML = '<button class="qs-drawer__close" id="qs-drawer-close" type="button" aria-label="合上史鉴">×</button>'
    + '<div class="qs-drawer__hd"><span class="ink-dot ink-dot--cinnabar"></span>'+esc(title)+' · 史鉴</div>'
    + (who?'<div class="qs-drawer__who">'+esc(who)+'</div>':'')
    + (era?'<div class="meta">'+esc(era)+'</div>':'')
    + '<p class="qs-drawer__txt">'+esc(txt)+'</p>';
  drawer.removeAttribute('hidden');
  drawer.querySelector('#qs-drawer-close').addEventListener('click', function(){ drawer.setAttribute('hidden',''); });
}
function snapshotHTML(){
  const rows=[
    ['享年', L(S.age)+' 岁'],
    ['身份', RANKS[S.rank]||'—'],
    ['子嗣', S.children.length?S.children.length+' 人':'无'],
    ['心境 / 道德', L(S.mind)+' / '+L(S.moral)],
    ['财力 / 声望 / 人脉', L(S.attrs.财)+' / '+L(S.attrs.望)+' / '+L(S.attrs.脉)]
  ];
  if(S.xianTier>=0) rows.push(['修为境界', (XIAN_TIERS[S.xianTier]||'练气')+' · 修为 '+L(S.cult)]);
  if(S.merit>0) rows.push(['军功', L(S.merit)]);
  if(S.incense>0) rows.push(['香火', L(S.incense)]);
  return '<div class="snapshot"><div class="snap-grid">'
    + rows.map(function(r){ return '<div class="snap-row"><span class="snap-row__k">'+r[0]+'</span><span class="snap-row__lead"></span><span class="snap-row__v">'+r[1]+'</span></div>'; }).join('')
    + '</div></div>';
}
function timelineHTML(endId){
  const rows = S.log.filter(function(l){ return l.kind==='key'||l.kind==='bad'; }).sort(function(a,b){ return a.age-b.age; });
  /* 首尾必录：纵是平生无事，年表亦当有生卒两笔（P1-1 不得出现空年表） */
  rows.unshift({ age:0, kind:'key', txt:'生于'+S.originName+'。' });
  rows.push({ age:S.age, kind:(ENDINGS[endId] && ENDINGS[endId].k==='bad') ? 'bad' : 'key',
              txt:'卒，享年 '+S.age+' 岁。' });
  return '<div class="timeline"><div class="hd3"><span class="ink-dot ink-dot--cinnabar"></span>年　表</div>'
    + rows.map(function(l){
        return '<div class="tl-row '+(l.kind==='key'?'tl-row--key':l.kind==='bad'?'tl-row--bad':'')+'">'
          + '<span class="tl-age">'+L(l.age)+'</span>'
          + '<span class="tl-axis"><span class="ink-dot '+(l.kind==='bad'?'ink-dot--death':'')+'"></span></span>'
          + '<span class="tl-txt">'+esc(l.txt)+'</span></div>';
      }).join('')+'</div>';
}
function showGauntletDeath(){
  const g = S.gauntlet, cause = g.rows[g.rows.length-1].txt, age = g.dieAge;
  recordEnding('eguan'); recordDeath('eguan');   /* P1-4：夭折亦入双卷（史无其人） */
  dom.veil.classList.add('is-on'); dom.veil.setAttribute('aria-hidden','false');
  dom.veil.innerHTML = '<div><p class="veil__name">饿殍路毙</p>'
    + '<p class="veil__sub">孤儿乞丐 · 未过十五岁 · '+esc(cause)+'<br>此命止于 <b class="lat">'+age+'</b> 岁，族谱未入，亦无传承。</p>'
    + '<div style="margin-top:32px"><button class="btn btn--primary" id="veil-restart" type="button">重开此命</button></div></div>';
  dom.veil.querySelector('#veil-restart').addEventListener('click', function(){
    dom.veil.classList.remove('is-on'); dom.veil.setAttribute('aria-hidden','true'); dom.veil.innerHTML='';
    startNewDraw(); switchScreen('scr-origin');
  });
}
function showLegacy(){
  let html = '<h1 class="world-title" style="font-size:var(--fs-h1)">承此门楣</h1>'
    + '<p class="meta" style="text-align:center">先人 '+esc(S.originName)+' 一世已终 · 择一子嗣承续家谱</p>'
    + '<div class="heir-grid">';
  S.children.forEach(function(c,i){
    html += '<button class="heir-card" data-idx="'+i+'" type="button">'
      + '<h3 class="heir-card__n">'+esc(c.name)+'</h3>'
      + '<div class="chips" style="margin-top:8px"><span class="chip">质 · '+esc(c.tag)+'</span><span class="chip">姿 · '+esc(c.talent)+'</span></div>'
      + '<p class="meta" style="margin-top:8px">承此支血脉，续写门第。</p></button>';
  });
  html += '</div><div class="legacy-list"><div class="hd3"><span class="ink-dot"></span>门第积厚</div>';
  HOUSE_TIERS.forEach(function(t){
    const on = META.gens>=t.gen;
    html += '<div class="house-tier '+(on?'house-tier--on':'house-tier--off')+'"><span>第 '+t.gen+' 代起</span><span>'+esc(t.n)+'</span><span>'+(on?'已成':'未至')+'</span></div>';
  });
  const dSt = dexStat();
  html += '<div class="legacy-dex"><span class="meta">图鉴已录 <b class="lat">'+dSt.seen+'</b> / <b class="lat">'+dSt.total+'</b></span>'
    + '<button class="btn btn--sm" id="btn-qingshi-legacy" type="button">披阅青史</button></div>';
  html += '</div><div class="ending-actions"><button class="btn" id="legacy-cancel" type="button">不传 · 重开</button></div>';
  dom.legacyBody.innerHTML = html;
  switchScreen('scr-legacy');
  const qsL = dom.legacyBody.querySelector('#btn-qingshi-legacy');
  if(qsL) qsL.addEventListener('click', function(){ openQingshi(null); });
  dom.legacyBody.querySelectorAll('.heir-card').forEach(function(b){
    b.addEventListener('click', function(){
      commitLegacy(parseInt(b.dataset.idx,10));
      startNewDraw(); switchScreen('scr-origin');
    });
  });
  dom.legacyBody.querySelector('#legacy-cancel').addEventListener('click', function(){ startNewDraw(); switchScreen('scr-origin'); });
}

/* ═══════════════════════════════════════════════════════════════════
   启动
   ═══════════════════════════════════════════════════════════════════ */
function bindStatic(){
  dom.btnReroll.addEventListener('click', reroll);
  dom.btnConfirm.addEventListener('click', confirmOrigin);
  dom.btnNext.addEventListener('click', advanceYear);
  dom.backdrop.addEventListener('click', function(){ if(MODAL_ONESC) MODAL_ONESC(); });
  /* v1.7:右栏双 tab「路线 / 行事」 */
  const tabR = document.getElementById('tab-route');
  const tabA = document.getElementById('tab-act');
  if(tabR) tabR.addEventListener('click', function(){ setRtTab('route'); });
  if(tabA) tabA.addEventListener('click', function(){ setRtTab('act'); });
  /* 青史常驻入口（F-8）：顶栏 / 开局页 均可开双卷 */
  const qsBtn = document.getElementById('btn-qingshi');
  if(qsBtn) qsBtn.addEventListener('click', function(){ openQingshi(null); });
  const qsBtnO = document.getElementById('btn-qingshi-origin');
  if(qsBtnO) qsBtnO.addEventListener('click', function(){ openQingshi(null); });
}
function boot(){
  cacheDom();
  loadMeta();
  bindStatic();
  startNewDraw();
  switchScreen('scr-origin');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
