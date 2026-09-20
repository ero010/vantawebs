/* Vantawebs — Privacy-first metadata remover */
(function(){
'use strict';

// i18n: t() comes from i18n.js (loaded before app.js). Fallback = key itself.
var t = (window.VTx && window.VTx.t.bind(window.VTx)) || function(k){ return k; };
function catLabel(cat) {
  var m = {'Device Info':'cat_device','Location':'cat_location','Date & Time':'cat_dates','Software':'cat_software','Author & Rights':'cat_author','AI Provenance':'cat_ai','Embedded':'cat_embedded','PDF Metadata':'cat_pdf'};
  return m[cat] ? t(m[cat]) : cat;
}

const dz = document.getElementById('dropzone');
const fi = document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const batchResults = document.getElementById('batchResults');
const batchActions = document.getElementById('batchActions');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const fileCountEl = document.getElementById('fileCount');
const instantPreview = document.getElementById('instantPreview');
const previewMeta = document.getElementById('previewMeta');
const previewClean = document.getElementById('previewClean');
const previewClose = document.getElementById('previewClose');
const offlineIndicator = document.getElementById('offlineIndicator');

let processedFiles = [];

/* ===== UTILS ===== */
const extOf = n => (n.split('.').pop()||'').toLowerCase();
const isImg = n => ['jpg','jpeg','png','webp','gif','bmp','tiff','tif','heic'].includes(extOf(n));
const isPdf = n => extOf(n)==='pdf';
const isAV = n => ['mp4','mov','m4a','webm','mkv','mp3','wav','ogg','aac','flac','avi'].includes(extOf(n));
const mimeOf = ext => {
  const m = {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',bmp:'image/bmp',heic:'image/heic'};
  return m[ext]||'application/octet-stream';
};
const formatSize = b => b < 1024 ? b+'B' : (b/1024).toFixed(1)+'KB';
const cleanName = orig => 'clean-'+Math.random().toString(36).slice(2,10)+'.'+extOf(orig);

/* ===== FILE INPUT / DROP ===== */
document.getElementById('pickBtn').onclick = e => { e.stopPropagation(); fi.click(); };
dz.onclick = () => fi.click();
dz.onkeydown = e => { if(e.key==='Enter'||e.key===' ') fi.click(); };
['dragover','dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', e => {
  const files = Array.from(e.dataTransfer.files);
  if(files.length) handleFiles(files);
});
fi.onchange = () => {
  if(fi.files.length) handleFiles(Array.from(fi.files));
  fi.value = '';
};

/* ===== INSTANT PREVIEW (hero feature) ===== */
let previewFile = null;
async function showInstantPreview(file) {
  if(!isImg(file.name) && !isPdf(file.name)) return;
  previewFile = file;
  try {
    const meta = await readMetadata(file);
    if(!meta || meta.totalTags === 0) return;
    previewMeta.innerHTML = renderMetadataPreview(meta);
    instantPreview.classList.remove('hidden');
  } catch(e) { /* no metadata or unsupported */ }
}
previewClose.onclick = () => { instantPreview.classList.add('hidden'); previewFile = null; };
previewClean.onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  console.log('previewClean clicked, previewFile:', previewFile);
  if(previewFile) {
    instantPreview.classList.add('hidden');
    skipPreview = true;
    const f = previewFile;
    previewFile = null;
    handleFiles([f]);
  }
};

/* ===== METADATA READING ===== */
async function readMetadata(file) {
  const buf = await file.arrayBuffer();
  const ext = extOf(file.name);
  const result = { categories: {}, totalTags: 0, raw: {} };

  if(isImg(file.name)) {
    try {
      const tags = ExifReader.load(buf, { expanded: true, includeOffsets: false });
      result.raw = tags;

      // Device info
      const device = {};
      if(tags.Make) device['Make'] = tags.Make.description || tags.Make;
      if(tags.Model) device['Model'] = tags.Model.description || tags.Model;
      if(tags.LensModel) device['Lens'] = tags.LensModel.description || tags.LensModel;
      if(tags.FocalLength) device['Focal Length'] = tags.FocalLength.description || tags.FocalLength;
      if(tags.FNumber) device['Aperture'] = tags.FNumber.description || tags.FNumber;
      if(tags.ISOSpeedRatings) device['ISO'] = tags.ISOSpeedRatings.description || tags.ISOSpeedRatings;
      if(tags.ExposureTime) device['Shutter Speed'] = tags.ExposureTime.description || tags.ExposureTime;
      if(Object.keys(device).length) { result.categories['Device Info'] = device; result.totalTags += Object.keys(device).length; }

      // Location
      const loc = {};
      if(tags.GPSLatitude && tags.GPSLongitude) {
        const lat = tags.GPSLatitude.description || JSON.stringify(tags.GPSLatitude);
        const lon = tags.GPSLongitude.description || JSON.stringify(tags.GPSLongitude);
        loc['GPS Location'] = lat + ', ' + lon;
      }
      if(tags.GPSAltitude) loc['Altitude'] = tags.GPSAltitude.description || tags.GPSAltitude;
      if(Object.keys(loc).length) { result.categories['Location'] = loc; result.totalTags += Object.keys(loc).length; }

      // Dates
      const dates = {};
      if(tags.DateTimeOriginal) dates['Date Taken'] = tags.DateTimeOriginal.description || tags.DateTimeOriginal;
      if(tags.DateTime) dates['Date Modified'] = tags.DateTime.description || tags.DateTime;
      if(tags.OffsetTimeOriginal) dates['Timezone'] = tags.OffsetTimeOriginal.description || tags.OffsetTimeOriginal;
      if(Object.keys(dates).length) { result.categories['Date & Time'] = dates; result.totalTags += Object.keys(dates).length; }

      // Software
      const soft = {};
      if(tags.Software) soft['Software'] = tags.Software.description || tags.Software;
      if(tags.ProcessingSoftware) soft['Processing'] = tags.ProcessingSoftware.description || tags.ProcessingSoftware;
      if(tags.ImageDescription) soft['Description'] = tags.ImageDescription.description || tags.ImageDescription;
      if(Object.keys(soft).length) { result.categories['Software'] = soft; result.totalTags += Object.keys(soft).length; }

      // Author / Copyright
      const auth = {};
      if(tags.Artist) auth['Author'] = tags.Artist.description || tags.Artist;
      if(tags.Copyright) auth['Copyright'] = tags.Copyright.description || tags.Copyright;
      if(tags.UserComment) auth['User Comment'] = (tags.UserComment.description || tags.UserComment).substring(0, 100);
      if(Object.keys(auth).length) { result.categories['Author & Rights'] = auth; result.totalTags += Object.keys(auth).length; }

      // AI Provenance / C2PA
      const ai = {};
      if(tags.DigitalSourceType) ai['Digital Source Type'] = tags.DigitalSourceType.description || tags.DigitalSourceType;
      if(tags.Application) ai['Application'] = tags.Application.description || tags.Application;
      // Check for C2PA/JUMBF markers in raw
      const raw8 = new Uint8Array(buf);
      const hasJUMBF = findBytes(raw8, [0xFF,0xE1]) || findBytes(raw8, [0x6A,0x75,0x6D,0x62,0x66]);
      if(hasJUMBF) ai['C2PA Content Credentials'] = 'Detected (APP11/JUMBF)';
      if(Object.keys(ai).length) { result.categories['AI Provenance'] = ai; result.totalTags += Object.keys(ai).length; }

      // Thumbnail
      if(tags.Thumbnail) { result.categories['Embedded'] = { 'Thumbnail': 'Present' }; result.totalTags++; }

    } catch(e) { /* ExifReader can't parse this file */ }
  }

  if(isPdf(file.name)) {
    try {
      const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
      const info = doc.getTitle() || doc.getAuthor() || doc.getSubject() || doc.getProducer() || doc.getCreator();
      const pdfMeta = {};
      if(doc.getTitle()) pdfMeta['Title'] = doc.getTitle();
      if(doc.getAuthor()) pdfMeta['Author'] = doc.getAuthor();
      if(doc.getSubject()) pdfMeta['Subject'] = doc.getSubject();
      if(doc.getProducer()) pdfMeta['Producer'] = doc.getProducer();
      if(doc.getCreator()) pdfMeta['Creator'] = doc.getCreator();
      if(doc.getKeywords() && doc.getKeywords().length) pdfMeta['Keywords'] = doc.getKeywords().join(', ');
      if(doc.getCreationDate()) pdfMeta['Created'] = doc.getCreationDate().toISOString();
      if(doc.getModificationDate()) pdfMeta['Modified'] = doc.getModificationDate().toISOString();
      if(Object.keys(pdfMeta).length) { result.categories['PDF Metadata'] = pdfMeta; result.totalTags += Object.keys(pdfMeta).length; }
    } catch(e) {}
  }

  return result;
}

function findBytes(arr, pattern) {
  for(let i = 0; i <= arr.length - pattern.length; i++) {
    let match = true;
    for(let j = 0; j < pattern.length; j++) {
      if(arr[i+j] !== pattern[j]) { match = false; break; }
    }
    if(match) return true;
  }
  return false;
}

function renderMetadataPreview(meta) {
  let html = '';
  for(const [cat, items] of Object.entries(meta.categories)) {
    html += '<div class="meta-row"><span class="meta-cat">'+escapeHtml(catLabel(cat))+'</span><div class="meta-val">';
    for(const [k,v] of Object.entries(items)) {
      html += '<div>'+k+': '+escapeHtml(String(v).substring(0,120))+' <span class="removed">'+t('removed')+'</span></div>';
    }
    html += '</div></div>';
  }
  return html;
}

function renderMetadataPanel(meta, cleaned) {
  let html = '';
  for(const [cat, items] of Object.entries(meta.categories)) {
    html += '<div class="meta-category"><div class="meta-cat-label">'+escapeHtml(catLabel(cat))+'</div>';
    for(const [k,v] of Object.entries(items)) {
      html += '<div class="meta-item"><span class="mk">'+k+':</span><span class="mv">'+escapeHtml(String(v).substring(0,120))+'</span>';
      html += cleaned ? '<span class="mg">'+t('clean')+'</span>' : '<span class="mr">'+t('removed')+'</span>';
      html += '</div>';
    }
    html += '</div>';
  }
  if(cleaned && meta.totalTags === 0) {
    html = '<div class="meta-item"><span class="mg">'+t('file_clean')+'</span></div>';
  }
  return html;
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ===== METADATA STRIPPING ===== */

// Image: canvas re-encode strips metadata reliably
async function scrubImage(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close();
  const ext = extOf(file.name);
  let mime = 'image/jpeg';
  if(ext === 'png') mime = 'image/png';
  else if(ext === 'webp') mime = 'image/webp';
  else if(ext === 'gif') mime = 'image/gif';
  return new Promise((resolve, reject) => {
    c.toBlob(blob => {
      if(blob) resolve(blob);
      else reject(new Error('Canvas encoding failed'));
    }, mime, 1.0);
  });
}

// PDF
async function scrubPdf(file) {
  const buf = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
  doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]);
  doc.setProducer(''); doc.setCreator('');
  doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0));
  try {
    const cat = doc.catalog;
    const PN = PDFLib.PDFName;
    if(cat.has(PN.of('Metadata'))) cat.delete(PN.of('Metadata'));
    if(cat.has(PN.of('Info'))) cat.delete(PN.of('Info'));
  } catch(e) {}
  return new Blob([await doc.save({ useObjectStreams: false })], { type: 'application/pdf' });
}

