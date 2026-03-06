import { URL } from 'url';

// The Advanced M3U8 Rewriting Proxy
app.get('/api/proxy-stream', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('Target URL is required');
    }

    try {
        // 1. Fetch the raw m3u8 file from the external host
        const response = await axios.get(targetUrl, {
            headers: {
                // Spoof headers to bypass basic protections
                'Referer': new URL(targetUrl).origin,
                'Origin': new URL(targetUrl).origin,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            responseType: 'text' // We need the raw text to rewrite it
        });

        const m3u8Content = response.data;
        
        // 2. The Base URL is needed to resolve relative paths inside the m3u8
        const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
        
        // 3. The URL of YOUR Render proxy so we can loop requests back through it
        const myProxyUrl = `${req.protocol}://${req.get('host')}/api/proxy-stream?url=`;

        // 4. Read the file line by line and rewrite the URLs
        const rewrittenManifest = m3u8Content.split('\n').map(line => {
            const trimmedLine = line.trim();
            
            // If the line is empty or is a tag (starts with #), leave it alone
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                return line;
            }

            // If it's a URL (chunk or sub-playlist), we need to proxy it
            let absoluteChunkUrl = trimmedLine;
            
            // Convert relative URLs to absolute URLs
            if (!trimmedLine.startsWith('http')) {
                absoluteChunkUrl = new URL(trimmedLine, baseUrl).href;
            }

            // Return the chunk wrapped in YOUR proxy URL
            return `${myProxyUrl}${encodeURIComponent(absoluteChunkUrl)}`;
        }).join('\n');

        // 5. Send the modified manifest back to your React player
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(rewrittenManifest);

    } catch (error) {
        console.error('[Proxy Error]:', error.message);
        
        // If the request was for a .ts video chunk (binary data), handle it differently
        if (targetUrl.includes('.ts')) {
             try {
                 const chunkStream = await axios.get(targetUrl, { responseType: 'stream' });
                 chunkStream.data.pipe(res);
                 return;
             } catch(e) {
                 return res.status(500).send('Chunk proxy failed');
             }
        }
        
        res.status(500).send('Proxy failed to fetch the stream.');
    }
});
