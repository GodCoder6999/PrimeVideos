import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors({ origin: '*' })); 

app.get('/', (req, res) => res.send('🚀 Prime Proxy is Live!'));

// THIS IS THE ENDPOINT YOUR PLAYER IS LOOKING FOR
app.get('/api/stream-video', async (req, res) => {
    const { sourceUrl } = req.query;
    if (!sourceUrl) return res.status(400).send('Missing sourceUrl');

    try {
        const range = req.headers.range;
        const response = await axios({
            method: 'get',
            url: sourceUrl,
            responseType: 'stream',
            headers: range ? { 'Range': range } : {},
            validateStatus: (status) => status >= 200 && status < 300 
        });

        res.status(response.status);
        for (const [key, value] of Object.entries(response.headers)) {
            res.setHeader(key, value);
        }
        response.data.pipe(res);
        req.on('close', () => response.data.destroy());
    } catch (error) {
        if (!res.headersSent) res.status(500).send('Streaming failed');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy running on port ${PORT}`));
