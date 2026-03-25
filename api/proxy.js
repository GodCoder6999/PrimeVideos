import axios from 'axios';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send('No URL provided');

  try {
    const isM3U8 = url.includes('.m3u8');
    
    // Prepare headers, forwarding client Range requests for MKV/MP4 seeking
    const headers = { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': new URL(url).origin 
    };
    
    if (req.headers.range) {
        headers['Range'] = req.headers.range;
    }

    const response = await axios({
      method: 'get',
      url: url,
      headers: headers,
      responseType: isM3U8 ? 'text' : 'stream',
      validateStatus: (status) => status >= 200 && status < 400
    });

    // Handling Binary Files (.mkv, .mp4) with Range Support
    if (!isM3U8) {
      res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
      if (response.headers['content-length']) {
          res.setHeader('Content-Length', response.headers['content-length']);
      }
      if (response.headers['content-range']) {
        res.setHeader('Content-Range', response.headers['content-range']);
        res.setHeader('Accept-Ranges', 'bytes');
        res.status(206);
      }
      // Direct Piping (No buffering into memory to avoid Vercel crash)
      return response.data.pipe(res);
    }

    // Handling HLS Playlists (.m3u8) with Manifest Rewriting Engine
    let manifest = response.data;
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

    // Rewrite absolute and relative URIs for standard transport streams (.ts)
    manifest = manifest.replace(/(?:URI=|#EXT-X-STREAM-INF.*[\r\n])(.*)/g, (match, p1) => {
      if (match.startsWith('#EXT-X-STREAM-INF')) return match; 
      if (!p1 || p1.trim() === '' || p1.startsWith('#')) return match;
      let fullUrl = p1.startsWith('http') ? p1 : new URL(p1, baseUrl).href;
      return match.replace(p1, `/api/proxy?url=${encodeURIComponent(fullUrl)}`);
    });

    // Targeted Regex: Crucial for #EXT-X-MEDIA (audio) and #EXT-X-KEY (encryption)
    manifest = manifest.replace(/URI="([^"]+)"/g, (match, p1) => {
      let fullUrl = p1.startsWith('http') ? p1 : new URL(p1, baseUrl).href;
      return `URI="/api/proxy?url=${encodeURIComponent(fullUrl)}"`;
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    return res.status(200).send(manifest);
  } catch (error) {
    console.error("Proxy error:", error.message);
    return res.status(500).send('Proxy error');
  }
}
