/* PDF text stays local. Optional handwriting mode sends rendered pages through the authenticated shell. */
(()=>{
 let library;
 function textFromItems(items){
  let text='',lastY=null;
  for(const item of items){
   if(typeof item.str!=='string')continue;
   const y=item.transform?.[5];
   if(lastY!==null&&Number.isFinite(y)&&Math.abs(y-lastY)>3&&!text.endsWith('\n'))text+='\n';
   text+=item.str;
   text+=item.hasEOL?'\n':' ';
   if(Number.isFinite(y))lastY=y;
  }
  return text.replace(/[ \t]+\n/g,'\n').trim();
 }
 async function read(file,progress=()=>{},options={}){
  if(!/\.(pdf|txt|md|png|jpe?g|webp)$/i.test(file.name))throw new Error('Choose a PDF, .txt, .md, JPG, PNG, or WebP file.');
  if(file.size>20*1024*1024)throw new Error('Choose a file smaller than 20 MB.');
  if(/\.(png|jpe?g|webp)$/i.test(file.name)){
   if(!options.handwriting)throw new Error('Turn on Read handwriting with AI to import a photo.');
   const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
   try{return await recognizeImage(bitmap,options,progress);}finally{bitmap.close();}
  }
  if(!/\.pdf$/i.test(file.name))return file.text();
  progress('Opening PDF…');
  library ||= import('./vendor/pdfjs/pdf.min.mjs').catch(error=>{library=null;throw error;});
  const pdfjs=await library;
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',location.href).href;
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useWasm:false,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',location.href).href,cMapUrl:new URL('./vendor/pdfjs/cmaps/',location.href).href,cMapPacked:true});
  let document;
  try{
   document=await task.promise;
   if(document.numPages>150)throw new Error('This PDF has more than 150 pages. Upload a smaller section.');
   let first=1,last=document.numPages;
   if(options.handwriting){
    first=Number(options.first||1);last=options.last?Number(options.last):document.numPages;
    if(!Number.isInteger(first)||!Number.isInteger(last)||first<1||last<first||last>document.numPages)throw new Error('Choose a valid PDF page range. This file has '+document.numPages+' pages.');
    if(last-first+1>10)throw new Error('Read up to 10 handwritten pages at a time. Choose a smaller page range.');
   }
   const pages=[];let length=0;
   for(let pageNumber=first;pageNumber<=last;pageNumber++){
    progress(`Reading PDF page ${pageNumber} of ${document.numPages}…`);
    const page=await document.getPage(pageNumber);
    let text;
    if(options.handwriting){
     const base=page.getViewport({scale:1});const scale=Math.min(2,1800/Math.max(base.width,base.height));
     const viewport=page.getViewport({scale});const canvas=window.document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
     try{await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'rgb(255,255,255)'}).promise;text=await sendPage(canvas,options,message=>progress(`Page ${pageNumber}: ${message}`));}
     finally{canvas.width=0;canvas.height=0;}
    }else text=textFromItems((await page.getTextContent()).items);
    pages.push(text);length+=text.length;page.cleanup();
    if(length>600000)throw new Error('This PDF contains too much text. Upload a smaller section.');
   }
   const text=pages.join('\n\n');
   if(!text.trim())throw new Error('This PDF has no selectable text. Turn on Read handwriting with AI and upload it again, or paste the question text.');
   return text;
  }catch(error){
   if(error.name==='PasswordException')throw new Error('This PDF is password protected. Upload an unlocked copy.');
   if(error.name==='InvalidPDFException')throw new Error('This PDF could not be read. Try exporting a fresh PDF.');
   throw error;
  }finally{await task.destroy();}
 }
 async function recognizeImage(bitmap,options,progress){
  const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.ceil(bitmap.width*scale);canvas.height=Math.ceil(bitmap.height*scale);
  try{const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return await sendPage(canvas,options,progress);}finally{canvas.width=0;canvas.height=0;}
 }
 async function sendPage(canvas,options,progress){
  progress('Reading handwriting…');const image=canvas.toDataURL('image/jpeg',0.85);
  if(image.length>2800000)throw new Error('This page image is too large. Try a smaller or clearer crop.');
  if(typeof window.parent.recognizeStudyPage!=='function')throw new Error('Open Study from the signed-in UniPlan app to use handwriting recognition.');
  return window.parent.recognizeStudyPage(image,options.userId);
 }
 window.StudyFiles={read,textFromItems};
})();
