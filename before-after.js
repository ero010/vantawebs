/* Vantawebs Before/After slider maker — 100% client-side.
 * Drop a "before" and an "after" photo, drag the divider, export one
 * shareable comparison image (labels burned in). Ideal for cleaners,
 * detailers, painters, renovators posting proof-of-work on WhatsApp.
 */
(function () {
  'use strict';

  var LONG_SIDE = 1920;

  /* ---------- pure layout math (unit-tested in Node) ---------- */

  function targetSize(mode, bW, bH) {
    var r; // width / height
    if (mode === 'square') r = 1;
    else if (mode === '4:5') r = 4 / 5;
    else if (mode === '9:16') r = 9 / 16;
    else r = bW / bH; // 'match': follow the BEFORE photo
    if (!(r > 0) || !isFinite(r)) r = 4 / 3;
    var w, h;
    if (r >= 1) { w = LONG_SIDE; h = Math.round(LONG_SIDE / r); }
    else { h = LONG_SIDE; w = Math.round(LONG_SIDE * r); }
    return { w: w, h: h };
  }

  // Cover-fit source rect: returns draw args to fill cw×ch with iw×ih, centered.
  function coverRect(iw, ih, cw, ch) {
    var s = Math.max(cw / iw, ch / ih);
    var dw = iw * s, dh = ih * s;
    return { dx: (cw - dw) / 2, dy: (ch - dh) / 2, dw: dw, dh: dh };
  }

  function clampDiv(p) {
    p = Number(p);
    if (!isFinite(p)) return 50;
    return Math.min(98, Math.max(2, p));
  }

  /* ---------- DOM wiring ---------- */

  var $ = function (id) { return document.getElementById(id); };
  var dropB = $('baDropB'), fileB = $('baFileB'), pickB = $('baPickB'), thumbB = $('baThumbB');
  var dropA = $('baDropA'), fileA = $('baFileA'), pickA = $('baPickA'), thumbA = $('baThumbA');
  var editor = $('baEditor'), canvas = $('baCanvas');
  var ctx = canvas.getContext('2d');
  var divRange = $('baDivider'), divVal = $('baDividerVal');
  var fmtSel = $('baFormat'), qualWrap = $('baQualityWrap');
  var quality = $('baQuality'), qualityVal = $('baQualityVal');
  var labelsChk = $('baLabels');
  var dlBtn = $('baDownload'), shareBtn = $('baShare'), resetBtn = $('baReset');
  var statusEl = $('baStatus'), statusText = $('baStatusText');

  var imgB = null, imgA = null; // loaded HTMLImageElements
  var nameB = 'before', nameA = 'after';
  var aspectMode = 'match';
  var divider = 50;

  function setStatus(msg, show) {
    statusText.textContent = msg;
    statusEl.classList.toggle('hidden', !show);
  }

  function baseName(f) {
    var n = (f && f.name ? f.name : 'photo').replace(/\.[^.]+$/, '');
    return n || 'photo';
  }

  function loadInto(file, slot) {
    if (!file || !file.type.match(/^image\//)) {
      setStatus('Please choose a JPG, PNG, WEBP or GIF image.', true);
      return;
    }
    setStatus('Loading…', true);
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      if (slot === 'B') { imgB = img; nameB = baseName(file); }
      else { imgA = img; nameA = baseName(file); }
      // NOTE: object URL was revoked, but the <img> keeps its decoded copy.
      // Fresh URL for the slot thumbnail so it stays valid.
      var tUrl = URL.createObjectURL(file);
      if (slot === 'B') { thumbB.src = tUrl; thumbB.classList.remove('hidden'); }
      else { thumbA.src = tUrl; thumbA.classList.remove('hidden'); }
      setStatus('', false);
      if (imgB && imgA) {
        editor.classList.remove('hidden');
        render();
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      setStatus('Could not read that file. Export HEIC photos as JPG first.', true);
    };
    img.src = url;
  }

  function drawTag(text, x, y, cw) {
    var fs = Math.max(22, Math.round(cw * 0.032));
    ctx.font = '700 ' + fs + 'px Inter, system-ui, sans-serif';
    var tw = ctx.measureText(text).width;
    var pad = fs * 0.55, bw = tw + pad * 2, bh = fs * 1.9;
    ctx.fillStyle = 'rgba(9,9,11,0.72)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, bh / 2);
    else ctx.rect(x, y, bw, bh);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + pad, y + bh / 2 + 1);
  }

  function render() {
    if (!imgB || !imgA) return;
    var size = targetSize(aspectMode, imgB.naturalWidth, imgB.naturalHeight);
    var cw = size.w, ch = size.h;
    canvas.width = cw; canvas.height = ch;
    // Full-frame BEFORE.
    var rb = coverRect(imgB.naturalWidth, imgB.naturalHeight, cw, ch);
    ctx.drawImage(imgB, rb.dx, rb.dy, rb.dw, rb.dh);
    // AFTER clipped to the left of the divider.
    var dx = Math.round(cw * divider / 100);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dx, ch);
    ctx.clip();
    var ra = coverRect(imgA.naturalWidth, imgA.naturalHeight, cw, ch);
    ctx.drawImage(imgA, ra.dx, ra.dy, ra.dw, ra.dh);
    ctx.restore();
    // Divider line + handle.
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12;
    ctx.fillRect(dx - 2, 0, 4, ch);
    ctx.shadowBlur = 0;
    var hr = Math.max(26, Math.round(ch * 0.035));
    ctx.beginPath(); ctx.arc(dx, ch / 2, hr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(9,9,11,0.78)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '700 ' + Math.round(hr * 0.8) + 'px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⇔', dx, ch / 2 + 1);
    ctx.textAlign = 'left';
    // Labels burned in so exports explain themselves on WhatsApp.
    if (labelsChk.checked) {
      var m = Math.round(cw * 0.03);
      drawTag('BEFORE', m, m, cw);
      var fs = Math.max(22, Math.round(cw * 0.032));
      ctx.font = '700 ' + fs + 'px Inter, system-ui, sans-serif';
      var tw = ctx.measureText('AFTER').width + fs * 1.1;
      drawTag('AFTER', cw - m - tw, m, cw);
    }
  }

  function setDivider(p) {
    divider = clampDiv(p);
    divVal.textContent = Math.round(divider) + '%';
    render();
  }

  function pctFromEvent(e) {
    var r = canvas.getBoundingClientRect();
    var x = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) - r.left;
    return (x / r.width) * 100;
  }
  var dragging = false;
  canvas.addEventListener('pointerdown', function (e) {
    if (!imgB || !imgA) return;
    dragging = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    setDivider(pctFromEvent(e));
  });
  canvas.addEventListener('pointermove', function (e) { if (dragging) setDivider(pctFromEvent(e)); });
  canvas.addEventListener('pointerup', function () { dragging = false; });
  canvas.addEventListener('pointercancel', function () { dragging = false; });

  divRange.addEventListener('input', function () { setDivider(parseFloat(divRange.value)); });

  document.querySelectorAll('[data-aspect]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      aspectMode = btn.getAttribute('data-aspect');
      document.querySelectorAll('[data-aspect]').forEach(function (b) {
        b.classList.toggle('seg-active', b === btn);
      });
      render();
    });
  });

  labelsChk.addEventListener('change', render);
  fmtSel.addEventListener('change', function () {
    qualWrap.classList.toggle('hidden', fmtSel.value !== 'jpeg');
  });
  quality.addEventListener('input', function () {
    qualityVal.textContent = quality.value + '%';
  });

  function exportBlob(cb) {
    render();
    var mime = fmtSel.value === 'png' ? 'image/png' : 'image/jpeg';
    var q = fmtSel.value === 'png' ? undefined : ((parseInt(quality.value, 10) || 90) / 100);
    canvas.toBlob(cb, mime, q);
  }

  function fileName() {
    var ext = fmtSel.value === 'png' ? 'png' : 'jpg';
    return nameB + '-vs-' + nameA + '.' + ext;
  }

  dlBtn.addEventListener('click', function () {
    if (!imgB || !imgA) return;
    exportBlob(function (blob) {
      if (!blob) { setStatus('Export failed — try again.', true); return; }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName();
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    });
  });

  shareBtn.addEventListener('click', function () {
    if (!imgB || !imgA) return;
    exportBlob(function (blob) {
      if (!blob) { setStatus('Export failed — try again.', true); return; }
      var file = null;
      try {
        file = new File([blob], fileName(), { type: blob.type });
      } catch (e) { file = null; }
      if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Before / After' }).catch(function () {});
      } else {
        // Fallback: download (desktop browsers without Web Share).
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName();
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        setStatus('Sharing is not supported in this browser — downloaded instead.', true);
      }
    });
  });

  resetBtn.addEventListener('click', function () {
    imgB = imgA = null; fileB.value = ''; fileA.value = '';
    thumbB.removeAttribute('src'); thumbA.removeAttribute('src');
    thumbB.classList.add('hidden'); thumbA.classList.add('hidden');
    editor.classList.add('hidden');
    setStatus('', false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function wireSlot(drop, file, pick, slot) {
    pick.addEventListener('click', function (e) { e.stopPropagation(); file.click(); });
    drop.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () { loadInto(file.files[0], slot); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      loadInto(f, slot);
    });
  }
  wireSlot(dropB, fileB, pickB, 'B');
  wireSlot(dropA, fileA, pickA, 'A');

  // Node test hook (harmless in browsers).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { targetSize: targetSize, coverRect: coverRect, clampDiv: clampDiv };
  }
})();
