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
test('Study plan uses exam priorities and reports unscheduled topics',()=>{
 const source=read('v2/study/app.js'),start=source.indexOf('function analyze()'),end=source.indexOf('function render(){');
 const ctx={state:{notes:'Chain rule: differentiate the outside and multiply by the inner derivative.',examFocus:'! Chain rule\nIntegrals\nLimits',exam:'2026-10-26'},today:new Date('2026-10-19T00:00:00')};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 let kit=ctx.analyze();assert.equal(kit.sessions.length,7);assert.equal(kit.sessions.filter(s=>s.title.endsWith('Chain rule')).length,3);assert.match(kit.sessions[0].detail,/Use related material/);assert.match(kit.sessions[2].detail,/No related source/);
 ctx.state.exam='2026-10-20';kit=ctx.analyze();assert.equal(kit.sessions.length,1);assert.deepEqual(Array.from(kit.uncovered),['Integrals','Limits']);
});
test('Homework parser keeps multiline questions and optional source answers',()=>{
 const source=read('v2/study/app.js'),ctx={crypto:require('node:crypto').webcrypto};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function parseQuestions('),source.indexOf('function addHomework(')),ctx);
 const questions=ctx.parseQuestions('1. Calculate force.\nMass is 2 kg.\nAnswer: 4 N\n\n2) Explain inertia.','homework.txt');
 assert.equal(questions.length,2);assert.equal(questions[0].text,'Calculate force.\nMass is 2 kg.');assert.equal(questions[0].answer,'4 N');assert.equal(questions[1].answer,'');assert.equal(questions[1].source,'homework.txt');
});
