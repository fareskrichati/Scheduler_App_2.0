/* OAuth consent is completed in UniPlan; passwords never go to an AI service. */
(async()=>{
 const get=id=>document.getElementById(id),status=get('connector-status');
 const params=new URLSearchParams(location.search),request={};
 for(const key of ['client_id','redirect_uri','response_type','scope','state','code_challenge','code_challenge_method','resource'])if(params.has(key))request[key]=params.get(key);
 const details=get('connector-details'),login=get('connector-login'),approve=get('connector-approve');
 let client;
 async function api(path,options={}){const response=await fetch(path,options);const data=await response.json();if(!response.ok)throw new Error(data.error_description||data.error||'Could not complete the connection.');return data;}
 async function account(){const {data,error}=await client.auth.getSession();if(error)throw error;const session=data.session;login.hidden=!!session;approve.hidden=!session;get('connector-account').textContent=session?'Signed in as '+session.user.email:'';return session;}
 try{
   const consent=await api('/connector/consent?'+new URLSearchParams(request));
   const config=window.DAILY_PLANNER_SUPABASE;
   if(!window.supabase||!config?.url||!config.anonKey)throw new Error('UniPlan sign-in is unavailable. Please try again later.');
   client=window.supabase.createClient(config.url,config.anonKey);
   get('connector-client').textContent=consent.name;
   get('connector-destination').textContent='Returning to: '+new URL(consent.redirect_uri).origin;
   get('connector-deny').href=consent.deny_url;
   get('connector-write-label').hidden=!consent.scopes.includes('planner:write');
   get('connector-allow-write').checked=consent.scopes.includes('planner:write');
   details.hidden=false;status.textContent='Review the permissions below, then sign in and approve.';await account();
 }catch(error){status.textContent=error.message;return;}
 login.addEventListener('submit',async event=>{
   event.preventDefault();const button=login.querySelector('button');button.disabled=true;
   try{const {error}=await client.auth.signInWithPassword({email:get('connector-email').value.trim(),password:get('connector-password').value});get('connector-password').value='';if(error)throw error;await account();status.textContent='Signed in. Choose Allow connection to continue.';}
   catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 });
 approve.addEventListener('click',async()=>{
   approve.disabled=true;
   try{const session=await account();if(!session)throw new Error('Sign in to UniPlan to continue.');
     const result=await api('/connector/approve',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({request,allow_write:get('connector-allow-write').checked,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})});
     const redirect=new URL(result.redirect_url);const expected=new URL(request.redirect_uri);if(redirect.origin!==expected.origin||redirect.pathname!==expected.pathname)throw new Error('Unexpected redirect. Please restart the connection.');location.assign(redirect.href);
   }catch(error){status.textContent=error.message;approve.disabled=false;}
 });
})();
