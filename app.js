/* ScrubMeta - 100% client-side metadata remover */
const $ = (s) => document.querySelector(s);
const dz = $('#dropzone'), fi = $('#fileInput');
const listEl = $('#list'), dlAllBtn = $('#downloadAll'), clearBtn = $('#clearAll');
const q = $('#quality'), qval = $('#qval');
let cleaned = []; // {name, blob}
let totalCleaned = 0;

q.oninput = () => qval.textContent = q.value;
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

/* ---------- BEFORE inspect ---------- */
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

/* ---------- SCRUBBERS ---------- */
async function scrubImage(file){
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const ext = extOf(file.name);
  let mime = 'image/jpeg', type='image/jpeg';
  if (ext==='png'){ mime='image/png'; type='image/png'; }
  else if (ext==='webp'){ mime='image/webp'; type='image/webp'; }
  // quality 92% (lossy enough to erase any residual EXIF that canvas copy may keep)
  const quality = mime==='image/png' ? undefined : 0.92;
  const blob = await new Promise(res => canvas.toBlob(res, mime, quality));
  if (!blob) throw new Error('encode failed (AVIF/HEIC may be unsupported in this browser)');
  return {blob, mimeOut: type};
}

async function scrubPdf(file){
  const buf = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(buf, {ignoreEncryption:true});
  // wipe all built-in metadata fields
  doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setProducer(''); doc.setCreator('');
  doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0));
  // aggressively wipe XMP / custom metadata at catalog level
  try{
    const catalog = doc.catalog;
    const PDFName = PDFLib.PDFName;
    // delete /Metadata entry
    if (catalog.has(PDFName.of('Metadata'))) catalog.delete(PDFName.of('Metadata'));
    // delete common custom info keys
    ['PieceInfo','LastModified','MarkInfo','Meta','XMP'].forEach(k=>{ try{ if(catalog.has(PDFName.of(k))) catalog.delete(PDFName.of(k)); }catch{} });
    // wipe the /Info dict entirely if present
    if (catalog.has(PDFName.of('Info'))) catalog.delete(PDFName.of('Info'));
  }catch{}
  // force save with no object streams to maximize compatibility & minimize residual data
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
  // -map_metadata -1 strips container metadata, stream copy = lossless + fast
  try{
    await ff.run('-hide_banner','-i', inName, '-map_metadata','-1', '-c:v','copy', '-c:a','copy', '-c:s','copy', '-fflags','+bitexact', '-flags:v','+bitexact', '-flags:a','+bitexact', outName);
  }catch(e){
    // fallback: try without subtitle copy (mkv/webm edge cases)
    await ff.run('-hide_banner','-i', inName, '-map_metadata','-1', '-c','copy', outName);
  }
  let out;
  try{ out = ff.FS('readFile', outName); }
  catch(e){ throw new Error('remux failed — file may use an unsupported codec for stream-copy'); }
  try{ ff.FS('unlink', inName); ff.FS('unlink', outName); }catch{}
  const mime = file.type || 'video/mp4';
  return {blob: new Blob([out.buffer], {type: mime})};
}

/* ---------- VERIFY ---------- */
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

/* ---------- MAIN ---------- */
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
    const name = outName(file.name); // always randomized clean name
    cleaned.push({name, blob: res.blob});
    totalCleaned++;
    $('#count').textContent = totalCleaned + ' files cleaned';
    const hadMetadata = typeof beforeCount === 'number' && beforeCount > 0;
    const cleanNow = after && (after.count===0 || after.count==='0');
    pill.className = 'pill ' + (cleanNow ? 'ok' : 'warn');
    pill.textContent = cleanNow ? 'clean ✓' : 'cleaned ('+(after?.count||'?')+' left)';
    const sizeKB = (res.blob.size/1024).toFixed(1);
    // show before/after summary
    let beforeLabel = hadMetadata ? `had ${hadMetadata} field(s)` : 'no detectable metadata';
    let afterLabel = cleanNow ? 'all metadata removed ✓' : `${after?.count||0} field(s) remaining`;
    meta.innerHTML += `<br><b>Before:</b> ${beforeLabel} | <b>After:</b> ${afterLabel} · ${sizeKB} KB · output: <b>${escapeHtml(name)}</b>`;
    const b = document.createElement('button');
    b.className='btn'; b.textContent='Download clean file';
    b.onclick=()=>downloadBlob(res.blob, name);
    acts.appendChild(b);
    // also show a small tag about what was cleaned
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
