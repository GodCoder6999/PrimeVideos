// File: api/proxy.js
import axios from 'axios';

export default async function handler(req, res) {
    const { url, headers } = req.query;
    if (!url) return res.status(400).send("No URL provided");

    try {
        const decodedUrl = decodeURIComponent(url);
        
        // NetMirror logic: Mimic a legitimate browser/player request
        const response = await axios({
            method: 'get',
            url: decodedUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
                'Referer': new URL(decodedUrl).origin,
                ...(headers ? JSON.parse(decodeURIComponent(headers)) : {})
            }
        });

        // Pipe the video data directly to the user
        res.setHeader('Content-Type', response.headers['content-type']);
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send("Proxy error");
    }
}
