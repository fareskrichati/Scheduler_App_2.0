/* Find a free interval using local calendar dates and minutes, without changing other plans. */
function findStudySlot(request,schedule,exams,now=new Date()){
 const toMinutes=value=>/^\d{2}:\d{2}$/.test(value||'')&&Number(value.slice(0,2))<24&&Number(value.slice(3))<60?Number(value.slice(0,2))*60+Number(value.slice(3)):NaN;
 const toTime=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
 const day=new Date(request.date+'T00:00:00');
 if(!Number.isFinite(day.getTime())||day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0')!==request.date)throw new Error('Choose a valid date.');
 const startOfToday=new Date(now);startOfToday.setHours(0,0,0,0);
 if(day<startOfToday)throw new Error('Choose today or a future date.');
 const duration=Number(request.minutes),first=toMinutes(request.earliest),last=toMinutes(request.latest);
 if(!Number.isInteger(duration)||duration<5||duration>480||duration%5)throw new Error('Choose a session length from 5 to 480 minutes, in steps of 5.');
 if(!['midday','end'].includes(request.preference)||!Number.isFinite(first)||!Number.isFinite(last)||first>=last)throw new Error('Choose a valid search window.');
 const busy=[];
 for(const item of schedule.filter(item=>item.date===request.date&&(!request.eventId||item.id!==request.eventId))){
  const start=toMinutes(item.start),end=toMinutes(item.end);
  if(Number.isFinite(start))busy.push([start,Number.isFinite(end)&&end>start?end:1440]);
 }
 for(const item of exams.filter(item=>item.date===request.date&&item.status!=='done')){
  const start=toMinutes(item.time);if(!Number.isFinite(start))continue;
  const end=toMinutes(item.end);busy.push([start,Number.isFinite(end)&&end>start?end:1440]);
 }
 let candidate=first;
 if(day.getTime()===startOfToday.getTime())candidate=Math.max(candidate,Math.ceil((now.getHours()*60+now.getMinutes()+1)/5)*5);
 candidate=Math.ceil(candidate/5)*5;
 for(const [start,end]of busy.sort((a,b)=>a[0]-b[0])){
  if(candidate+duration<=start)break;
  if(candidate<end&&candidate+duration>start)candidate=Math.ceil(end/5)*5;
 }
 if(candidate+duration>last)throw new Error('No open time fits that day and window. Try a wider window, a shorter session, or another date.');
 return{date:request.date,start:toTime(candidate),end:toTime(candidate+duration)};
}
