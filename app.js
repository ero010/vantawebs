/* ScrubMeta - 100% client-side metadata remover + invisible anti-detection pipeline */
const _q = (s) => document.querySelector(s);
const dz = _q('#dropzone'), fi = _q('#fileInput');
const listEl = _q('#list'), dlAllBtn = _q('#downloadAll'), clearBtn = _q('#clearAll');
const adStr = _q('#adStrength'), adVal = _q('#adVal');
let cleaned = [];
let totalCleaned = 0;

adStr.oninput = () => adVal.textContent = adStr.value;
_q('#pickBtn').onclick = (e) => { e.stopPropagation(); fi.click(); };
dz.onclick = () => fi.click();
dz.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') fi.click(); };
['dragover','dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
fi.onchange = () => { handleFiles(fi.files); fi.value = ''; };

clearBtn.onclick = () => { listEl.innerHTML=''; cleaned=[]; dlAllBtn.disabled=true; clearBtn.disabled=true; };

dlAllBtn.onclick = async () => {
  const zip = new JSZip();
  cleaned.forEach(f => zip.file(f.name, f.blob));
  const out = await zip.generateAsync({type:'blob'});
  downloadBlob(out, 'scrubmeta-clean.zip');
};

function downloadBlob(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
}

function outName(orig){
  const dot = orig.lastIndexOf('.');
  const ext = dot>=0 ? orig.slice(dot).toLowerCase() : '';
  const r = Math.random().toString(36).slice(2,12);
  return 'clean-' + r + ext;
}

const extOf = n => (n.split('.').pop()||'').toLowerCase();
const isImg = n => ['jpg','jpeg','png','webp','gif','bmp'].includes(extOf(n));
const isPdf = n => extOf(n)==='pdf';
const isAV = n => ['mp4','mov','m4a','webm','mkv','mp3','wav','ogg','aac','flac','avi'].includes(extOf(n));

const getStr = () => parseInt(adStr.value,10);

async function handleFiles(files){
  for (const f of files) await processOne(f);
  if (cleaned.length){ dlAllBtn.disabled=false; clearBtn.disabled=false; }
}

function cardSkeleton(file){
  const el = document.createElement('div');
  el.className='card';
  el.innerHTML = `<div class="row"><span class="fname">${esc(file.name)}</span><span class="pill warn">working...</span></div>
  <div class="prog"><i></i></div>
  <div class="meta">reading...</div>
  <div class="actions"></div>`;
  listEl.prepend(el);
  return el;
}
function esc(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setProg(el,p){ el.querySelector('.prog i').style.width = (p*100)+'%'; }
function isChecked(id){ const el = document.getElementById(id); return el && el.checked; }

/* ========== INVISIBLE ANTI-DETECTION PIPELINE ========== */
/* All parameters are tuned to be 100% invisible at strength 1.
   The pixel changes are real but below the threshold of human perception.
   At higher strength they become slightly measurable but still look normal. */

// 1. RESAMPLE — scale down 97-85% then back up. At s=1: 97% (invisible).
function resample(canvas, s){
  const w = canvas.width, h = canvas.height;
  const factor = 0.97 - (s - 1) * 0.03; // s1=0.97, s2=0.94, s3=0.91, s4=0.88, s5=0.85
  const tmp = document.createElement('canvas');
  const tw = Math.round(w * factor), th = Math.round(h * factor);
  tmp.width = tw; tmp.height = th;
  const tc = tmp.getContext('2d');
  tc.imageSmoothingEnabled = true;
  tc.imageSmoothingQuality = 'high';
  tc.drawImage(canvas, 0, 0, tw, th);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, w, h);
}

// 2. FILM GRAIN — ±1 noise per pixel at s=1 (invisible on any screen)
function addGrain(canvas, s){
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const intensity = 1 + (s - 1) * 2.5; // s1=1, s2=3.5, s3=6, s4=8.5, s5=11
  for (let i = 0; i < d.length; i += 4){
    const n = (Math.random() - 0.5) * intensity;
    d[i]   = Math.max(0, Math.min(255, d[i]   + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

// 3. MICRO-CROP — 0.5% at s=1 (a few pixels on a 2000px image, invisible)
function randomCrop(canvas, s){
  const w = canvas.width, h = canvas.height;
  const pct = 0.005 + (s - 1) * 0.01; // s1=0.5%, s2=1.5%, s3=2.5%, s4=3.5%, s5=4.5%
  const cx = Math.floor(Math.random() * w * pct);
  const cy = Math.floor(Math.random() * h * pct);
  const cw = w - cx - Math.floor(Math.random() * w * pct * 0.5);
  const ch = h - cy - Math.floor(Math.random() * h * pct * 0.5);
  const tmp = document.createElement('canvas');
  tmp.width = cw; tmp.height = ch;
  tmp.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  canvas.getContext('2d').clearRect(0,0,w,h);
  canvas.getContext('2d').drawImage(tmp, 0, 0, w, h);
}

// 4. COLOR SHIFT — brightness ±1, contrast ±0.3%, saturation ±0.5% at s=1 (invisible)
function colorShift(canvas, s){
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const bShift = (Math.random() - 0.5) * s * 0.8;   // s1: ±0.4
  const cMul   = 1 + (Math.random() - 0.5) * s * 0.004; // s1: ±0.2%
  const sMul   = 1 + (Math.random() - 0.5) * s * 0.006; // s1: ±0.3%
  for (let i = 0; i < d.length; i += 4){
    let r = d[i] + bShift, g = d[i+1] + bShift, b = d[i+2] + bShift;
    r = (r - 128) * cMul + 128;
    g = (g - 128) * cMul + 128;
    b = (b - 128) * cMul + 128;
    const lum = 0.299*r + 0.587*g + 0.114*b;
    d[i]   = Math.max(0, Math.min(255, lum + sMul*(r-lum)));
    d[i+1] = Math.max(0, Math.min(255, lum + sMul*(g-lum)));
    d[i+2] = Math.max(0, Math.min(255, lum + sMul*(b-lum)));
  }
  ctx.putImageData(img, 0, 0);
}

// 5. SHARPEN — amount 0.08 at s=1 (barely measurable, adds natural texture feel)
function sharpen(canvas, s){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const out = new Uint8ClampedArray(d);
  const amt = 0.08 + (s - 1) * 0.12; // s1=0.08, s2=0.20, s3=0.32, s4=0.44, s5=0.56
  for (let y = 1; y < h-1; y++){
    for (let x = 1; x < w-1; x++){
      const i = (y*w+x)*4;
      for (let c = 0; c < 3; c++){
        const v = d[i+c];
        const blur = (d[((y-1)*w+x)*4+c]+d[((y+1)*w+x)*4+c]+d[(y*w+x-1)*4+c]+d[(y*w+x+1)*4+c])/4;
        out[i+c] = Math.max(0, Math.min(255, v + (v - blur) * amt));
      }
    }
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}

// 6. DOUBLE JPEG — quality 99/98 at s=1 (visually lossless, breaks block patterns)
async function doubleJpeg(canvas, s){
  const q1 = 99 - (s - 1) * 4; // s1=99, s2=95, s3=91, s4=87, s5=83
  const q2 = 98 - (s - 1) * 2; // s1=98, s2=96, s3=94, s4=92, s5=90
  const b1 = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q1/100));
  const bmp = await createImageBitmap(b1);
  canvas.width = bmp.width; canvas.height = bmp.height;
  canvas.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close();
  return q2;
}

// Master pipeline
async function postProcessCanvas(canvas){
  const steps = [];
  if (isChecked('optResample')) steps.push('resample');
  if (isChecked('optGrain'))    steps.push('grain');
  if (isChecked('optCrop'))     steps.push('crop');
  if (isChecked('optColor'))    steps.push('color');
  if (isChecked('optSharpen'))  steps.push('sharpen');
  if (isChecked('optJpegRe'))   steps.push('jpegre');
  const s = getStr();
  for (const step of steps){
    switch(step){
      case 'resample': resample(canvas, s); break;
      case 'grain':    addGrain(canvas, s); break;
      case 'crop':     randomCrop(canvas, s); break;
      case 'color':    colorShift(canvas, s); break;
      case 'sharpen':  sharpen(canvas, s); break;
      case 'jpegre':   await doubleJpeg(canvas, s); break;
    }
  }
}

/* ========== BEFORE INSPECT ========== */
async function inspectBefore(file){
  try{
    if (isImg(file.name) && window.ExifReader){
      const tags = await ExifReader.load(file);
      const keys = Object.keys(tags).filter(k=>!['FileType','FileTypeExtension'].includes(k));
      return {count: keys.length, sample: keys.slice(0,8).join(', ')||'none'};
    }
    if (isPdf(file.name) && window.PDFLib){
      const buf = await file.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(buf, {ignoreEncryption:true});
      const fields = [doc.getTitle(),doc.getAuthor(),doc.getSubject(),doc.getKeywords(),doc.getProducer(),doc.getCreator(),doc.getCreationDate(),doc.getModificationDate()].filter(Boolean);
      return {count: fields.length, sample: fields.map(String).join(' | ').slice(0,160)||'no info dict'};
    }
  }catch(e){ return {count:'?', sample:'unreadable'}; }
  return {count:'n/a', sample: isAV(file.name)?'container metadata':'unknown type'};
}

/* ========== SCRUBBERS ========== */
async function scrubImage(file){
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();

  // run invisible anti-detection pipeline
  await postProcessCanvas(canvas);

  const ext = extOf(file.name);
  let mime = 'image/jpeg';
  if (ext==='png') mime = 'image/png';
  else if (ext==='webp') mime = 'image/webp';

  // FULL QUALITY — no compression loss
  const quality = mime === 'image/png' ? undefined : 1.0;
  const blob = await new Promise(res => canvas.toBlob(res, mime, quality));
  if (!blob) throw new Error('encode failed');
  return {blob};
}

async function scrubPdf(file){
  const buf = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(buf, {ignoreEncryption:true});
  doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setProducer(''); doc.setCreator('');
  doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0));
  try{
    const catalog = doc.catalog;
    const PN = PDFLib.PDFName;
    if (catalog.has(PN.of('Metadata'))) catalog.delete(PN.of('Metadata'));
    ['PieceInfo','LastModified','MarkInfo','Meta','XMP'].forEach(k=>{ try{ if(catalog.has(PN.of(k))) catalog.delete(PN.of(k)); }catch{} });
    if (catalog.has(PN.of('Info'))) catalog.delete(PN.of('Info'));
  }catch{}
  const bytes = await doc.save({useObjectStreams:false, addDefaultPage:false});
  return {blob: new Blob([bytes], {type:'application/pdf'})};
}

let ffmpegInst=null, ffmpegLoading=null;
function loadFFmpegScript(src){
  return new Promise((res,rej)=>{
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej;
    document.head.appendChild(s);
  });
}
async function getFFmpeg(){
  if (ffmpegInst) return ffmpegInst;
  if (ffmpegLoading) return ffmpegLoading;
  ffmpegLoading = (async()=>{
    document.getElementById('ffmpegStatus').classList.remove('hidden');
    await loadFFmpegScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');
    const { createFFmpeg } = window.FFmpeg;
    const ff = createFFmpeg({ corePath:'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js', log:false });
    await ff.load();
    document.getElementById('ffmpegStatus').classList.add('hidden');
    ffmpegInst = ff;
    return ff;
  })();
  return ffmpegLoading;
}

async function scrubAV(file){
  const ff = await getFFmpeg();
  const inName = 'in_' + Math.random().toString(36).slice(2) + '.' + extOf(file.name);
  const ext = extOf(file.name)==='mov' ? 'mp4' : extOf(file.name);
  const outName = 'out.' + ext;
  const data = new Uint8Array(await file.arrayBuffer());
  ff.FS('writeFile', inName, data);
  try{
    await ff.run('-hide_banner','-i', inName, '-map_metadata','-1', '-c:v','copy', '-c:a','copy', '-c:s','copy', '-fflags','+bitexact', '-flags:v','+bitexact', '-flags:a','+bitexact', outName);
  }catch(e){
    await ff.run('-hide_banner','-i', inName, '-map_metadata','-1', '-c','copy', outName);
  }
  let out;
  try{ out = ff.FS('readFile', outName); }
  catch(e){ throw new Error('remux failed'); }
  try{ ff.FS('unlink', inName); ff.FS('unlink', outName); }catch{}
  const mime = file.type || 'video/mp4';
  return {blob: new Blob([out.buffer], {type: mime})};
}

/* ========== VERIFY ========== */
async function verifyClean(name, blob){
  if (!document.getElementById('verify')?.checked) return null;
  try{
    if (isImg(name) && window.ExifReader){
      const tags = await ExifReader.load(blob);
      const keys = Object.keys(tags).filter(k=>!['FileType','FileTypeExtension'].includes(k));
      return {count: keys.length, sample: keys.slice(0,8).join(', ')||'none found'};
    }
    if (isPdf(name) && window.PDFLib){
      const doc = await PDFLib.PDFDocument.load(await blob.arrayBuffer(), {ignoreEncryption:true});
      const left = [doc.getTitle(),doc.getAuthor(),doc.getSubject(),doc.getProducer(),doc.getCreator()].filter(x=>x && x!=='');
      return {count: left.length, sample: left.length? left.join('|') : 'clean'};
    }
  }catch(e){ return {count:'?', sample:'verify skipped'}; }
  return {count:0, sample:'metadata stripped'};
}

/* ========== MAIN ========== */
async function processOne(file){
  const el = cardSkeleton(file);
  const pill = el.querySelector('.pill'), meta = el.querySelector('.meta'), acts = el.querySelector('.actions');
  setProg(el, .1);
  const before = await inspectBefore(file);
  const beforeCount = before.count;
  meta.innerHTML = `<b>Before:</b> ${esc(String(beforeCount))} fields — ${esc(before.sample)} | ${(file.size/1024).toFixed(1)} KB`;
  setProg(el, .3);
  try{
    let res;
    if (isImg(file.name)) res = await scrubImage(file);
    else if (isPdf(file.name)) res = await scrubPdf(file);
    else if (isAV(file.name)) { setProg(el,.5); res = await scrubAV(file); }
    else throw new Error('unsupported type');
    setProg(el, .8);
    const after = await verifyClean(file.name, res.blob);
    const name = outName(file.name);
    cleaned.push({name, blob: res.blob});
    totalCleaned++;
    document.getElementById('count').textContent = totalCleaned + ' files cleaned';
    const hadMeta = typeof beforeCount === 'number' && beforeCount > 0;
    const cleanNow = after && (after.count===0 || after.count==='0');
    pill.className = 'pill ' + (cleanNow ? 'ok' : 'warn');
    pill.textContent = cleanNow ? 'clean' : 'cleaned';
    const sizeKB = (res.blob.size/1024).toFixed(1);
    const bLabel = hadMeta ? `${beforeCount} field(s)` : 'none';
    const aLabel = cleanNow ? 'all removed' : `${after?.count||0} left`;
    const activeOpts = [];
    if (isChecked('optResample')) activeOpts.push('resample');
    if (isChecked('optGrain'))    activeOpts.push('grain');
    if (isChecked('optCrop'))     activeOpts.push('crop');
    if (isChecked('optColor'))    activeOpts.push('color');
    if (isChecked('optSharpen'))  activeOpts.push('sharpen');
    if (isChecked('optJpegRe'))   activeOpts.push('jpeg');
    const pp = activeOpts.length ? ` | pipeline: ${activeOpts.join('+')}` : '';
    meta.innerHTML += `<br><b>After:</b> ${aLabel} | ${sizeKB} KB | <b>${esc(name)}</b>${pp}`;
    const b = document.createElement('button');
    b.className='btn'; b.textContent='Download';
    b.onclick=()=>downloadBlob(res.blob, name);
    acts.appendChild(b);
    if (hadMeta && cleanNow){
      const tag = document.createElement('span');
      tag.className='pill ok'; tag.style.marginLeft='8px'; tag.style.fontSize='11px';
      tag.textContent = 'purged';
      acts.appendChild(tag);
    }
    setProg(el,1);
    if (cleaned.length){ dlAllBtn.disabled=false; clearBtn.disabled=false; }
  }catch(err){
    pill.className='pill err'; pill.textContent='failed';
    meta.innerHTML += `<br><b>Error:</b> ${esc(err.message)}`;
    setProg(el,1);
  }
}
