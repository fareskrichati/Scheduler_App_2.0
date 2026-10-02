const fs=require('node:fs');const path=require('node:path');
function buildV2(root=__dirname){
 const out=path.join(root,'deploy');fs.mkdirSync(out,{recursive:true});
 fs.cpSync(path.join(root,'v2'),path.join(out,'v2'),{recursive:true,filter:source=>!source.endsWith('.sql')&&!source.endsWith('.md')});
 fs.cpSync(path.join(root,'releases','1.5.1'),path.join(out,'releases','1.5.1'),{recursive:true,filter:source=>!source.endsWith('supabase-schema.sql')&&!source.includes(path.sep+'netlify')&&!source.endsWith('build-deploy.js')});
 const home=fs.readFileSync(path.join(root,'v2','index.html'),'utf8').replace('<head>','<head>\n    <base href="./v2/">');
 fs.writeFileSync(path.join(out,'index.html'),home);
 fs.writeFileSync(path.join(out,'mobile.html'),home);
}
module.exports={buildV2};if(require.main===module){buildV2();console.log('Built separate /v2/ and preserved /releases/1.5.1/.');}
