/* A non-modal guided tour: the highlighted app controls remain usable. */
function setupInteractiveTour(){
 const steps=[
  {title:'Meet your pet helper',page:'settings',target:'.pet-settings',copy:'I’m your Scheduler Helper! Choose a cat, dog, fox, or robot in App Customization. Outside the tour, tap your floating pet to ask about your day, add plans through chat, or choose Mark done to finish a to-do. You can change or hide your pet anytime in Settings.'},
  {title:'Your day at a glance',page:'today',target:'#v2-week-strip',copy:'Try selecting a day in the week strip. Your agenda and upcoming work update below.'},
  {title:'Calendar views',page:'calendar',target:'.calendar-view-switch',copy:'Try Month, Week, or Day. Select a calendar item for details; hold a date to add something.'},
  {title:'Tasks and completed work',page:'todo',target:'#panel-todo',copy:'Open a task to review it, or mark finished work complete. The Completed section keeps your history.'},
  {title:'Classes and schedules',page:'classes',target:'#panel-classes',copy:'Open Add class to explore meeting times, locations, repeating schedules, and online classes. Save only when you want to add a real class.'},
  {title:'Events',page:'events',target:'#panel-events',copy:'Explore Add event for appointments and activities. Events can repeat and include addresses and notes.'},
  {title:'Homework and imports',page:'homework',target:'#panel-homework',copy:'Explore Add homework or the Canvas/photo import controls. Review imported items before adding them to your planner.'},
  {title:'Exams and deadlines',page:'exams',target:'#panel-exams',copy:'Open Add exam to set its class, date, and time. Exams also appear with your other pending work in To-Do.'},
  {title:'Reminders',page:'reminders',target:'#panel-reminders',copy:'Explore Add reminder for things that need a nudge. Your reminder delivery preferences live in Settings.'},
  {title:'Notes and PDF uploads',page:'study',target:'#upload',frame:true,copy:'Choose your class, then upload a PDF, text file, or Markdown notes. Text is read on your device. Enable Read handwriting with AI for handwritten pages or scans; selected pages are sent to OpenAI.'},
  {title:'Homework question bank',page:'study',target:'#homework-upload',frame:true,copy:'Upload homework PDFs or text files. Questions are extracted into a bank; you can edit extracted text when the numbering needs correction.'},
  {title:'Focus your study plan',page:'study',target:'#exam-focus',frame:true,copy:'List what you expect on the exam, one topic per line. Prefix a topic with ! for extra review, then set your date and build the plan.'},
  {title:'Practice and mock exams',page:'study',target:'.tabs',frame:true,copy:'Try the study-kit tabs: equations, key notes, recall cards, and Homework & exams. In Homework & exams, select questions and build a practice set or mock exam.'},
  {title:'Send a destination to Tesla',page:'classes',target:'[data-tesla-address]',copy:'Classes with a location have Send to Tesla beside the map links. On your phone, tap it and choose Tesla in the share menu. Do this only when you want to share the destination.'},
  {title:'Connect Canvas',page:'settings',target:'#settings-canvas-feed',copy:'Add your private Canvas calendar feed and choose manual review or automatic imports. No connection is needed to explore the rest of the app.'},
  {title:'Connect your AI app',page:'settings',target:'#connected-ai-apps',copy:'You can connect ChatGPT or Claude to read your schedule and help update your planner from that AI app. Open Connected AI apps for setup and permissions. Connections require a deployed connector and an AI account that supports custom connectors. Your pet helper is still available here.'},
  {title:'Widgets',page:'settings',target:'.widget-settings',copy:'Preview your planner widget, customize its appearance, and download the Scriptable widget for your iPhone.'},
  {title:'Appearance and preferences',page:'settings',target:'.customization-dropdown',copy:'Open appearance options to explore themes, colors, and layout. Settings also contains account, sync, notification, and delivery preferences.'},
  {title:'Quick add, anytime',page:'today',target:'#quick-add',copy:'Use + to add a class, task, exam, event, or reminder from anywhere. You can reopen this tour from Settings or What’s new.'}
 ];
 // Study is temporarily closed while improvements are underway.
 for(let i=steps.length-1;i>=0;i--)if(steps[i].page==='study')steps.splice(i,1);
 const panel=document.createElement('section');panel.className='v2-tour-panel';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','Interactive UniPlan tutorial');
 panel.innerHTML='<div class="v2-tour-top"><span class="panel-label" id="v2-tour-progress"></span><button type="button" id="v2-tour-close">Close ×</button></div><label class="sr-only" for="v2-tour-jump">Jump to a tutorial feature</label><select id="v2-tour-jump"></select><h2 id="v2-tour-title"></h2><p id="v2-tour-copy"></p><p class="v2-tour-status" id="v2-tour-status" role="status"></p><div class="v2-tour-actions"><button type="button" class="ghost-button" id="v2-tour-try">Show control</button><button type="button" class="ghost-button" id="v2-tour-back">Back</button><button type="button" class="primary-button" id="v2-tour-next">Next</button></div>';
 document.body.append(panel);
 const get=id=>panel.querySelector('#'+id),jump=get('v2-tour-jump');
 steps.forEach((step,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${i+1}. ${step.title}`;jump.append(option);});
 let current=0,cleanup=()=>{},timer,originalPage='today';
 function clear(){clearTimeout(timer);cleanup();cleanup=()=>{};document.querySelectorAll('.v2-tour-highlight').forEach(el=>el.classList.remove('v2-tour-highlight'));}
 function highlight(attempt=0){
  if(panel.hidden)return;const step=steps[current];let root=document;
  if(step.frame)root=document.querySelector('#study-workspace')?.contentDocument;
  let target=root?.querySelector(step.target);
  if(!target&&step.frame&&attempt<20){timer=setTimeout(()=>highlight(attempt+1),150);return;}
  if(!target){target=document.querySelector('#panel-'+step.page);get('v2-tour-status').textContent=step.target==='[data-tesla-address]'?'Add a location to a class to see its map and Tesla buttons.':'Explore the highlighted section, or continue to the next feature.';}
  else get('v2-tour-status').textContent='Try the highlighted control, or choose Next to continue.';
  if(!target)return;
  for(let el=target.parentElement;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;
  target.classList.add('v2-tour-highlight');target.scrollIntoView({block:'center',behavior:'instant'});
  const tried=()=>{get('v2-tour-status').textContent='✓ You tried it. Continue when you’re ready.';};
  target.addEventListener('click',tried);target.addEventListener('input',tried);target.addEventListener('change',tried);
  cleanup=()=>{target.classList.remove('v2-tour-highlight');target.removeEventListener('click',tried);target.removeEventListener('input',tried);target.removeEventListener('change',tried);};
 }
 function show(){window.UniPlanPet?.tour(true);clear();const step=steps[current];setActiveTab(step.page);get('v2-tour-progress').textContent=`FEATURE ${current+1} / ${steps.length}`;get('v2-tour-title').textContent=step.title;get('v2-tour-copy').textContent=step.copy;window.UniPlanPet?.decorateTour(panel);jump.value=current;get('v2-tour-back').disabled=current===0;get('v2-tour-next').textContent=current===steps.length-1?'Finish':'Next';timer=setTimeout(()=>highlight(),80);}
 function close(){window.UniPlanPet?.tour(false);clear();panel.hidden=true;document.body.classList.remove('v2-tour-running');setActiveTab(originalPage);}
 document.querySelectorAll('[data-v2-tutorial]').forEach(button=>button.addEventListener('click',()=>{if(elements.whatsNewDialog.open)elements.whatsNewDone.click();originalPage=state.activeTab;current=0;panel.hidden=false;document.body.classList.add('v2-tour-running');show();get('v2-tour-jump').focus();}));
 get('v2-tour-close').onclick=close;get('v2-tour-back').onclick=()=>{if(current>0){current--;show();}};get('v2-tour-next').onclick=()=>{if(current===steps.length-1)close();else{current++;show();}};get('v2-tour-try').onclick=()=>{clear();setActiveTab(steps[current].page);highlight();};jump.onchange=()=>{current=Number(jump.value);show();};
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)close();});
}
