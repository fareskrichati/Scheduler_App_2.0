// A message handshake also works for file:// previews, whose frames have opaque origins.
let studyConnected=false;
const studyTargetOrigin=location.protocol==='file:'?'*':location.origin;
function requestStudyContext(){window.parent.postMessage({type:'uniplan-study-context-request'},studyTargetOrigin);}
window.addEventListener('message',event=>{
 const trustedOrigin=location.protocol==='file:'?event.origin==='null':event.origin===location.origin;
 if(studyConnected||!trustedOrigin||event.source!==window.parent||event.data?.type!=='uniplan-study-context')return;
 const context=event.data.context;
 if(!context||typeof context.userId!=='string'||!context.userId||!Array.isArray(context.courses))return;
 studyConnected=true;clearInterval(studyConnectionRetry);
 document.getElementById('study-connection').hidden=true;
 initializeStudy(context);
});
let studyConnectionAttempts=0;
const studyConnectionRetry=setInterval(()=>{
 if(++studyConnectionAttempts>=10){clearInterval(studyConnectionRetry);document.getElementById('study-connection').textContent='Could not load your classes. Reopen Study from your signed-in planner, or reload the planner and try again.';return;}
 requestStudyContext();
},1000);
requestStudyContext();
function initializeStudy(context){
const $=id=>document.getElementById(id);
const classes=[...new Set(context.courses.filter(course=>typeof course==='string'&&course.trim()))];
if(!classes.length){$('study-connection').hidden=false;$('study-connection').textContent='No saved classes yet. Add a class in Classes, then return to Study. Your saved exams and quizzes will appear under their class.';return;}
document.querySelector('main').hidden=false;
let scheduling=false,editingScheduledSession=null;
const pendingScheduleRequests=new Map();
window.addEventListener('message',event=>{
 const trustedOrigin=location.protocol==='file:'?event.origin==='null':event.origin===location.origin;
 if(!trustedOrigin||event.source!==window.parent||event.data?.type!=='uniplan-study-schedule-result')return;
 const pending=pendingScheduleRequests.get(event.data.requestId);if(!pending)return;
 clearTimeout(pending.timeout);pendingScheduleRequests.delete(event.data.requestId);
 event.data.error?pending.reject(new Error(event.data.error)):pending.resolve(event.data);
});
function scheduleRequest(request){return new Promise((resolve,reject)=>{
 const requestId=crypto.randomUUID();
 const timeout=setTimeout(()=>{pendingScheduleRequests.delete(requestId);reject(new Error('The planner did not respond. Reopen Study and try again.'));},15000);
 pendingScheduleRequests.set(requestId,{resolve,reject,timeout});
 window.parent.postMessage({type:'uniplan-study-schedule',requestId,userId:context.userId,request:{...request,course:state.course}},studyTargetOrigin);
});}
function setScheduling(value){scheduling=value;for(const id of ['course','assessment','generate','reset','schedule-session','schedule-plan'])$(id).disabled=value;renderClasses();}
async function removeCalendarSessions(sessions){
 const eventIds=sessions.filter(s=>s.eventId).map(s=>s.eventId);
 if(eventIds.length)await scheduleRequest({action:'remove',eventIds});
}
const accountKey='uniplan-study:'+context.userId;
const today=new Date();today.setHours(0,0,0,0);
function dateValue(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const later=new Date(today);later.setDate(later.getDate()+7);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assessments=(context.assessments||[]).filter(item=>item.date>=dateValue(today)).sort((a,b)=>a.date.localeCompare(b.date));
const assessmentsFor=course=>assessments.filter(item=>item.course===course);
const planKey=(course,id='')=>encodeURIComponent(course)+(id?':assessment:'+encodeURIComponent(id):'');
const keyFor=(course,id='')=>accountKey+':'+planKey(course,id);
let plans={...context.plans};
function emptyState(course){return{course,goal:'',examFocus:'',exam:dateValue(later),minutes:'30',preference:'midday',afterTime:'17:00',beforeTime:'23:59',notes:'',sources:[],sessions:[],generated:false};}
function syncCalendarSession(session){
 const calendar=(context.studySessions||[]).find(item=>item.id===session.eventId);
 return calendar?{...session,done:calendar.status==='done',date:calendar.date,start:calendar.start,end:calendar.end}:session;
}
function loadClass(course,id=''){
 const base={...emptyState(course),assessmentId:id};
 try{const saved=structuredClone(plans[planKey(course,id)]);if(saved&&saved.course===course&&typeof saved.notes==='string'){
  return {...base,...saved,sources:Array.isArray(saved.sources)?saved.sources:[],sessions:Array.isArray(saved.sessions)?saved.sessions.filter(s=>s&&typeof s.id==='string'&&typeof s.title==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)&&Number(s.minutes)>0).map(syncCalendarSession):[]};
 }}catch{}
 return base;
}
let initialCourse=classes[0];try{const selected=localStorage.getItem(accountKey+':selected');if(classes.includes(selected))initialCourse=selected;}catch{}
const launchParams=new URLSearchParams(location.search);
const launchAssessment=assessments.find(item=>item.id===launchParams.get('assessment'));
if(launchAssessment&&classes.includes(launchAssessment.course))initialCourse=launchAssessment.course;
function preferredAssessment(course){
 try{const selected=localStorage.getItem(keyFor(course)+':assessment');if(selected===''||assessmentsFor(course).some(item=>item.id===selected))return selected;}catch{}
 return assessmentsFor(course)[0]?.id||'';
}
let state=loadClass(initialCourse,launchAssessment?.id||preferredAssessment(initialCourse));
window.addEventListener('message',event=>{
 const trustedOrigin=location.protocol==='file:'?event.origin==='null':event.origin===location.origin;
 if(!trustedOrigin||event.source!==window.parent||event.data?.type!=='uniplan-study-sessions'||!Array.isArray(event.data.sessions))return;
  context.studySessions=event.data.sessions;
 const key=planKey(state.course,state.assessmentId);
 const changed=event.data.plans && JSON.stringify(plans[key])!==JSON.stringify(event.data.plans[key]);
 if(event.data.plans)plans={...event.data.plans};
 if(changed&&!scheduling){state=loadClass(state.course,state.assessmentId);syncAssessment();hydrate();}
 else state.sessions=state.sessions.map(syncCalendarSession);
 if(!scheduling)render();
});
function selectedAssessment(){return assessmentsFor(state.course).find(item=>item.id===state.assessmentId);}
function syncAssessment(){
 const item=selectedAssessment();if(!item)return;
 state.exam=item.date;
 if(!state.goal)state.goal='Prepare for '+item.title;
}
function selectAssessment(id){
 if(scheduling)return;
 editingScheduledSession=null;state=loadClass(state.course,id);syncAssessment();
 try{localStorage.setItem(keyFor(state.course)+':assessment',id);}catch{}
 hydrate();render();
}
function save(){
 const plan=structuredClone(state);
 plans[planKey(plan.course,plan.assessmentId)]=plan;
 window.parent.postMessage({type:'uniplan-study-save',userId:context.userId,plan},studyTargetOrigin);
}
function buildSessions(plan,start){
 const target=new Date(plan.exam+'T00:00:00');
 // Count calendar days rather than 24-hour periods across daylight-saving changes.
 const days=Math.round((Date.UTC(target.getFullYear(),target.getMonth(),target.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000);
 if(!Number.isFinite(days)||days<1)return{sessions:[],uncovered:[]};
 const lines=(plan.examFocus||'').split('\n').map(x=>x.trim()).filter(Boolean);
 if(!lines.length&&plan.assessmentId)lines.push('Class concepts','Assigned examples','Difficult topics');
 const topics=[...new Map(lines.map(x=>[x.replace(/^!\s*/,'').toLowerCase(),{title:x.replace(/^!\s*/,''),priority:x.startsWith('!')}])).values()].filter(x=>x.title);
 const pool=[...topics,...topics.filter(x=>x.priority)];
 const count=Math.min(days,7);
 const sessions=pool.length?Array.from({length:count},(_,i)=>{
  const date=new Date(start);date.setDate(date.getDate()+(count===1?0:Math.floor(i*(days-1)/(count-1))));
  const topic=pool[i%pool.length];
  const mode=i<topics.length?'Review':i===count-1?'Recap':'Revisit';
  return{id:crypto.randomUUID(),date:dateValue(date),title:`${mode}: ${topic.title}`.slice(0,180),minutes:Number(plan.minutes),done:false,notes:''};
 }):[];
 return{sessions,uncovered:topics.slice(count).map(x=>x.title)};
}
function sortedSessions(){return [...state.sessions].sort((a,b)=>a.date.localeCompare(b.date)||(a.start||'').localeCompare(b.start||''));}
function formatDate(value){return new Date(value+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});}
function hydrate(){
 $('plan-preference').value=state.preference||'midday';
 $('plan-after').value=state.afterTime||'17:00';$('plan-before').value=state.beforeTime||'23:59';
 $('plan-time-window').hidden=$('plan-preference').value!=='end';
 for(const id of ['goal','exam-focus','exam','minutes'])$(id).value=state[{'exam-focus':'examFocus'}[id]||id]||'';
 const items=assessmentsFor(state.course);
 $('assessment').innerHTML='<option value="">Independent study plan</option>'+items.map(item=>`<option value="${escapeHTML(item.id)}">${escapeHTML(item.kind+': '+item.title+' · '+formatDate(item.date))}</option>`).join('');
 $('assessment').value=state.assessmentId||'';
 const item=selectedAssessment();
 $('exam').readOnly=Boolean(item);
 $('assessment-detail').textContent=item?`${item.kind} for ${item.course} · ${formatDate(item.date)}${item.time?' at '+item.time:''}${item.notes?' · '+item.notes:''}`:'Plan your own study goal for this class.';
 $('course').value=state.course;$('exam').min=dateValue(new Date(today.getFullYear(),today.getMonth(),today.getDate()+1));
 $('session-date').value=dateValue(today);$('session-minutes').value=state.minutes;
}
function renderClasses(){
 $('class-cards').innerHTML=classes.map((course,i)=>{
  const plans=['',...assessmentsFor(course).map(item=>item.id)].map(id=>course===state.course&&id===(state.assessmentId||'')?state:loadClass(course,id));
  const total=plans.reduce((n,p)=>n+p.sessions.length,0),done=plans.reduce((n,p)=>n+p.sessions.filter(s=>s.done).length,0);
  return `<button class="class-card" data-course="${i}" aria-pressed="${course===state.course}" ${scheduling?'disabled':''}><strong>${escapeHTML(course)}</strong><span>${total?`${done} of ${total} sessions complete`:'Ready for a fresh plan'}</span></button>`;
 }).join('');
 $('class-cards').querySelectorAll('[data-course]').forEach(button=>button.onclick=()=>openClass(classes[Number(button.dataset.course)]));
}
function renderAssessments(){
 const items=assessmentsFor(state.course);
 $('assessments').innerHTML=items.length?items.map((item,i)=>{
  const plan=item.id===state.assessmentId?state:loadClass(state.course,item.id);
  return `<article class="assessment-card"><div><span class="caption">${escapeHTML(item.kind)} · ${escapeHTML(formatDate(item.date))}</span><h3>${escapeHTML(item.title)}</h3><p class="help">${escapeHTML(item.course)}${plan.sessions.length?' · '+plan.sessions.filter(s=>s.done).length+'/'+plan.sessions.length+' sessions complete':''}</p></div><button data-assessment="${i}">${plan.sessions.length?'Open study plan':'Create a study plan'} →</button></article>`;
 }).join(''):'<p class="help">No upcoming exams or quizzes saved for this class. Add one in Exams, or create an independent study plan below.</p>';
 $('assessments').querySelectorAll('[data-assessment]').forEach(button=>button.onclick=()=>{
  selectAssessment(items[Number(button.dataset.assessment)].id);
  $('status').textContent='Choose when to study, then select Create study plan to add sessions to your calendar.';
  $('plan-preference').focus();
 });
}
function render(){
 renderClasses();renderAssessments();
 $('schedule-plan').hidden=!state.sessions.some(session=>!session.eventId&&!session.done);
 const sessions=sortedSessions(),done=sessions.filter(s=>s.done).length,next=sessions.find(s=>!s.done);
 if(state.plannedDate&&selectedAssessment()&&state.plannedDate!==state.exam)$('status').textContent='The assessment date changed. Rebuild your plan or adjust your sessions to fit the new date.';
 $('kit-tag').textContent=sessions.length?`${done}/${sessions.length} complete`:'No plan yet';
 $('next-title').textContent=next?next.title:sessions.length?'You’ve finished this plan.':'Make room for a little progress.';
 $('next-detail').textContent=next?`${formatDate(next.date)}${next.start?' · '+next.start+'–'+next.end:''} · ${next.minutes} minutes${next.date<dateValue(today)?' · Reschedule when you’re ready':''}`:sessions.length?'Take a moment to see what still needs practice, or add your next session.':selectedAssessment()?'Create a study plan for '+selectedAssessment().title+' using its saved date. Topics are optional.':'Add the topics you want to cover, then create a plan for this class.';
 $('progress').max=sessions.length||1;$('progress').value=done;
 $('progress-label').textContent=sessions.length?`${done} of ${sessions.length} sessions complete · ${sessions.filter(s=>!s.done).reduce((n,s)=>n+Number(s.minutes),0)} minutes remaining`:'';
 $('generate').textContent=sessions.length?'Rebuild study plan →':'Create study plan →';
 $('panel').innerHTML=(state.uncovered?.length?`<p class="focus-summary">Still to schedule: ${state.uncovered.map(escapeHTML).join(', ')}. Add sessions below to cover these topics.</p>`:'')+(sessions.length?sessions.map(s=>`<article class="session ${s.done?'done':''}" data-id="${escapeHTML(s.id)}"><div class="session-head"><input id="done-${escapeHTML(s.id)}" type="checkbox" data-done ${s.done?'checked':''}><label for="done-${escapeHTML(s.id)}"><small>${escapeHTML(formatDate(s.date))} · ${s.start?escapeHTML(s.start+'–'+s.end)+' · ':''}${escapeHTML(s.minutes)} MIN${!s.eventId?' · NOT ON CALENDAR':''}${s.date<dateValue(today)&&!s.done?' · PAST DUE':''}</small>${escapeHTML(s.title)}</label></div><details><summary>Edit session & notes</summary><label>Session focus<input data-field="title" maxlength="180" value="${escapeHTML(s.title)}" ${s.eventId?'readonly':''} required></label><div class="settings"><label>Date<input data-field="date" type="date" value="${escapeHTML(s.date)}" ${s.eventId?'readonly':''} required></label><label>Minutes<input data-field="minutes" type="number" min="5" max="480" step="5" value="${escapeHTML(s.minutes)}" ${s.eventId?'readonly':''} required></label></div><label>Progress notes<textarea data-field="notes" placeholder="What clicked? What needs another pass?">${escapeHTML(s.notes||'')}</textarea></label>${s.scheduleError?'<p class="help">'+escapeHTML(s.scheduleError)+'</p>':''}${s.eventId?'<button data-view-calendar>View in calendar</button> ':''}<button data-reschedule>${s.eventId?'Find another time':'Add to calendar'}</button>${s.eventId?'<p class="help">Added to your calendar. Use Find another time to change its schedule.</p>':''}<button class="remove" data-remove>Remove session</button></details></article>`).join(''):'<div class="empty">Your plan starts here.<br>Create a study plan above, or add your first session below.</div>');
 $('panel').querySelectorAll('[data-id]').forEach(row=>{
  const session=state.sessions.find(s=>s.id===row.dataset.id);
  row.querySelector('[data-done]').onchange=async e=>{
   if(scheduling){render();return;}const done=e.target.checked;
   if(!session.eventId){session.done=done;save();render();return;}
   setScheduling(true);
   try{await scheduleRequest({action:'complete',eventId:session.eventId,done});session.done=done;save();render();}
   catch(error){$('status').textContent=error.message;render();}
   finally{setScheduling(false);}
  };
  row.querySelectorAll('[data-field]').forEach(input=>input.onchange=()=>{
   if(!input.reportValidity()||(input.dataset.field==='title'&&!input.value.trim())){input.value=session[input.dataset.field]||'';return;}
   session[input.dataset.field]=input.dataset.field==='minutes'?Number(input.value):input.value;save();
   // Keep the open editor and focus while refreshing the summary above it.
   const field=input.dataset.field,id=session.id;render();const updated=[...$('panel').querySelectorAll('[data-id]')].find(r=>r.dataset.id===id);updated.querySelector('details').open=true;updated.querySelector(`[data-field="${field}"]`).focus();
  });
  const viewCalendar=row.querySelector('[data-view-calendar]');
  if(viewCalendar)viewCalendar.onclick=async()=>{if(scheduling)return;try{await scheduleRequest({action:'view',eventId:session.eventId});}catch(error){$('status').textContent=error.message;}};
  const reschedule=row.querySelector('[data-reschedule]');
  if(reschedule)reschedule.onclick=()=>{if(scheduling)return;editingScheduledSession=session.id;$('add-session').open=true;$('session-title').value=session.title;$('session-date').value=session.date;$('session-minutes').value=session.minutes;$('session-preference').value=session.preference||'midday';updateSearchWindow();$('session-status').textContent='Choose where to look for a new time for this session.';$('session-title').focus();};
  row.querySelector('[data-remove]').onclick=async()=>{if(scheduling)return;setScheduling(true);try{await removeCalendarSessions([session]);state.sessions=state.sessions.filter(s=>s.id!==session.id);save();render();}catch(error){$('status').textContent=error.message;}finally{setScheduling(false);}};
 });
}
function openClass(course){
 if(scheduling)return;
 editingScheduledSession=null;state=loadClass(course,preferredAssessment(course));syncAssessment();try{localStorage.setItem(accountKey+':selected',course);}catch{}
 hydrate();render();$('status').textContent='Opened your plan for '+course+'.';
}
$('course').replaceChildren(...classes.map(title=>{const option=document.createElement('option');option.value=title;option.textContent=title;return option;}));
$('course').onchange=()=>openClass($('course').value);
$('assessment').onchange=()=>selectAssessment($('assessment').value);
for(const [id,field] of [['goal','goal'],['exam-focus','examFocus'],['exam','exam'],['minutes','minutes'],['plan-preference','preference'],['plan-after','afterTime'],['plan-before','beforeTime']]){
 $(id).oninput=()=>{state[field]=$(id).value;if(id==='plan-preference')$('plan-time-window').hidden=$(id).value!=='end';save();};
}
async function createPlan(){
 if(scheduling)return;
 syncAssessment();hydrate();
 if(!selectedAssessment()&&!(state.examFocus||'').replace(/!/g,'').trim()){$('status').textContent='Add the topics you want to cover first.';$('exam-focus').focus();return;}
 if(state.exam<=dateValue(today)){$('status').textContent='This assessment is today. Add a session below if you still have time to review.';return;}
 if(!$('exam').reportValidity())return;
 if(state.preference==='end'&&(!$('plan-after').reportValidity()||!$('plan-before').reportValidity()))return;
 if(state.sessions.length&&!confirm('Replace the sessions in this study plan? Existing session progress and notes will be removed.'))return;
 const result=buildSessions(state,today);
 if(!result.sessions.length){$('status').textContent='Add study topics and a future target date first.';return;}
 setScheduling(true);$('status').textContent='Finding calendar times for your study plan…';
 try{
  const reply=await schedulePlanSessions(result.sessions,state.sessions.filter(s=>s.eventId).map(s=>s.eventId));
  state.sessions=mergeScheduledSessions(result.sessions,reply.sessions);state.uncovered=result.uncovered;state.generated=true;state.plannedDate=state.exam;save();render();showCalendarResult();
 }catch(error){$('status').textContent=error.message;}
 finally{setScheduling(false);}
}
function schedulePlanSessions(sessions,replaceEventIds=[]){
 const preference=state.preference||'midday';
 return scheduleRequest({action:'plan',sessions,replaceEventIds,preference,earliest:preference==='end'?(state.afterTime||'17:00'):'11:00',latest:preference==='end'?(state.beforeTime||'23:59'):'17:00'});
}
function mergeScheduledSessions(sessions,results){
 return sessions.map(session=>{const result=results.find(item=>item.id===session.id);return {...session,...result,scheduleError:result?.scheduleError||''};});
}
function showCalendarResult(){
 const scheduled=state.sessions.filter(s=>s.eventId).length,unscheduled=state.sessions.filter(s=>!s.eventId).length;
 $('status').textContent=`${scheduled} study session${scheduled===1?'':'s'} added to your calendar.${unscheduled?' '+unscheduled+' could not fit and remain marked as not on calendar. Choose Add to calendar on a session to try another time.':''}`;
}
$('schedule-plan').onclick=async()=>{
 if(scheduling)return;setScheduling(true);$('status').textContent='Finding calendar times…';
 try{const pending=state.sessions.filter(session=>!session.eventId&&!session.done);const reply=await schedulePlanSessions(pending);const updated=mergeScheduledSessions(pending,reply.sessions);state.sessions=state.sessions.map(session=>updated.find(item=>item.id===session.id)||session);save();render();showCalendarResult();}
 catch(error){$('status').textContent=error.message;}
 finally{setScheduling(false);}
};
$('generate').onclick=createPlan;
function updateSearchWindow(){const end=$('session-preference').value==='end';$('session-earliest').value=end?'17:00':'11:00';$('session-latest').value=end?'23:59':'17:00';$('session-search-label').textContent=end?'Start looking after':'Search from';}
$('session-preference').onchange=updateSearchWindow;
$('session-date').min=dateValue(today);
$('session-form').onsubmit=async e=>{
 e.preventDefault();if(scheduling)return;
 const title=$('session-title').value.trim();if(!title)return;
 const id=editingScheduledSession||crypto.randomUUID();
 const session={id,title,date:$('session-date').value,minutes:Number($('session-minutes').value),preference:$('session-preference').value,notes:'',done:false};
 $('session-status').textContent='Checking your schedule…';setScheduling(true);
 try{
  const result=await scheduleRequest({...session,sessionId:id,earliest:$('session-earliest').value,latest:$('session-latest').value});
  const existing=state.sessions.find(s=>s.id===id);
  const scheduled={...session,notes:existing?.notes||'',done:existing?.done||false,...result.slot};
  state.sessions=state.sessions.filter(s=>s.id!==id);state.sessions.push(scheduled);save();render();
  editingScheduledSession=null;$('session-title').value='';$('add-session').open=false;
  $('status').textContent=`Study time added to your calendar: ${formatDate(scheduled.date)}, ${scheduled.start}–${scheduled.end}.`;
  $('session-status').textContent='';
 }catch(error){$('session-status').textContent=error.message;}
 finally{setScheduling(false);}
};
$('reset').onclick=async()=>{
 if(scheduling||!confirm('Clear this study plan and its scheduled calendar sessions for '+state.course+'?'))return;
 setScheduling(true);
 try{await removeCalendarSessions(state.sessions);state={...emptyState(state.course),assessmentId:state.assessmentId};syncAssessment();save();hydrate();render();$('status').textContent='This study plan has been cleared.';}
 catch(error){$('status').textContent=error.message;}
 finally{setScheduling(false);}
};
syncAssessment();hydrate();render();
if(launchAssessment&&launchParams.get('create')==='1'&&!state.sessions.length){$('status').textContent='Choose when to study, then select Create study plan to add sessions to your calendar.';$('plan-preference').focus();}
new ResizeObserver(()=>window.parent.postMessage({type:'uniplan-study-height',height:Math.ceil(document.body.getBoundingClientRect().height)},studyTargetOrigin)).observe(document.body);
}
