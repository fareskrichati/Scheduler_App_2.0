const $ = id => document.getElementById(id);
const context=window.parent.getUniPlanStudyContext();
const classes=context.courses.length?context.courses:['General study'];
const samples=Object.fromEntries(classes.map(title=>[title,'']));
const accountKey='uniplan-study:'+context.userId;
let initialCourse=classes[0];
try{const selected=localStorage.getItem(accountKey+':selected');if(classes.includes(selected))initialCourse=selected;}catch{}
let storageKey=accountKey+':'+encodeURIComponent(initialCourse);
$('course').replaceChildren(...classes.map(title=>{const option=document.createElement('option');option.value=title;option.textContent=title;return option;}));
const today = new Date(); today.setHours(0,0,0,0);
function dateValue(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const later = new Date(today); later.setDate(later.getDate()+7);
let state = {course:initialCourse,notes:'',exam:dateValue(later),minutes:'30',sources:[],completed:[],generated:false};
try {const saved=JSON.parse(localStorage.getItem(storageKey));if(saved && Object.hasOwn(samples,saved.course) && typeof saved.notes==='string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.exam) && ['20','30','45','60'].includes(saved.minutes))state={...state,...saved};}catch{}
let activeTab='plan',kit=null,practiceIndex=0,revealed=false;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{$('status').textContent='Browser storage is unavailable; this session still works.';}}
function hydrate(){ $('exam-focus').value=state.examFocus||''; $('course').value=state.course;$('notes').value=state.notes;$('exam').min=dateValue(today);$('exam').value=state.exam;$('minutes').value=state.minutes;renderSources();count(); }
function renderSources(){$('sources').innerHTML=state.sources.map(s=>`<span class="source">▤ ${escapeHTML(s)}</span>`).join('');}
function count(){$('word-count').textContent=`${$('notes').value.trim().split(/\s+/).filter(Boolean).length} words`;}
function analyze(){
 const lines=state.notes.split(/\n/).map(x=>x.trim()).filter(Boolean);
 const equations=lines.filter(x=>/[=≠→∝]/.test(x));
 const important=lines.filter(x=>!equations.includes(x)&&x.length>32);
 const topics=lines.filter(x=>x.length<=48&&!/[=≠→∝:]/.test(x));
 const target=new Date(state.exam+'T00:00:00');
 const days=Math.max(1,Math.ceil((target-today)/86400000));
 const count=state.notes.trim()||(state.examFocus||'').trim()?Math.min(days,7):0;
 const focus=(state.examFocus||'').split(/\n/).map(x=>x.trim()).filter(Boolean).map(x=>({title:x.replace(/^!\s*/,''),priority:x.startsWith('!')})).filter(x=>x.title);
 const distinct=[...new Map(focus.map(x=>[x.title.toLowerCase(),x])).values()];
 const base=distinct.length?distinct.map(x=>x.title):(topics.length?topics:important.map(x=>x.split(':')[0].slice(0,65)));
 // Cover each topic before giving high-priority topics extra sessions.
 const pool=[...base,...distinct.filter(x=>x.priority).map(x=>x.title)];
 const related=[...lines.filter(x=>x.length>40||/[=≠→∝]/.test(x)),...(state.homework?.questions||[]).map(q=>q.text)];
 const matchFor=topic=>{const words=topic.toLowerCase().match(/[a-z]{3,}/g)||[];const stop=new Set(['the','and','for','with','from','problems','questions','exam','word','important']);const keys=words.filter(w=>!stop.has(w));return related.map(text=>({text,score:keys.filter(w=>text.toLowerCase().includes(w)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score)[0]?.text;};
 const sessions=Array.from({length:count},(_,i)=>{
 const date=new Date(today);date.setDate(date.getDate()+(count===1?0:Math.floor(i*(days-1)/(count-1))));
 const topic=pool[i%Math.max(pool.length,1)]||'Your class notes';
 const mode=count===1?'Review & practice':i===count-1?'Recall & recap':i%3===1?'Practice':i%3===2?'Active recall':'Review';
 const matched=distinct.length?matchFor(topic):null;
 const focusDetail=distinct.length?(matched?`Use related material: ${matched}`:'No related source found yet. Add notes or homework for this topic, then rebuild your plan.'):null;
 return {date:date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}),title:`${mode}: ${topic}`,detail:(focusDetail?focusDetail+' ':'')+(mode==='Practice'?'Work through examples, then check your notes. Mark anything that needs another pass.':mode==='Active recall'?'Close your notes and explain the ideas from memory. Revisit the gaps.':mode==='Recall & recap'?'Test yourself on key ideas and equations. Revisit the parts you found hardest.':'Read the source notes, summarize the big ideas, then try recalling them without looking.')};
 });
 return {equations,important,topics,sessions,days,focus:distinct,uncovered:base.slice(count)};
}
function render(){
 $('kit-tag').textContent=state.generated?'Your study kit':'Build a kit from your notes';$('equation-count').textContent=kit.equations.length;
 document.querySelectorAll('[data-tab]').forEach(b=>{const selected=b.dataset.tab===activeTab;b.setAttribute('aria-selected',selected);b.tabIndex=selected?0:-1;});
 const panel=$('panel');panel.setAttribute('aria-label',({plan:'Study plan',equations:'Equations',important:'Key notes',practice:'Recall cards',homework:'Homework & exams'})[activeTab]);
 if(activeTab==='plan'){
 panel.innerHTML=(kit.focus.length?`<div class="focus-summary"><strong>Focused on your exam list</strong><p>${kit.focus.map(x=>`${x.priority?'★ ':''}${escapeHTML(x.title)}`).join(' · ')}</p>${kit.uncovered.length?`<p>Not scheduled yet: ${kit.uncovered.map(escapeHTML).join(' · ')}. There are fewer sessions than topics; allow more days or narrow your list.</p>`:''}</div>`:'')+`<div class="plan-summary"><span>${kit.sessions.length} sessions · ${escapeHTML(state.minutes)} min each</span><span>${state.completed.length}/${kit.sessions.length} complete</span></div>`+kit.sessions.map((s,i)=>`<label class="session ${state.completed.includes(i)?'done':''}"><input type="checkbox" data-session="${i}" ${state.completed.includes(i)?'checked':''}><div><div class="day">${i===0?'START HERE · ':''}${escapeHTML(s.date.toUpperCase())}</div><strong>${escapeHTML(s.title)}</strong><p>${escapeHTML(s.detail)}</p></div><span class="duration">${escapeHTML(state.minutes)} min</span></label>`).join('');
 panel.querySelectorAll('[data-session]').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.session);state.completed=input.checked?[...new Set([...state.completed,i])]:state.completed.filter(x=>x!==i);save();render();});
 } else if(activeTab==='equations')panel.innerHTML=kit.equations.length?kit.equations.map(x=>{const split=x.indexOf(':');return `<article class="equation">${split>-1?`<p>${escapeHTML(x.slice(0,split))}</p>`:''}<strong>${escapeHTML(split>-1?x.slice(split+1):x)}</strong><span class="source-label">↳ Found in your notes · Check notation and context in the source</span></article>`;}).join(''):'<div class="key-note">No equations found. Try adding a formula on its own line, such as F = ma.</div>';
 else if(activeTab==='important')panel.innerHTML=kit.important.length?kit.important.map(x=>`<article class="key-note">${escapeHTML(x)}<span class="source-label">↳ From your class notes</span></article>`).join(''):'<div class="key-note">Add a few detailed sentences to your notes to see key points here.</div>';
 else if(activeTab==='homework')renderHomework();
 else renderPractice();
}
function renderPractice(){
 const items=[...kit.equations,...kit.important];
 if(!items.length){$('panel').innerHTML='<div class="key-note">Add equations or detailed notes to make practice cards.</div>';return;}
 practiceIndex%=items.length;const item=items[practiceIndex];const split=item.indexOf(':');
 const question=split>-1?`Can you recall ${item.slice(0,split).toLowerCase()}?`:`Read, hide, and recall this note in your own words.`;
 $('panel').innerHTML=`<div class="plan-summary"><span>Active recall</span><span>Card ${practiceIndex+1} of ${items.length}</span></div><div class="practice-card"><span class="caption">${revealed?'FROM YOUR NOTES':'GIVE IT A TRY'}</span><p>${escapeHTML(revealed?item:question)}</p></div><div class="practice-actions"><button id="reveal">${revealed?'Hide answer':'Reveal note'}</button><button id="next">Next card →</button></div>`;
 $('reveal').onclick=()=>{revealed=!revealed;renderPractice();};$('next').onclick=()=>{practiceIndex++;revealed=false;renderPractice();};
}
$('notes').oninput=()=>{state.notes=$('notes').value;count();save();$('status').textContent='Notes saved. Build your plan to refresh the study kit.';};
$('exam-focus').oninput=()=>{state.examFocus=$('exam-focus').value;save();$('status').textContent='Exam focus saved. Build your plan to apply these topics.';};
$('exam').onchange=()=>{state.exam=$('exam').value;save();};$('minutes').onchange=()=>{state.minutes=$('minutes').value;save();$('status').textContent='Study time updated. Build your plan to apply it.';};
$('generate').onclick=()=>{
 if(!state.notes.trim()&&!(state.examFocus||'').trim()){$('status').textContent='Add class notes or expected exam topics first.';$('notes').focus();return;}
 if(!$('exam').reportValidity())return;
 state.exam=$('exam').value;state.minutes=$('minutes').value;state.generated=true;state.completed=[];practiceIndex=0;kit=analyze();activeTab='plan';save();render();$('status').textContent='Study kit ready. Explore your equations, key notes, and practice cards.';
};
$('course').onchange=()=>{
 save();const course=$('course').value;storageKey=accountKey+':'+encodeURIComponent(course);
 state={course,notes:'',sources:[],completed:[],generated:false,examFocus:'',exam:dateValue(later),minutes:'30',homework:{text:'',questions:[],sources:[],run:null}};
 try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&saved.course===course&&typeof saved.notes==='string')state={...state,...saved};localStorage.setItem(accountKey+':selected',course);}catch{}
 hydrate();$('homework-text').value=state.homework.text;$('homework-status').textContent='';kit=analyze();practiceIndex=0;activeTab='plan';render();$('status').textContent='Opened saved study space for '+course+'.';
};
document.querySelectorAll('[data-tab]').forEach(b=>{b.onclick=()=>{activeTab=b.dataset.tab;revealed=false;render();};b.onkeydown=e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const buttons=[...document.querySelectorAll('[data-tab]')];let i=buttons.indexOf(b);i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[i].click();buttons[i].focus();}};});
$('read-handwriting').onchange=()=>{$('handwriting-range').hidden=!$('read-handwriting').checked;};
function importOptions(){return{handwriting:$('read-handwriting').checked,first:$('ocr-first').value,last:$('ocr-last').value,userId:context.userId};}
let importing=false;
function setImporting(value){importing=value;['upload','homework-upload','course','reset','read-handwriting','ocr-first','ocr-last'].forEach(id=>$(id).disabled=value);}
$('upload').onclick=()=>$('file').click();
$('file').onchange=async()=>{
 const file=$('file').files[0];if(!file||importing)return;
 setImporting(true);
 try{const text=await StudyFiles.read(file,message=>$('status').textContent=message,importOptions());state.notes+=(state.notes?'\n\n':'')+text;state.sources.push(file.name);hydrate();save();$('status').textContent=$('read-handwriting').checked?'Handwriting transcribed. Review and correct the text and equations before building your plan.':'Notes added. Review the extracted text, then build your plan.';}
 catch(error){$('status').textContent=error.message||'Could not read this file. Try a fresh export.';}
 finally{setImporting(false);$('file').value='';}
};
$('reset').onclick=()=>{
 if(!confirm('Clear notes, homework and progress for '+state.course+' from this browser?'))return;
 const course=state.course;
 state={course,notes:'',sources:[],completed:[],generated:false,examFocus:'',exam:dateValue(later),minutes:'30',homework:{text:'',questions:[],sources:[],run:null}};
 activeTab='plan';practiceIndex=0;hydrate();$('homework-text').value='';$('homework-status').textContent='';kit=analyze();save();render();$('status').textContent='Study data cleared for this class.';
};
state.homework = state.homework || {text:'',questions:[],sources:[],run:null};
function resetHomework(){state.homework={text:'',questions:[],sources:[],run:null};$('homework-text').value='';$('homework-status').textContent='';}
function parseQuestions(text,source){
 const lines=text.replace(/\r/g,'').split('\n');const result=[];let current=null;
 const numbered=/^\s*(?:Q(?:uestion)?\s*)?\d+[.)：:]\s*/i;
 for(const line of lines){
  const trimmed=line.trim();if(!trimmed)continue;
  if(numbered.test(trimmed)){if(current)result.push(current);current={text:trimmed.replace(numbered,''),answer:'',source};}
  else if(/^Answer\s*:/i.test(trimmed)&&current){current.answer=trimmed.replace(/^Answer\s*:\s*/i,'');}
  else if(current){if(current.answer)current.answer+=' '+trimmed;else current.text+='\n'+trimmed;}
  else if(/\?$/.test(trimmed)){result.push({text:trimmed,answer:'',source});}
 }
 if(current)result.push(current);
 return result.filter(q=>q.text.trim()).map(q=>({...q,id:crypto.randomUUID(),selected:true}));
}
function addHomework(text,source){
 const questions=parseQuestions(text,source);
 const existing=new Set(state.homework.questions.map(q=>q.text.toLowerCase().trim()));
 const fresh=questions.filter(q=>{const key=q.text.toLowerCase().trim();if(existing.has(key))return false;existing.add(key);return true;});
 state.homework.questions.push(...fresh);if(fresh.length&&!state.homework.sources.includes(source))state.homework.sources.push(source);save();return fresh.length;
}
function renderHomework(){
 const hw=state.homework, panel=$('panel');
 if(hw.run){renderExam();return;}
 panel.innerHTML=`<div class="plan-summary"><span>${hw.questions.length} homework questions</span><span>Review before building</span></div><p class="hw-intro">Choose questions from your assignments. Practice shows the source answer on demand; mock exams hide it until you finish.</p><div class="exam-builder"><label>Mode<select id="exam-mode"><option value="practice">Practice set</option><option value="exam">Mock exam</option></select></label><label>Questions<input id="question-limit" type="number" min="1" max="${Math.max(1,hw.questions.length)}" value="${Math.min(5,Math.max(1,hw.questions.length))}"></label><button id="build-exam" class="primary" ${hw.questions.length?'':'disabled'}>Build set →</button></div><p class="disclaimer">Practice sets reuse your homework questions in shuffled order. Review your responses against the source answer key.</p><div id="bank-message" role="status"></div>`+
 (hw.questions.length?hw.questions.map(q=>`<label class="bank-question"><input type="checkbox" data-question="${q.id}" ${q.selected?'checked':''}><div><strong>${escapeHTML(q.text)}</strong><span class="source-label">${escapeHTML(q.source)} · ${q.answer?'Answer key included':'No answer key'}</span></div></label>`).join(''):'<div class="key-note">Your question bank starts here. Upload homework, paste numbered questions, or try the sample homework.</div>');
 panel.querySelectorAll('[data-question]').forEach(input=>input.onchange=()=>{hw.questions.find(q=>q.id===input.dataset.question).selected=input.checked;save();});
 $('build-exam').onclick=()=>{
  const selected=hw.questions.filter(q=>q.selected),limit=Number($('question-limit').value);
  if(!selected.length){$('bank-message').textContent='Select at least one question.';return;}
  if(!Number.isInteger(limit)||limit<1||limit>selected.length){$('bank-message').textContent=`Choose between 1 and ${selected.length} selected questions.`;return;}
  const shuffled=[...selected];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  hw.run={mode:$('exam-mode').value,questions:shuffled.slice(0,limit),responses:{},finished:false};save();renderHomework();
 };
}
function renderExam(){
 const run=state.homework.run,panel=$('panel');
 panel.innerHTML=`<div class="plan-summary"><span>${run.mode==='exam'?'Mock exam':'Practice set'} · ${run.questions.length} questions</span><button class="quiet" id="back-bank">← Question bank</button></div><p class="hw-intro">${run.finished?'Review your responses alongside the uploaded answer key. Answers are not automatically graded.':run.mode==='exam'?'Work without your notes. Finish when you’re ready to review the answer key.':'Try each question, then reveal the uploaded answer to check your work.'}</p>`+run.questions.map((q,i)=>`<article class="exam-question"><span class="caption">QUESTION ${i+1}</span><h3>${escapeHTML(q.text)}</h3><span class="source-label">From ${escapeHTML(q.source)}</span><label for="response-${i}" class="sr">Your response to question ${i+1}</label><textarea id="response-${i}" data-response="${i}" placeholder="Write your answer or show your work…" ${run.finished?'readonly':''}>${escapeHTML(run.responses[i]||'')}</textarea>${run.mode==='practice'||run.finished?`<details ${run.finished?'open':''}><summary>Review source answer</summary><p>${q.answer?escapeHTML(q.answer):'No answer key was uploaded. Check the original homework or ask your instructor.'}</p></details>`:''}</article>`).join('')+`<button id="finish-exam" class="primary">${run.finished?'Build another set':'Finish & review answers'}</button>`;
 panel.querySelectorAll('[data-response]').forEach(input=>input.oninput=()=>{run.responses[input.dataset.response]=input.value;save();});
 $('back-bank').onclick=()=>{state.homework.run=null;save();renderHomework();};
 $('finish-exam').onclick=()=>{if(run.finished)state.homework.run=null;else run.finished=true;save();renderHomework();};
}
$('homework-text').value=state.homework.text;
$('homework-text').oninput=()=>{state.homework.text=$('homework-text').value;save();};
$('extract-homework').onclick=()=>{state.homework.text=$('homework-text').value;const n=addHomework(state.homework.text,'Pasted homework');state.homework.run=null;activeTab='homework';render();$('homework-status').textContent=n?`${n} questions added. Review them in Homework & exams.`:'No new questions found. Use numbered questions (1., 2.) with optional Answer: lines. Duplicate questions are skipped.';};
$('sample-homework').onclick=()=>{
 const examples={
  'PHYS 101 · Intro to Physics':'1. A 4 kg object accelerates at 3 m/s². Calculate the net force.\nAnswer: F = ma = 4 × 3 = 12 N.\n\n2. A 2 kg ball travels at 5 m/s. Calculate its kinetic energy.\nAnswer: KE = ½mv² = ½ × 2 × 25 = 25 J.\n\n3. Explain why action and reaction forces do not cancel on a single object.\nAnswer: The forces act on different objects.\n\n4. A force of 10 N moves an object 3 m in the force direction. Find the work done.\nAnswer: W = Fd cos(0) = 30 J.',
  'MATH 151 · Calculus I':'1. Differentiate f(x) = x³.\nAnswer: f′(x) = 3x².\n\n2. Find the indefinite integral of x².\nAnswer: x³/3 + C.\n\n3. Differentiate sin(2x).\nAnswer: 2cos(2x), using the chain rule.',
  'BIOL 101 · Biology':'1. What distinguishes prokaryotes from eukaryotes?\nAnswer: Prokaryotes lack a membrane-bound nucleus; eukaryotes have one.\n\n2. How do enzymes affect activation energy?\nAnswer: Enzymes lower activation energy.\n\n3. Define osmosis.\nAnswer: The net movement of water across a selectively permeable membrane.'
 };
 state.homework.text=examples[state.course]||examples['PHYS 101 · Intro to Physics'];$('homework-text').value=state.homework.text;const n=addHomework(state.homework.text,'Sample homework');state.homework.run=null;activeTab='homework';save();render();$('homework-status').textContent=`Sample loaded · ${n} new questions added.`;
};
$('homework-upload').onclick=()=>$('homework-files').click();
$('homework-files').onchange=async()=>{
 if(importing)return;
 setImporting(true);let added=0;const errors=[];
 try{
 for(const file of $('homework-files').files){
  try{
   const text=await StudyFiles.read(file,message=>$('homework-status').textContent=message,importOptions());
   const n=addHomework(text,file.name);added+=n;
   // Keep the extracted text editable, even when question numbering needs correction.
   state.homework.text+=(state.homework.text?'\n\n':'')+text;$('homework-text').value=state.homework.text;
   if(!n)errors.push(`${file.name}: no new numbered questions found. Review the extracted text and number each question before extracting again.`);
  }catch(error){errors.push(`${file.name}: ${error.message||'could not read file'}`);}
 }
 state.homework.run=null;activeTab='homework';save();render();$('homework-status').textContent=`${added} questions added. ${$('read-handwriting').checked?'Review the recognized text and equations for errors. ':''}${errors.join(' ')}`;
 }finally{setImporting(false);$('homework-files').value='';}
};
hydrate();kit=analyze();render();

new ResizeObserver(()=>window.parent.postMessage({type:'uniplan-study-height',height:Math.ceil(document.body.getBoundingClientRect().height)},location.origin)).observe(document.body);
