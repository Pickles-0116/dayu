/* 数据层字段计数校验（一次性） */
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/../data.js', 'utf8');

const cat = (s.match(/cat:'[^']+'/g) || []).length;
const idBlock = s.slice(s.indexOf('const IDENTITIES'));
const enBlock = s.slice(s.indexOf('const ENDINGS'));
function countHist(block){
  // 仅统计对象字面量内的 hist:{，避免误伤说明文字
  let n = 0, i = 0;
  while((i = block.indexOf('hist:{', i)) >= 0){ n++; i += 6; }
  return n;
}
const idHist = countHist(idBlock.slice(0, idBlock.indexOf('\n};', 50)));
const enHist = countHist(enBlock.slice(0, enBlock.indexOf('\n};', 50)));
const layers = (s.match(/layer:'[^']+'/g) || []).length;
const hasRL = /const ROUTE_LAYERS/.test(s);
const hasProto = /function diwangProto/.test(s);

console.log('ACTIONS cat :', cat);
console.log('IDENTITIES hist :', idHist);
console.log('ENDINGS hist :', enHist);
console.log('ROUTES layer :', layers);
console.log('ROUTE_LAYERS :', hasRL);
console.log('diwangProto :', hasProto);
