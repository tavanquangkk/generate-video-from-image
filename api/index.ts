import express from 'express';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import path from 'path';

const app = express();
app.use(express.json());

const connection = new IORedis(process.env.REDIS_HOST || 'localhost', { maxRetriesPerRequest: null });
const videoQueue = new Queue('video_jobs', { connection });

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

app.post('/jobs/create', async (req, res) => {
    const { images, options, callbackUrl } = req.body;
    const jobId = `job_${Math.random().toString(36).substring(2, 10)}`;
    
    await videoQueue.add(jobId, {
        jobId,
        images,
        options: options || { durationPerImage: 3, overlay: true, music: false },
        callbackUrl
    });

    res.status(202).json({ jobId, status: 'queued' });
});

app.get('/jobs/:id', async (req, res) => {
    const job = await videoQueue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    
    const state = await job.getState();
    res.json({ jobId: job.id, status: state });
});

app.use('/videos', express.static(path.join(STORAGE_PATH, 'videos')));

app.listen(3000, () => console.log('API listening on port 3000'));
