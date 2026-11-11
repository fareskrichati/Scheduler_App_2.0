const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('v2/js/study-scheduler.js','utf8'),context);
const request={date:'2026-11-09',minutes:30,preference:'midday',earliest:'11:00',latest:'17:00'};
const now=new Date('2026-11-05T10:00:00');
const find=(changes={},schedule=[],exams=[],clock=now)=>context.findStudySlot({...request,...changes},schedule,exams,clock);
test('midday search fits between overlapping classes and events without moving them',()=>{
 const schedule=[{date:request.date,start:'10:00',end:'12:00'},{date:request.date,start:'11:30',end:'13:00'},{date:request.date,start:'14:00',end:'15:00'}];
 assert.equal(find({},schedule).start,'13:00');assert.equal(schedule[0].start,'10:00');
 assert.equal(find({minutes:60},schedule).end,'14:00');
});
test('end of day uses the first free slot after the chosen time',()=>{
 const schedule=[{date:request.date,start:'17:30',end:'19:00'},{date:request.date,start:'12:00',end:'13:00'}];
 assert.equal(find({preference:'end',earliest:'17:00',latest:'22:00'},schedule).start,'17:00');
 assert.throws(()=>find({preference:'end',earliest:'17:45',latest:'19:00'},schedule),/No open time/);
});
test('search avoids past times today and blocks exams with unknown end times',()=>{
 assert.equal(find({date:'2026-11-05'},[],[],new Date('2026-11-05T13:22:00')).start,'13:25');
 assert.throws(()=>find({},[{date:request.date,start:'11:00',end:'13:00'}],[{date:request.date,time:'13:00',status:'pending'}]),/No open time/);
 assert.equal(find({},[],[{date:request.date,time:'11:00',end:'12:30'}]).start,'12:30');
});
test('a scheduled study session blocks another one, and rescheduling excludes itself',()=>{
 const schedule=[{id:'s',date:request.date,start:'11:00',end:'11:30'}];
 assert.equal(find({},schedule).start,'11:30');assert.equal(find({eventId:'s'},schedule).start,'11:00');
});
test('invalid dates, windows and durations do not schedule',()=>{
 for(const changes of [{date:'2026-02-30'},{date:'2026-11-01'},{minutes:0},{minutes:33},{earliest:'18:00'},{latest:'25:00'},{preference:'anything'}])assert.throws(()=>find(changes));
});
function bridge(){
 let handler;const messages=[];const frame={contentWindow:{postMessage:value=>messages.push(value)}};
 const state={data:{schedule:[{id:'class',type:'class',date:request.date,start:'11:00',end:'12:00'}],exams:[]}};
 class FixedDate extends Date { constructor(...args){ super(...(args.length?args:[now.getTime()])); } }
 const ctx={state,Date:FixedDate,location:{origin:'https://planner.test',protocol:'https:'},window:{addEventListener:(type,fn)=>handler=fn},document:{querySelector:()=>frame},authState:{isAuthenticated:true,userId:'one'},getImportableClasses:()=>[{title:'Physics'}],colorForSelectedClass:()=> '#123456',crypto:require('node:crypto').webcrypto,persistAndRender(){}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('v2/js/study-scheduler.js','utf8'),ctx);vm.runInContext(fs.readFileSync('v2/js/study-integration.js','utf8'),ctx);
 return{state,ctx,messages,send:(changes={})=>handler({origin:'https://planner.test',source:frame.contentWindow,data:{type:'uniplan-study-schedule',requestId:'r',userId:'one',request:{...request,course:'Physics',title:'Review',sessionId:'session-1'},...changes}})};
}
test('bridge schedules into the main calendar, deduplicates retries, and removes only linked sessions',()=>{
 const f=bridge();f.send();assert.equal(f.messages[0].slot.start,'12:00');assert.equal(f.state.data.schedule.length,2);
 f.send();assert.equal(f.state.data.schedule.length,2);
 const item=f.state.data.schedule.find(x=>x.studySessionId);assert.equal(item.color,'#123456');
 f.send({request:{action:'remove',course:'Physics',eventIds:['class',item.id]}});assert.equal(f.state.data.schedule.length,1);assert.equal(f.state.data.schedule[0].id,'class');
});
test('bridge rejects wrong accounts and classes without writing calendar events',()=>{
 const f=bridge();f.send({userId:'two'});assert.match(f.messages[0].error,/Sign in/);
 f.send({request:{...request,course:'Biology',title:'Review',sessionId:'s'}});assert.match(f.messages[1].error,/saved classes/);assert.equal(f.state.data.schedule.length,1);
});
test('generated study plans write calendar events and report sessions that do not fit',()=>{
 const f=bridge();
 const sessions=[{id:'plan-1',title:'Review concepts',date:request.date,minutes:30},{id:'plan-2',title:'Practice',date:request.date,minutes:30},{id:'plan-3',title:'Recap',date:request.date,minutes:480}];
 const batch={request:{action:'plan',...request,course:'Physics',sessions}};
 f.send(batch);
 const result=f.messages[0].sessions;
 assert.equal(result[0].start,'12:00');assert.equal(result[1].start,'12:30');assert.ok(result[0].eventId);assert.ok(result[1].eventId);
 assert.match(result[2].scheduleError,/No open time/);assert.equal(result[2].eventId,undefined);
 assert.equal(f.state.data.schedule.filter(item=>item.studySessionId).length,2);
 f.send(batch);assert.equal(f.state.data.schedule.filter(item=>item.studySessionId).length,2);
});
test('rebuilding replaces only the current plan’s calendar events',()=>{
 const f=bridge();f.send();const old=f.messages[0].slot.eventId;
 f.state.data.schedule.push({id:'other',studySessionId:'other-session',type:'event',course:'Biology',date:request.date,start:'14:00',end:'14:30'});
 f.send({request:{action:'plan',...request,course:'Physics',replaceEventIds:[old,'class','other'],sessions:[{id:'new-session',title:'New review',date:request.date,minutes:30}]}});
 assert.equal(f.state.data.schedule.some(item=>item.id===old),false);
 assert.ok(f.state.data.schedule.some(item=>item.id==='class'));assert.ok(f.state.data.schedule.some(item=>item.id==='other'));
 assert.equal(f.messages[1].sessions[0].start,'12:00');
});
test('View in calendar selects the saved session date and clears calendar filters',()=>{
 const f=bridge();f.send();const eventId=f.messages[0].slot.eventId;
 let active,rendered=false;f.ctx.elements={calendarFilter:{value:'classes'}};f.ctx.startOfMonth=date=>date.slice(0,7)+'-01';f.ctx.setActiveTab=tab=>active=tab;f.ctx.renderCalendar=()=>rendered=true;
 f.send({request:{action:'view',course:'Physics',eventId}});
 assert.equal(active,'calendar');assert.equal(f.state.selectedDate,request.date);assert.equal(f.state.calendarFilter,'all');assert.equal(f.ctx.elements.calendarFilter.value,'all');assert.equal(rendered,true);
});
test('Study completion from the frame changes the shared calendar record',()=>{
 const f=bridge();f.send();const eventId=f.messages[0].slot.eventId;
 f.ctx.setItemStatus=(item,status)=>{item.status=status;item.completedAt=status==='done'?'123':''};
 f.send({request:{action:'complete',course:'Physics',eventId,done:true}});
 assert.equal(f.state.data.schedule.find(item=>item.id===eventId).status,'done');
 assert.equal(f.ctx.window.getUniPlanStudyContext().studySessions[0].status,'done');
 f.send({request:{action:'complete',course:'Physics',eventId,done:false}});
 assert.equal(f.state.data.schedule.find(item=>item.id===eventId).status,'pending');
});

