const axios = require('axios');

module.exports = async function handler(req, res) {
    // Standard CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Target URL is required');
    }

    try {
        // Important: SuperStream bypass headers
        const headers = {
            'User-Agent': 'moviebox/2.6.8 (Linux; U; Android 11)',
            'Referer': 'https://showbox.shegu.net/',
            'Origin': 'https://showbox.shegu.net/',
            'Accept': '*/*'
        };

        // Forward Range headers for seeking/scrubbing in video player
        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const response = await axios({
            method: 'get',
            url: targetUrl,
            headers: headers,
            responseType: 'stream',
            validateStatus: status => status >= 200 && status < 400 // Handle 206 Partial Content
        });

        // Copy critical headers back to the frontend player
        const headersToForward = ['content-type', 'content-length', 'accept-ranges', 'content-range'];
        
        headersToForward.forEach(header => {
            if (response.headers[header]) {
                res.setHeader(header, response.headers[header]);
            }
        });

        // Set status code (e.g., 206 for partial chunk content)
        res.status(response.status);

        // Pipe the video stream chunk directly to Vercel response
        response.data.pipe(res);

    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to proxy content' });
    }
};
