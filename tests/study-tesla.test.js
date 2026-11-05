const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('v2 location controls preserve and escape the full Tesla address',()=>{
 const source=read('v2/js/app.js'),ctx={};vm.createContext(ctx);
 for(const [start,end] of [['buildLocationMapLinks','renderDaySummary'],['escapeHtml',null]]){
 const text=source.slice(source.indexOf(`function ${start}(`));vm.runInContext(end?text.slice(0,text.indexOf(`function ${end}(`)):text.slice(0,text.indexOf('\n}')+2),ctx);
 }
 const html=ctx.buildLocationMapLinks('  1 Main & "West" <Hall>  ');
 assert.match(html,/data-tesla-address="1 Main &amp; &quot;West&quot; &lt;Hall&gt;"/);
 assert.match(html,/Send to Tesla/);assert.equal(ctx.buildLocationMapLinks(''), '');
});
test('Tesla share preserves Unicode addresses and cancellation is quiet',async()=>{
 let handler,payload;
 const button={dataset:{teslaAddress:'42 O’Farrell St, Montréal #4'},disabled:false};
 const ctx={document:{addEventListener:(name,fn)=>handler=fn},navigator:{share:async p=>{payload=p;throw Object.assign(new Error('cancelled'),{name:'AbortError'});}}};
 vm.runInNewContext(read('v2/js/tesla-share.js'),ctx);
 await handler({target:{closest:()=>button}});
 assert.equal(payload.text,button.dataset.teslaAddress);
 assert.equal(new URL(payload.url).searchParams.get('query'),button.dataset.teslaAddress);
 assert.equal(button.disabled,false);
});
test('Study iframe is account scoped and removed on sign out',()=>{
 const frame={dataset:{},style:{},removeAttribute(name){delete this[name]}};
 const ctx={window:{addEventListener(){}},document:{querySelector:()=>frame},authState:{isAuthenticated:true,userId:'one'},state:{activeTab:'study'},getImportableClasses:()=>[{title:'Physics'}]};
 vm.createContext(ctx);vm.runInContext(read('v2/js/study-integration.js'),ctx);
 ctx.renderV2Study();assert.equal(frame.src,'study/index.html');assert.match(frame.dataset.studyOwner,/one/);
 ctx.authState.userId='two';ctx.renderV2Study();assert.match(frame.dataset.studyOwner,/two/);
 ctx.authState.isAuthenticated=false;ctx.renderV2Study();assert.equal(frame.src,undefined);assert.equal(frame.dataset.studyOwner,undefined);
});
function plannerContext(){
 const source=read('v2/study/app.js'),ctx={crypto:require('node:crypto').webcrypto};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function dateValue('),source.indexOf('const later=')),ctx);
 vm.runInContext(source.slice(source.indexOf('function buildSessions('),source.indexOf('function sortedSessions(')),ctx);
 return ctx;
}
test('Study plan covers topics before repeating priorities, including across DST',()=>{
 const ctx=plannerContext(),start=new Date('2026-10-30T00:00:00');
 const plan={examFocus:'! Chain rule\nIntegrals\nLimits',exam:'2026-11-06',minutes:'30'};
 const result=ctx.buildSessions(plan,start);
 assert.equal(result.sessions.length,7);
 assert.equal(result.sessions.filter(s=>s.title.endsWith('Chain rule')).length,3);
 assert.equal(result.sessions[0].date,'2026-10-30');
 assert.equal(result.sessions[6].date,'2026-11-05');
 assert.equal(new Set(result.sessions.map(s=>s.id)).size,7);
 assert.ok(result.sessions.every(s=>!s.done&&s.minutes===30));
 plan.exam='2026-10-31';
 assert.deepEqual(Array.from(ctx.buildSessions(plan,start).uncovered),['Integrals','Limits']);
});
test('Study plan rejects expired dates and blank topics',()=>{
 const ctx=plannerContext(),start=new Date('2026-11-05T00:00:00');
 for(const exam of ['2026-11-05','2026-11-04','invalid'])assert.equal(ctx.buildSessions({exam,examFocus:'Limits',minutes:'30'},start).sessions.length,0);
 assert.equal(ctx.buildSessions({exam:'2026-11-12',examFocus:'! \n',minutes:'30'},start).sessions.length,0);
});
test('Study context includes saved exams and homework quizzes with their own classes',()=>{
 const ctx={window:{addEventListener(){}},authState:{userId:'one'},getImportableClasses:()=>[{title:'Physics'}],state:{data:{exams:[{id:'a',title:'Midterm',course:'Physics',date:'2026-11-12',notes:'Chapters 1–3'},{id:'b',title:'Quiz 2',course:'Biology',date:'2026-11-14'},{id:'c',title:'Old exam',course:'Physics',date:'2026-11-01',status:'done'}],homework:[{id:'a',title:'Quiz 1',course:'Physics',date:'2026-11-10'},{id:'d',title:'Problem set',course:'Physics',date:'2026-11-10'}]}}};
 vm.runInNewContext(read('v2/js/study-integration.js'),ctx);
 const result=ctx.window.getUniPlanStudyContext();
 assert.deepEqual(Array.from(result.courses),['Physics','Biology']);
 assert.deepEqual(Array.from(result.assessments,x=>x.id),['exam:a','exam:b','homework:a']);
 assert.equal(result.assessments[0].notes,'Chapters 1–3');assert.equal(result.assessments[1].kind,'Quiz');
});
test('Linked assessments can build a starter plan without inventing subject topics',()=>{
 const ctx=plannerContext();const result=ctx.buildSessions({assessmentId:'exam:a',exam:'2026-11-12',minutes:'45',examFocus:''},new Date('2026-11-05T00:00:00'));
 assert.equal(result.sessions.length,7);assert.equal(result.sessions[0].title,'Review: Class concepts');
 assert.ok(result.sessions.every(s=>s.minutes===45&&s.date<'2026-11-12'));
});
test('Assessment plans are isolated by account, class, and assessment and survive reload',()=>{
 const source=read('v2/study/app.js'),storage=new Map();
 const ctx={accountKey:'uniplan-study:one',later:new Date('2026-11-12T00:00:00'),context:{assessments:[]},today:new Date('2026-11-05T00:00:00'),localStorage:{getItem:key=>storage.get(key)||null}};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function dateValue('),source.indexOf('const later=')),ctx);
 vm.runInContext(source.slice(source.indexOf('const assessments='),source.indexOf('let initialCourse=')),ctx);
 storage.set('uniplan-study:one:Physics:assessment:exam%3Aa',JSON.stringify({course:'Physics',notes:'',sessions:[{id:'s',title:'Review',date:'2026-11-08',minutes:30,done:true}]}));
 assert.equal(ctx.loadClass('Physics','exam:a').sessions[0].done,true);
 assert.equal(ctx.loadClass('Physics','exam:b').sessions.length,0);
 assert.equal(ctx.loadClass('Biology','exam:a').sessions.length,0);
 ctx.accountKey='uniplan-study:two';assert.equal(ctx.loadClass('Physics','exam:a').sessions.length,0);
});
function bridgeFixture(protocol='https:'){
 let receive;const sent=[];const contentWindow={postMessage:(...args)=>sent.push(args)};
 const frame={contentWindow,style:{}};
 const ctx={location:{protocol,origin:protocol==='file:'?'null':'https://planner.test'},window:{addEventListener:(type,fn)=>receive=fn},document:{querySelector:()=>frame},authState:{isAuthenticated:true,userId:'one'},state:{data:{courses:[],exams:[{id:'e',title:'Quiz 1',course:'Physics',date:'2026-11-12'}]}},getImportableClasses:()=>[{title:'Physics'}]};
 vm.runInNewContext(read('v2/js/study-integration.js'),ctx);
 return{ctx,sent,request:(origin,source=contentWindow)=>receive({origin,source,data:{type:'uniplan-study-context-request'}})};
}
test('Study message bridge works with local-file opaque origins and HTTP',()=>{
 for(const protocol of ['file:','https:']){
  const f=bridgeFixture(protocol);f.request(protocol==='file:'?'null':'https://planner.test');
  assert.equal(f.sent.length,1);assert.equal(f.sent[0][0].context.courses[0],'Physics');assert.equal(f.sent[0][0].context.assessments[0].title,'Quiz 1');
  assert.equal(f.sent[0][1],protocol==='file:'?'*':'https://planner.test');
 }
});
test('Study bridge rejects other windows, hostile origins, and signed-out requests',()=>{
 const f=bridgeFixture();f.request('https://hostile.test');f.request('https://planner.test',{});assert.equal(f.sent.length,0);
 f.ctx.authState.isAuthenticated=false;f.request('https://planner.test');assert.equal(f.sent.length,0);
});
test('Study frame requests context without reading across frame origins',()=>{
 const source=read('v2/study/app.js').split('function initializeStudy(context){')[0];
 for(const protocol of ['file:','https:']){
  let receive,loaded;const requests=[];const parent={postMessage:(...args)=>requests.push(args)};
  const ctx={location:{protocol,origin:protocol==='file:'?'null':'https://planner.test'},window:{parent,addEventListener:(type,fn)=>receive=fn},document:{getElementById:()=>({})},setInterval:()=>1,clearInterval(){},initializeStudy:value=>loaded=value};
  vm.runInNewContext(source,ctx);assert.equal(requests[0][0].type,'uniplan-study-context-request');
  const event={origin:protocol==='file:'?'null':'https://planner.test',source:parent,data:{type:'uniplan-study-context',context:{userId:'one',courses:['Physics']}}};
  receive({...event,source:{}});assert.equal(loaded,undefined);receive(event);assert.equal(loaded.courses[0],'Physics');
 }
});
test('Exam card study action opens the exact assessment in Study',()=>{
 const frame={};let active;
 const ctx={window:{addEventListener(){}},document:{querySelector:()=>frame},authState:{isAuthenticated:true},state:{data:{exams:[{id:'quiz & 1',course:'Physics',status:'pending'},{id:'done',status:'done'}]}},setActiveTab:tab=>active=tab};
 vm.createContext(ctx);vm.runInContext(read('v2/js/study-integration.js'),ctx);
 ctx.openStudyPlanForExam('quiz & 1');assert.equal(active,'study');
 const url=new URL(frame.src,'https://planner.test/v2/');assert.equal(url.searchParams.get('assessment'),'exam:quiz & 1');assert.equal(url.searchParams.get('create'),'1');
 frame.src='unchanged';ctx.openStudyPlanForExam('done');assert.equal(frame.src,'unchanged');
 ctx.authState.isAuthenticated=false;ctx.openStudyPlanForExam('quiz & 1');assert.equal(frame.src,'unchanged');
});
