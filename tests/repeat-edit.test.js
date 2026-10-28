const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('v2/js/app.js','utf8');
for(const [kind,fn,collection] of [['event','saveEventItem','schedule'],['class','saveClassItem','schedule'],['homework','saveHomework','homework'],['reminder','saveReminder','reminders']]) {
 function fixture(series=false,valid=true){
  const record={id:'original',title:'Meeting',type:kind,date:'2026-10-27',seriesId:series?'series':undefined};
  const values={Id:'original',Title:'Meeting',Date:'2026-10-27',Start:'10:00',End:'11:00',Class:'Math',Status:'pending',Color:'#123abc',RepeatMode:'daily'};
  const elements=new Proxy({}, {get:(o,key)=>o[key]??=( {value:values[key.slice(kind.length)]||'',checked:key===kind+'Repeat',dataset:{seriesId:series?'series':''}})});
  const ctx={elements,state:{data:{schedule:[],courses:[],homework:[],reminders:[],[collection]:[record]}},crypto:require('node:crypto').webcrypto,getExistingStatus:()=> 'pending',getExistingCompletedAt:()=>'',getMatchSourceValue:()=>'',normalizeColor:x=>x,colorForSelectedClass:(c,x)=>x,startOfMonth:x=>x,persistAndRender(){},window:{alert(){}},buildRepeatedScheduleItems:()=>valid?[{...record,id:'first',seriesId:'series'},{...record,id:'second',date:'2026-10-28',seriesId:'series'}]:null};
  ctx.buildRepeatedCollectionItems=ctx.buildRepeatedScheduleItems;ctx['reset'+kind[0].toUpperCase()+kind.slice(1)+'Form']=()=>{};
  const start=source.indexOf('function '+fn+'(');vm.createContext(ctx);vm.runInContext(source.slice(start,source.indexOf('\nfunction ',start+10)),ctx);return {ctx,record,save:()=>ctx[fn]()};
 }
 test(kind+' converts an existing single item to a series without keeping the original',()=>{const f=fixture();f.save();assert.equal(f.ctx.state.data[collection].length,2);assert.ok(f.ctx.state.data[collection].every(i=>i.seriesId&&i.id!=='original'))});
 test(kind+' preserves the existing series when repeat validation fails',()=>{const f=fixture(true,false);f.save();assert.equal(f.ctx.state.data[collection].length,1);assert.equal(f.ctx.state.data[collection][0],f.record)});
}
