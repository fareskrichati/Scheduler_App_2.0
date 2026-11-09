const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('v2/js/v2-runtime.js', 'utf8');
const context = { Date, isoDate: date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` };
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function v2TimeUntil(')), context);
test('Up next keeps scheduled activities until their end, then removes them', () => {
 const item = {kind:'event',sortKey:'10:00',endTime:'12:00'};
 const date = '2026-11-08';
 for (const [time, visible, label] of [['09:00',true,'Starts in 1h'],['10:00',true,'Ends in 2h'],['11:45',true,'Ends in 15m'],['11:59:30',true,'Ends in 1m'],['12:00',false,'Starting now']]) {
  const now = new Date(`${date}T${time}`);
  assert.equal(context.v2IsUpcoming(item,date,now),visible,time);
  assert.equal(context.v2TimeUntil(date,item.sortKey,now,item.endTime),label,time);
 }
 assert.equal(context.v2IsUpcoming(item,'2026-11-07',new Date(`${date}T11:00`)),false);
 assert.equal(context.v2IsUpcoming({...item,endTime:undefined},date,new Date(`${date}T11:00`)),false);
 assert.equal(context.v2IsUpcoming({kind:'homework',sortKey:'12:00'},date,new Date(`${date}T11:00`)),true);
});
