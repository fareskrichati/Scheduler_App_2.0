const crypto = require('node:crypto');
const SCOPES = ['planner:read', 'planner:write'];
const fail = (status, message, oauthError) => Object.assign(new Error(message), {status, oauthError});
function config() {
  let origin;try{origin=new URL(process.env.CONNECTOR_PUBLIC_URL || process.env.PLANNER_PUBLIC_URL || 'https://unconfigured.invalid');}catch{throw fail(503,'Set CONNECTOR_PUBLIC_URL to the HTTPS origin of your UniPlan site.');}
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || origin.hostname === 'unconfigured.invalid') throw fail(503, 'Set CONNECTOR_PUBLIC_URL to the HTTPS origin of your UniPlan site.');
  const secret = process.env.CONNECTOR_SIGNING_SECRET || '';
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (secret.length < 32 || !url || !key || !publicKey) throw fail(503, 'Connector setup is incomplete. Configure its signing secret and Supabase server variables.');
  return {origin:origin.origin, resource:origin.origin+'/mcp', secret, url:url.replace(/\/$/,''), key, publicKey};
}
const hash = value => crypto.createHash('sha256').update(value).digest('base64url');
const random = () => crypto.randomBytes(32).toString('base64url');
function sign(type, data, c=config()) {
  const payload = Buffer.from(JSON.stringify({type,...data})).toString('base64url');
  return payload+'.'+crypto.createHmac('sha256',c.secret).update(payload).digest('base64url');
}
function verify(token, type, c=config()) {
  if (typeof token!=='string' || token.length>12000) throw fail(401,'Invalid token.','invalid_token');
  const [payload,sig,extra]=token.split('.');
  if(!payload || !sig || extra) throw fail(401,'Invalid token.','invalid_token');
  const expected=crypto.createHmac('sha256',c.secret).update(payload).digest();
  const actual=Buffer.from(sig,'base64url');
  if(actual.length!==expected.length || !crypto.timingSafeEqual(actual,expected)) throw fail(401,'Invalid token.','invalid_token');
  let data;try{data=JSON.parse(Buffer.from(payload,'base64url'));}catch{throw fail(401,'Invalid token.','invalid_token');}
  if(data.type!==type || data.exp && data.exp<=Math.floor(Date.now()/1000)) throw fail(401,'Token expired or invalid.','invalid_token');
  return data;
}
function json(statusCode, value, headers={}) {return {statusCode, headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers},body:JSON.stringify(value)};}
function body(event) {
  const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString():event.body||'';
  if(Buffer.byteLength(raw)>65536) throw fail(413,'Request is too large.','invalid_request');
  try{const parsed=(event.headers?.['content-type']||event.headers?.['Content-Type']||'').includes('application/x-www-form-urlencoded')?Object.fromEntries(new URLSearchParams(raw)):JSON.parse(raw||'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed;}
  catch{throw fail(400,'Invalid request body.','invalid_request');}
}
async function db(table, query={}, method='GET', value, c=config()) {
  const response=await fetch(`${c.url}/rest/v1/${table}?${new URLSearchParams(query)}`,{method,headers:{apikey:c.key,...(c.key.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${c.key}`}),'Content-Type':'application/json',Prefer:'return=representation'},...(value===undefined?{}:{body:JSON.stringify(value)}),signal:AbortSignal.timeout(12000)});
  if(!response.ok) {
    const error=await response.json().catch(()=>({}));
    if(error.code==='42P01'||error.code==='PGRST205') throw fail(503,'Connector database setup is required. Run supabase-connector.sql.');
    if(response.status===401 || response.status===403) throw fail(503,'Planner server credentials were rejected. Check the Supabase service key and project URL in Netlify.');
    throw fail(503,'Planner storage is temporarily unavailable. Please retry.');
  }
  return response.status===204?[]:response.json();
}
function checkOrigin(event, allowed, c=config()) {
  const origin=event.headers?.origin||event.headers?.Origin;
  if(origin && ![c.origin,...allowed].includes(origin)) throw fail(403,'Origin is not allowed.');
}
async function user(event,c=config()) {
  const auth=event.headers?.authorization||event.headers?.Authorization;
  if(!auth?.startsWith('Bearer '))throw fail(401,'Sign in to UniPlan first.');
  const response=await fetch(c.url+'/auth/v1/user',{headers:{apikey:c.publicKey,Authorization:auth},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw fail(401,'Your UniPlan session has expired. Sign in again.');
  const result=await response.json();if(!result.id)throw fail(401,'Invalid UniPlan session.');return result;
}
function scopes(value) {
  const result=[...new Set((typeof value==='string'?value:'planner:read planner:write').split(' ').filter(Boolean))];
  if(!result.includes('planner:read')||result.some(s=>!SCOPES.includes(s)))throw fail(400,'Request planner:read and optionally planner:write.','invalid_scope');
  return result;
}
function client(id,c=config()) {try{return verify(id,'client',c);}catch{throw fail(400,'Unrecognized OAuth client.','invalid_client');}}
function clientAuth(event,input,c=config()) {
  let id=input.client_id,secret=input.client_secret,basic=false;
  const header=event.headers?.authorization||event.headers?.Authorization||'';
  if(header.startsWith('Basic ')){
    basic=true;let decoded;try{decoded=Buffer.from(header.slice(6),'base64').toString();const colon=decoded.indexOf(':');if(colon<0)throw new Error();const fromHeader=decodeURIComponent(decoded.slice(0,colon));secret=decodeURIComponent(decoded.slice(colon+1));if(id&&id!==fromHeader)throw new Error();id=fromHeader;}catch{throw fail(401,'Invalid client authentication.','invalid_client');}
  }
  const app=client(id,c),method=app.auth_method||'none';
  if(method!=='none' && ((method==='client_secret_basic')!==basic || typeof secret!=='string' || hash(secret)!==app.secret_hash))throw fail(401,'Invalid client authentication.','invalid_client');
  input.client_id=id;return app;
}
function authorization(params,c=config()) {
  const app=client(params.client_id,c);
  if(params.response_type!=='code'||params.code_challenge_method!=='S256'||!/^[-\w]{43}$/.test(params.code_challenge||''))throw fail(400,'Authorization code flow with S256 PKCE is required.','invalid_request');
  if(!app.redirect_uris.includes(params.redirect_uri))throw fail(400,'Redirect URI is not registered.','invalid_request');
  if(params.resource && params.resource!==c.resource)throw fail(400,'Incorrect resource.','invalid_target');
  if(typeof params.state!=='string'||!params.state||params.state.length>2048)throw fail(400,'OAuth state is required.','invalid_request');
  return {app,scope:scopes(params.scope),redirect:params.redirect_uri};
}
function redirect(uri,params) {const url=new URL(uri);for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);return url.href;}
function access(grant,c=config(),scope=grant.scopes) {
  return sign('access',{sub:grant.user_id,gid:grant.id,scope,aud:c.resource,exp:Math.floor(Date.now()/1000)+3600},c);
}
async function authenticate(event,c=config()) {
  const raw=(event.headers?.authorization||event.headers?.Authorization||'').replace(/^Bearer /,'');
  const token=verify(raw,'access',c);
  if(token.aud!==c.resource)throw fail(401,'Wrong token audience.','invalid_token');
  const [grant]=await db('planner_connector_grants',{id:'eq.'+token.gid,user_id:'eq.'+token.sub,revoked_at:'is.null',refresh_expires_at:'gt.'+new Date().toISOString(),select:'id,user_id,scopes,timezone'},'GET',undefined,c);
  if(!grant || !Array.isArray(token.scope)||token.scope.some(s=>!grant.scopes.includes(s)))throw fail(401,'Connection expired or revoked.','invalid_token');
  return {...grant,scopes:token.scope};
}
module.exports={SCOPES,fail,config,hash,random,sign,verify,json,body,db,checkOrigin,user,scopes,client,clientAuth,authorization,redirect,access,authenticate};
