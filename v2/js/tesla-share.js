/* Tesla destinations use the device's share sheet; no vehicle credentials are stored. */
(() => {
  function destination(address) {
    return {title:'Tesla destination',text:address,url:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address)};
  }
  function fallback(address, message) {
    document.querySelector('#tesla-share-dialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='tesla-share-dialog';dialog.className='tesla-share-dialog';
    const title=document.createElement('h2');title.textContent='Send destination to Tesla';
    const info=document.createElement('p');info.textContent=message+' On your phone, open this destination in Maps, tap Share, and choose Tesla. You can also paste the address in the Tesla app under Location → Navigate.';
    const label=document.createElement('label');label.textContent='Destination address';
    const addressField=document.createElement('textarea');addressField.value=address;addressField.readOnly=true;label.append(addressField);
    const actions=document.createElement('div');actions.className='tesla-share-actions';
    const copy=document.createElement('button');copy.type='button';copy.className='small-button';copy.textContent='Copy address';
    const status=document.createElement('p');status.setAttribute('role','status');
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(address);status.textContent='Address copied. Paste it into Maps or the Tesla app.';}catch{addressField.focus();addressField.select();status.textContent='Select and copy the address above.';}};
    const maps=document.createElement('a');maps.href=destination(address).url;maps.target='_blank';maps.rel='noopener noreferrer';maps.textContent='Open in Google Maps ↗';
    const close=document.createElement('button');close.type='button';close.className='small-button';close.textContent='Close';close.onclick=()=>dialog.close();
    actions.append(copy,maps,close);dialog.append(title,info,label,actions,status);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-tesla-address]');if(!button)return;
    const address=button.dataset.teslaAddress?.trim();if(!address)return;
    if(typeof navigator.share!=='function'){fallback(address,'This browser does not offer a device share menu.');return;}
    button.disabled=true;
    try{await navigator.share(destination(address));}
    catch(error){if(error.name!=='AbortError')fallback(address,'The share menu could not open.');}
    finally{button.disabled=false;}
  });
})();
