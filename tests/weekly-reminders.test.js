const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('netlify/functions/weekly-schedule-reminders.js','utf8');
function context(fetch=()=>{throw Error('Unexpected network call')}){const c=vm.createContext({exports:{},process:{env:{SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test'}},fetch,Date,Intl,console:{log(){},error(){}},URLSearchParams,Buffer});vm.runInContext(source,c);return c;}
test('reminders wait until chosen minute and catch up across midnight',()=>{
 const c=context(),r={day:0,time:'18:07',timezone:'UTC'};
 assert.equal(c.reminderOccurrenceKey(r,new Date('2026-10-04T18:00:00Z')),null);
 assert.equal(c.reminderOccurrenceKey(r,new Date('2026-10-04T18:15:00Z')),'2026-10-04');
 assert.equal(c.reminderOccurrenceKey(r,new Date('2026-10-05T00:15:00Z')),'2026-10-04');
 assert.equal(c.reminderOccurrenceKey(r,new Date('2026-10-05T18:15:00Z')),null);
 assert.equal(c.reminderOccurrenceKey({...r,time:'23:59'},new Date('2026-10-05T00:00:00Z')),'2026-10-04');
});
test('reminders respect local time and keep a stable key during DST repeat',()=>{
 const c=context(),r={day:0,time:'01:30',timezone:'America/Los_Angeles'};
 for(const time of ['2026-11-01T08:30:00Z','2026-11-01T09:30:00Z']) assert.equal(c.reminderOccurrenceKey(r,new Date(time)),'2026-11-01');
 assert.equal(c.reminderOccurrenceKey({...r,time:'99:99'}),null);
});
test('delivery-state failure stops sending rather than ignoring duplicate protection',async()=>{
 let calls=0;const c=context(async()=>{calls++;return calls===1?new Response('[]'):new Response('Unavailable',{status:503});});
 await assert.rejects(c.exports.handler(),/Supabase reminder request failed/);assert.equal(calls,2);
});
test('provider failure is reported and not recorded as delivered',async()=>{
 const now=new Date(),r={enabled:true,day:now.getUTCDay(),time:'00:00',timezone:'UTC',delivery:'email'};
 const c=context(async url=>new Response(JSON.stringify(url.includes('planner_profiles')?[{user_id:'test',data:{settings:{email:'test@example.test',notificationSchedule:{weeklyScheduleReminder:r}}}}]:[])));
 const result=await c.exports.handler();assert.equal(result.statusCode,502);assert.equal(JSON.parse(result.body).failed,1);
});
