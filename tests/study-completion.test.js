const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('v2/js/app.js','utf8');
function extract(name,next){return source.slice(source.indexOf('function '+name+'('),source.indexOf('function '+next+'('));}
function fixture(){
 let saves=0;const ctx={state:{data:{schedule:[{id:'study',type:'event',studySessionId:'s',course:'Physics',date:'2026-11-09',start:'18:00',end:'18:30',title:'Study',status:'pending'},{id:'party',type:'event',date:'2026-11-09',start:'20:00',end:'21:00',title:'Party'}],homework:[],exams:[],reminders:[]}},getNextVisibleOccurrences:items=>items,getStoredItemColor:()=> '#123456',formatTime:x=>x,persistAndRender:()=>saves++,document:{createElement:()=>({addEventListener(name,fn){this.click=fn}})}};
 vm.createContext(ctx);
 for(const [name,next] of [['getTodoItems','renderTodoList'],['getItemsForDate','upsertItem'],['toggleStudySessionStatus','toggleEventStatus'],['setItemStatus','pruneExpiredCompletedItems'],['buildDayStatusButton','buildDayDeleteButton']])vm.runInContext(extract(name,next),ctx);
 return{ctx,saves:()=>saves};
}
test('Study is a to-do and calendar checkbox toggles the same saved record',()=>{
 const {ctx,saves}=fixture();assert.equal(ctx.getTodoItems().length,1);assert.equal(ctx.getTodoItems()[0].kind,'study');
 const item=ctx.getItemsForDate('2026-11-09').find(x=>x.studySessionId);assert.equal(item.status,'pending');
 const button=ctx.buildDayStatusButton(item);assert.equal(button.textContent,'Mark done');button.click();
 assert.equal(ctx.getTodoItems()[0].status,'done');assert.equal(ctx.getItemsForDate('2026-11-09').find(x=>x.studySessionId).status,'done');assert.equal(saves(),1);
 ctx.toggleStudySessionStatus('study');assert.equal(ctx.getTodoItems()[0].status,'pending');
 ctx.toggleStudySessionStatus('party');assert.equal(saves(),2);
});
test('ordinary events remain without completion controls and completed study history stays saved',()=>{
 const {ctx}=fixture();assert.equal(ctx.buildDayStatusButton(ctx.getItemsForDate('2026-11-09').find(x=>x.sourceId==='party')),null);
 ctx.state.data.schedule[0].status='done';ctx.state.data.schedule[0].completedAt='1';
 ctx.isExpiredCompletedItem=()=>true;vm.runInContext(extract('pruneExpiredCompletedItems','isExpiredCompletedItem'),ctx);ctx.pruneExpiredCompletedItems();
 assert.equal(ctx.state.data.schedule.length,1);assert.equal(ctx.state.data.schedule[0].id,'study');
});
