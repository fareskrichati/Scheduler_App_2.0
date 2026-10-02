export const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
export function validateFeed(value) {
 const url=new URL(value);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.instructure.com')||url.username||url.password||url.port||!/^\/feeds\/calendars\/[^/]+\.ics$/i.test(url.pathname))throw new Error('Add a valid private Canvas calendar feed in Settings.');
 return url.href;
}
export function zoned(instant,timezone) {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
function due(property,timezone){
 if(!property)return null;const m=property.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z|[+-]\d{4})?$/i);if(!m)return null;
 const [,y,mo,d,h,mi,se='00',suffix='']=m;if(!h)return {date:`${y}-${mo}-${d}`,time:''};
 let timestamp=Date.UTC(+y,+mo-1,+d,+h,+mi,+se);
 if(suffix&&suffix.toUpperCase()!=='Z'){const sign=suffix[0]==='+'?1:-1;timestamp-=sign*(+suffix.slice(1,3)*60 + +suffix.slice(3,5))*60000;}
 if(!suffix){const sourceZone=property.params.match(/TZID="?([^;":]+)/i)?.[1]||timezone;const fmt=new Intl.DateTimeFormat('en-US',{timeZone:sourceZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});const target=timestamp;for(let i=0;i<3;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(timestamp)).filter(x=>x.type!=='literal').map(x=>[x.type,+x.value]));const diff=target-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);timestamp+=diff;if(!diff)break}}
 return zoned(new Date(timestamp),timezone);
}
export function parseFeed(ics,timezone='UTC',now=new Date()){
 if(typeof ics!=='string'||ics.length>2_000_000||!ics.includes('BEGIN:VCALENDAR'))throw new Error('Canvas returned an invalid calendar.');
 const today=zoned(now,timezone).date,decode=s=>s.replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1').trim();
 return ics.replace(/\r?\n[ \t]/g,'').split('BEGIN:VEVENT').slice(1).flatMap(block=>{
  const read=n=>{const m=block.match(new RegExp(`(?:^|\\n)${n}((?:;[^:\\n]*)*):(.*)`,'i'));return m?{params:m[1],value:m[2].trim()}:null};
  if(read('STATUS')?.value==='CANCELLED')return [];
  const summary=decode(read('SUMMARY')?.value||''),date=due(read('DUE')||read('DTSTART'),timezone);if(!summary||!date||date.date<today)return [];
  const description=decode(read('DESCRIPTION')?.value||''),pre=summary.match(/^\[([^\]]+)\]\s*(.*)$/),post=summary.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  const course=(pre?.[1]||post?.[2]||description.match(/(?:^|\n)\s*(?:course|context)\s*:\s*([^\n]+)/i)?.[1]||decode(read('CATEGORIES')?.value||'')||'Canvas').trim();
  const title=(pre?.[2]||post?.[1]||summary).replace(/^assignment\s*:\s*/i,'').trim();
  return [{uid:read('UID')?.value||`${summary}|${read('DTSTART')?.value}`,title,course,kind:/\b(exam|quiz|test|midterm|final)\b/i.test(title)?'exam':'homework',...date}];
 });
}
const key=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
export function addNewItems(data,items,uuid){
 const next=structuredClone(data);next.homework=next.homework||[];next.exams=next.exams||[];
 const all=[...next.homework,...next.exams,...(next.reminders||[])],uids=new Set(all.map(x=>x.canvasFeedUid).filter(Boolean)),sourceIds=new Set(all.map(x=>x.schoolImportId).filter(Boolean));
 const identities=new Set(all.map(x=>`${key(x.title)}|${key(x.course)}|${x.date}`));
 const courses=[...(next.courses||[]),...(next.schedule||[]).filter(x=>x.type==='class')];let added=0;
 for(const item of items){const savedMatch=next.settings?.canvasCourseMatches?.[key(item.course)];const course=courses.find(x=>x.title===savedMatch)||courses.find(x=>key(x.title)===key(item.course));const title=course?.title||item.course;const identity=`${key(item.title)}|${key(title)}|${item.date}`;
  if(uids.has(item.uid)||sourceIds.has(`canvas-feed:${item.uid}`)||identities.has(identity))continue;
  next[item.kind==='exam'?'exams':'homework'].push({id:uuid(),title:item.title,course:title,date:item.date,time:item.time,status:'pending',priority:false,color:course?.color||'#7eaed6',canvasFeedUid:item.uid,schoolImportId:`canvas-feed:${item.uid}`,notes:item.time?'Imported automatically from Canvas.':'Imported automatically from Canvas. No due time was provided.',...(course?{matchSourceKey:course.matchSourceKey||`schedule:${course.seriesId||course.id}`}:{})});
  uids.add(item.uid);sourceIds.add(`canvas-feed:${item.uid}`);identities.add(identity);added++;
 }
 return {data:next,added};
}
