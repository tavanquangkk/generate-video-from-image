import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import axios from 'axios';
import ExifParser from 'exif-parser';

const execPromise = util.promisify(exec);
const connection = new IORedis(process.env.REDIS_HOST || 'localhost', { maxRetriesPerRequest: null });
const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const BASE_URL = process.env.BASE_URL || 'http://api:3000';

const worker = new Worker('video_jobs', async job => {
    console.log(`Processing ${job.id}`);
    const { jobId, images, options, callbackUrl } = job.data;
    const tempDir = path.join(STORAGE_PATH, 'temp', jobId);
    const videoOutputDir = path.join(STORAGE_PATH, 'videos');
    
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    if (!fs.existsSync(videoOutputDir)) fs.mkdirSync(videoOutputDir, { recursive: true });

    const videoClips: string[] = [];
    const duration = options.durationPerImage || 3;

    for (let i = 0; i < images.length; i++) {
        const imagePath = path.join(STORAGE_PATH, 'images', images[i]);
        const clipPath = path.join(tempDir, `clip_${i}.mp4`);
        
        // Extract EXIF
        const buffer = fs.readFileSync(imagePath);
        const parser = ExifParser.create(buffer);
        const exif = parser.parse();
        
        const iso = exif.tags.ISO || '?';
        const f = exif.tags.FNumber || '?';
        const s = exif.tags.ExposureTime ? `1/${Math.round(1/exif.tags.ExposureTime)}` : '?';
        const cam = exif.tags.Model || 'Camera';
        const lens = exif.tags.LensModel || 'Lens';
        
        const overlayText = `ISO ${iso} | f/${f} | ${s}s\\n${cam} + ${lens}`;

        // Stylish FFmpeg: Zoom + Fade + Metadata
        const ffmpegCmd = `ffmpeg -y -loop 1 -i "${imagePath}" -vf "scale=8000:-1,zoompan=z='min(zoom+0.0015,1.5)':d=${duration * 25}:s=1920x1080:fps=25,fade=t=in:st=0:d=1,fade=t=out:st=${duration - 1}:d=1,drawtext=text='${overlayText}':x=60:y=h-th-60:fontsize=32:fontcolor=white@0.8:box=1:boxcolor=black@0.3:boxborderw=15" -c:v libx264 -t ${duration} -pix_fmt yuv420p -r 25 "${clipPath}"`;
        
        await execPromise(ffmpegCmd);
        videoClips.push(clipPath);
    }

    // Concat
    const listFile = path.join(tempDir, 'list.txt');
    fs.writeFileSync(listFile, videoClips.map(c => `file '${c}'`).join('\n'));
    
    const intermediateFile = path.join(tempDir, 'no_music.mp4');
    await execPromise(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${intermediateFile}"`);

    const finalFile = path.join(videoOutputDir, `video_${jobId}.mp4`);
    const bgmFile = path.join(STORAGE_PATH, 'music', 'background.mp3');

    if (options.music && fs.existsSync(bgmFile)) {
        await execPromise(`ffmpeg -y -i "${intermediateFile}" -stream_loop -1 -i "${bgmFile}" -map 0:v -map 1:a -c:v copy -c:a aac -shortest "${finalFile}"`);
    } else {
        fs.copyFileSync(intermediateFile, finalFile);
    }

    // Callback
    await axios.post(callbackUrl, {
        jobId,
        status: 'completed',
        videoUrl: `${BASE_URL}/videos/video_${jobId}.mp4`
    }).catch(err => console.error('Callback failed', err.message));

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`Done ${jobId}`);
}, { connection });
