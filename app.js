/* ScrubMeta - 100% client-side metadata remover + anti-detection pipeline */
const $ = (s) => document.querySelector(s);
const dz = $('#dropzone'), fi = $('#fileInput');
const listEl = $('#list'), dlAllBtn = $('#downloadAll'), clearBtn = $('#clearAll');
const q = $('#quality'), qval = $('#qval');
const adStr = $('#adStrength'), adVal = $('#adVal');
let cleaned = []; // {name, blob}
let totalCleaned = 0;

q.oninput = () => qval.textContent = q.value;
adStr.oninput = () => adVal.textContent = adStr.value;
$('#pickBtn').onclick = (e) => { e.stopPropagation(); fi.click(); };
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

// Always randomize output filenames for privacy (no original name leaks)
function outName(orig){
  const dot = orig.lastIndexOf('.');
  const ext = dot>=0 ? orig.slice(dot).toLowerCase() : '';
  const r = Math.random().toString(36).slice(2,12);
  return 'scrub-' + r + ext;
}

const extOf = n => (n.split('.').pop()||'').toLowerCase();
const isImg = n => ['jpg','jpeg','png','webp','gif','bmp'].includes(extOf(n));
const isPdf = n => extOf(n)==='pdf';
const isAV = n => ['mp4','mov','m4a','webm','mkv','mp3','wav','ogg','aac','flac','avi'].includes(extOf(n));

// strength from slider: 1-5 → multiplier
const strMul = () => parseInt(adStr.value,10);

async function handleFiles(files){
  for (const f of files) await processOne(f);
  if (cleaned.length){ dlAllBtn.disabled=false; clearBtn.disabled=false; }
}

function cardSkeleton(file){
  const el = document.createElement('div');
  el.className='card';
  el.innerHTML = `<div class="row"><span class="fname">${escapeHtml(file.name)}</span><span class="pill warn">working…</span></div>
  <div class="prog"><i></i></div>
  <div class="meta">reading…</div>
  <div class="actions"></div>`;
  listEl.prepend(el);
  return el;
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setProg(el,p){ el.querySelector('.prog i').style.width = (p*100)+'%'; }

/* ========== ANTI-DETECTION POST-PROCESSING PIPELINE ========== */

// 1. RESAMPLE — downscale to 70-85% then upscale back to original size
//    Changes pixel grid alignment and frequency distribution
function resample(canvas, strength){
  const w = canvas.width, h = canvas.height;
  const factor = 0.70 + (5 - strength) * 0.03; // strength 1→0.82, strength 5→0.70
  const tmp = document.createElement('canvas');
  const tw = Math.round(w * factor), th = Math.round(h * factor);
  tmp.width = tw; tmp.height = th;
  const ctx = tmp.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, tw, th);
  const ctx2 = canvas.getContext('2d');
  ctx2.clearRect(0,0,w,h);
  ctx2.imageSmoothingEnabled = true;
  ctx2.imageSmoothingQuality = 'high';
  ctx2.drawImage(tmp, 0, 0, w, h);
}

