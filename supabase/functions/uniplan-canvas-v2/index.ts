import {validateFeed,parseFeed,addNewItems,THREE_DAYS} from './canvas-core.mjs';
const cronSecret = Deno.env.get('UNIPLAN_CRON_SECRET');
const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-uniplan-cron','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:cors});
async function rest(path:string,options:RequestInit={}){const response=await fetch(base+'/rest/v1/'+path,{...options,headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Planner sync is unavailable. Please try again.');const text=await response.text();return text?JSON.parse(text):null}
async function fetchFeed(feed:string){const response=await fetch(validateFeed(feed),{headers:{Accept:'text/calendar'},redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Canvas could not be reached. Check that your private feed is still valid.');const reader=response.body!.getReader();const decoder=new TextDecoder();let text='',length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2_000_000){await reader.cancel();throw new Error('Canvas calendar is too large.')}text+=decoder.decode(value,{stream:true})}return text+decoder.decode()}
async function syncUser(pref:any,manual=false){
 const userId=pref.user_id,filter=`user_id=eq.${encodeURIComponent(userId)}`;
 const leaseUntil=new Date(Date.now()+10*60000).toISOString();
 const claim=await rest(`planner_canvas_automation?${filter}&mode=eq.automatic&next_check_at=eq.${encodeURIComponent(pref.next_check_at)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({next_check_at:leaseUntil})});
 if(!claim?.length)return {added:0,skipped:true};
 try {
  let rows=await rest(`planner_profiles?${filter}&select=data,updated_at`),row=rows?.[0];if(!row)throw new Error('Save your planner and Canvas feed first.');
  const feed=row.data?.settings?.canvasFeedUrl;const ics=await fetchFeed(feed);const items=parseFeed(ics,pref.timezone||'UTC');
  let added=0;
  for(let attempt=0;attempt<3;attempt++){
   // Re-check opt-in and feed after the network call and each conflict retry.
   const current=await rest(`planner_canvas_automation?${filter}&select=mode,next_check_at`);if(current?.[0]?.mode!=='automatic'||current[0].next_check_at!==claim[0].next_check_at)return {added:0,skipped:true};
   if(row.data?.settings?.canvasFeedUrl!==feed)throw new Error('Canvas feed changed during sync. Please check again.');
   const merged=addNewItems(row.data,items,()=>crypto.randomUUID());added=merged.added;
   if(added){const written=await rest(`planner_profiles?${filter}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data:merged.data,updated_at:new Date().toISOString()})});if(!written?.length){rows=await rest(`planner_profiles?${filter}&select=data,updated_at`);row=rows?.[0];if(attempt===2)throw new Error('Your planner changed during sync. Please retry.');continue}}
   await rest(`planner_canvas_automation?${filter}&mode=eq.automatic&next_check_at=eq.${encodeURIComponent(claim[0].next_check_at)}`,{method:'PATCH',body:JSON.stringify({last_checked_at:new Date().toISOString(),next_check_at:new Date(Date.now()+THREE_DAYS).toISOString(),last_error:null})});return {added};
  }
 }catch(error){await rest(`planner_canvas_automation?${filter}&mode=eq.automatic&next_check_at=eq.${encodeURIComponent(claim[0].next_check_at)}`,{method:'PATCH',body:JSON.stringify({last_error:error.message||'Canvas sync failed.',next_check_at:new Date(Date.now()+3600000).toISOString()})});throw error}
 return {added:0};
}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed.'},405);
 try{
  const scheduler=Boolean(cronSecret)&&req.headers.get('x-uniplan-cron')===cronSecret;
  if(scheduler){const due=await rest(`planner_canvas_automation?mode=eq.automatic&next_check_at=lte.${encodeURIComponent(new Date().toISOString())}&order=next_check_at.asc&limit=25`);let processed=0,failed=0;for(const pref of due||[]){try{await syncUser(pref);processed++}catch{failed++}}return json({processed,failed})}
  const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return json({error:'Sign in to use Canvas imports.'},401);
  const userResponse=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!userResponse.ok)return json({error:'Your session expired. Sign in again.'},401);const user=await userResponse.json();if(!user.id)return json({error:'Sign in first.'},401);
  const body=await req.json();if(body.action==='review'){
   // Only the signed-in user's saved feed can be fetched.
   const rows=await rest(`planner_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=data`);const ics=await fetchFeed(rows?.[0]?.data?.settings?.canvasFeedUrl);return json({ics});
  }
  if(body.action!=='sync')return json({error:'Unknown action.'},400);
  const rows=await rest(`planner_canvas_automation?user_id=eq.${encodeURIComponent(user.id)}&select=*`),pref=rows?.[0];if(pref?.mode!=='automatic')return json({error:'Turn on automatic import mode first, or use manual review.'},400);
  if(pref.last_checked_at&&Date.now()-Date.parse(pref.last_checked_at)<60000)return json({error:'Canvas was just checked. Please wait a minute before checking again.'},429);
  return json(await syncUser(pref,true));
 }catch(error){return json({error:error.message||'Canvas sync failed. Please try again.'},502)}
});