// Video/Audio via FFmpeg
let ffInst = null, ffLoad = null;
async function scrubAV(file) {
  if(!ffLoad) ffLoad = (async () => {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    const ff = window.FFmpeg.createFFmpeg({
      corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
      log: false
    });
    await ff.load();
    ffInst = ff;
  })();
  await ffLoad;
  const ext = extOf(file.name) === 'mov' ? 'mp4' : extOf(file.name);
  const inN = 'i_' + Math.random().toString(36).slice(2) + '.' + extOf(file.name);
  const outN = 'o.' + ext;
  ffInst.FS('writeFile', inN, new Uint8Array(await file.arrayBuffer()));
  try {
    await ffInst.run('-hide_banner', '-i', inN, '-map_metadata', '-1', '-c', 'copy', outN);
  } catch(e) {
    await ffInst.run('-hide_banner', '-i', inN, '-map_metadata', '-1', '-c:v', 'copy', '-c:a', 'copy', outN);
  }
  const out = ffInst.FS('readFile', outN);
  try { ffInst.FS('unlink', inN); ffInst.FS('unlink', outN); } catch(e) {}
  return new Blob([out.buffer], { type: file.type || 'video/mp4' });
}

/* ===== BATCH PROCESSING ===== */
let skipPreview = false;
async function handleFiles(files) {
  // Filter supported types
  const supported = files.filter(f => isImg(f.name) || isPdf(f.name) || isAV(f.name));
  const rejected = files.length - supported.length;

  if(!supported.length) {
    showStatus(t('unsupported'));
    statusText.textContent = t('supported_list');
    setTimeout(() => statusEl.classList.add('hidden'), 3000);
    return;
  }

  // Show instant preview for single file (unless already clicked "Clean it now")
  if(supported.length === 1 && !skipPreview) {
    showInstantPreview(supported[0]);
    return;
  }
  skipPreview = false;

  // Batch processing
  instantPreview.classList.add('hidden');
  fileCountEl.classList.add('hidden');
  batchResults.innerHTML = '';
  processedFiles = [];
  showStatus(t('processing_files', {n: supported.length}));
  progressBar.classList.remove('hidden');
  progressFill.style.width = '0%';

  // Create file cards (all dirty initially)
  for(const file of supported) {
    addFileCard(file.name, file.size, 'processing');
  }

  for(let i = 0; i < supported.length; i++) {
    const file = supported[i];
    statusText.textContent = t('processing_one', {i: i+1, n: supported.length, name: file.name});
    progressFill.style.width = ((i / supported.length) * 100) + '%';

    try {
      // Read metadata before cleaning
      const metaBefore = await readMetadata(file);

      let blob;
      if(isImg(file.name)) blob = await scrubImage(file);
      else if(isPdf(file.name)) blob = await scrubPdf(file);
      else if(isAV(file.name)) blob = await scrubAV(file);

      // Read metadata after cleaning
      const metaAfter = await readMetadata(blobToFile(blob, file.name));

      const entry = {
        name: cleanName(file.name),
        originalName: file.name,
        originalSize: file.size,
        cleanSize: blob.size,
        blob: blob,
        metaBefore: metaBefore,
        metaAfter: metaAfter
      };
      processedFiles.push(entry);

      updateFileCard(i, 'clean', entry);
    } catch(err) {
      updateFileCard(i, 'error', { error: err.message });
    }
  }

  progressFill.style.width = '100%';
  setTimeout(() => {
    statusEl.classList.add('hidden');
    progressBar.classList.add('hidden');
    batchActions.classList.remove('hidden');
    downloadAllBtn.classList.remove('hidden');
    if(processedFiles.length > 1) {
      downloadAllBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ' + t('download_all');
    } else {
      downloadAllBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ' + t('download');
    }
  }, 400);
}

