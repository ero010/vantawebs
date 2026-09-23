/* Vantawebs HDR engine — 100% client-side.
 * Pipeline: shadow lift + highlight roll-off (hue preserving),
 * S-curve contrast, vibrance + saturation, clarity (unsharp mask on luminance).
 * Working resolution capped at 2048px on the longest side for speed.
 */
(function () {
  'use strict';

  var MAX_SIDE = 2048;

  var dropzone = document.getElementById('hdrDrop');
  var fileInput = document.getElementById('hdrFile');
  var pickBtn = document.getElementById('hdrPick');
  var editor = document.getElementById('hdrEditor');
  var beforeImg = document.getElementById('hdrBefore');
  var afterImg = document.getElementById('hdrAfter');
  var compare = document.getElementById('hdrCompare');
  var divider = document.getElementById('hdrDivider');
  var strength = document.getElementById('hdrStrength');
  var strengthVal = document.getElementById('hdrStrengthVal');
  var fmtSel = document.getElementById('hdrFormat');
  var qualWrap = document.getElementById('hdrQualityWrap');
  var quality = document.getElementById('hdrQuality');
  var qualityVal = document.getElementById('hdrQualityVal');
  var dlBtn = document.getElementById('hdrDownload');
  var resetBtn = document.getElementById('hdrReset');
  var statusEl = document.getElementById('hdrStatus');
  var statusText = document.getElementById('hdrStatusText');

  var workCanvas = document.createElement('canvas');
  var wctx = workCanvas.getContext('2d', { willReadFrequently: true });
  var origData = null; // Float32Array RGB copy at working res
  var W = 0, H = 0;
  var baseName = 'image';
  var rafId = 0;

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  /* Separable box blur on a float luminance plane. r >= 1. */
  function boxBlur(src, w, h, r) {
    var n = w * h;
    var tmp = new Float32Array(n);
    var dst = new Float32Array(n);
    var x, y, xx, yy, sum, cnt, xa, xb, ya, yb;
    cnt = 2 * r + 1; // constant: window always covers 2r+1 taps (clamped at edges)
    for (y = 0; y < h; y++) {
      sum = 0;
      for (x = -r; x <= r; x++) {
        xx = x < 0 ? 0 : (x >= w ? w - 1 : x);
        sum += src[y * w + xx];
      }
      for (x = 0; x < w; x++) {
        tmp[y * w + x] = sum / cnt;
        xa = x - r; if (xa < 0) xa = 0;
        xb = x + r + 1; if (xb >= w) xb = w - 1;
        sum += src[y * w + xb] - src[y * w + xa];
      }
    }
    for (x = 0; x < w; x++) {
      sum = 0;
      for (y = -r; y <= r; y++) {
        yy = y < 0 ? 0 : (y >= h ? h - 1 : y);
        sum += tmp[yy * w + x];
      }
      for (y = 0; y < h; y++) {
        dst[y * w + x] = sum / cnt;
        ya = y - r; if (ya < 0) ya = 0;
        yb = y + r + 1; if (yb >= h) yb = h - 1;
        sum += tmp[yb * w + x] - tmp[ya * w + x];
      }
    }
    return dst;
  }

  /* Core HDR grade. px = Float32Array RGB triplets (0..1), modified in place. */
  function gradePixels(px, w, h, t) {
    var n = w * h;
    var lum = new Float32Array(n);
    var i, o, r, g, b, Y, Yt, ratio, avg, mx, mn, sat, boost;
    for (i = 0; i < n; i++) {
      o = i * 3;
      r = px[o]; g = px[o + 1]; b = px[o + 2];
      Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // 1. Tone map: lift shadows, roll off highlights, hue preserving.
      Yt = Y + t * (0.10 * Math.pow(1 - Y, 3) - 0.14 * Math.pow(Y, 3));
      ratio = Y > 1e-6 ? Yt / Y : 0;
      if (ratio > 3) ratio = 3; else if (ratio < 0) ratio = 0;
      r *= ratio; g *= ratio; b *= ratio;
      // 2. S-curve contrast.
      r += t * 1.6 * r * (1 - r) * (r - 0.5);
      g += t * 1.6 * g * (1 - g) * (g - 0.5);
      b += t * 1.6 * b * (1 - b) * (b - 0.5);
      // 3. Vibrance (targets dull pixels) + saturation.
      avg = (r + g + b) / 3;
      mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      sat = clamp01(mx - mn);
      boost = t * (0.30 * (1 - sat) + 0.15);
      r += (r - avg) * boost; g += (g - avg) * boost; b += (b - avg) * boost;
      px[o] = r; px[o + 1] = g; px[o + 2] = b;
      lum[i] = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    // 4. Clarity: unsharp mask on luminance.
    var rad = Math.round(Math.min(w, h) * 0.02);
    if (rad < 2) rad = 2; if (rad > 12) rad = 12;
    var blur = boxBlur(lum, w, h, rad);
    var amt = t * 0.6, d;
    for (i = 0; i < n; i++) {
      o = i * 3; d = (lum[i] - blur[i]) * amt;
      px[o] += d; px[o + 1] += d; px[o + 2] += d;
    }
    return px;
  }

  function render() {
    if (!origData) return;
    var t = (parseInt(strength.value, 10) || 0) / 100;
    var px = new Float32Array(origData);
    gradePixels(px, W, H, t);
    var img = wctx.createImageData(W, H);
    var d = img.data, i, o;
    for (i = 0, o = 0; i < W * H; i++, o += 4) {
      d[o] = Math.round(clamp01(px[i * 3]) * 255);
      d[o + 1] = Math.round(clamp01(px[i * 3 + 1]) * 255);
      d[o + 2] = Math.round(clamp01(px[i * 3 + 2]) * 255);
      d[o + 3] = 255;
    }
    wctx.putImageData(img, 0, 0);
    afterImg.src = workCanvas.toDataURL('image/jpeg', 0.92);
  }

  function scheduleRender() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () { rafId = 0; render(); });
    strengthVal.textContent = strength.value + '%';
  }

  function setStatus(msg, show) {
    statusText.textContent = msg;
    statusEl.classList.toggle('hidden', !show);
  }

  function loadFile(file) {
    if (!file || !file.type.match(/^image\//)) {
      setStatus('Please drop a JPG, PNG, WEBP or GIF image.', true);
      return;
    }
    setStatus('Loading image…', true);
    baseName = (file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      W = Math.max(1, Math.round(img.naturalWidth * scale));
      H = Math.max(1, Math.round(img.naturalHeight * scale));
      workCanvas.width = W; workCanvas.height = H;
      // Before view shows the same working-res pixels (fair comparison).
      var bCan = document.createElement('canvas');
      bCan.width = W; bCan.height = H;
      bCan.getContext('2d').drawImage(img, 0, 0, W, H);
      beforeImg.src = bCan.toDataURL('image/jpeg', 0.92);
      var bd = wctx.getImageData(0, 0, 0, 0); // noop guard for tainted canvases
      wctx.drawImage(img, 0, 0, W, H);
      var data;
      try {
        data = wctx.getImageData(0, 0, W, H).data;
      } catch (e) {
        setStatus('This image cannot be processed in your browser (protected source). Try a downloaded JPG or PNG.', true);
        return;
      }
      origData = new Float32Array(W * H * 3);
      for (var i = 0, o = 0; i < W * H; i++, o += 4) {
        origData[i * 3] = data[o] / 255;
        origData[i * 3 + 1] = data[o + 1] / 255;
        origData[i * 3 + 2] = data[o + 2] / 255;
      }
      void bd;
      setStatus('', false);
      dropzone.classList.add('hidden');
      editor.classList.remove('hidden');
      setCompare(50);
      render();
      editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      setStatus('Could not read that file. HEIC photos are not supported — export as JPG first.', true);
    };
    img.src = url;
  }

  function setCompare(pct) {
    if (pct < 2) pct = 2; if (pct > 98) pct = 98;
    afterImg.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
    divider.style.left = pct + '%';
  }

  var dragging = false;
  function pctFromEvent(e) {
    var r = compare.getBoundingClientRect();
    var x = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) - r.left;
    return (x / r.width) * 100;
  }
  compare.addEventListener('pointerdown', function (e) { dragging = true; compare.setPointerCapture(e.pointerId); setCompare(pctFromEvent(e)); });
  compare.addEventListener('pointermove', function (e) { if (dragging) setCompare(pctFromEvent(e)); });
  compare.addEventListener('pointerup', function () { dragging = false; });
  compare.addEventListener('pointercancel', function () { dragging = false; });

  strength.addEventListener('input', scheduleRender);
  fmtSel.addEventListener('change', function () {
    qualWrap.classList.toggle('hidden', fmtSel.value !== 'jpeg');
  });
  quality.addEventListener('input', function () {
    qualityVal.textContent = quality.value + '%';
  });

  dlBtn.addEventListener('click', function () {
    if (!origData) return;
    render();
    var mime = fmtSel.value === 'png' ? 'image/png' : 'image/jpeg';
    var q = fmtSel.value === 'png' ? undefined : ((parseInt(quality.value, 10) || 92) / 100);
    workCanvas.toBlob(function (blob) {
      if (!blob) { setStatus('Export failed — try again.', true); return; }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = baseName + '-hdr.' + (fmtSel.value === 'png' ? 'png' : 'jpg');
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }, mime, q);
  });

  resetBtn.addEventListener('click', function () {
    origData = null; fileInput.value = '';
    editor.classList.add('hidden');
    dropzone.classList.remove('hidden');
    setStatus('', false);
  });

  pickBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
  dropzone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { loadFile(fileInput.files[0]); });
  ['dragenter', 'dragover'].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('over'); });
  });
  dropzone.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    loadFile(f);
  });

  // Node test hook (harmless in browsers).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { gradePixels: gradePixels, boxBlur: boxBlur, clamp01: clamp01 };
  }
})();
