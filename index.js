const express = require("express");
const multer = require("multer");
const { exiftool } = require("exiftool-vendored");
const ffmpeg = require("fluent-ffmpeg");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = 3000;

// Setup directories
const UPLOADS_DIR = "uploads";
const OUTPUT_DIR = process.env.OUTPUT_DIR || "outputs";
const MUSIC_DIR = "music";
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({ storage });

app.post("/api/v1/create-video", upload.single("photo"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Please upload a photo." });
    }

    let customFileName = req.body.fileName || uuidv4();
    if (customFileName.toLowerCase().endsWith(".mp4")) {
        customFileName = customFileName.slice(0, -4);
    }
    
    const photoPath = req.file.path;
    const videoId = uuidv4();
    const outputVideoPath = path.join(OUTPUT_DIR, `${customFileName}.mp4`);
    const overlayPath = path.join(UPLOADS_DIR, `${videoId}_overlay.png`);

    try {
        console.log(`[DEBUG] Starting processing for photo: ${photoPath}`);

        // 0. Pick Random Music
        const musicFiles = fs.readdirSync(MUSIC_DIR).filter((file) =>
            [".mp3", ".wav", ".m4a"].includes(path.extname(file).toLowerCase()),
        );
        let musicPath = null;
        if (musicFiles.length > 0) {
            const randomMusic = musicFiles[Math.floor(Math.random() * musicFiles.length)];
            musicPath = path.join(MUSIC_DIR, randomMusic);
            console.log(`[DEBUG] Music selected: ${randomMusic}`);
        }

        // 1. Extract EXIF
        const tags = await exiftool.read(photoPath);
        const cameraName = tags.Model || "Unknown Camera";
        const lensInfo = tags.LensModel || tags.Lens || "Unknown Lens";
        const iso = tags.ISO || "N/A";
        const aperture = tags.Aperture || tags.FNumber || "N/A";
        const shutterSpeed = tags.ShutterSpeed || tags.ExposureTime || "N/A";

        // 2. Create Stylish Overlay (Fixed 1920x1080)
        console.log(`[DEBUG] Creating overlay at 1920x1080`);
        const canvas = createCanvas(1920, 1080);
        const ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, 1920, 1080);

        const padding = 60;
        const fontSizeMain = 60;
        const fontSizeSub = 30;

        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.fillStyle = "white";

        // Camera Name
        ctx.font = `bold ${fontSizeMain}px Helvetica`;
        ctx.fillText(
            cameraName.toUpperCase(),
            padding,
            1080 - padding - fontSizeSub * 2.5,
        );

        // Lens & Settings
        ctx.font = `${fontSizeSub}px Helvetica`;
        ctx.fillText(`${lensInfo}`, padding, 1080 - padding - fontSizeSub * 1.2);
        ctx.fillText(
            `ISO ${iso} | f/${aperture} | ${shutterSpeed}s`,
            padding,
            1080 - padding,
        );

        // Subtle vignette
        const gradient = ctx.createRadialGradient(960, 540, 0, 960, 540, 1100);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.4)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1920, 1080);

        const buffer = canvas.toBuffer("image/png");
        fs.writeFileSync(overlayPath, buffer);

        // 3. Create Video with FFmpeg
        console.log(`[DEBUG] Initializing FFmpeg...`);
        let ffmpegCommand = ffmpeg();

        ffmpegCommand = ffmpegCommand.input(photoPath).loop(5);
        ffmpegCommand = ffmpegCommand.input(overlayPath);

        if (musicPath) {
            ffmpegCommand = ffmpegCommand.input(musicPath);
        }

        const outputOptions = [
            "-map [v_out]",
            "-c:v libx264",
            "-pix_fmt yuv420p",
            "-movflags +faststart"
        ];

        if (musicPath) {
            outputOptions.push("-map 2:a");
            outputOptions.push("-c:a aac");
            outputOptions.push("-b:a 192k");
            outputOptions.push("-shortest");
        }

        ffmpegCommand
            .complexFilter([
                // Photo: scale to 3840 (double 1920) for quality, then crop to 16:9, then zoompan
                {
                    filter: "scale",
                    options: "3840:2160:force_original_aspect_ratio=increase",
                    inputs: "0",
                    outputs: "scaled",
                },
                {
                    filter: "crop",
                    options: "3840:2160",
                    inputs: "scaled",
                    outputs: "cropped",
                },
                {
                    filter: "zoompan",
                    options: {
                        z: "zoom+0.0005",
                        d: 125,
                        s: "1920x1080",
                        fps: 25,
                        x: "iw/2-(iw/zoom/2)",
                        y: "ih/2-(ih/zoom/2)",
                    },
                    inputs: "cropped",
                    outputs: "zoomed",
                },
                // Merge with Overlay
                {
                    filter: "overlay",
                    inputs: ["zoomed", "1"],
                    outputs: "v_out",
                },
            ])
            .outputOptions(outputOptions)
            .fps(25)
            .on("start", (commandLine) => {
                console.log(`[DEBUG] Executing FFmpeg: ${commandLine}`);
            })
            .on("stderr", (stderrLine) => {
                console.log(`[FFMPEG] ${stderrLine}`);
            })
            .on("end", () => {
                console.log(`[DEBUG] FFmpeg finished successfully.`);
                if (fs.existsSync(overlayPath)) fs.unlinkSync(overlayPath);
                if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
                res.json({
                    message: "Video created successfully",
                    videoId,
                    fileName: `${customFileName}.mp4`,
                    videoUrl: `/outputs/${customFileName}.mp4`,
                    metadata: { cameraName, lensInfo, iso, aperture, shutterSpeed },
                    musicUsed: musicPath ? path.basename(musicPath) : "none",
                });
            })
            .on("error", (err) => {
                console.error(`[DEBUG] FFmpeg Error: ${err.message}`);
                if (fs.existsSync(overlayPath)) fs.unlinkSync(overlayPath);
                if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
                res.status(500).json({ error: "Video generation failed." });
            })
            .save(outputVideoPath);
    } catch (error) {
        console.error(`[DEBUG] Unexpected Error: ${error.message}`);
        res.status(500).json({ error: "An error occurred during processing." });
    }
});

app.use("/outputs", express.static(OUTPUT_DIR));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