function blobToFile(blob, name) {
  return new File([blob], name, { type: blob.type });
}

/* ===== FILE CARDS ===== */
function addFileCard(name, size, state) {
  const el = document.createElement('div');
  el.className = 'file-card card-dirty';
  el.innerHTML = '<div class="file-card-top">'
    + '<div class="file-dot dot-processing"></div>'
    + '<span class="file-name">' + escapeHtml(name) + '</span>'
    + '<span class="file-size">' + formatSize(size) + '</span>'
    + '</div>';
  batchResults.appendChild(el);
}

function updateFileCard(index, state, data) {
  const cards = batchResults.querySelectorAll('.file-card');
  if(!cards[index]) return;
  const card = cards[index];

  if(state === 'clean') {
    card.className = 'file-card card-clean';
    let metaHtml = '';
    if(data.metaBefore.totalTags > 0) {
      metaHtml = '<button class="file-meta-toggle" data-idx="'+index+'">'+t('show_meta', {n: data.metaBefore.totalTags})+'</button>'
        + '<div class="file-meta-panel hidden" data-panel="'+index+'">'
        + renderMetadataPanel(data.metaBefore, true) + '</div>';
    } else {
      metaHtml = '<div style="font-size:11px;color:var(--green);margin-top:6px">'+t('no_meta')+'</div>';
    }

    card.innerHTML = '<div class="file-card-top">'
      + '<div class="file-dot dot-clean"></div>'
      + '<span class="file-name">' + escapeHtml(data.name) + '</span>'
      + '<span class="file-size">' + formatSize(data.originalSize) + ' &rarr; ' + formatSize(data.cleanSize) + '</span>'
      + '<div class="file-actions">'
      + '<button class="btn-sm btn-download" data-idx="'+index+'">'
      + '<svg viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + t('download') + '</button>'
      + '</div></div>' + metaHtml;

    // Wire download
    card.querySelector('.btn-download').onclick = () => downloadSingle(index);

    // Wire meta toggle
    const toggle = card.querySelector('.file-meta-toggle');
    if(toggle) {
      toggle.onclick = () => {
        const panel = card.querySelector('[data-panel="'+index+'"]');
        panel.classList.toggle('hidden');
        toggle.textContent = panel.classList.contains('hidden')
          ? t('show_meta', {n: data.metaBefore.totalTags})
          : t('hide_meta');
      };
    }
  }

  if(state === 'error') {
    card.className = 'file-card card-dirty';
    card.innerHTML = '<div class="file-card-top">'
      + '<div class="file-dot" style="background:var(--red)"></div>'
      + '<span class="file-name">' + escapeHtml(card.querySelector('.file-name').textContent) + '</span>'
      + '<span class="file-size" style="color:var(--red)">Error: ' + escapeHtml(data.error) + '</span>'
      + '</div>';
  }
}

