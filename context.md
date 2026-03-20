
🧠 1. Kiến trúc FINAL (chi tiết dev-level)
n8n → API → Queue (Redis) → Worker → Storage → n8n callback
📁 2. Monorepo structure (rất nên dùng)
project/
 ├── docker-compose.yml
 ├── storage/
 │    ├── images/
 │    ├── videos/
 │    └── temp/
 │
 ├── api/
 │    ├── src/
 │    │    ├── routes/
 │    │    ├── controllers/
 │    │    ├── services/
 │    │    ├── queue/
 │    │    └── utils/
 │    └── Dockerfile
 │
 ├── worker/
 │    ├── src/
 │    │    ├── jobs/
 │    │    ├── services/
 │    │    └── utils/
 │    └── Dockerfile
 │
 └── shared/
      ├── types/
      └── constants/
📦 3. API DESIGN (contract cực rõ)
🎯 Endpoint chính
POST /jobs/create
{
  "images": ["file1.jpg", "file2.jpg"],
  "options": {
    "durationPerImage": 3,
    "overlay": true,
    "music": false
  },
  "callbackUrl": "http://n8n:5678/webhook/video-done"
}
🔁 Response
{
  "jobId": "job_abc123",
  "status": "queued"
}
🔍 GET /jobs/:id
{
  "jobId": "job_abc123",
  "status": "processing",
  "progress": 60
}
🧠 4. QUEUE JOB SCHEMA (RẤT QUAN TRỌNG)

👉 dùng BullMQ (Redis)

🧾 Job payload
type VideoJob = {
  jobId: string;

  images: string[]; // path local

  options: {
    durationPerImage: number;
    overlay: boolean;
    music?: boolean;
  };

  callbackUrl: string;

  createdAt: number;
};
📊 Job state
type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";
⚙️ 5. WORKER FLOW (core logic)
🎬 Pipeline trong worker
1. load job
2. extract EXIF (metadata)
3. build overlay text
4. generate video (FFmpeg)
5. save video
6. callback n8n
🧩 Pseudo code
async function processJob(job) {
  updateProgress(10);

  const metadataList = await extractExif(job.images);

  updateProgress(30);

  const overlays = buildOverlay(metadataList);

  updateProgress(50);

  const videoPath = await renderVideo(job.images, overlays);

  updateProgress(90);

  await callback(job.callbackUrl, {
    videoUrl: `/videos/${videoName}`,
    metadata: metadataList
  });

  updateProgress(100);
}
🧠 6. METADATA DESIGN (chuẩn hóa)
Output từ EXIF
{
  "iso": 100,
  "aperture": 1.8,
  "shutter": "1/200",
  "camera": "Sony A7III",
  "lens": "35mm"
}
Convert thành text overlay
ISO 100 | f/1.8 | 1/200s
Sony A7III + 35mm
⚠️ fallback logic
iso || "ISO ?"
aperture || "f/?"
🎬 7. VIDEO RENDER DESIGN
🎯 Input

images[]

overlay per image

🎥 Output
/storage/videos/video_{jobId}.mp4
🧠 FFmpeg strategy
Step 1: concat images
Step 2: apply overlay
Step 3: encode
💡 IMPORTANT

👉 mỗi image cần filter riêng:

[0:v] drawtext=...
[1:v] drawtext=...
🌐 8. CALLBACK DESIGN (n8n integration)
Worker → n8n
POST callbackUrl

{
  "jobId": "job_abc123",
  "status": "completed",
  "videoUrl": "http://api:3000/videos/video_abc123.mp4",
  "metadata": [...]
}
Nếu fail
{
  "jobId": "job_abc123",
  "status": "failed",
  "error": "FFmpeg crashed"
}
💾 9. STORAGE RULES
📁 Path rule
images: /storage/images/{jobId}/
videos: /storage/videos/
🧹 Cleanup strategy

cron job:

delete after 24h
🔄 10. n8n FLOW (rất cụ thể)

Trong n8n:

Step 1: Trigger

manual / webhook

Step 2: Upload images → API
Step 3: Wait webhook callback
Step 4: Download video
Step 5: Upload YouTube
⚡ 11. RETRY + ERROR DESIGN
Worker retry
attempts: 3
backoff: exponential
Case cần retry:

FFmpeg fail

EXIF fail

callback fail

📊 12. LOGGING (rất nên làm)
[job_123]
- start
- exif done
- render done
- upload callback done
🔥 13. ENV CONFIG
REDIS_HOST=redis
STORAGE_PATH=/app/storage
BASE_URL=http://api:3000
🚀 14. MVP CHECKLIST

Bạn chỉ cần build đủ:

 API create job

 Queue (BullMQ)

 Worker process

 EXIF extract

 FFmpeg render

 Callback n8n

 Static video serve

👉 là chạy được end-to-end luôn
