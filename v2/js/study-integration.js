// Study data remains local, scoped to the signed-in account and selected class.
window.getUniPlanStudyContext=()=>{
 const exams=state.data?.exams||[];
 const quizzes=(state.data?.homework||[]).filter(item=>/\bquiz\b/i.test(item.title||''));
 const assessments=[...exams.map(item=>({...item,studyId:'exam:'+item.id})),...quizzes.map(item=>({...item,studyId:'homework:'+item.id}))]
  .filter(item=>item.status!=='done'&&/^\d{4}-\d{2}-\d{2}$/.test(item.date||'')&&item.course)
  .map(item=>({id:item.studyId,title:item.title,course:item.course,date:item.date,time:item.time||'',notes:item.notes||'',kind:/\bquiz\b/i.test(item.title||'')?'Quiz':'Exam'}));
 return{userId:authState.userId,courses:[...new Set([...getImportableClasses().map(c=>c.title),...assessments.map(item=>item.course)])],assessments,studySessions:(state.data?.schedule||[]).filter(item=>item.studySessionId).map(item=>({id:item.id,sessionId:item.studySessionId,course:item.course,status:item.status||'pending',date:item.date,start:item.start,end:item.end}))};
};
function openStudyPlanForExam(id){
 const exam=(state.data.exams||[]).find(item=>item.id===id);
 if(!exam||exam.status==='done'||!authState.isAuthenticated)return;
 setActiveTab('study');
 const frame=document.querySelector('#study-workspace');
 if(frame)frame.src='study/index.html?assessment='+encodeURIComponent('exam:'+id)+'&create=1';
}
function renderV2Study(){
 const frame=document.querySelector('#study-workspace');if(!frame)return;
 if(!authState.isAuthenticated){frame.removeAttribute('src');delete frame.dataset.studyOwner;return;}
 if(state.activeTab!=='study')return;
 const context=window.getUniPlanStudyContext();
 const {studySessions,...identityContext}=context;
 const identity=JSON.stringify(identityContext);
 if(frame.dataset.studyOwner!==identity){frame.dataset.studyOwner=identity;frame.src='study/index.html';}
 else frame.contentWindow?.postMessage({type:'uniplan-study-sessions',sessions:studySessions},location.protocol==='file:'?'*':location.origin);
}
window.addEventListener('message',event=>{
 const frame=document.querySelector('#study-workspace');
 const trustedOrigin=location.protocol==='file:'?event.origin==='null':event.origin===location.origin;
 if(!trustedOrigin||event.source!==frame?.contentWindow)return;
 if(event.data?.type==='uniplan-study-context-request'){
  if(!authState.isAuthenticated||!authState.userId)return;
  frame.contentWindow.postMessage({type:'uniplan-study-context',context:window.getUniPlanStudyContext()},location.protocol==='file:'?'*':location.origin);
  return;
 }
 if(event.data?.type==='uniplan-study-schedule'){
  const message=event.data;
  const reply=result=>frame.contentWindow.postMessage({type:'uniplan-study-schedule-result',requestId:message.requestId,...result},location.protocol==='file:'?'*':location.origin);
  if(!authState.isAuthenticated||authState.userId!==message.userId){reply({error:'Sign in again before scheduling study time.'});return;}
  try{
   const request=message.request||{};
   if(!window.getUniPlanStudyContext().courses.includes(request.course))throw new Error('Choose one of your saved classes.');
   if(request.action==='complete'){
    const item=state.data.schedule.find(item=>item.id===request.eventId&&item.studySessionId&&item.course===request.course);
    if(!item||typeof request.done!=='boolean')throw new Error('This study session is no longer on your calendar.');
    setItemStatus(item,request.done?'done':'pending');persistAndRender();reply({done:request.done});return;
   }
   if(request.action==='view'){
    const item=state.data.schedule.find(item=>item.id===request.eventId&&item.studySessionId&&item.course===request.course);
    if(!item)throw new Error('This session is no longer on your calendar. Use Find another time to add it again.');
    state.selectedDate=item.date;state.visibleMonth=startOfMonth(item.date);state.calendarFilter='all';
    if(elements.calendarFilter)elements.calendarFilter.value='all';
    setActiveTab('calendar');renderCalendar();reply({opened:true});return;
   }
   if(request.action==='plan'){
    if(!Array.isArray(request.sessions)||request.sessions.length<1||request.sessions.length>31)throw new Error('Choose between 1 and 31 study sessions.');
    if(request.sessions.some(session=>!session||typeof session.id!=='string'||!session.id||typeof session.title!=='string'||!session.title.trim()||session.title.length>180))throw new Error('Each session needs a title and identifier.');
    const replaceIds=new Set(Array.isArray(request.replaceEventIds)?request.replaceEventIds:[]);
    let schedule=state.data.schedule.filter(item=>!(replaceIds.has(item.id)&&item.studySessionId&&item.course===request.course));
    const sessions=request.sessions.map(session=>{
     try{
      const existing=schedule.find(item=>item.studySessionId===session.id&&item.course===request.course);
      const slot=findStudySlot({...request,...session,eventId:existing?.id},schedule,state.data.exams||[]);
      const item={id:existing?.id||crypto.randomUUID(),type:'event',title:'Study: '+request.course+' · '+session.title.trim(),course:request.course,...slot,color:colorForSelectedClass(request.course,'#7eaed6'),studySessionId:session.id,status:existing?.status||'pending',completedAt:existing?.completedAt||'',notes:'Study session scheduled from your class study planner.'};
      schedule=schedule.filter(entry=>entry.id!==item.id);schedule.push(item);
      return{id:session.id,...slot,eventId:item.id};
     }catch(error){return{id:session.id,scheduleError:error.message||'No available time found.'};}
    });
    state.data.schedule=schedule;persistAndRender();reply({sessions});return;
   }
   if(request.action==='remove'){
    const ids=new Set(Array.isArray(request.eventIds)?request.eventIds:[]);
    state.data.schedule=state.data.schedule.filter(item=>!(ids.has(item.id)&&item.studySessionId&&item.course===request.course));
    persistAndRender();reply({removed:true});return;
   }
   if(typeof request.sessionId!=='string'||!request.sessionId||typeof request.title!=='string'||!request.title.trim()||request.title.length>180)throw new Error('Enter a study session title.');
   const existing=state.data.schedule.find(item=>item.studySessionId===request.sessionId&&item.course===request.course);
   const slot=findStudySlot({...request,eventId:existing?.id},state.data.schedule,state.data.exams||[]);
   const item={id:existing?.id||crypto.randomUUID(),type:'event',title:'Study: '+request.course+' · '+request.title.trim(),course:request.course,...slot,color:colorForSelectedClass(request.course,'#7eaed6'),studySessionId:request.sessionId,status:existing?.status||'pending',completedAt:existing?.completedAt||'',notes:'Study session scheduled from your class study planner.'};
   state.data.schedule=state.data.schedule.filter(entry=>entry.id!==item.id);state.data.schedule.push(item);
   persistAndRender();reply({slot:{...slot,eventId:item.id}});
  }catch(error){reply({error:error.message||'Could not schedule this session.'});}
  return;
 }
 if(event.data?.type!=='uniplan-study-height')return;
 const height=Number(event.data.height);if(Number.isFinite(height)&&height>0)frame.style.height=Math.min(100000,Math.ceil(height)+20)+'px';
});
// This bridge stays in the authenticated shell; the Study frame never receives tokens.
window.recognizeStudyPage=async(image,expectedUserId)=>{
 if(!authState.isAuthenticated||authState.userId!==expectedUserId)throw new Error('Sign in again before reading handwriting.');
 const token=await getValidAccessToken();
 if(!token||authState.userId!==expectedUserId)throw new Error('Sign in again before reading handwriting.');
 const response=await fetch('/.netlify/functions/study-handwriting',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({image,consent:true}),signal:AbortSignal.timeout(60000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||(response.status===404?'Handwriting recognition needs the latest deployment.':'Could not read this page.'));
 if(authState.userId!==expectedUserId)throw new Error('The signed-in account changed. Please retry.');
 if(typeof result.text!=='string'||!result.text.trim())throw new Error('No readable text was returned.');
 return result.text;
};
