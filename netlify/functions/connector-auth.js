const crypto=require('node:crypto');
const s=require('./lib/connector-shared');
exports.handler=async event=>{
  try {
    const c=s.config(),route=event.queryStringParameters?.route;
    const method=event.httpMethod;
    if(route==='metadata'&&method==='GET') return s.json(200,{issuer:c.origin,authorization_endpoint:c.origin+'/connector/authorize',token_endpoint:c.origin+'/connector/token',registration_endpoint:c.origin+'/connector/register',revocation_endpoint:c.origin+'/connector/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none','client_secret_basic','client_secret_post'],scopes_supported:s.SCOPES});
    if(route==='resource'&&method==='GET') return s.json(200,{resource:c.resource,authorization_servers:[c.origin],scopes_supported:s.SCOPES,bearer_methods_supported:['header'],resource_name:'UniPlan'});
    if(route==='status'&&method==='GET'){await s.db('planner_connector_grants',{select:'id',limit:'0'},'GET',undefined,c);return s.json(200,{ready:true,url:c.resource});}
    if(route==='register'&&method==='POST') {
      const input=s.body(event);
      if(!Array.isArray(input.redirect_uris)||!input.redirect_uris.length||input.redirect_uris.length>5)throw s.fail(400,'Provide 1–5 redirect URIs.','invalid_redirect_uri');
      const uris=input.redirect_uris.map(uri=>{let url;try{url=new URL(uri);}catch{throw s.fail(400,'Invalid redirect URI.','invalid_redirect_uri');}if(uri.length>500||url.protocol!=='https:'||url.username||url.password||url.hash)throw s.fail(400,'HTTPS redirect URIs without fragments or credentials are required.','invalid_redirect_uri');return uri;});
      const method=input.token_endpoint_auth_method||'none';
      if(!['none','client_secret_basic','client_secret_post'].includes(method))throw s.fail(400,'Unsupported client authentication method.','invalid_client_metadata');
      const secret=method==='none'?null:s.random();
      const name=typeof input.client_name==='string'?input.client_name.trim().slice(0,80):'Custom AI connector';
      const id=s.sign('client',{redirect_uris:uris,name,nonce:s.random(),auth_method:method,...(secret?{secret_hash:s.hash(secret)}:{})},c);
      return s.json(201,{client_id:id,client_name:name,redirect_uris:uris,token_endpoint_auth_method:method,...(secret?{client_secret:secret,client_secret_expires_at:0}:{}),grant_types:['authorization_code','refresh_token'],response_types:['code'],scope:s.SCOPES.join(' ')});
    }
    if(route==='consent'&&method==='GET') {
      const request=event.queryStringParameters;const valid=s.authorization(request,c);
      return s.json(200,{name:valid.app.name,redirect_uri:valid.redirect,scopes:valid.scope,deny_url:s.redirect(valid.redirect,{error:'access_denied',state:request.state})});
    }
    if(route==='approve'&&method==='POST') {
      s.checkOrigin(event,[],c);const owner=await s.user(event,c);const input=s.body(event);const request=input.request||{};
      const valid=s.authorization(request,c);
      const granted=valid.scope.filter(scope=>scope!=='planner:write'||input.allow_write===true);
      let timezone=input.timezone||'UTC';try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{throw s.fail(400,'Invalid time zone.');}
      const code=s.random(),id=crypto.randomUUID();
      await s.db('planner_connector_grants',{},'POST',{id,user_id:owner.id,client_id:request.client_id,client_name:valid.app.name,scopes:granted,redirect_uri:valid.redirect,code_challenge:request.code_challenge,code_hash:s.hash(code),code_expires_at:new Date(Date.now()+300000).toISOString(),refresh_expires_at:new Date(Date.now()+30*86400000).toISOString(),timezone},c);
      return s.json(200,{redirect_url:s.redirect(valid.redirect,{code:id+'.'+code,state:request.state})});
    }
    if(route==='token'&&method==='POST') {
      const input=s.body(event);s.clientAuth(event,input,c);
      if(input.resource&&input.resource!==c.resource)throw s.fail(400,'Incorrect resource.','invalid_target');
      const codeFlow=input.grant_type==='authorization_code';
      if(!codeFlow&&input.grant_type!=='refresh_token')throw s.fail(400,'Unsupported grant type.','unsupported_grant_type');
      const raw=codeFlow?input.code:input.refresh_token;
      if(typeof raw!=='string'||!/^[-\w]{36}\.[-\w]{43}$/.test(raw))throw s.fail(400,'Invalid or expired grant.','invalid_grant');
      const [id,secret]=raw.split('.');
      const query={id:'eq.'+id,client_id:'eq.'+input.client_id,revoked_at:'is.null',select:'*',[codeFlow?'code_hash':'refresh_hash']:'eq.'+s.hash(secret),[codeFlow?'code_expires_at':'refresh_expires_at']:'gt.'+new Date().toISOString()};
      const [grant]=await s.db('planner_connector_grants',query,'GET',undefined,c);
      if(!grant)throw s.fail(400,'Invalid, expired, or already used grant.','invalid_grant');
      if(codeFlow&&(input.redirect_uri!==grant.redirect_uri||!/^[-.\w~]{43,128}$/.test(input.code_verifier||'')||s.hash(input.code_verifier)!==grant.code_challenge))throw s.fail(400,'Code verifier or redirect URI does not match.','invalid_grant');
      const requested=input.scope?s.scopes(input.scope):grant.scopes;
      if(requested.some(scope=>!grant.scopes.includes(scope)))throw s.fail(400,'Scope exceeds the approved connection.','invalid_scope');
      const refresh=s.random();
      const rows=await s.db('planner_connector_grants',query,'PATCH',{code_hash:null,code_expires_at:null,refresh_hash:s.hash(refresh),refresh_expires_at:new Date(Date.now()+30*86400000).toISOString()},c);
      if(!rows.length)throw s.fail(400,'Grant already used.','invalid_grant');
      return s.json(200,{access_token:s.access(grant,c,requested),token_type:'Bearer',expires_in:3600,refresh_token:id+'.'+refresh,scope:requested.join(' ')});
    }
    if(route==='revoke'&&method==='POST') {
      const input=s.body(event);s.clientAuth(event,input,c);
      if(typeof input.token==='string'&&/^[-\w]{36}\.[-\w]{43}$/.test(input.token)) {
        const [id,secret]=input.token.split('.');await s.db('planner_connector_grants',{id:'eq.'+id,client_id:'eq.'+input.client_id,refresh_hash:'eq.'+s.hash(secret)},'PATCH',{revoked_at:new Date().toISOString()},c);
      }else if(typeof input.token==='string'){
        try{const token=s.verify(input.token,'access',c);if(token.aud===c.resource)await s.db('planner_connector_grants',{id:'eq.'+token.gid,user_id:'eq.'+token.sub,client_id:'eq.'+input.client_id},'PATCH',{revoked_at:new Date().toISOString()},c);}catch(error){if(error.status!==401)throw error;}
      }return s.json(200,{});
    }
    if(route==='connections'&&['GET','POST'].includes(method)) {
      s.checkOrigin(event,[],c);const owner=await s.user(event,c);
      if(method==='GET'){const rows=await s.db('planner_connector_grants',{user_id:'eq.'+owner.id,revoked_at:'is.null',refresh_hash:'not.is.null',select:'id,client_name,scopes,created_at,refresh_expires_at',order:'created_at.desc'},'GET',undefined,c);return s.json(200,{connections:rows.map(({id,client_name,scopes,created_at,refresh_expires_at})=>({id,client_name,scopes,created_at,refresh_expires_at}))});}
      const input=s.body(event);if(typeof input.id!=='string'||!/^[-\w]{36}$/.test(input.id))throw s.fail(400,'Choose a connection to disconnect.');
      await s.db('planner_connector_grants',{id:'eq.'+input.id,user_id:'eq.'+owner.id},'PATCH',{revoked_at:new Date().toISOString()},c);return s.json(200,{revoked:true});
    }
    return s.json(405,{error:'invalid_request',error_description:'Method or route not supported.'},{Allow:'GET, POST'});
  }catch(error){return s.json(error.status||500,{error:error.oauthError||(error.status===503?'temporarily_unavailable':'invalid_request'),error_description:error.status?error.message:'The connector could not complete this request.'});}
};
