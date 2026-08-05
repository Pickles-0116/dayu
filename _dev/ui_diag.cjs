/* 诊断：看页面脚本是否加载、全局是否可用 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE_URL = 'file:///C:/Users/Hoolinks/WorkBuddy/2026-08-04-17-23-59/project/index.html';
const PORT = 9344;
const USER_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'alc2-'));
const child = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+PORT,'--user-data-dir='+USER_DIR, FILE_URL], { stdio:'ignore' });
function getJSON(u){ return new Promise((res,rej)=>{ http.get(u,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d));}catch(e){rej(e);}});}).on('error',rej); }); }
async function waitEndpoint(){ for(let i=0;i<80;i++){ try{ return await getJSON('http://127.0.0.1:'+PORT+'/json'); }catch(e){ await new Promise(r=>setTimeout(r,300)); } } throw new Error('timeout'); }
function pickPageWs(list){ const t = list.find(x=>x.type==='page' && /index\.html/.test(x.url||'')) || list.find(x=>x.type==='page'); return t && t.webSocketDebuggerUrl; }
(async()=>{
  const list = await waitEndpoint();
  const wsUrl = pickPageWs(list);
  if(!wsUrl) throw new Error('no page target');
  const ws = new WebSocket(wsUrl);
  const pending=new Map(); let msgId=0;
  await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=e=>rej(new Error('ws '+e.message)); });
  ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id!==undefined&&pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id);} };
  const send=(method,params)=>new Promise(res=>{ const id=++msgId; pending.set(id,res); ws.send(JSON.stringify({id,method,params:params||{}})); });
  await send('Runtime.enable');
  await new Promise(r=>setTimeout(r,1500)); // 等脚本加载
  const probes = [
    'document.readyState',
    'document.scripts.length',
    'typeof S', 'typeof DRAW', 'typeof CAREER', 'typeof startNewDraw', 'typeof confirmOrigin', 'typeof dom',
    '(()=>{ try { return Object.keys(window).filter(k=>/S|DRAW|CAREER/.test(k)).slice(0,10); } catch(e){ return "err:"+e.message; } })()',
    '2+2',
    '(()=>{ try{ return "IIFE sees DRAW="+(typeof DRAW)+" S="+(typeof S)+" dom="+(typeof dom); }catch(e){ return "ERR:"+e.message; } })()'
  ];
  for(const p of probes){
    const r = await send('Runtime.evaluate', { expression: p, returnByValue:true });
    console.log(p, 'RAW=>', JSON.stringify(r));
  }
  try{ child.kill('SIGKILL'); }catch(_){}
  try{ fs.rmSync(USER_DIR,{recursive:true,force:true}); }catch(_){}
  process.exit(0);
})().catch(e=>{ console.log('FATAL', e.message); try{child.kill('SIGKILL');}catch(_){} process.exit(1); });
