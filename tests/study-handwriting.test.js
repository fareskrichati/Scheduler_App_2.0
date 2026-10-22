const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('netlify/functions/study-handwriting.js','utf8');
const image='data:image/jpeg;base64,YWJj';
function setup({authStatus=200,aiStatus=200,aiPayload={output_text:'1. Find F = ma.\nAnswer: [unclear]'},env={}}={}){
 const calls=[],ctx={exports:{},AbortSignal,process:{env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test-key',OPENAI_API_KEY:'server-test-key',...env}},fetch:async(url,options)=>{calls.push({url,options});return url.includes('/auth/v1/user')?{ok:authStatus===200,status:authStatus,json:async()=>({id:'user-1'})}:{ok:aiStatus===200,status:aiStatus,json:async()=>aiPayload};}};
 vm.runInNewContext(source,ctx);return{calls,run:(body={image,consent:true},headers={authorization:'Bearer test-user'})=>ctx.exports.handler({httpMethod:'POST',headers,body:JSON.stringify(body)})};
}
test('handwriting requires a user before reaching auth or OpenAI',async()=>{const s=setup();assert.equal((await s.run({image,consent:true},{})).statusCode,401);assert.equal(s.calls.length,0);});
test('explicit consent and strict image limits are enforced before uploading',async()=>{const s=setup();for(const body of [{image,consent:false},{image:'https://example.test/private.png',consent:true},{image:'data:text/html;base64,YQ==',consent:true}])assert.equal((await s.run(body)).statusCode,400);assert.equal((await s.run({image:'x'.repeat(3000001),consent:true})).statusCode,413);assert.equal(s.calls.length,0);});
test('invalid sign-in cannot reach the handwriting model',async()=>{const s=setup({authStatus:401});assert.equal((await s.run()).statusCode,401);assert.equal(s.calls.length,1);});
test('server config error is actionable and never exposes secrets',async()=>{const s=setup({env:{OPENAI_API_KEY:''}}),r=await s.run();assert.equal(r.statusCode,503);assert.match(r.body,/OPENAI_API_KEY/);assert.equal(s.calls.length,1);});
test('recognized text preserves uncertain math, disables response storage and requires review',async()=>{const s=setup(),r=await s.run();assert.equal(r.statusCode,200);const result=JSON.parse(r.body);assert.match(result.text,/\[unclear\]/);assert.equal(result.reviewRequired,true);assert.equal(s.calls[0].options.headers.apikey,'public-test-key');const payload=JSON.parse(s.calls[1].options.body);assert.equal(payload.store,false);assert.equal(payload.input[1].content[0].image_url,image);assert.match(payload.input[0].content,/Never solve questions/);assert.equal(r.headers['Cache-Control'],'no-store');});
test('partial recognition never returns a truncated transcription as complete',async()=>{const s=setup({aiPayload:{status:'incomplete',output_text:'Truncated'}});assert.equal((await s.run()).statusCode,422);});
test('AI outages and unreadable pages preserve a clear retry path',async()=>{assert.equal((await setup({aiStatus:429}).run()).statusCode,429);assert.equal((await setup({aiPayload:{output_text:'[No readable text]'}}).run()).statusCode,422);});
function clientReader({totalPages=2,failPage=0}={}){
 const seen=[],rendered=[],destroyed=[],page={};
 const pdf={numPages:totalPages,getPage:async n=>({getTextContent:async()=>({items:[{str:'Typed page '+n}]}),getViewport:()=>({width:600,height:800}),render:()=>{rendered.push(n);return{promise:Promise.resolve()};},cleanup(){}})};
 const canvas={width:0,height:0,getContext:()=>({}),toDataURL:()=>image};
 const ctx={window:{document:{createElement:()=>canvas},parent:{recognizeStudyPage:async(value,user)=>{seen.push({value,user});if(seen.length===failPage)throw new Error('Unavailable');return'Handwritten page '+seen.length;}}},location:{href:'https://planner.test/v2/study/index.html'},URL,Uint8Array};
 const library={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve(pdf),destroy:async()=>destroyed.push(true)})};ctx.libraryMock=library;
 const text=fs.readFileSync('v2/study/file-import.js','utf8').replace('let library;','let library=Promise.resolve(libraryMock);');vm.runInNewContext(text,ctx);
 return{read:options=>ctx.window.StudyFiles.read({name:'goodnotes.pdf',size:50,arrayBuffer:async()=>new ArrayBuffer(10)},()=>{},options),seen,rendered,destroyed};
}
test('standard PDF extraction stays local and never sends page images',async()=>{const s=clientReader();assert.match(await s.read({}),/Typed page 1/);assert.equal(s.seen.length,0);assert.equal(s.rendered.length,0);assert.equal(s.destroyed.length,1);});
test('handwriting renders selected pages and passes account identity without a token',async()=>{const s=clientReader({totalPages:20});assert.equal(await s.read({handwriting:true,first:4,last:5,userId:'signed-in-user'}),'Handwritten page 1\n\nHandwritten page 2');assert.deepEqual(s.rendered,[4,5]);assert.equal(s.seen[0].user,'signed-in-user');assert.equal(s.destroyed.length,1);});
test('oversized handwriting ranges are rejected before any page is sent',async()=>{const s=clientReader({totalPages:20});await assert.rejects(s.read({handwriting:true}),/10 handwritten pages/);assert.equal(s.seen.length,0);assert.equal(s.destroyed.length,1);});
test('failed pages do not silently return partial transcription',async()=>{const s=clientReader({failPage:2});await assert.rejects(s.read({handwriting:true}),/Unavailable/);assert.equal(s.destroyed.length,1);});
