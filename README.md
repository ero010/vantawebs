# Vantawebs — Free Online Metadata Remover

**Live tool: https://vantawebs.site**

Strip ALL hidden metadata from files. 100% client-side — your files never leave your browser. No signup, no upload, no tracking.

Every photo you share carries hidden EXIF data: GPS coordinates, camera model, timestamps. AI-generated images now carry C2PA Content Credentials and generator parameters. PDFs leak author names. Vantawebs removes all of it, losslessly, in your browser.

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

## Privacy guides

21 free guides live on the site covering every metadata question people actually search for: what EXIF and C2PA are, what Instagram/Facebook/WhatsApp/TikTok strip (and what they keep), how to clean AI art from Midjourney/Stable Diffusion/DALL-E/Firefly before selling, and more. See [/pages/](https://vantawebs.site/pages/).

## Deploy

Static site — push to any host. Currently live on Cloudflare Pages at **https://vantawebs.site**.

```bash
npx wrangler pages deploy . --project-name=vantawebs
```

## Contributing

Found a file type that keeps metadata after cleaning? Open an issue with a sample file description (never upload personal photos) and the tags that survived.
