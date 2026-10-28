(()=>{
 let section,list,status,urlField,copy,owner=null;
 const button=(label,run)=>{const b=document.createElement('button');b.type='button';b.className='ghost-button';b.textContent=label;b.addEventListener('click',run);return b;};
 async function api(path,method='GET',body){
   if(!authState.isAuthenticated)throw new Error('Sign in to manage your connections.');
   const {data,error}=await supabaseClient.auth.getSession();if(error||!data.session)throw new Error('Sign in again to manage connections.');
   const response=await fetch(path,{method,headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
   const value=await response.json().catch(()=>{throw new Error('The connector is not deployed on this server yet.');});if(!response.ok)throw new Error(value.error_description||'Connection setup is unavailable.');return value;
 }
 async function load(){
   const requestedOwner=owner;status.textContent='Checking connections…';
   try{
     const setup=await fetch('/connector/status').then(async response=>{const value=await response.json().catch(()=>{throw new Error('The connector is not deployed on this server yet.');});if(!response.ok)throw new Error(value.error_description||'Connector setup is incomplete.');return value;});
     if(owner!==requestedOwner)return;urlField.value=setup.url;copy.disabled=false;
     const data=await api('/connector/connections');if(owner!==requestedOwner)return;
     list.replaceChildren();status.textContent=data.connections.length?'Your connected AI apps:':'No AI apps connected yet. Follow the setup steps above.';
     data.connections.forEach(connection=>{
       const row=document.createElement('div');row.className='connector-connection';
       const name=document.createElement('strong');name.textContent=connection.client_name;
       const detail=document.createElement('p');detail.textContent=connection.scopes.includes('planner:write')?'Can read and update your planner':'Can read your planner';row.append(name,detail);
       row.append(button('Disconnect',async()=>{try{await api('/connector/connections','POST',{id:connection.id});await load();}catch(error){status.textContent=error.message;}}));list.append(row);
     });
   }catch(error){if(owner===requestedOwner)status.textContent=error.message;}
 }
 function refresh(){if(!section)return;const next=authState.isAuthenticated?authState.userId||authState.profile?.email:null;if(next!==owner){owner=next;list.replaceChildren();if(owner)load();else status.textContent='Sign in to manage connections.';}}
 document.addEventListener('DOMContentLoaded',()=>{
   section=document.createElement('section');section.className='connector-settings';section.id='connector-settings';
   section.innerHTML='<h3>Connect ChatGPT or Claude</h3><p>Manage UniPlan from your preferred AI app. Your pet helper stays available here.</p><p>Connector URL</p>';
   urlField=document.createElement('input');urlField.type='text';urlField.readOnly=true;urlField.className='connector-url';urlField.setAttribute('aria-label','Connector URL');urlField.value=/^https?:$/.test(location.protocol)?location.origin+'/mcp':'';urlField.placeholder='Open your hosted UniPlan site to copy its connector URL';section.append(urlField);
   const selectUrl=()=>{urlField.focus();urlField.select();urlField.setSelectionRange(0,urlField.value.length);};
   urlField.addEventListener('click',selectUrl);
   copy=button('Copy connector URL',async()=>{
     try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(urlField.value);status.textContent='Connector URL copied.';}
     catch{selectUrl();let copied=false;try{copied=document.execCommand('copy');}catch{}status.textContent=copied?'Connector URL copied.':'URL selected. Touch and hold the URL, then choose Copy.';}
   });copy.disabled=!urlField.value;section.append(copy);
   const steps=document.createElement('ol');
   for(const text of ['In ChatGPT, open Plugins and choose Add custom MCP server. In Claude, open Settings → Connectors → Add custom connector.','Paste the connector URL, then connect using OAuth. Your AI account or workspace must support custom connectors.','Sign in to UniPlan, review the permissions, and choose Allow connection.','Ask your AI app “What do I have today?” or “Add this assignment to UniPlan.”']){const item=document.createElement('li');item.textContent=text;steps.append(item);}section.append(steps);
   const links=document.createElement('div');links.className='connector-app-links';for(const [name,url]of [['Open ChatGPT','https://chatgpt.com/plugins'],['Open Claude','https://claude.ai/settings/connectors']]){const a=document.createElement('a');a.textContent=name;a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.className='ghost-button';links.append(a);}section.append(links);
   section.append(button('Refresh connections',()=>load()));status=document.createElement('p');status.setAttribute('role','status');section.append(status);list=document.createElement('div');section.append(list);const dropdown=document.createElement('details');dropdown.className='settings-accordion';const summary=document.createElement('summary');summary.textContent='Connected AI apps';dropdown.append(summary,section);dropdown.id='connected-ai-apps';const chatSettings=document.querySelector('#chat-settings');if(chatSettings)chatSettings.after(dropdown);else document.querySelector('#panel-settings')?.append(dropdown);refresh();
 });
 window.UniPlanConnector={refresh};
})();
