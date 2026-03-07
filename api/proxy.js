// File: api/proxy.js
import axios from 'axios';

export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) return res.status(400).send("Missing URL");

    try {
        const decodedUrl = decodeURIComponent(url);
        const response = await axios({
            method: 'get',
            url: decodedUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': new URL(decodedUrl).origin
            }
        });

        res.setHeader('Content-Type', response.headers['content-type']);
        res.setHeader('Access-Control-Allow-Origin', '*');
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send("Relay Error");
    }
}
