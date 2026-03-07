import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const app = express();
app.use(cors({ origin: '*' })); // Allows Vercel to talk to Render
app.use(express.json());

// Cloudflare R2 Configuration
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET_KEY
    }
});

const BUCKET_NAME = 'prime-ephemeral-cache';

app.get('/', (req, res) => res.send('🚀 Ephemeral Cache Node Live'));

// ==========================================
// 1. PIPELINE: Fetch -> Upload -> Presign
// ==========================================
app.get('/api/cache-media', async (req, res) => {
    const { sourceUrl } = req.query;
    if (!sourceUrl) return res.status(400).json({ error: 'Missing sourceUrl' });

    const fileName = `temp-media-${Date.now()}.mp4`;

    try {
        console.log(`[Cache Node] Initiating stream from source: ${sourceUrl}`);
        
        const response = await axios({
            method: 'get',
            url: sourceUrl,
            responseType: 'stream'
        });

        const parallelUploads3 = new Upload({
            client: s3Client,
            params: {
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: response.data,
                ContentType: 'video/mp4'
            },
        });

        await parallelUploads3.done();
        console.log(`[Cache Node] Upload complete: ${fileName}`);

        const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileName });
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 14400 }); // 4 hours

        return res.json({ 
            success: true, 
            playUrl: presignedUrl,
            fileKey: fileName 
        });

    } catch (error) {
        console.error("[Cache Error]", error.message);
        return res.status(500).json({ error: 'Failed to cache media' });
    }
});

// ==========================================
// 2. LAYER 1 & 2 GARBAGE COLLECTION
// ==========================================
app.post('/api/delete-media', async (req, res) => {
    const { fileKey } = req.body;
    if (!fileKey) return res.status(400).json({ error: 'Missing fileKey' });

    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey
        }));
        console.log(`🧨 [Auto-Destruct] Vaporized: ${fileKey}`);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Deletion failed' });
    }
});

// ==========================================
// 3. LAYER 3 GARBAGE COLLECTION (Janitor)
// ==========================================
setInterval(async () => {
    try {
        const data = await s3Client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME }));
        if (!data.Contents) return;

        const now = new Date();
        for (const item of data.Contents) {
            if ((now - item.LastModified) > (3 * 60 * 60 * 1000)) { // Older than 3 hours
                await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: item.Key }));
                console.log(`🧹 [Janitor] Destroyed ghost file: ${item.Key}`);
            }
        }
    } catch (error) {
        console.error("🧹 Janitor error:", error.message);
    }
}, 30 * 60 * 1000); // Check every 30 minutes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));