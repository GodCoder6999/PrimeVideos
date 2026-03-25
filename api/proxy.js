import axios from 'axios';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send('No URL provided');

  try {
    const isM3U8 = url.includes('.m3u8');
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;

    const response = await axios({
      method: 'get',
      url: url,
      headers: headers,
      responseType: isM3U8 ? 'text' : 'stream',
      validateStatus: false
    });

    // Handle Binary Files (.mkv, .mp4) with Range Support
    if (!isM3U8) {
      res.setHeader('Content-Type', response.headers['content-type']);
      res.setHeader('Content-Length', response.headers['content-length']);
      if (response.headers['content-range']) {
        res.setHeader('Content-Range', response.headers['content-range']);
        res.status(206);
      }
      return response.data.pipe(res);
    }

    // Handle HLS Playlists (.m3u8) with Manifest Rewriting
    let manifest = response.data;
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

    // Rewrite absolute and relative URIs to point back to this proxy
    manifest = manifest.replace(/(?:URI=|#EXT-X-STREAM-INF.*[\r\n])(.*)/g, (match, p1) => {
      if (match.startsWith('#EXT-X-STREAM-INF')) return match; 
      let fullUrl = p1.startsWith('http') ? p1 : new URL(p1, baseUrl).href;
      return match.replace(p1, `/api/proxy?url=${encodeURIComponent(fullUrl)}`);
    });

    // Specifically target URI="..." in #EXT-X-MEDIA and #EXT-X-KEY
    manifest = manifest.replace(/URI="([^"]+)"/g, (match, p1) => {
      let fullUrl = p1.startsWith('http') ? p1 : new URL(p1, baseUrl).href;
      return `URI="/api/proxy?url=${encodeURIComponent(fullUrl)}"`;
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    return res.status(200).send(manifest);
  } catch (error) {
    return res.status(500).send('Proxy error');
  }
}
