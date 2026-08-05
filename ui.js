/* ═══════════════════════════════════════════════════════════════════
   第三层 · 界面与闭环（UI）——五界面切换、年回合循环、模态、结局/传承
   ═══════════════════════════════════════════════════════════════════ */

/* ───────── 基础工具 ───────── */
function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }
function badge(text, cls){ return '<span class="badge '+(cls||'')+'">'+esc(text)+'</span>'; }
function optLetter(i){ return '甲乙丙丁戊己庚辛壬癸'[i] || (i+1); }

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
let RT_TAB = 'route';
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
  dom.btnConfirm.disabled = true;
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
  render();
}

/* ═══════════════════════════════════════════════════════════════════
   年回合循环：结算 → 事件 → 行动 → 更新
   ═══════════════════════════════════════════════════════════════════ */
function advanceYear(){
  if(!S || S.ended || S.phase!=='idle') return;
  S.phase = 'busy';
  render();
  const notes = doSettle();
  showSettleNotes(notes, function(){
    if(S.pendingEnd){ setTimeout(finishToEnding, 900); return; }
    runEventQueue(pickEvents());
  });
}
function showSettleNotes(notes, done){
  const toasts = [{ t:'第 '+L(S.age)+' 年', x:(S.world==='乱世'?'乱世':'治世'), c:'gain' }];
  notes.forEach(function(n){ toasts.push({ t:n.t, x:n.x, c:n.c }); });
  if(!toasts.length){ done(); return; }
  let i=0;
  (function next(){
    if(i>=toasts.length){ setTimeout(done, 320); return; }
    const t = toasts[i++]; toast(t.t, t.x, t.c); setTimeout(next, 520);
  })();
}
function runEventQueue(evs){
  if(!evs.length){ enterActionPhase(); return; }
  const item = evs.shift();
  showEvent(item, function(){ runEventQueue(evs); });
}
function enterActionPhase(){
  S.phase = 'action'; S.actionDone = false;
  render();
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
}

/* ───────── 事件弹窗 ───────── */
function resolveOpt(opt, ctx){
  let chosen;
  if(opt.p!==undefined){ const p=(typeof opt.p==='function')?opt.p(S):opt.p; chosen = chance(p)?opt.ok:opt.ko; }
  else chosen = opt.ok;
  const deltas = applyEff(chosen.eff, ctx);
  return { txt:chosen.txt, deltas:deltas };
}
function resClass(deltas){
  if(!deltas || !deltas.length) return '';
  const g=deltas.filter(function(d){return d.v>0;}).length, l=deltas.filter(function(d){return d.v<0;}).length;
  if(g>l) return 'result--gain'; if(l>g) return 'result--loss'; return '';
}
function showEvent(item, onDone){
  const ev = item.ev;
  /* variants 分支解析：命中第一个 hook 满足条件的分支即采用其 d/eff/l */
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
  const modal = el('div','modal');
  modal.innerHTML =
    '<div class="modal__type"><span class="badge ev-'+(ev.type||'通用')+'">'+(ev.type||'通用')+'</span></div>'
    + '<h2 class="modal__title">'+esc(ev.t)+'</h2>'
    + '<p class="modal__lead">'+esc(ev.d)+'</p>'
    + '<div class="opts" id="ev-opts"></div>';
  const wrap = modal.querySelector('#ev-opts');
  ev.opts.forEach(function(opt, i){
    /* v1.6：req 只能表达属性门槛；reqFn/reqText 用于状态门槛（心境、旗标等） */
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
      showEventResult(modal, r, function(){ closeModal(); if(S.pendingEnd) finishToEnding(); else onDone(); });
    });
    wrap.appendChild(o);
  });
  openModal(modal, { focusSel:'#ev-opts .opt:not(:disabled)', onEsc:null });
}
function showEventResult(modal, r, onContinue){
  modal.innerHTML =
    '<div class="modal__type"><span class="badge">抉择</span></div>'
    + '<h2 class="modal__title">—</h2>'
    + '<div class="result '+resClass(r.deltas)+'"><p class="result__txt">'+esc(r.txt)+'</p></div>'
    + '<div class="modal__foot"><button class="btn btn--primary" data-focus="1">继续</button></div>';
  modal.querySelector('.modal__foot button').addEventListener('click', onContinue);
}
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
  renderFate(); renderActions(); renderRouteFoot();
  dom.btnNext.disabled = !(S.phase==='idle' && !S.ended);
}
function renderBadges(){
  const b = [];
  b.push(badge(S.world==='乱世'?'乱世':'治世', S.world==='乱世'?'badge--solid':''));
  b.push(badge(RANKS[S.rank]||'—',''));
  if(S.sex) b.push(badge(S.sex,''));
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
    : '（待推进一岁）');
}
function renderRouteFoot(){
  const active = Object.keys(S.routes).filter(function(id){ return S.routes[id].active; });
  dom.routeFoot.innerHTML = active.length
    ? ('已入：'+active.map(function(id){ const r=ROUTES.find(function(x){return x.id===id;}); return r?r.n:''; }).join('、'))
    : '尚无既定之途 · 静待时机';
}

/* ═══════════════════════════════════════════════════════════════════
   结局 / 传承
   ═══════════════════════════════════════════════════════════════════ */
function finishToEnding(){
  const res = resolveOutcome();
  S.ended = true;
  renderEnding(res.ach, res.death);
}
function renderEnding(ach, death){
  const aE = (ach && typeof ENDINGS!=='undefined' && ENDINGS[ach]) ? ENDINGS[ach] : null;
  const dE = ENDINGS[death] || ENDINGS.pingdan;
  const fatal = (dE.k==='bad');
  /* primary 为落图鉴与计分主键，与 engine.resolveOutcome 一致：凶终抹去成就铭文 */
  const primary = (ach && aE && !fatal && ach!==death) ? ach : death;
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
  html += '</div><div class="ending-actions"><button class="btn" id="legacy-cancel" type="button">不传 · 重开</button></div>';
  dom.legacyBody.innerHTML = html;
  switchScreen('scr-legacy');
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