/* ===== DOWNLOADS ===== */
function downloadSingle(index) {
  const entry = processedFiles[index];
  if(!entry) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(entry.blob);
  a.download = entry.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

downloadAllBtn.onclick = async () => {
  if(!processedFiles.length) return;
  if(processedFiles.length === 1) {
    downloadSingle(0);
    return;
  }
  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = t('creating_zip');
  try {
    const zip = new JSZip();
    for(const entry of processedFiles) {
      zip.file(entry.name, entry.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vanta-cleaned-' + Date.now() + '.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch(e) {
    alert(t('zip_failed', {msg: e.message}));
  }
  downloadAllBtn.disabled = false;
  downloadAllBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ' + t('download_all');
};

clearAllBtn.onclick = () => {
  batchResults.innerHTML = '';
  batchActions.classList.add('hidden');
  processedFiles = [];
  dz.classList.remove('hidden');
};

/* ===== UI HELPERS ===== */
function showStatus(msg) {
  statusEl.classList.remove('hidden');
  batchResults.innerHTML = '';
  batchActions.classList.add('hidden');
  statusText.textContent = msg;
}

/* ===== PWA ===== */
if('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    console.log('Vantawebs SW registered');
  }).catch(e => console.log('SW registration failed:', e));
}

// Online/offline indicator
function updateOnlineStatus() {
  if(!offlineIndicator) return;
  if(navigator.onLine) {
    offlineIndicator.classList.add('hidden');
  } else {
    offlineIndicator.classList.remove('hidden');
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

})();
