// Study data remains local, scoped to the signed-in account and selected class.
window.getUniPlanStudyContext=()=>({userId:authState.userId,courses:getImportableClasses().map(c=>c.title)});
function renderV2Study(){
 const frame=document.querySelector('#study-workspace');if(!frame)return;
 if(!authState.isAuthenticated){frame.removeAttribute('src');delete frame.dataset.studyOwner;return;}
 if(state.activeTab!=='study')return;
 const identity=JSON.stringify(window.getUniPlanStudyContext());
 if(frame.dataset.studyOwner!==identity){frame.dataset.studyOwner=identity;frame.src='study/index.html';}
}
window.addEventListener('message',event=>{
 const frame=document.querySelector('#study-workspace');
 if(event.origin!==location.origin||event.source!==frame?.contentWindow||event.data?.type!=='uniplan-study-height')return;
 const height=Number(event.data.height);if(Number.isFinite(height)&&height>0)frame.style.height=Math.min(100000,Math.ceil(height)+20)+'px';
});
