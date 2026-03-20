const express = require('express');
const multer = require('multer');
const { exiftool } = require('exiftool-vendored');
const ffmpeg = require('fluent-ffmpeg');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

// Setup directories
const UPLOADS_DIR = 'uploads';
const OUTPUT_DIR = 'outputs';
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({ storage });

app.post('/api/v1/create-video', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a photo.' });
  }

  const photoPath = req.file.path;
  const videoId = uuidv4();
  const outputVideoPath = path.join(OUTPUT_DIR, `${videoId}.mp4`);
  const overlayPath = path.join(UPLOADS_DIR, `${videoId}_overlay.png`);

  try {
    // 1. Extract EXIF
    const tags = await exiftool.read(photoPath);
    const cameraName = tags.Model || 'Unknown Camera';
    const lensInfo = tags.LensModel || tags.Lens || 'Unknown Lens';
    const iso = tags.ISO || 'N/A';
    const aperture = tags.Aperture || tags.FNumber || 'N/A';
    const shutterSpeed = tags.ShutterSpeed || tags.ExposureTime || 'N/A';

    // 2. Create Stylish Overlay
    const img = await loadImage(photoPath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    // Draw nothing for background (transparent)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Stylish Typography at bottom-left
    const padding = 60;
    const fontSizeMain = Math.floor(canvas.height * 0.05);
    const fontSizeSub = Math.floor(canvas.height * 0.025);

    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.fillStyle = 'white';

    // Camera Name
    ctx.font = `bold ${fontSizeMain}px Helvetica`;
    ctx.fillText(cameraName.toUpperCase(), padding, canvas.height - padding - fontSizeSub * 2.5);

    // Lens & Settings
    ctx.font = `${fontSizeSub}px Helvetica`;
    ctx.fillText(`${lensInfo}`, padding, canvas.height - padding - fontSizeSub * 1.2);
    ctx.fillText(`ISO ${iso} | f/${aperture} | ${shutterSpeed}s`, padding, canvas.height - padding);

    // Optional: Add a subtle vignette in the overlay
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(overlayPath, buffer);

    // 3. Create Video with FFmpeg (Zoom effect + Overlay)
    // Scale image to a reasonable size if too large (e.g. 1920x1080)
    ffmpeg()
      .input(photoPath)
      .loop(5) // 5 seconds
      .input(overlayPath)
      .complexFilter([
        // Layer 0: Original Photo with zoompan
        // d=125 (5s * 25fps), zoom in from 1.0 to 1.1
        {
          filter: 'scale',
          options: '3840:-1',
          inputs: '0',
          outputs: 'scaled'
        },
        {
          filter: 'zoompan',
          options: {
            z: 'zoom+0.0005',
            d: 125,
            s: '1920x1080',
            fps: 25,
            x: 'iw/2-(iw/zoom/2)',
            y: 'ih/2-(ih/zoom/2)'
          },
          inputs: 'scaled',
          outputs: 'zoomed'
        },
        // Layer 1: Overlay
        {
          filter: 'scale',
          options: '1920:1080',
          inputs: '1',
          outputs: 'overlay_scaled'
        },
        // Merge
        {
          filter: 'overlay',
          inputs: ['zoomed', 'overlay_scaled'],
          outputs: 'final'
        }
      ])
      .map('final')
      .videoCodec('libx264')
      .outputOptions('-pix_fmt yuv420p')
      .fps(25)
      .save(outputVideoPath)
      .on('end', () => {
        // Cleanup temp files
        fs.unlinkSync(overlayPath);
        // fs.unlinkSync(photoPath); // Keeping original for now or cleanup as you wish

        res.json({
          message: 'Video created successfully',
          videoId,
          videoUrl: `/outputs/${videoId}.mp4`,
          metadata: { cameraName, lensInfo, iso, aperture, shutterSpeed }
        });
      })
      .on('error', (err) => {
        console.error(err);
        res.status(500).json({ error: 'Video generation failed.' });
      });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred during processing.' });
  }
});

app.use('/outputs', express.static(OUTPUT_DIR));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
