# Vantawebs — Privacy-First Metadata Remover

Strip ALL hidden metadata from files. 100% client-side. Your files never leave your browser.

## What it removes

- **EXIF:** Camera model, GPS coordinates, timestamps, lens info, ISO, shutter speed
- **IPTC / XMP:** Author, copyright, keywords, location data
- **AI Provenance:** C2PA Content Credentials, IPTC "Digital Source Type" AI-disclosure tags, generator-embedded params (Midjourney, DALL-E, Stable Diffusion)
- **PDF:** Title, author, producer, creator, dates, XMP streams
- **Video/Audio:** Container metadata (title, encoder, GPS, creation_time) via FFmpeg stream-copy

## Supported formats

| Type | Formats | Technique |
|---|---|---|
| Images | JPEG, PNG, WebP, HEIC, GIF, TIFF, SVG | Structural byte-level removal (lossless) |
| Documents | PDF | pdf-lib metadata wipe |
| Video/Audio | MP4, MOV, WebM, MKV, MP3, WAV | FFmpeg `-map_metadata -1` stream-copy |

## Features

- **Lossless:** No re-encoding. Pixel-identical output.
- **Batch processing:** Drop multiple files, download as ZIP
- **Before/after viewer:** See exactly what metadata was found and removed
- **PWA:** Installable, works offline after first load
- **No account:** No signup, no email, no tracking

## Use

Open `index.html` or deploy statically to any host.

```bash
npx serve .
```

## Stack

Vanilla HTML/CSS/JS + picscrub (lossless image stripping) + pdf-lib + JSZip + ffmpeg.wasm + ExifReader (metadata display)

## Limits

Removes technical container metadata for privacy. Does not remove invisible content watermarks (e.g. SynthID) and does not replace legally required AI-content disclosure (EU AI Act, platform policies). Use lawfully.

## Domain

Deploy to **vantawebs.site**
