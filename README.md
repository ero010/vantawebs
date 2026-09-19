# ScrubMeta — Private Metadata Remover

100% client-side metadata remover for **images, PDFs, video & audio**. Files never leave the browser.

## Why powerful
- **Images (JPG/PNG/WebP/GIF/BMP):** pixel re-render via canvas → destroys all EXIF / XMP / IPTC / GPS / thumbnails / comments.
- **PDF:** rebuild with pdf-lib, wipes Author/Creator/Producer/dates/XMP + catalog `/Metadata`.
- **Video/Audio (MP4/MOV/WEBM/MKV/MP3/WAV…):** FFmpeg `-map_metadata -1` stream-copy remux → zero quality loss, strips title/encoder/GPS/creation_time.
- **Proof:** before/after inspect with ExifReader + pdf-lib. Batch + ZIP. Filename randomizer.

## Use
Open `index.html` or deploy statically (GitHub Pages / Netlify / Vercel). No build, no server.

```bash
# local preview
npx serve .
```

## Honest limits
Removes *technical container metadata* for privacy. Does not remove invisible content watermarks (e.g. SynthID) and does not replace legally required AI-content disclosure (EU AI Act, TikTok/Instagram/YouTube policies). Use lawfully.

## Stack
Vanilla HTML/CSS/JS + ExifReader + pdf-lib + JSZip + ffmpeg.wasm (lazy-loaded only for video).
