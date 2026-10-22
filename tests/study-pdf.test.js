const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function reader(){const context={window:{},location:{href:'https://planner.test/v2/study/index.html'}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../v2/study/file-import.js'),'utf8'),context);return context.window.StudyFiles;}
test('PDF text extraction retains question, answer, and page line breaks',()=>{
 const items=[{str:'1.',transform:[1,0,0,1,10,100]},{str:'Define memory.',transform:[1,0,0,1,20,100],hasEOL:true},{str:'Answer: Brief storage.',transform:[1,0,0,1,10,80],hasEOL:true},{str:'2. Explain recall.',transform:[1,0,0,1,10,60]}];
 assert.equal(reader().textFromItems(items),'1. Define memory.\nAnswer: Brief storage.\n2. Explain recall.');
});
test('PDF text extraction recognizes baselines even without explicit EOL flags',()=>{
 assert.equal(reader().textFromItems([{str:'First line',transform:[1,0,0,1,0,100]},{str:'Second line',transform:[1,0,0,1,0,80]}]),'First line\nSecond line');
});
test('File reader rejects unsupported and oversized uploads without reading bytes',async()=>{
 let read=false;const file={name:'work.docx',size:20,text(){read=true;}};
 await assert.rejects(reader().read(file),/Choose a PDF/);
 file.name='work.pdf';file.size=21*1024*1024;
 await assert.rejects(reader().read(file),/20 MB/);assert.equal(read,false);
});
test('Text imports keep the original Unicode equations',async()=>{
 assert.equal(await reader().read({name:'notes.md',size:30,text:async()=> 'KE = ½mv²'}),'KE = ½mv²');
});
