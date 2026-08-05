/* 纯 Node + 真实 Chrome(CDP) 跑完整通关，验证 UI 运行时无报错。
   关键点：Runtime.evaluate 顶层语句能访问页面的顶层 let 全局(DRAW/S/dom)，
   但嵌套函数(IIFE)看不到——所以全程用 Node 侧循环 + 顶层表达式驱动，绝不用 IIFE。 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE_URL = 'file:///C:/Users/Hoolinks/WorkBuddy/2026-08-04-17-23-59/project/index.html';
const PORT = 9355;
const USER_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'alc3-'));
const child = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + USER_DIR, FILE_URL
], { stdio: 'ignore' });

function getJSON(u){ return new Promise((res, rej) => {
  http.get(u, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{ res(JSON.parse(d)); }catch(e){ rej(e); } }); }).on('error', rej);
}); }
async function waitEndpoint(){ for(let i=0;i<80;i++){ try { return await getJSON('http://127.0.0.1:'+PORT+'/json'); } catch(e){ await new Promise(r=>setTimeout(r,300)); } } throw new Error('chrome endpoint timeout'); }
function pickPageWs(list){ const t = list.find(x=>x.type==='page' && /index\.html/.test(x.url||'')) || list.find(x=>x.type==='page'); return t && t.webSocketDebuggerUrl; }

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let exitCode = 0;
  const pageErrors = [];
  try {
    const list = await waitEndpoint();
    const wsUrl = pickPageWs(list);
    if(!wsUrl) throw new Error('no page target');
    const ws = new WebSocket(wsUrl);
    const pending = new Map(); const events = []; let msgId = 0;
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error('ws ' + (e.message||''))); });
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if(m.id !== undefined && pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); } else if(m.method){ events.push(m); if(m.method === 'Runtime.exceptionThrown'){ const d = m.params.exceptionDetails; pageErrors.push((d.exception && d.exception.description) || d.text || 'exception'); } } };
    const send = (method, params) => new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
    await send('Runtime.enable');
    // 轮询等待游戏脚本加载完成（避免固定 sleep 的竞态）
    let ready = false;
    for(let i=0;i<60;i++){
      const t = await step('typeof startNewDraw');
      if(t === 'function'){ ready = true; break; }
      await sleep(200);
    }
    if(!ready){ throw new Error('game scripts not loaded (startNewDraw undefined)'); }

    // 顶层表达式求值（绝不用 IIFE）；返回值走 returnByValue
    async function step(expr){
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if(r.result && r.result.exceptionDetails){ const ed = r.result.exceptionDetails; pageErrors.push('eval['+expr.slice(0,40)+']: ' + ((ed.exception && ed.exception.description) || ed.text)); }
      return r.result && r.result.result ? r.result.result.value : undefined;
    }

    // 开局
    await step('startNewDraw()');
    await step('selectOrigin(DRAW.pool[0].id)');
    await step('confirmOrigin()');
    await step('S.married = true; S.children.push({ n:"长嗣", sex:"男" });'); // 制造子嗣，确保结局页出现「承此门楣」
    await sleep(300);
    // 强制一个身份，触发 CAREER 生涯事件渲染路径
    const careerKey = await step('(function(){ if(typeof CAREER==="undefined") return null; var ks=Object.keys(CAREER); if(!ks.length) return null; S.identity=ks[0]; return ks[0]; })()');
    // 注：上面用 IIFE 取 CAREER 键名（CAREER 是 let，但只是读取键名；赋值时已用顶层语句 S.identity=... 在步进里）— 修正：改用顶层
    // 重新用顶层设置身份：
    await step('S.identity = (typeof CAREER!=="undefined" && Object.keys(CAREER).length) ? Object.keys(CAREER)[0] : S.identity');

    let years = 0, eventsSeen = 0, actionsDone = 0, restStuck = 0, maxModal = 0;
    for(let y=0; y<40; y++){
      // 等到 idle/action
      let g = 0;
      while(g < 80){
        const ph = await step('S.phase');
        const ended = await step('S.ended');
        if(ended) break;
        if(ph === 'idle' || ph === 'action') break;
        await sleep(150); g++;
      }
      if(await step('S.ended')) break;
      const ph1 = await step('S.phase');
      if(ph1 !== 'idle' && ph1 !== 'action'){ pageErrors.push('stuck phase=' + ph1 + ' year=' + y); break; }
      await step('advanceYear()');
      await sleep(400);
      // 处理结算 toast + 事件弹窗
      let mg = 0;
      while(mg < 60){
        if(await step('S.ended')) break;
        const open = await step('!!(dom && dom.modalRoot && dom.modalRoot.children.length)');
        if(!open){
          const ph = await step('S.phase');
          if(ph === 'busy'){ await sleep(200); mg++; continue; }
          break;
        }
        maxModal = Math.max(maxModal, await step('dom.modalRoot.children.length') || 0);
        const hasOpt = await step('!!(dom.modalRoot.querySelector(".opt:not(:disabled)"))');
        if(hasOpt){ await step('dom.modalRoot.querySelector(".opt:not(:disabled)").click()'); eventsSeen++; await sleep(650); mg++; continue; }
        const hasCont = await step('!!(dom.modalRoot.querySelector(".modal__foot button"))');
        if(hasCont){ await step('dom.modalRoot.querySelector(".modal__foot button").click()'); await sleep(500); mg++; continue; }
        const anyBtn = await step('!!(dom.modalRoot.querySelector("button"))');
        if(anyBtn){ await step('dom.modalRoot.querySelector("button").click()'); await sleep(500); mg++; continue; }
        break;
      }
      if(await step('S.ended')) break;
      // 行动阶段：点第一个可用行动（rest 常驻，必有）
      const ph2 = await step('S.phase');
      if(ph2 === 'action'){
        const hasAct = await step('!!(dom.actGroup && dom.actGroup.querySelector("button:not(:disabled)"))');
        if(hasAct){ await step('dom.actGroup.querySelector("button:not(:disabled)").click()'); actionsDone++; await sleep(600); }
        else { restStuck++; }
      }
      years++;
    }
    // 结局 + 尝试传承
    const ended = await step('S.ended');
    const endingKey = await step('S.pendingEnd');
    const age = await step('S.age');
    const identity = await step('S.identity');
    let endingShown = false, legacyShown = false;
    if(ended){
      endingShown = await step('!!(dom.endingBody && dom.endingBody.innerHTML.length>0)');
      await step('if(dom.endingBody.querySelector("#to-legacy")) dom.endingBody.querySelector("#to-legacy").click()');
      await sleep(600);
      legacyShown = await step('!!(dom.scrLegacy && /is-on/.test(dom.scrLegacy.className)) || !!(dom.legacyBody && dom.legacyBody.innerHTML.length>0)');
    }
    const ok = !pageErrors.length && ended;
    console.log(JSON.stringify({
      ok,
      pageErrors,
      runtime: { years, eventsSeen, actionsDone, restStuck, maxModal, ended, age, endingKey, identity, careerKey, endingShown, legacyShown, cdpEvents: events.length }
    }, null, 2));
    if(pageErrors.length) exitCode = 2;
    if(!ended) exitCode = 3;
  } catch(e){
    console.log(JSON.stringify({ ok:false, fatal: e.message, pageErrors }));
    exitCode = 1;
  } finally {
    try { child.kill('SIGKILL'); } catch(_){}
    try { fs.rmSync(USER_DIR, { recursive:true, force:true }); } catch(_){}
    process.exit(exitCode);
  }
})();
