/* Local server for the real 2.0 app and the existing Netlify functions. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,port=Number(process.env.PORT||8796);
const allowedFunctions=new Set(['academic-calendar','homework-photo-import','event-photo-import','canvas-calendar-feed']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.md':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/.netlify/functions/')){const name=url.pathname.split('/').pop();if(!allowedFunctions.has(name)){res.writeHead(404);return res.end()}
 let body='';for await(const chunk of req){body+=chunk;if(body.length>28_000_000){res.writeHead(413);return res.end('Request too large')}}
 const result=await require(path.join(root,'netlify/functions',name+'.js')).handler({httpMethod:req.method,body,headers:req.headers,queryStringParameters:Object.fromEntries(url.searchParams)});res.writeHead(result.statusCode,result.headers||{'Content-Type':'application/json'});return res.end(result.body);
 }
 let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/v2/index.html';if(pathname.endsWith('/'))pathname+='index.html';
 if(!/^\/(v2|releases\/1\.5\.1)\//.test(pathname)){res.writeHead(404);return res.end('Not found')}
 const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!types[path.extname(file)]||file.split(path.sep).some(x=>x.startsWith('.'))||file.includes('/netlify/')){res.writeHead(404);return res.end('Not found')}
 const data=await fs.promises.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});res.end(data);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'The request could not finish. Check local server configuration.'}));}
}).listen(port,'127.0.0.1',()=>console.log(`UniPlan 2.0: http://127.0.0.1:${port}/v2/index.html`));
