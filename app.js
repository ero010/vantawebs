/* ScrubMeta — simple metadata remover */
const dz = document.getElementById('dropzone');
const fi = document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const resultEl = document.getElementById('result');
const resultName = document.getElementById('resultName');
const resultInfo = document.getElementById('resultInfo');
const downloadBtn = document.getElementById('downloadBtn');
const historyEl = document.getElementById('history');

let currentBlob = null;
let currentName = '';

// drag & drop
document.getElementById('pickBtn').onclick = (e) => { e.stopPropagation(); fi.click(); };
dz.onclick = () => fi.click();
['dragover','dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', e => { if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]); });
fi.onchange = () => { if (fi.files.length) processFile(fi.files[0]); fi.value = ''; };

// download
downloadBtn.onclick = () => {
  if (!currentBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(currentBlob);
  a.download = currentName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

const extOf = n => (n.split('.').pop()||'').toLowerCase();
const isImg = n => ['jpg','jpeg','png','webp','gif','bmp'].includes(extOf(n));
const isPdf = n => extOf(n)==='pdf';
const isAV = n => ['mp4','mov','m4a','webm','mkv','mp3','wav','ogg','aac','flac','avi'].includes(extOf(n));

function randomName(orig){
  const ext = extOf(orig);
  return 'clean-' + Math.random().toString(36).slice(2,10) + '.' + ext;
}

function showStatus(msg){
  statusEl.classList.remove('hidden');
  resultEl.classList.add('hidden');
  statusText.textContent = msg;
}
function showResult(name, info, blob){
  statusEl.classList.add('hidden');
  resultEl.classList.remove('hidden');
  resultName.textContent = name;
  resultInfo.textContent = info;
  currentBlob = blob;
  currentName = name;
  addHistory(name, info, blob);
}
function addHistory(name, info, blob){
  const el = document.createElement('div');
  el.className = 'hist-item';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.textContent = 'download';
  el.innerHTML = `<div class="dot"></div><span>${name} — ${info}</span>`;
  el.appendChild(a);
  historyEl.prepend(el);
}

/* ===== INVISIBLE ANTI-DETECTION (strength 1 = invisible) ===== */
function resample(canvas){
  const w = canvas.width, h = canvas.height;
  const f = 0.97;
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(w*f); tmp.height = Math.round(h*f);
  const tc = tmp.getContext('2d');
  tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
  tc.drawImage(canvas, 0, 0, tmp.width, tmp.height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, w, h);
}
function addGrain(canvas){
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4){
    const n = (Math.random() - 0.5) * 1.5;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);
}
function microCrop(canvas){
  const w = canvas.width, h = canvas.height;
  const pct = 0.005;
  const cx = Math.floor(Math.random()*w*pct), cy = Math.floor(Math.random()*h*pct);
  const cw = w - cx - Math.floor(Math.random()*w*pct*0.5);
  const ch = h - cy - Math.floor(Math.random()*h*pct*0.5);
  const tmp = document.createElement('canvas');
  tmp.width = cw; tmp.height = ch;
  tmp.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  canvas.getContext('2d').clearRect(0,0,w,h);
  canvas.getContext('2d').drawImage(tmp, 0, 0, w, h);
}
function colorShift(canvas){
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const b = (Math.random()-0.5)*0.8;
  const cm = 1 + (Math.random()-0.5)*0.004;
  const sm = 1 + (Math.random()-0.5)*0.006;
  for (let i = 0; i < d.length; i += 4){
    let r = d[i]+b, g = d[i+1]+b, bl = d[i+2]+b;
    r = (r-128)*cm+128; g = (g-128)*cm+128; bl = (bl-128)*cm+128;
    const lum = 0.299*r+0.587*g+0.114*bl;
    d[i] = Math.max(0,Math.min(255, lum+sm*(r-lum)));
    d[i+1] = Math.max(0,Math.min(255, lum+sm*(g-lum)));
    d[i+2] = Math.max(0,Math.min(255, lum+sm*(bl-lum)));
  }
  ctx.putImageData(img, 0, 0);
}
function sharpen(canvas){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const d = ctx.getImageData(0,0,w,h).data;
  const out = new Uint8ClampedArray(d);
  for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++){
    const i = (y*w+x)*4;
    for (let c=0;c<3;c++){
      const v=d[i+c];
      const blur=(d[((y-1)*w+x)*4+c]+d[((y+1)*w+x)*4+c]+d[(y*w+x-1)*4+c]+d[(y*w+x+1)*4+c])/4;
      out[i+c]=Math.max(0,Math.min(255,v+(v-blur)*0.08));
    }
  }
  ctx.putImageData(new ImageData(out,w,h),0,0);
}

/* ===== SCRUBBERS ===== */
async function scrubImage(file){
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close();
  // invisible anti-detection
  resample(c); addGrain(c); microCrop(c); colorShift(c); sharpen(c);
  // full quality output
  const ext = extOf(file.name);
  let mime = 'image/jpeg';
  if (ext==='png') mime='image/png';
  else if (ext==='webp') mime='image/webp';
  const blob = await new Promise(r => c.toBlob(r, mime, 1.0));
  return blob;
}

async function scrubPdf(file){
  const buf = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(buf, {ignoreEncryption:true});
  doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]);
  doc.setProducer(''); doc.setCreator('');
  doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0));
  try{
    const cat = doc.catalog, PN = PDFLib.PDFName;
    if (cat.has(PN.of('Metadata'))) cat.delete(PN.of('Metadata'));
    if (cat.has(PN.of('Info'))) cat.delete(PN.of('Info'));
  }catch{}
  const bytes = await doc.save({useObjectStreams:false});
  return new Blob([bytes], {type:'application/pdf'});
}

let ffInst=null, ffLoad=null;
async function scrubAV(file){
  if (!ffLoad){
    ffLoad = (async()=>{
      await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});
      const ff = window.FFmpeg.createFFmpeg({corePath:'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',log:false});
      await ff.load();
      ffInst=ff;
    })();
  }
  await ffLoad;
  const ext = extOf(file.name)==='mov'?'mp4':extOf(file.name);
  const inN='i_'+Math.random().toString(36).slice(2)+'.'+extOf(file.name);
  const outN='o.'+ext;
  ffInst.FS('writeFile',inN,new Uint8Array(await file.arrayBuffer()));
  try{ await ffInst.run('-hide_banner','-i',inN,'-map_metadata','-1','-c','copy',outN); }
  catch(e){ await ffInst.run('-hide_banner','-i',inN,'-map_metadata','-1','-c:v','copy','-c:a','copy',outN); }
  const out=ffInst.FS('readFile',outN);
  try{ffInst.FS('unlink',inN);ffInst.FS('unlink',outN)}catch{}
  return new Blob([out.buffer],{type:file.type||'video/mp4'});
}

/* ===== MAIN ===== */
async function processFile(file){
  showStatus('Cleaning ' + file.name + '...');
  try{
    let blob;
    if (isImg(file.name)) blob = await scrubImage(file);
    else if (isPdf(file.name)) blob = await scrubPdf(file);
    else if (isAV(file.name)) blob = await scrubAV(file);
    else throw new Error('Unsupported file type');

    const name = randomName(file.name);
    const sizeKB = (blob.size/1024).toFixed(1);
    const origKB = (file.size/1024).toFixed(1);
    showResult(name, `${origKB}KB → ${sizeKB}KB · metadata removed`, blob);
  }catch(err){
    statusEl.classList.add('hidden');
    resultEl.classList.remove('hidden');
    resultName.textContent = 'Error';
    resultInfo.textContent = err.message;
    downloadBtn.style.display = 'none';
  }
}
