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
// This bridge stays in the authenticated shell; the Study frame never receives tokens.
window.recognizeStudyPage=async(image,expectedUserId)=>{
 if(!authState.isAuthenticated||authState.userId!==expectedUserId)throw new Error('Sign in again before reading handwriting.');
 const token=await getValidAccessToken();
 if(!token||authState.userId!==expectedUserId)throw new Error('Sign in again before reading handwriting.');
 const response=await fetch('/.netlify/functions/study-handwriting',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({image,consent:true}),signal:AbortSignal.timeout(60000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||(response.status===404?'Handwriting recognition needs the latest deployment.':'Could not read this page.'));
 if(authState.userId!==expectedUserId)throw new Error('The signed-in account changed. Please retry.');
 if(typeof result.text!=='string'||!result.text.trim())throw new Error('No readable text was returned.');
 return result.text;
};