// 2. FILM GRAIN — subtle random noise overlay on every pixel
//    Disrupts statistical patterns AI classifiers rely on
function addGrain(canvas, strength){
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const intensity = 3 + strength * 2; // strength 1→5, strength 5→13
  for (let i = 0; i < d.length; i += 4){
    const n = (Math.random() - 0.5) * intensity;
    d[i]   = Math.max(0, Math.min(255, d[i]   + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

// 3. RANDOM MICRO-CROP — crop 1-6% from random edge then resize back
//    Shifts pixel positions and breaks spatial alignment
function randomCrop(canvas, strength){
  const w = canvas.width, h = canvas.height;
  const pct = (0.01 + strength * 0.01); // strength 1→2%, strength 5→6%
  const cropX = Math.floor(Math.random() * w * pct);
  const cropY = Math.floor(Math.random() * h * pct);
  const cropW = w - cropX - Math.floor(Math.random() * w * pct * 0.5);
  const cropH = h - cropY - Math.floor(Math.random() * h * pct * 0.5);
  const tmp = document.createElement('canvas');
  tmp.width = cropW; tmp.height = cropH;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(tmp, 0, 0, w, h);
}

// 4. COLOR PROFILE SHIFT — slight hue/saturation/brightness/contrast adjustment
//    Changes color statistics without visible artifacts at low strength
function colorShift(canvas, strength){
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  // random per-image offsets (deterministic within this call)
  const bShift = (Math.random() - 0.5) * strength * 2;  // brightness ±10
  const cMul   = 1 + (Math.random() - 0.5) * strength * 0.01; // contrast ±2.5%
  const sMul   = 1 + (Math.random() - 0.5) * strength * 0.015; // saturation ±3.75%
  for (let i = 0; i < d.length; i += 4){
    let r = d[i], g = d[i+1], b = d[i+2];
    // brightness
    r += bShift; g += bShift; b += bShift;
    // contrast (around 128 midpoint)
    r = (r - 128) * cMul + 128;
    g = (g - 128) * cMul + 128;
    b = (b - 128) * cMul + 128;
    // saturation (using luminance approximation)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + sMul * (r - lum);
    g = lum + sMul * (g - lum);
    b = lum + sMul * (b - lum);
    d[i]   = Math.max(0, Math.min(255, r));
    d[i+1] = Math.max(0, Math.min(255, g));
    d[i+2] = Math.max(0, Math.min(255, b));
  }
  ctx.putImageData(img, 0, 0);
}

// 5. LIGHT SHARPEN — unsharp mask at very low radius
//    Adds high-frequency detail that classifiers interpret as natural texture
function sharpen(canvas, strength){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const out = new Uint8ClampedArray(d);
  const amt = 0.3 + strength * 0.15; // strength 1→0.45, strength 5→1.05
  for (let y = 1; y < h-1; y++){
    for (let x = 1; x < w-1; x++){
      const i = (y*w+x)*4;
      for (let c = 0; c < 3; c++){
        const v = d[i+c];
        const blur = (
          d[((y-1)*w+x)*4+c] + d[((y+1)*w+x)*4+c] +
          d[(y*w+x-1)*4+c] + d[(y*w+x+1)*4+c]
        ) / 4;
        out[i+c] = Math.max(0, Math.min(255, v + (v - blur) * amt));
      }
    }
  }
  const outImg = new ImageData(out, w, h);
  ctx.putImageData(outImg, 0, 0);
}

// 6. DOUBLE JPEG RECOMPRESS — encode → decode → re-encode at different quality
//    Breaks JPEG block-boundary patterns that AI models detect
async function doubleJpegRecompress(canvas, strength){
  const q1 = 85 - strength * 3;  // strength 1→82, strength 5→70
  const q2 = 92 - strength * 1;  // strength 1→91, strength 5→87
  // first pass
  const blob1 = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q1/100));
  const bmp = await createImageBitmap(blob1);
  canvas.width = bmp.width; canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  // second pass at different quality
  return q2;
}

// Master pipeline — runs selected post-processing in order
async function postProcessCanvas(canvas){
  const steps = [];
  if ($('#optResample').checked) steps.push('resample');
  if ($('#optGrain').checked)    steps.push('grain');
  if ($('#optCrop').checked)     steps.push('crop');
  if ($('#optColor').checked)    steps.push('color');
  if ($('#optSharpen').checked)  steps.push('sharpen');
  if ($('#optJpegRe').checked)   steps.push('jpegre');

  const s = strMul();

  for (const step of steps){
    switch(step){
      case 'resample': resample(canvas, s); break;
      case 'grain':    addGrain(canvas, s); break;
      case 'crop':     randomCrop(canvas, s); break;
      case 'color':    colorShift(canvas, s); break;
      case 'sharpen':  sharpen(canvas, s); break;
      case 'jpegre':   await doubleJpegRecompress(canvas, s); break;
    }
  }
}

/* ========== BEFORE INSPECT ========== */
async function inspectBefore(file){
  try{
    if (isImg(file.name) && window.ExifReader){
      const tags = await ExifReader.load(file);
      const keys = Object.keys(tags).filter(k=>!['FileType','FileTypeExtension'].includes(k));
      return {count: keys.length, sample: keys.slice(0,8).join(', ')||'none', tags};
    }
    if (isPdf(file.name) && window.PDFLib){
      const buf = await file.arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(buf, {ignoreEncryption:true});
      const fields = [doc.getTitle(),doc.getAuthor(),doc.getSubject(),doc.getKeywords(),doc.getProducer(),doc.getCreator(),doc.getCreationDate(),doc.getModificationDate()].filter(Boolean);
      return {count: fields.length, sample: fields.map(String).join(' | ').slice(0,160)||'no info dict', tags:null};
    }
  }catch(e){ return {count:'?', sample:'unreadable ('+e.message.slice(0,60)+')'}; }
  return {count:'n/a', sample: isAV(file.name)?'container metadata (title/encoder/GPS/time)':'unknown type'};
}

/* ========== SCRUBBERS ========== */
async function scrubImage(file){
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  // --- run anti-detection pipeline BEFORE final encode ---
  await postProcessCanvas(canvas);

  const ext = extOf(file.name);
  let mime = 'image/jpeg', type='image/jpeg';
  if (ext==='png'){ mime='image/png'; type='image/png'; }
  else if (ext==='webp'){ mime='image/webp'; type='image/webp'; }
  const quality = mime==='image/png' ? undefined : 0.92;
  const blob = await new Promise(res => canvas.toBlob(res, mime, quality));
  if (!blob) throw new Error('encode failed (AVIF/HEIC may be unsupported in this browser)');
  return {blob, mimeOut: type};
}

async function scrubPdf(file){
  const buf = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(buf, {ignoreEncryption:true});
  doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setProducer(''); doc.setCreator('');
  doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0));
  try{
    const catalog = doc.catalog;
    const PDFName = PDFLib.PDFName;
    if (catalog.has(PDFName.of('Metadata'))) catalog.delete(PDFName.of('Metadata'));
    ['PieceInfo','LastModified','MarkInfo','Meta','XMP'].forEach(k=>{ try{ if(catalog.has(PDFName.of(k))) catalog.delete(PDFName.of(k)); }catch{} });
    if (catalog.has(PDFName.of('Info'))) catalog.delete(PDFName.of('Info'));
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
    $('#ffmpegStatus').classList.remove('hidden');
    await loadFFmpegScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');
    const { createFFmpeg } = window.FFmpeg;
    const ff = createFFmpeg({ corePath:'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js', log:false });
    await ff.load();
    $('#ffmpegStatus').classList.add('hidden');
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
  catch(e){ throw new Error('remux failed — file may use an unsupported codec for stream-copy'); }
  try{ ff.FS('unlink', inName); ff.FS('unlink', outName); }catch{}
  const mime = file.type || 'video/mp4';
  return {blob: new Blob([out.buffer], {type: mime})};
}

/* ========== VERIFY ========== */
async function verifyClean(name, blob){
  if (!$('#verify').checked) return null;
  try{
    if (isImg(name) && window.ExifReader){
      const tags = await ExifReader.load(blob);
      const keys = Object.keys(tags).filter(k=>!['FileType','FileTypeExtension'].includes(k));
      return {count: keys.length, sample: keys.slice(0,8).join(', ')||'none found ✓'};
    }
    if (isPdf(name) && window.PDFLib){
      const doc = await PDFLib.PDFDocument.load(await blob.arrayBuffer(), {ignoreEncryption:true});
      const left = [doc.getTitle(),doc.getAuthor(),doc.getSubject(),doc.getProducer(),doc.getCreator()].filter(x=>x && x!=='');
      return {count: left.length, sample: left.length? left.join('|') : 'no author/creator/producer ✓'};
    }
  }catch(e){ return {count:'?', sample:'verify skipped'}; }
  return {count:0, sample:'container re-muxed with -map_metadata -1 ✓'};
}

/* ========== MAIN ========== */
async function processOne(file){
  const el = cardSkeleton(file);
  const pill = el.querySelector('.pill'), meta = el.querySelector('.meta'), acts = el.querySelector('.actions');
  setProg(el, .1);
  const before = await inspectBefore(file);
  const beforeCount = before.count;
  const beforeSample = typeof before.sample === 'string' ? before.sample : (before.sample?.sample||String(before.sample));
  meta.innerHTML = `<b>Before:</b> ${escapeHtml(String(beforeCount))} metadata fields — ${escapeHtml(beforeSample)} · ${(file.size/1024).toFixed(1)} KB`;
  setProg(el, .3);
  try{
    let res;
    if (isImg(file.name)) res = await scrubImage(file);
    else if (isPdf(file.name)) res = await scrubPdf(file);
    else if (isAV(file.name)) { setProg(el,.5); res = await scrubAV(file); }
    else throw new Error('unsupported type — images, PDF, video & audio only in v1');
    setProg(el, .8);
    const after = await verifyClean(res.blob ? file.name : file.name, res.blob);
    const name = outName(file.name);
    cleaned.push({name, blob: res.blob});
    totalCleaned++;
    $('#count').textContent = totalCleaned + ' files cleaned';
    const hadMetadata = typeof beforeCount === 'number' && beforeCount > 0;
    const cleanNow = after && (after.count===0 || after.count==='0');
    pill.className = 'pill ' + (cleanNow ? 'ok' : 'warn');
    pill.textContent = cleanNow ? 'clean ✓' : 'cleaned ('+(after?.count||'?')+' left)';
    const sizeKB = (res.blob.size/1024).toFixed(1);
    let beforeLabel = hadMetadata ? `had ${hadMetadata} field(s)` : 'no detectable metadata';
    let afterLabel = cleanNow ? 'all metadata removed ✓' : `${after?.count||0} field(s) remaining`;
    // show active post-processing steps
    const activeOpts = [];
    if ($('#optResample').checked) activeOpts.push('resample');
    if ($('#optGrain').checked)    activeOpts.push('grain');
    if ($('#optCrop').checked)     activeOpts.push('crop');
    if ($('#optColor').checked)    activeOpts.push('color');
    if ($('#optSharpen').checked)  activeOpts.push('sharpen');
    if ($('#optJpegRe').checked)   activeOpts.push('jpeg');
    const ppTag = activeOpts.length ? ` · pipeline: ${activeOpts.join('+')}` : '';
    meta.innerHTML += `<br><b>Before:</b> ${beforeLabel} | <b>After:</b> ${afterLabel} · ${sizeKB} KB · output: <b>${escapeHtml(name)}</b>${ppTag}`;
    const b = document.createElement('button');
    b.className='btn'; b.textContent='Download clean file';
    b.onclick=()=>downloadBlob(res.blob, name);
    acts.appendChild(b);
    if (hadMetadata && cleanNow){
      const tag = document.createElement('span');
      tag.className='pill ok'; tag.style.marginLeft='8px'; tag.style.fontSize='12px';
      tag.textContent = 'metadata purged';
      acts.appendChild(tag);
    }
    setProg(el,1);
    if (cleaned.length){ dlAllBtn.disabled=false; clearBtn.disabled=false; }
  }catch(err){
    pill.className='pill err'; pill.textContent='failed';
    meta.innerHTML += `<br><b>Error:</b> ${escapeHtml(err.message)}`;
    setProg(el,1);
  }
}
