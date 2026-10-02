/* Three-way merge: retain remote imports while applying only this device's edits. */
(function(root){
 function equal(a,b){return JSON.stringify(a)===JSON.stringify(b)}
 function merge(base,local,remote){
  if(equal(local,base))return remote;
  if(equal(remote,base)||equal(local,remote))return local;
  if(Array.isArray(local)&&Array.isArray(base)&&Array.isArray(remote)&&[...local,...base,...remote].every(x=>x&&typeof x==='object'&&typeof x.id==='string')){
   const b=new Map(base.map(x=>[x.id,x])),l=new Map(local.map(x=>[x.id,x])),r=new Map(remote.map(x=>[x.id,x]));
   return [...new Set([...remote.map(x=>x.id),...local.map(x=>x.id)])].flatMap(id=>{
    if(b.has(id)&&!l.has(id))return [];
    if(!r.has(id)&&b.has(id)&&equal(l.get(id),b.get(id)))return [];
    const value=merge(b.get(id),l.get(id),r.get(id));return value===undefined?[]:[value];
   });
  }
  if(local&&remote&&typeof local==='object'&&typeof remote==='object'&&!Array.isArray(local)&&!Array.isArray(remote)){
   const out={};for(const k of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){const value=merge(base?.[k],local[k],remote[k]);if(value!==undefined)out[k]=value}return out;
  }
  return local;
 }
 root.UniPlanMerge={merge};if(typeof module!=='undefined')module.exports={merge};
})(globalThis);
