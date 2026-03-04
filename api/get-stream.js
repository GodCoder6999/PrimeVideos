// File: api/streaming/get-stream.js
import { checkDatabaseForManifest, publishTranscodeTask } from '../../lib/microservices';

export default async function handler(req, res) {
    const { type, id, season, episode } = req.query;

    try {
        // 1. Check Metadata/Database Service
        // Does our system already have a transcoded ABS manifest for this content?
        const existingStream = await checkDatabaseForManifest({ type, id, season, episode });

        if (existingStream && existingStream.status === 'READY') {
            // Content exists on our CDN/S3
            return res.status(200).json({
                success: true,
                manifestUrl: existingStream.cdn_url, // e.g., https://cdn.yourdomain.com/hls/12345/master.m3u8
                drm: existingStream.isEncrypted ? { licenseServer: existingStream.licenseServer } : null
            });
        }

        if (existingStream && existingStream.status === 'PROCESSING') {
            return res.status(202).json({
                success: false,
                status: 'processing',
                message: 'Content is currently being transcoded by the FFmpeg workers.'
            });
        }

        // 2. If not found, trigger the Discovery & Ingestion Microservice
        // This pushes a task to RabbitMQ/Redis which your Python/Node scrapers will pick up
        await publishTranscodeTask({
            action: 'DISCOVER_AND_TRANSCODE',
            payload: { type, id, season, episode }
        });

        // Tell the player to wait/poll
        return res.status(202).json({
            success: false,
            status: 'processing',
            message: 'Content queued for discovery and ingestion.'
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Orchestration Error' });
    }
}
