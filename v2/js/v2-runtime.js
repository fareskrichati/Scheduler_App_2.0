/* 2.0 additions use the same authenticated planner model as 1.5.1. */
let v2CanvasPreference = null;
let v2CanvasBusy = false;
let v2TodayDate = '';
function showV2StartupError(error) {
  console.error('UniPlan startup failed', error);
  document.body.classList.remove('is-authenticated');
  const status=document.querySelector('#login-status');
  status.textContent=error.message || 'Unable to open your planner. Reload and try again.';
}
function setupV2() {
  v2TodayDate=todayString();
  setupV2Tutorial();
  document.querySelector('#open-customize').addEventListener('click',()=>{setActiveTab('settings');const panel=document.querySelector('.customization-dropdown');if(panel){panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'start'});panel.querySelector('summary')?.focus()}});
  document.querySelectorAll('[data-v2-page]').forEach(b=>b.addEventListener('click',()=>setActiveTab(b.dataset.v2Page)));
  document.querySelector('[data-v2-calendar]').addEventListener('click',()=>{state.selectedDate=v2TodayDate;state.visibleMonth=startOfMonth(v2TodayDate);setActiveTab('calendar');render()});
  document.querySelector('[data-v2-todo]').addEventListener('click',()=>setActiveTab('todo'));
  document.querySelector('[data-v2-canvas]').addEventListener('click',()=>{setActiveTab('settings');const feed=elements.settingsCanvasFeed;for(let p=feed.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;feed.scrollIntoView({block:'center',behavior:'smooth'});feed.focus()});
  document.querySelector('#v2-save-import-mode').addEventListener('click',saveV2CanvasPreference);
  document.querySelector('#v2-import-now').addEventListener('click',runV2CanvasNow);
  document.querySelectorAll('[name="v2-canvas-mode"]').forEach(r=>r.addEventListener('change',()=>{document.querySelector('#v2-canvas-status').textContent='Choose Save import preference to apply this change.'}));
  setInterval(()=>{const old=document.querySelector('#v2-date').textContent;renderV2Date();if(old!==document.querySelector('#v2-date').textContent){v2TodayDate=todayString();renderV2Today()}renderV2Today();renderV2Sync()},30000);
  matchMedia("(max-width: 760px)").addEventListener("change",()=>renderCalendar());
  renderV2Date();
}
function renderV2Date(){document.querySelector('#v2-date').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}
function renderV2Sync(){const el=document.querySelector('#v2-sync-status');el.textContent=authState.isAuthenticated?(lastCloudSyncMessage||'Connected to your planner'):'Sign in to sync your planner';document.querySelector('#v2-profile').textContent=getSettings().name||authState.profile?.email||''}
function renderV2Navigation(){
 const labels={today:'Today',calendar:'Calendar',todo:'To-Do',classes:'Classes',events:'Events',homework:'Homework',exams:'Exams',reminders:'Reminders',settings:'Settings',more:'More'};
 document.querySelector('#v2-current-section').textContent=labels[state.activeTab]||'Today';
 document.querySelector('#v2-section-description').textContent={today:'Your classes, plans, and deadlines. One place.',calendar:'Your whole schedule, with everything in view.',todo:'Homework, exams, and reminders. One list.',settings:'Your planner, your preferences.',more:'All your planner tools, close by.'}[state.activeTab]||labels[state.activeTab];
 document.querySelectorAll('.v2-bottom-nav .tab-button').forEach(b=>{const active=b.dataset.tab===state.activeTab||(b.dataset.tab==='more'&&!['today','calendar','todo','classes'].includes(state.activeTab));b.classList.toggle('is-active',active);b.setAttribute('aria-selected',active)});
 renderV2Date();
}
function v2AppendItem(target,item,date=v2TodayDate){
 const row=document.createElement('article');row.className='v2-agenda-item'+(item.status==='done'?' is-complete':'');applyItemColor(row,item.color);
 const check=buildDayStatusButton(item);if(check){check.className='todo-check';check.textContent=item.status==='done'?'✓':'';check.setAttribute('aria-label',`${item.status==='done'?'Mark pending':'Complete'} ${item.title}`);row.append(check)}
 const body=document.createElement('button');body.type='button';body.className='v2-item-content';body.innerHTML=`<span class="v2-item-type">${escapeHtml(item.label||item.kind)}</span><strong>${escapeHtml(item.title)}</strong><small>${item.attentionDate?escapeHtml(item.attentionDate)+' · ':''}${escapeHtml(item.meta||item.displayTime||'Any time')}</small>`;body.addEventListener('click',()=>openCalendarItemDetails(item,date));row.append(body);target.append(row);
}
function renderV2Today(){
 if(!document.querySelector('#v2-day-list'))return;
 renderV2Date();renderV2Sync();
 const date=v2TodayDate||todayString(),anchor=new Date(date+'T12:00:00'),first=new Date(anchor);first.setDate(first.getDate()-((first.getDay()+6)%7));
 const strip=document.querySelector('#v2-week-strip');strip.innerHTML='';for(let i=0;i<7;i++){const d=new Date(first);d.setDate(first.getDate()+i);const key=isoDate(d),b=document.createElement('button');b.type='button';b.className=key===date?'is-active':'';b.setAttribute('aria-pressed',key===date);b.innerHTML=`<span>${escapeHtml(d.toLocaleDateString(undefined,{weekday:'short'}))}</span><strong>${d.getDate()}</strong>`;b.addEventListener('click',()=>{v2TodayDate=key;renderV2Today()});strip.append(b)}
 document.querySelector('#v2-agenda-date').textContent=formatLongDate(date);
 const items=getItemsForDate(date),active=items.filter(i=>i.status!=='done'),completed=items.filter(i=>i.status==='done');
 const list=document.querySelector('#v2-day-list'),done=document.querySelector('#v2-day-completed');list.innerHTML='';done.innerHTML='';active.forEach(i=>v2AppendItem(list,i));completed.forEach(i=>v2AppendItem(done,i));if(!active.length)list.innerHTML='<p class="empty-state">Nothing scheduled or due. Add a class, event, or to-do to get started.</p>';if(!completed.length)done.innerHTML='<p class="empty-state">Completed items will stay here.</p>';document.querySelector('#v2-day-completed-count').textContent=`(${completed.length})`;
 const now=new Date(),clock=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;const next=active.find(i=>['class','event'].includes(i.kind)&&(date!==todayString()||i.sortKey>=clock))||active.find(i=>i.displayTime&&(date!==todayString()||i.sortKey>=clock));const up=document.querySelector('#v2-up-next');up.innerHTML=next?`<h2>${escapeHtml(next.title)}</h2><p class="v2-countdown">${escapeHtml(v2TimeUntil(date,next.sortKey))}</p><p>${escapeHtml(next.meta)}</p>`:'<h2>You’re all clear.</h2><p>No more upcoming items for this day.</p>';if(next){const b=document.createElement('button');b.className='small-button';b.textContent='View details ↗';b.addEventListener('click',()=>openCalendarItemDetails(next,date));up.append(b)}
 const attention=document.querySelector('#v2-attention');attention.innerHTML='';const todo=getTodoItems().filter(i=>i.status!=='done').sort(compareByDateTime).slice(0,5);todo.forEach(item=>{const converted=getItemsForDate(item.date).find(x=>x.sourceId===item.id&&x.kind===item.kind);if(!converted)return;const row=document.createElement('div');v2AppendItem(row,{...converted,attentionDate:formatShortDate(item.date)},item.date);attention.append(row)});if(!todo.length)attention.innerHTML='<p class="empty-state">All caught up. Completed items are in To-Do.</p>';
 const exam=state.data.exams.filter(i=>i.status!=='done'&&i.date>=todayString()).sort(compareByDateTime)[0];document.querySelector('#v2-next-exam').innerHTML=exam?`<h3>${escapeHtml(exam.title)}</h3><p class="settings-note">${escapeHtml(exam.course)} · ${formatShortDate(exam.date)}${exam.time?' · '+formatTime(exam.time):''}</p>`:'<p class="settings-note">No upcoming exams.</p>';
}
async function v2CanvasRequest(action){
 const token=await getValidAccessToken();if(!token)throw new Error('Sign in before using Canvas imports.');
 const response=await fetch(`${window.DAILY_PLANNER_SUPABASE.url}/functions/v1/uniplan-canvas-v2`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,apikey:window.DAILY_PLANNER_SUPABASE.anonKey},body:JSON.stringify({action})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Canvas sync could not finish. Please try again.');return data;
}
async function loadV2CanvasPreference(){
 try{const {data,error}=await supabaseClient.from('planner_canvas_automation').select('mode,last_checked_at,next_check_at,last_error').eq('user_id',authState.userId).maybeSingle();if(error)throw error;v2CanvasPreference=data;document.querySelector(`[name="v2-canvas-mode"][value="${data?.mode==='automatic'?'automatic':'manual'}"]`).checked=true;renderV2CanvasStatus()}catch{document.querySelector('#v2-canvas-status').textContent='Automatic imports need backend setup. Manual Canvas review is available below.'}
}
function renderV2CanvasStatus(){const p=v2CanvasPreference;document.querySelector('#v2-import-now').hidden=p?.mode!=='automatic';document.querySelector('#v2-canvas-status').textContent=p?.last_error?`Last check needs attention: ${p.last_error}`:p?.mode==='automatic'?`Automatic imports are on.${p.last_checked_at?' Last checked '+new Date(p.last_checked_at).toLocaleString()+'.':''}${p.next_check_at?' Next check by '+new Date(p.next_check_at).toLocaleString()+'.':''}`:'Manual mode. Use Check Canvas calendar below to review and add items.'}
async function saveV2CanvasPreference(){
 if(v2CanvasBusy)return;v2CanvasBusy=true;const status=document.querySelector('#v2-canvas-status'),b=document.querySelector('#v2-save-import-mode');b.disabled=true;
 try{if(!authState.isAuthenticated)throw new Error('Sign in first.');const mode=document.querySelector('[name="v2-canvas-mode"]:checked').value;const feed=elements.settingsCanvasFeed.value.trim();if(mode==='automatic'&&!isCanvasFeedUrl(feed))throw new Error('Add a valid Canvas calendar feed before turning on automatic imports.');if(feed&&!isCanvasFeedUrl(feed))throw new Error('Enter a valid Canvas feed URL.');state.data.settings.canvasFeedUrl=feed;saveDataLocally();if(cloudSaveTimer){clearTimeout(cloudSaveTimer);cloudSaveTimer=null}await saveDataToSupabase();const {error}=await supabaseClient.from('planner_canvas_automation').upsert({user_id:authState.userId,mode,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',next_check_at:mode==='automatic'?new Date().toISOString():null});if(error)throw error;await loadV2CanvasPreference();status.textContent=mode==='automatic'?'Automatic imports enabled. New items will be checked every 3 days; you can also check now.':'Manual import mode saved.'}catch(error){status.textContent=error.message||'Could not save import preference.'}finally{v2CanvasBusy=false;b.disabled=false}
}
async function runV2CanvasNow(){if(v2CanvasBusy)return;v2CanvasBusy=true;const b=document.querySelector('#v2-import-now'),status=document.querySelector('#v2-canvas-status');b.disabled=true;status.textContent='Checking Canvas…';try{if(cloudSaveTimer){clearTimeout(cloudSaveTimer);cloudSaveTimer=null;await saveDataToSupabase()}const result=await v2CanvasRequest('sync');await refreshCloudData();await loadV2CanvasPreference();status.textContent=`Canvas checked. ${result.added||0} new items added. Existing items were kept.`}catch(error){status.textContent=error.message}finally{b.disabled=false;v2CanvasBusy=false}}

function setupV2Tutorial(){
 const steps=[
  ['Your planner has a new look','UniPlan 2.0 keeps your existing classes, tasks, and account. This optional tour shows you where everything lives.','today'],
  ['Your whole day','Today brings classes, events, and deadlines together. Select a day above the agenda; finished tasks stay under Completed.','today'],
  ['Your familiar calendar','Switch between Month, Week, and Day. Select an item for details, or hold a day to add something.','calendar'],
  ['All your to-dos','Every pending homework item, exam, and reminder appears here by due date. Open Import from Canvas to check and review imports. Completed items stay below the list.','todo'],
  ['Classes and what is due next','Each class shows its next unfinished assignment, including overdue work. Add new opens the forms for classes, tasks, and events.','classes'],
  ['Make it yours','Settings includes your appearance, Canvas feed, and sync preferences. You can reopen this tutorial here whenever you need it.','settings']
 ];
 const dialog=document.createElement('dialog');dialog.className='whats-new-dialog';dialog.setAttribute('aria-label','UniPlan tutorial');dialog.innerHTML='<div class="whats-new-card"><p id="v2-tour-progress" class="panel-label"></p><h2 id="v2-tour-title"></h2><p id="v2-tour-copy"></p><div class="v2-tour-actions"><button type="button" class="ghost-button" id="v2-tour-close">Close tutorial</button><button type="button" class="ghost-button" id="v2-tour-back">Back</button><button type="button" class="primary-button" id="v2-tour-next">Next</button></div></div>';document.body.append(dialog);
 let current=0;
 const show=()=>{const step=steps[current];setActiveTab(step[2]);document.querySelector('#v2-tour-progress').textContent=`Step ${current+1} of ${steps.length}`;document.querySelector('#v2-tour-title').textContent=step[0];document.querySelector('#v2-tour-copy').textContent=step[1];document.querySelector('#v2-tour-back').disabled=current===0;document.querySelector('#v2-tour-next').textContent=current===steps.length-1?'Finish':'Next';};
 document.querySelectorAll('[data-v2-tutorial]').forEach(b=>b.addEventListener('click',()=>{if(elements.whatsNewDialog.open)elements.whatsNewDone.click();current=0;show();dialog.showModal()}));
 document.querySelector('#v2-tour-close').onclick=()=>dialog.close();
 document.querySelector('#v2-tour-back').onclick=()=>{if(current>0){current--;show()}};
 document.querySelector('#v2-tour-next').onclick=()=>{if(current===steps.length-1)dialog.close();else{current++;show()}};
}
function v2NextAssignment(classTitle){
 return getNextVisibleOccurrences(state.data.homework).filter(item=>item.status!=='done'&&item.course?.trim().toLowerCase()===classTitle.trim().toLowerCase()).sort(compareByDateTime)[0];
}

function v2TimeUntil(date,time,now=new Date()){
 if(!/^\d{2}:\d{2}$/.test(time||''))return 'Coming up';
 const minutes=Math.max(0,Math.ceil((new Date(`${date}T${time}:00`)-now)/60000));
 if(!minutes)return 'Starting now';
 const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;
 return 'Starts in '+[days?`${days}d`:'',hours?`${hours}h`:'',mins?`${mins}m`:''].filter(Boolean).join(' ');
}

function v2ImportMatches(item,panelKind,today){
 return item.date>=today && (panelKind==='all' || (item.kind||'homework')===panelKind);
}
