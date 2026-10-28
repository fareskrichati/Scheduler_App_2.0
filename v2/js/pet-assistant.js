/* Local, deterministic planner helper. No model, network calls, or persistent chat. */
(() => {
  const tourInvitations = new Set();
  const species = ['cat', 'dog', 'fox', 'robot'];
  const tabs = {class:'classes',event:'events',homework:'homework',exam:'exams',reminder:'reminders'};
  const normalize = value => ({species: species.includes(value?.species) ? value.species : 'cat', hidden: value?.hidden === true, tourOffered: value?.tourOffered === true});
  let root, panel, log, launcher, owner = null, touring = false, pending = null, guidedEdit = false, draft = null, completionPicker = null;
  const svg = kind => {
    const color = {cat:'#b6a1e6',dog:'#d7aa77',fox:'#ed985d',robot:'#83c9c4'}[kind] || '#b6a1e6';
    if(kind==='cat') return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M21 45L25 15L42 30Q50 27 58 30L75 15L79 45Q88 80 66 88Q50 95 34 88Q12 80 21 45" fill="${color}"/><path d="M28 34l1-10 8 9m26 0 8-9 1 10" fill="#efbdd8"/><path d="M42 32l3 9m13-9-3 9" stroke="#8970bc" stroke-width="3" stroke-linecap="round"/><g fill="#253749"><ellipse cx="36" cy="55" rx="4" ry="6"/><ellipse cx="64" cy="55" rx="4" ry="6"/></g><path d="M46 66h8l-4 5z" fill="#bc7398"/><path d="M50 71v4m0 0q-5 6-10 0m10 0q5 6 10 0M30 67l-16-3m16 10-16 3m56-10 16-3m-16 10 16 3" fill="none" stroke="#253749" stroke-width="2" stroke-linecap="round"/></svg>`;
    const ears = kind === 'robot' ? '<path d="M50 22V10m-5 0h10" stroke="#405065" stroke-width="4"/><rect x="16" y="39" width="68" height="47" rx="15"/>' : kind === 'dog' ? '<ellipse cx="22" cy="48" rx="13" ry="24"/><ellipse cx="78" cy="48" rx="13" ry="24"/>' : '<path d="M22 43L18 12L44 31M56 31L82 12L78 43" stroke="#405065" stroke-width="3"/>';
    return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g fill="${color}">${ears}<ellipse cx="50" cy="60" rx="33" ry="30"/></g><ellipse cx="50" cy="71" rx="21" ry="14" fill="#fff" opacity=".75"/><g fill="#253749"><circle cx="37" cy="54" r="4"/><circle cx="63" cy="54" r="4"/><path d="M46 66h8l-4 5z"/></g><path d="M42 76q8 7 16 0" fill="none" stroke="#253749" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  };
  function picker(id, selected) {
    const box = document.createElement('fieldset'); box.className = 'pet-picker';
    const legend = document.createElement('legend'); legend.textContent = 'Choose your pet'; box.append(legend);
    species.forEach(kind => {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'radio'; input.name = id; input.value = kind; input.checked = kind === selected;
      const picture = document.createElement('span'); picture.innerHTML = svg(kind);
      const name = document.createElement('span'); name.textContent = kind[0].toUpperCase() + kind.slice(1);
      label.append(input, picture, name); box.append(label);
    }); return box;
  }
  function button(text, action, parent) { const b = document.createElement('button'); b.type='button'; b.textContent=text; b.addEventListener('click',action); parent.append(b); return b; }
  function say(text, actions = [], user = false, items = []) {
    const row = document.createElement('div'); row.className = user ? 'pet-message pet-user' : 'pet-message';
    const p = document.createElement('p'); p.textContent = text; row.append(p);
    items.forEach(item => {
      const task = ['homework', 'reminder', 'exam'].includes(item.kind);
      const destination = task ? 'To-Do' : 'month view';
      const link = button('', () => { if (authState.isAuthenticated) navigateItem(item); }, row);
      link.className = 'pet-agenda-item';
      link.setAttribute('aria-label', `${item.title} — open in ${destination}`);
      const title = document.createElement('strong'); title.textContent = item.title;
      const detail = document.createElement('span');
      const time = item.displayTime || (item.start ? `${formatTime(item.start)}${item.end?' – '+formatTime(item.end):''}` : item.time ? formatTime(item.time) : 'No time set');
      detail.textContent = `${item.date ? readableDate(item.date) + ' · ' : ''}${time}`;
      const hint = document.createElement('span'); hint.className = 'pet-agenda-destination'; hint.textContent = `View in ${destination} ↗`;
      link.append(title, detail, hint);
    });
    actions.forEach(a => button(a.label, () => { if (!authState.isAuthenticated) return; a.run(); }, row));
    log.append(row); log.scrollTop = log.scrollHeight;
    launcher?.classList.remove('pet-greeting');
    if (!user && launcher) {
      launcher.classList.remove('pet-answering', 'pet-asking', 'pet-celebration');
      void launcher.offsetWidth;
      launcher.classList.add(text.includes('?') ? 'pet-asking' : 'pet-answering');
    }
    while (log.children.length > 60) log.firstChild.remove();
  }
  function show(open) { if (!panel || touring) return; panel.hidden = !open; launcher.setAttribute('aria-expanded',String(open)); if (open && !window.matchMedia?.('(max-width: 760px), (any-pointer: coarse)').matches) panel.querySelector('.pet-input input').focus({preventScroll:true}); }
  const today = () => isoDate(new Date());
  function dateFrom(text) {
    const explicit = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (explicit) { const d = new Date(explicit[0]+'T12:00:00'); return !Number.isNaN(d.getTime()) && isoDate(d) === explicit[0] ? explicit[0] : null; }
    return /\btomorrow\b/.test(text) ? offsetDate(today(),1) : today();
  }
  function timeFrom(text) {
    const match = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || text.match(/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/);
    if (!match) return null;
    let h=Number(match[1]), m=Number(match[2]||0); const suffix=match[3]?.toLowerCase();
    if (m>59 || (suffix ? h<1||h>12 : h>23)) return null;
    if(suffix) h=h%12+(suffix==='pm'?12:0);
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
  }
  function dayItems(date) { return getItemsForDate(date).filter(i => i.status !== 'done' && (i.kind !== 'class' || isActiveClassDate(date))); }
  function readableDate(date) { return new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}); }
  function navigateItem(item) {
    show(false);
    if (['homework','reminder','exam'].includes(item.kind)) {
      todoTypeFilter = 'all'; todoClassFilter = 'all';
      setActiveTab('todo'); renderTodoList();
    } else {
      state.selectedDate = item.navigationDate || item.date || today();
      setCalendarView('month'); setActiveTab('calendar');
    }
    requestAnimationFrame(() => {
      const id = item.sourceId || item.id;
      const task = ['homework','reminder','exam'].includes(item.kind);
      const nodes = document.querySelectorAll(`${task?'#panel-todo':'#panel-calendar'} [data-planner-source-id]`);
      const target = [...nodes].find(node => node.dataset.plannerSourceId === id && node.dataset.plannerKind === item.kind)
        || document.querySelector(task?'#todo-list':`[data-calendar-date="${state.selectedDate}"]`);
      if (!target) return;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({block:'center',inline:'nearest',behavior:reduced?'instant':'smooth'});
      const focus = target.querySelector('.calendar-item-open, .todo-check') || target;
      focus.focus({preventScroll:true});
      target.classList.add('pet-target-highlight');
      setTimeout(() => target.classList.remove('pet-target-highlight'),4000);
    });
  }

  function range(start,end,kind) { const out=[]; for(let d=start;d<=end;d=offsetDate(d,1)) out.push(...dayItems(d).filter(i=>!kind||i.kind===kind).map(i=>({...i,date:d}))); return out; }
  const collectionFor = kind => state.data[kind==='class'||kind==='event'?'schedule':kind==='homework'?'homework':tabs[kind]];
  function beginAdd(kind, text) {
    completionPicker?.remove(); completionPicker=null;
    pending = null;
    const quoted = text.match(/["“]([^"”]+)["”]/);
    const plain = text.replace(/^.*?\b(?:add|create|new)\s+(?:a\s+|an\s+)?(?:event|appointment|class|homework|assignment|task|exam|reminder)\s*/i,'').trim();
    draft = {kind, fields:{}, index:0};
    if (quoted) draft.fields.title = quoted[1].trim();
    else if (plain && !/\b(today|tomorrow|at|on|every)\b|\d{4}-\d{2}-\d{2}/i.test(plain)) draft.fields.title = plain;
    if (/\btoday\b|\btomorrow\b|\d{4}-\d{2}-\d{2}/i.test(text)) draft.fields.date = dateFrom(text.toLowerCase());
    const time = timeFrom(text);
    if (time) draft.fields[kind==='event'||kind==='class'?'start':'time'] = time;
    say(`Let’s add ${kind==='event'||kind==='exam'?'an':'a'} ${kind}. I’ll ask for the details, then show you a summary to save. You can say “cancel” anytime.`);
    askDraft();
  }
  function draftSteps(d) {
    const steps = [{key:'title',question:'What should I call it?'},{key:'date',question:'What date? Say today, tomorrow, or a date like 2026-10-26.'}];
    if (d.kind==='class'||d.kind==='event') steps.push({key:'start',question:'What time does it start? For example, 5:30 PM.'},{key:'end',question:'What time does it end?'});
    else steps.push({key:'time',question:d.kind==='homework'?'What time is it due? Say “skip” if no time is listed.':'What time? Say “skip” if it has no set time.',optional:true});
    if (d.kind==='homework'||d.kind==='exam') steps.push({key:'course',question:'Which class is it for? Choose one below or type its name.'});
    if (d.kind==='class'||d.kind==='event') steps.push({key:'location',question:'Where is it? Type a location or say “skip”.',optional:true});
    steps.push({key:'color',question:'Which color would you like? Pick a color below or enter a hex color.',optional:true});
    steps.push({key:'notes',question:'Any notes to include? Say “skip” if there are none.',optional:true});
    return steps;
  }
  function askDraft() {
    if (!draft) return;
    const d = draft;
    document.querySelectorAll('.pet-prompts button').forEach(button => {button.disabled=true;});
    const step = draftSteps(d).find(s => d.fields[s.key] === undefined || d.fields[s.key] === null);
    if (!step) {
      d.confirming = true;
      const f=d.fields;
      const time=f.start?`${formatTime(f.start)} – ${formatTime(f.end)}`:f.time?formatTime(f.time):'No time set';
      const summary=[f.title,readableDate(f.date),time,f.course,f.location,f.notes,'One-time '+d.kind].filter(Boolean).join('\n');
      say('Ready to add this?\n'+summary,[{label:'Save '+d.kind,run:()=>{if(draft===d)saveDraft();}},{label:'Start over',run:()=>{if(draft===d)beginAdd(d.kind,'');}},{label:'Cancel',run:()=>{if(draft===d)cancelDraft();}}]);
      return;
    }
    d.step = step; d.confirming = false;
    let actions=[];
    if(step.optional) actions.push({label:'Skip',run:()=>{if(draft===d)receiveDraft('skip');}});
    if(step.key==='date') actions.push(...['Today','Tomorrow'].map(label=>({label,run:()=>{if(draft===d)receiveDraft(label);}})));
    if(step.key==='course') {
      const courses=[...new Set([...(state.data.courses||[]),...state.data.schedule.filter(i=>i.type==='class')].map(i=>i.title).filter(Boolean))];
      actions.push(...courses.slice(0,12).map(label=>({label,run:()=>{if(draft===d)receiveDraft(label);}})));
    }
    say(step.question,actions);
    if(step.key==='color') {
      const row=log.children[log.children.length-1];
      const input=document.createElement('input'); input.type='color';
      input.value=colorForSelectedClass(d.fields.course||(d.kind==='class'?d.fields.title:''),'#7eaed6');
      input.setAttribute('aria-label','Item color'); row.append(input);
      button('Use this color',()=>{if(draft===d)receiveDraft(input.value);},row);
    }
    // Keep mobile keyboards closed until the user taps the chat input.
  }
  function cancelDraft() { draft=null;document.querySelectorAll('.pet-prompts button').forEach(button => {button.disabled=false;}); say('Canceled. Your planner has not changed.'); }
  function receiveDraft(raw) {
    if(!draft)return;
    const text=raw.trim();
    if (/^(cancel|stop|never mind|nevermind)$/i.test(text)) {cancelDraft();return;}
    if(draft.confirming) {
      if(/^(save|yes|confirm|add it|save it|looks good)$/i.test(text)) saveDraft();
      else say('Choose Save to add it, say “start over” to change the details, or “cancel”.');
      if(/^start over$/i.test(text)) beginAdd(draft.kind,'');
      return;
    }
    const step=draft.step;
    let value=text;
    if(step.optional && /^(skip|none|no|nope)$/i.test(text)) value='';
    else if (step.key==='color') {
      if(!/^#[0-9a-f]{6}$/i.test(text)){say('Choose a color using the selector, or enter a hex color such as #7eaed6.');return;}
    }
    else if (step.key==='date') {
      if(!/^(today|tomorrow|\d{4}-\d{2}-\d{2})$/i.test(text)) {say('Please use today, tomorrow, or YYYY-MM-DD so I get the right date.');return;}
      value=dateFrom(text.toLowerCase());
      if(!value){say('That date does not exist. Please try another date.');return;}
      if(draft.kind==='class'&&!isActiveClassDate(value)){say('That date falls outside your school term or during a break. Which class date should I use?');return;}
    } else if (['start','end','time'].includes(step.key)) {
      value=timeFrom(text);
      if(!value){say('Please include AM or PM, such as 3 PM, or use 24-hour time such as 15:00.');return;}
      if(step.key==='end'&&value<=draft.fields.start){say('The end time needs to be after the start time on the same day. What end time should I use?');return;}
    } else if(!text || text.length>(step.key==='notes'?2000:200)) {say('Please enter '+(step.key==='notes'?'up to 2,000':'1 to 200')+' characters.');return;}
    draft.fields[step.key]=value;
    askDraft();
  }
  function saveDraft() {
    if(!draft?.confirming)return;
    const {kind,fields:f}=draft;
    if ((kind==='event'||kind==='class')&&f.end<=f.start){draft.fields.end=undefined;askDraft();return;}
    if(kind==='class'&&!isActiveClassDate(f.date)){draft.fields.date=undefined;askDraft();return;}
    const collection=collectionFor(kind);
    const duplicate=collection.find(i=>i.title.toLowerCase()===f.title.toLowerCase()&&i.date===f.date&&(!i.type||i.type===kind)&&(i.start||i.time||'')===(f.start||f.time||'')&&(i.course||'')===(f.course||''));
    if(duplicate){draft=null;document.querySelectorAll('.pet-prompts button').forEach(button => {button.disabled=false;});say('That item is already in your planner.',[],false,[{...duplicate,kind}]);return;}
    const color=f.color||colorForSelectedClass(f.course||(kind==='class'?f.title:''),'#7eaed6');
    const record={id:crypto.randomUUID(),title:f.title,date:f.date,color,notes:f.notes||''};
    if(kind==='class'||kind==='event') Object.assign(record,{type:kind,start:f.start,end:f.end,location:f.location||''});
    else Object.assign(record,{time:f.time||'',status:'pending',completedAt:'',priority:false,...(f.course?{course:f.course}:{})});
    draft=null;guidedEdit=false;
    document.querySelectorAll('.pet-prompts button').forEach(button => {button.disabled=false;});
    collection.push(record);
    persistAndRender();
    launcher.classList.add('pet-celebration');
    say(`Added ${record.title}.`,[{label:'Edit or repeat '+kind,run:()=>edit(kind,record.id)}],false,[{...record,kind}]);
  }
  function markDonePicker() {
    const items=getTodoItems().filter(i=>i.status!=='done').sort(compareByDateTime);
    if(!items.length){say('You’re all caught up—there are no pending to-dos to mark done.');return;}
    completionPicker?.remove();
    say('Which to-do did you finish? Choose it below, then select Mark done.');
    const form=document.createElement('form');form.className='pet-completion-picker';
    const label=document.createElement('label');label.textContent='Choose a to-do';
    const select=document.createElement('select');select.setAttribute('aria-label','Choose a to-do to mark done');
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select a to-do…';select.append(placeholder);
    items.forEach((item,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=`${item.title} · ${item.date}${item.time?' · '+formatTime(item.time):''} · ${item.kind}`;select.append(option);});
    label.append(select);form.append(label);
    const done=document.createElement('button');done.type='submit';done.textContent='Mark done';form.append(done);
    form.addEventListener('submit',event=>{
      event.preventDefault();if(!authState.isAuthenticated)return;
      if(select.value===''){select.focus();return;}
      const item=items[Number(select.value)];if(!item)return;
      const record=collectionFor(item.kind).find(i=>i.id===item.id);
      if(!record || record.status==='done'){say('That item has already been completed or removed. Choose Mark done again to refresh the list.');return;}
      setItemStatus(record,'done');persistAndRender();form.remove();completionPicker=null;
      launcher.classList.add('pet-celebration');
      say(`Marked ${record.title} done.`,[{label:'Undo',run:()=>{const latest=collectionFor(item.kind).find(i=>i.id===item.id);if(latest?.status==='done'){setItemStatus(latest,'pending');persistAndRender();say(`${latest.title} is pending again.`);}}}]);
    });
    log.append(form);completionPicker=form;log.scrollTop=log.scrollHeight;select.focus();
  }
  function edit(kind,id) {
    guidedEdit = true; show(false); ({class:editClassItem,event:editEventItem,homework:editHomework,exam:editExam,reminder:editReminder})[kind](id);
  }
  function answer(raw) {
    if(draft){receiveDraft(raw);return;}
    const text=raw.toLowerCase().trim();
    if(/\b(mark done|mark.*complete|complete.*to.?do|finished.*task)\b/.test(text)){markDonePicker();return;}
    const date=dateFrom(text);
    if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|next week)\b/.test(text) && !/\d{4}-\d{2}-\d{2}/.test(text)) {say('Please include the date as YYYY-MM-DD, or say today or tomorrow, so I use the right day.');return;}
    if(!date){say('Please use a valid date, such as 2026-10-26.');return;}
    if (/\b(tour|tutorial|show me around)\b/.test(text)) { show(false); document.querySelector('[data-v2-tutorial]')?.click(); return; }
    if (/\b(canvas|import|school schedule)\b/.test(text)) {
      say('I can open your existing import tools. I can answer questions about Canvas work already added to your planner; I cannot read emails or screenshots myself.', [
        {label:'Canvas settings',run:()=>{show(false);setActiveTab('settings');const target=document.querySelector('#settings-canvas-feed');for(let el=target;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;target?.scrollIntoView({block:'center'});target?.focus();}},
        {label:'School schedule import',run:()=>{show(false);setActiveTab('classes');const target=document.querySelector('#extract-schedule');for(let el=target;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;target?.scrollIntoView({block:'center'});target?.focus();}}
      ]); return;
    }
    if (/\b(add|create|new|edit|move|reschedule|change)\b/.test(text)) {
      const kind = /\b(class|classes)\b/.test(text)?'class':/\b(homework|assignment|task)\b/.test(text)?'homework':/\bexam\b/.test(text)?'exam':/\breminder\b/.test(text)?'reminder':/\b(event|appointment)\b/.test(text)?'event':null;
      if (!kind) {say('What would you like to add or edit?',Object.keys(tabs).map(k=>({label:k,run:()=>answer(raw+' '+k)})));return;}
      if (/\b(edit|move|reschedule|change)\b/.test(text)) {
        const collection = kind==='class'||kind==='event' ? state.data.schedule.filter(i=>i.type===kind):state.data[kind==='homework'?'homework':tabs[kind]];
        const quoted=raw.match(/["“]([^"”]+)["”]/); const query=quoted?.[1].toLowerCase();
        let items=collection.filter(i=>!query||i.title.toLowerCase().includes(query));
        if (/today|tomorrow|\d{4}-\d{2}-\d{2}/.test(text)) items=items.filter(i=>i.date===date);
        say(items.length?'Choose the item to edit. Review the details and use Save to apply changes.':'I could not find a matching item. Try its title in quotes or choose a different date.',items.slice(0,30).map(i=>({label:`${i.title} · ${i.date}${i.start?' · '+i.start:''}`,run:()=>edit(kind,i.id)})));
        if(items.length>30)say('Showing the first 30 matches. Include a date or a title in quotes to narrow the list.');
      } else {beginAdd(kind,raw);} return;
    }
    if (/\b(free|available|busy)\b/.test(text)) {
      const time=timeFrom(text);
      if(!time){ pending={intent:'availability',date}; say('What time should I check? Include AM or PM, such as “3 PM tomorrow”.');return; }
      const busy=state.data.schedule.filter(i=>i.date===date && i.start && i.end && i.start<=time && time<i.end && (i.type!=='class'||isActiveClassDate(date)));
      say(busy.length?`At ${time} on ${date}, you have:\n${busy.map(i=>`${i.title} (${i.start}–${i.end})`).join('\n')}`:`You have no timed classes or events at ${time} on ${date}. Assignment deadlines do not reserve time; exams and untimed items should be checked separately.`);return;
    }
    if(/\bnext\b/.test(text)&&/\bclass(?:es)?\b/.test(text)) {
      const now=new Date(),clock=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      const next=state.data.schedule.filter(i=>i.type==='class' && (i.date>today() || i.date===today()&&i.start>=clock) && isActiveClassDate(i.date)).sort(compareByDateTime)[0];
      say(next?'Your next class':'No upcoming scheduled classes are saved.',[],false,next?[{...next,kind:'class',displayTime:formatTime(next.start)+(next.end?' – '+formatTime(next.end):'')}]:[]);return;
    }
    if(/\b(exam|exams|test|tests)\b/.test(text)) {
      const items=state.data.exams.filter(i=>i.status!=='done'&&i.date>=today()).sort(compareByDateTime);
      say(items.length?'Upcoming exams':'No upcoming exams are saved.', [], false, items.slice(0,20).map(i=>({...i,kind:'exam'})));return;
    }
    if(/\breminders?\b/.test(text)) {
      const items=dayItems(date).filter(i=>i.kind==='reminder');
      say(items.length?`Reminders · ${readableDate(date)}`:'No pending reminders for that day.',[{label:'Open To-Do ↗',run:()=>navigateItem({kind:'reminder'})}],false,items);
      return;
    }
    if(/\b(assignment|assignments|homework|due|deadlines)\b/.test(text)) {
      const start=today(),day=new Date(start+'T12:00:00').getDay(),end=offsetDate(start,(7-day)%7);
      const items=/\bweek\b/.test(text)?range(start,end,'homework'):dayItems(date).filter(i=>i.kind==='homework');
      const overdue=state.data.homework.filter(i=>i.status!=='done'&&i.date<start);
      say((items.length?`Assignments · ${/\bweek\b/.test(text)?'This week':readableDate(date)}`:'No pending assignments in that period.')+(overdue.length?`\n${overdue.length} overdue assignment(s) to review.`:''),overdue.length?[{label:'Review To-Do ↗',run:()=>navigateItem({kind:'homework'})}]:[],false,items);return;
    }
    if(/\b(today|tomorrow|schedule|agenda|going on|what.*have)\b/.test(text)||/\d{4}-\d{2}-\d{2}/.test(text)) {
      const items=dayItems(date);const label=date===today()?'Today':date===offsetDate(today(),1)?'Tomorrow':'Your day';say(items.length?`${label} · ${readableDate(date)}`:`Nothing scheduled for ${readableDate(date)}.`,[{label:'Open month view ↗',run:()=>navigateItem({kind:'event',date})}],false,items.map(i=>({...i,date:undefined, navigationDate:date})));return;
    }
    if (/^(hi|hello|hey|thanks|thank you)[!. ]*$/.test(text)) {say('Hello! I’m Scheduler Helper. Ask about your day, next class, assignments, or an event you want to add.');return;}
    say('I can help with schedule questions and guided edits. Try “What do I have today?”, “Am I free at 3 PM?”, “Assignments due this week”, or “Add event”.');
  }
  function mount() {
    const signup=document.querySelector('#profile-setup-form'); signup?.insertBefore(picker('signup-pet','cat'),signup.querySelector('button[type="submit"]'));
    root=document.createElement('div'); root.className='pet-assistant';root.hidden=true;
    panel=document.createElement('section');panel.id='pet-chat';panel.className='pet-chat';panel.hidden=true;panel.setAttribute('aria-label','Pet schedule assistant');
    const header=document.createElement('div');header.className='pet-chat-header';header.innerHTML='<strong>Scheduler Helper</strong>';
    button('Close',()=>{show(false);launcher.focus();},header);panel.append(header);
    log=document.createElement('div');log.className='pet-log';log.setAttribute('role','log');log.setAttribute('aria-live','polite');panel.append(log);
    const prompts=document.createElement('div');prompts.className='pet-prompts';[['Today','What do I have today?'],['Next class','Next class'],['Due this week','Assignments due this week'],['Exams','Upcoming exams'],['Mark done','Mark done'],['Add event','Add event'],['Edit event','Edit event'],['Tour','Tour']].forEach(([label,prompt])=>{const command=button(label,()=>submit(prompt),prompts);command.title=prompt;command.setAttribute('aria-label',prompt);});panel.append(prompts);
    const form=document.createElement('form');form.className='pet-input';const input=document.createElement('input');input.placeholder='Ask about your schedule…';input.setAttribute('aria-label','Question for your pet');input.maxLength=500;form.append(input);const send=document.createElement('button');send.type='submit';send.textContent='Ask';form.append(send);form.onsubmit=e=>{e.preventDefault();submit(input.value);input.value='';};panel.append(form);
    launcher=button('',()=>show(panel.hidden),root);launcher.className='pet-launcher pet-greeting';launcher.setAttribute('aria-label','Open pet schedule assistant');launcher.setAttribute('aria-controls','pet-chat');launcher.setAttribute('aria-expanded','false');root.prepend(panel);document.body.append(root);
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){show(false);launcher.focus();}});
    const settings=document.createElement('section');settings.className='pet-settings';settings.innerHTML='<h3>Scheduler Helper</h3><p>Your pet companion for schedule questions and guided tours.</p>';
    const petPicker=picker('settings-pet','cat');
    document.querySelector('#app-customization .customization-dropdown-body')?.append(petPicker);
    const label=document.createElement('label');const hidden=document.createElement('input');hidden.type='checkbox';hidden.id='pet-hidden';label.append(hidden,document.createTextNode(' Hide the floating pet'));settings.append(label);
    const savePet=()=>{const current=getSettings().pet;state.data.settings.pet={...current,species:document.querySelector('input[name="settings-pet"]:checked').value,hidden:hidden.checked};saveData();refresh();};
    settings.addEventListener('change',savePet);petPicker.addEventListener('change',savePet);
    button('Take a pet-led tour',()=>document.querySelector('[data-v2-tutorial]')?.click(),settings);
    const chatSettings=document.createElement('details');chatSettings.className='settings-accordion';chatSettings.id='chat-settings';
    const chatSummary=document.createElement('summary');chatSummary.textContent='Chat settings';chatSettings.append(chatSummary,settings);
    const weekly=document.querySelector('.weekly-reminder-settings');
    const weeklyGroup=weekly?.closest('details.settings-accordion') || weekly;
    if(weeklyGroup)weeklyGroup.before(chatSettings);else document.querySelector('#panel-settings')?.append(chatSettings);
    refresh();
  }
  function submit(text) { if(!text.trim()||!authState.isAuthenticated)return;say(text,[],true);const context=pending;pending=null;answer(context?.intent==='availability'?'am I free '+text+(/today|tomorrow|\d{4}-\d{2}-\d{2}/i.test(text)?'':' '+context.date):text); }
  function refresh() {
    if(!root)return;
    document.querySelectorAll('.pet-prompts button').forEach(button => {button.disabled=Boolean(draft);});
    const next=authState.isAuthenticated?authState.userId||authState.profile?.email||'local':null;
    if(next!==owner){owner=next;if(touring){document.querySelector('#v2-tour-close')?.click();touring=false;}log.replaceChildren();pending=null;draft=null;completionPicker=null;guidedEdit=false;panel.hidden=true;launcher.setAttribute('aria-expanded','false');if(next)say('Hi! I’m your Scheduler Helper. I can help you plan your day, keep track of deadlines, and update your schedule.');}
    const pet=normalize(state.data.settings?.pet);
    root.hidden=!next||pet.hidden||touring;
    launcher.innerHTML=svg(pet.species);launcher.title=pet.species+' schedule helper';
    const radio=document.querySelector(`input[name="settings-pet"][value="${pet.species}"]`);if(radio)radio.checked=true;
    const hidden=document.getElementById('pet-hidden');if(hidden)hidden.checked=pet.hidden;
    if(next&&!pet.tourOffered&&!tourInvitations.has(next)){tourInvitations.add(next);state.data.settings.pet={...pet,tourOffered:true};saveData();say('Ready to get settled in? I’ll show you where everything is.',[{label:'Show me around',run:()=>document.querySelector('[data-v2-tutorial]')?.click()},{label:'Maybe later',run:()=>show(false)}]);if(!pet.hidden)show(true);}
  }
  window.UniPlanPet={saved(){if(guidedEdit && launcher){guidedEdit=false;launcher.classList.remove('pet-answering');launcher.classList.add('pet-celebration');say('Saved! Your planner is updated.');}},normalize,svg,answer,dateFrom,timeFrom,dayItems,range,refresh,signupChoice:()=>normalize({species:document.querySelector('input[name="signup-pet"]:checked')?.value}),tour(active){touring=active;if(panel)panel.hidden=true;launcher?.setAttribute('aria-expanded','false');if(!active&&launcher)launcher.classList.add('pet-celebration');refresh();},decorateTour(tourPanel){let avatar=tourPanel.querySelector('.pet-tour-avatar');if(!avatar){avatar=document.createElement('div');avatar.className='pet-tour-avatar';tourPanel.prepend(avatar);}avatar.innerHTML=svg(normalize(state.data.settings?.pet).species);avatar.setAttribute('aria-label','Your pet is guiding the tour');}};
  document.addEventListener('DOMContentLoaded',mount);
})();