test('Study imports existing plans for the signed-in account without replacing cloud plans',()=>{
 const f=bridge();
 const plan={course:'Physics',assessmentId:'',notes:'Existing notes',sessions:[]};
 const entries=new Map([['uniplan-study:one:Physics',JSON.stringify(plan)],['uniplan-study:two:Physics',JSON.stringify({...plan,notes:'Other account'})]]);
 f.ctx.localStorage={length:entries.size,key:i=>[...entries.keys()][i],getItem:key=>entries.get(key)};
 let saves=0;f.ctx.saveData=()=>saves++;
 f.send({type:'uniplan-study-context-request'});
 assert.equal(f.messages[0].context.plans.Physics.notes,'Existing notes');
 f.state.data.studyPlans.Physics={...plan,notes:'Cloud edit'};
 f.send({type:'uniplan-study-context-request'});
 assert.equal(f.messages[1].context.plans.Physics.notes,'Cloud edit');
 assert.equal(saves,1);
});
test('Study sends only authenticated edits to planner sync and a fresh frame sees them',()=>{
 const f=bridge();let saves=0;f.ctx.saveData=()=>saves++;
 const plan={course:'Physics',assessmentId:'',notes:'Notes from laptop',sessions:[]};
 f.send({type:'uniplan-study-save',userId:'two',plan});
 f.send({type:'uniplan-study-save',plan:{...plan,course:'Other class'}});
 assert.equal(saves,0);
 f.send({type:'uniplan-study-save',plan});
 assert.equal(saves,1);
 f.send({type:'uniplan-study-context-request'});
 assert.equal(f.messages[0].context.plans.Physics.notes,'Notes from laptop');
});
