/**
 * reelstreamResolver.js
 *
 * Full port of REELSTREAM's 3-tier video resolution logic for use in the
 * PrimeVideo React frontend.
 *
 * Resolution order:
 *   Tier 1 — Supabase DB lookup by TMDB ID          (instant, curated)
 *   Tier 2 — Open-directory root scrape + fuzzy match (a.111477.xyz)
 *   Tier 3 — Candidate URL brute-force variants       (fallback)
 *
 * For TV shows the returned object has `folders` (seasons) and no videos.
 * For movies it has `videos` directly.
 * The caller (PrimePlayer) picks the best file via selectBestFiles().
 */

// ─────────────────────────── CONFIG ────────────────────────────────────────
const TMDB_KEY  = 'cb1dc311039e6ae85db0aa200345cbc5';
const BASE      = 'https://a.111477.xyz';
const VID_RE    = /\.(mkv|mp4|avi|webm|mov|m4v|ts|ogv|flv|wmv|mpeg|mpg)(\?.*)?$/i;

const SUPA_BASE = 'https://xuzfdkkkklmrilcitsec.supabase.co/rest/v1';
const SUPA_KEY  =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1emZka2tra2xtcmlsY2l0c2VjIiwicm9sZSI6' +
  'ImFub24iLCJpYXQiOjE3MDk4MzA3NjIsImV4cCI6MjAyNTQwNjc2Mn0.' +
  'lyODVH5HMqBGCTMXHdwMWlHIKvhGNS1yBrISeZFDhXo';

// ─────────────────────── LOCAL PROXY PROBE ─────────────────────────────────
// Checks once at startup whether /api/proxy (Vercel serverless) is reachable.
let _localProxyOk = null;
let _probePromise  = null;

function probeLocalProxy() {
  if (_probePromise) return _probePromise;
  _probePromise = (async () => {
    try {
      const r = await fetch(
        `/api/proxy?url=${encodeURIComponent('https://www.google.com/robots.txt')}`,
        { signal: AbortSignal.timeout(4000) }
      );
      const ct  = r.headers.get('content-type') || '';
      const xps = r.headers.get('x-proxy-status');
      _localProxyOk = !!(xps || (r.ok && !ct.includes('text/html')));
    } catch (_) {
      _localProxyOk = false;
    }
  })();
  return _probePromise;
}

// Start probing immediately so it's ready by the time resolveTitle is called.
probeLocalProxy();

// ─────────────────────── PROXY WATERFALL ───────────────────────────────────
async function buildProxyList(url) {
  // Wait for probe if it hasn't finished yet
  if (_localProxyOk === null) await probeLocalProxy();

  const list = [];
  if (_localProxyOk) {
    list.push(`/api/proxy?url=${encodeURIComponent(url)}`);
  }
  list.push(`https://corsproxy.io/?${encodeURIComponent(url)}`);
  list.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  return list;
}

export async function proxiedFetch(url) {
  const proxies = await buildProxyList(url);
  const errors  = [];

  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) {
        errors.push(`${proxyUrl.slice(0, 60)}: HTTP ${res.status}`);
        continue;
      }
      const ct   = res.headers.get('content-type') || '';
      const text = await res.text();

      // Reject SPA catch-all HTML error pages (no real <a href> links)
      const isHtmlPage = ct.includes('text/html') && text.includes('<!DOCTYPE');
      const hasLinks   = /<a\s+[^>]*href=/i.test(text);
      if (!text || text.length < 50 || (isHtmlPage && !hasLinks)) {
        errors.push(`${proxyUrl.slice(0, 60)}: empty/error page (${text?.length ?? 0}b)`);
        continue;
      }

      return text;
    } catch (e) {
      errors.push(e.message);
    }
  }

  throw new Error(
    `Could not fetch: ${url.slice(0, 80)}\nErrors: ${errors.slice(0, 2).join('; ')}`
  );
}

// ──────────────────────────── SUPABASE ─────────────────────────────────────
async function supaFetch(tmdbId, mediaType) {
  const table = mediaType === 'tv' ? 'tv_shows' : 'movies';
  try {
    const res = await fetch(
      `${SUPA_BASE}/${table}?tmdb_id=eq.${tmdbId}&select=download_url`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.download_url ?? null;
  } catch (_) {
    return null;
  }
}

// ─────────────────────────── URL HELPERS ───────────────────────────────────
export function safeUrl(url) {
  try {
    const u = new URL(url);
    u.pathname = u.pathname
      .split('/')
      .map((seg) => {
        try { return encodeURIComponent(decodeURIComponent(seg)); }
        catch (_) { return encodeURIComponent(seg); }
      })
      .join('/');
    return u.toString();
  } catch (_) {
    return url
      .replace(/ /g,  '%20')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\[/g, '%5B')
      .replace(/\]/g, '%5D');
  }
}

function normalizeTitle(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────── LINK EXTRACTION ───────────────────────────────
function extractLinks(html) {
  const links = [];
  const patterns = [
    /<a\s+[^>]*href="([^"#?][^"]*)"[^>]*>([^<]+)<\/a>/gi,
    /<a\s+[^>]*href='([^'#?][^']*)'[^>]*>([^<]+)<\/a>/gi,
  ];
  const seen = new Set();
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const href = m[1].trim();
      const text = m[2].trim();
      if (!seen.has(href)) { seen.add(href); links.push({ href, text }); }
    }
  }
  return links;
}

// ─────────────────────────── FOLDER MATCH ──────────────────────────────────
function findFolderMatch(links, searchKey, year, mediaType) {
  const skipText = new Set(['../', 'Name', 'Size', 'Last modified', 'Description', 'Date']);
  const skipHref = new Set(['../', './', '?', '#', '/']);
  let best = null;

  for (const { href, text } of links) {
    if (skipHref.has(href) || skipText.has(text)) continue;
    if (!href.endsWith('/') && !text.endsWith('/')) continue;

    let decoded;
    try { decoded = decodeURIComponent(text); } catch (_) { decoded = text; }
    const norm = normalizeTitle(decoded);

    if (mediaType === 'tv') {
      if (norm === searchKey) { best = href; break; }
      if (!best && norm.includes(searchKey)) best = href;
    } else {
      if (norm.includes(searchKey) && year && norm.includes(year)) { best = href; break; }
      if (!best && norm.includes(searchKey)) best = href;
    }
  }
  return best;
}

// ─────────────────────── CANDIDATE URL BUILDER ─────────────────────────────
function buildCandidateUrls(baseUrl, title, year, mediaType) {
  const enc = (s) => encodeURIComponent(s);
  const sp   = title.replace(/ /g, '%20');
  const raw  = `${title} (${year})`;

  if (mediaType === 'tv') {
    return [
      `${baseUrl}${title}/`,
      `${baseUrl}${sp}/`,
      `${baseUrl}${enc(title)}/`,
      `${baseUrl}${title.replace(/ /g, '+')}/`,
    ];
  }
  return [
    `${baseUrl}${raw}/`,
    `${baseUrl}${sp}%20(${year})/`,
    `${baseUrl}${sp}%20%28${year}%29/`,
    `${baseUrl}${enc(raw)}/`,
    `${baseUrl}${enc(title)}%20(${year})/`,
  ];
}

// ─────────────────────── FOLDER LISTING PARSER ─────────────────────────────
export function parseFolderListing(html, baseUrl) {
  const folders = [];
  const videos  = [];
  const links   = extractLinks(html);

  for (const { href, text } of links) {
    if (!href || href === '../' || href.startsWith('?') || href === '#') continue;

    let abs = href.startsWith('http')
      ? href
      : href.startsWith('/')
      ? BASE + href
      : baseUrl + href;

    abs = safeUrl(abs);

    let name;
    try { name = decodeURIComponent(href.replace(/\/$/, '').split('/').pop()); }
    catch (_) { name = href.replace(/\/$/, '').split('/').pop(); }
    if (!name) {
      try { name = decodeURIComponent(text.replace(/\/$/, '').trim()); }
      catch (_) { name = text.replace(/\/$/, '').trim(); }
    }

    const rawDec = (() => {
      try { return decodeURIComponent(href.split('?')[0]); }
      catch (_) { return href.split('?')[0]; }
    })();

    if (href.endsWith('/')) {
      folders.push({ name, url: abs });
    } else if (VID_RE.test(rawDec)) {
      videos.push({ name, url: abs });
    }
  }
  return { folders, videos };
}

// ─────────────────────── SUBFOLDER FETCH ───────────────────────────────────
export async function fetchSubfolder(url) {
  const html     = await proxiedFetch(url);
  const endsWith = url.endsWith('/') ? url : url + '/';
  return parseFolderListing(html, endsWith);
}

// ─────────────────────── INDEX SCRAPER (Tier 2+3) ──────────────────────────
async function scrapeIndex(title, year, mediaType) {
  const baseDir  = mediaType === 'tv' ? 'tvs' : 'movies';
  const baseUrl  = `${BASE}/${baseDir}/`;
  const searchKey = normalizeTitle(title);

  // Try root listing first
  let bestHref = null;
  try {
    const rootHtml = await proxiedFetch(baseUrl);
    const links    = extractLinks(rootHtml);
    bestHref = findFolderMatch(links, searchKey, year, mediaType);
  } catch (_) { /* continue to candidates */ }

  const tried = new Set();

  if (bestHref) {
    let folderUrl;
    if (bestHref.startsWith('http')) {
      folderUrl = bestHref;
    } else if (bestHref.startsWith('/')) {
      folderUrl = BASE + bestHref;
    } else {
      let decoded;
      try { decoded = decodeURIComponent(bestHref); } catch (_) { decoded = bestHref; }
      folderUrl = baseUrl + decoded;
    }
    if (!folderUrl.endsWith('/')) folderUrl += '/';
    tried.add(folderUrl);

    try {
      const html   = await proxiedFetch(folderUrl);
      const result = parseFolderListing(html, folderUrl);
      if (result.videos.length || result.folders.length) return result;
    } catch (_) { /* fall through */ }
  }

  // Brute-force candidate URLs
  const candidates = buildCandidateUrls(baseUrl, title, year, mediaType);
  for (const candidate of candidates) {
    if (tried.has(candidate)) continue;
    tried.add(candidate);
    try {
      const html   = await proxiedFetch(candidate);
      const result = parseFolderListing(html, candidate);
      if (result.videos.length || result.folders.length) return result;
    } catch (_) { /* try next */ }
  }

  throw new Error(
    `"${title}" (${year || '?'}) not found on index.\nTry pasting a direct URL.`
  );
}

// ─────────────────────── QUALITY HELPERS ───────────────────────────────────
export function detectQuality(filename) {
  const f = filename.toLowerCase();
  if (/2160p|4k|uhd/.test(f))  return '4K';
  if (/1080p/.test(f))          return '1080p';
  if (/720p/.test(f))           return '720p';
  if (/480p/.test(f))           return '480p';
  if (/360p/.test(f))           return '360p';
  return null;
}

function fileScore(name) {
  const n = name.toLowerCase();
  let score = 0;
  if (n.includes('remux'))                    score += 1000;
  if (n.includes('part00'))                   score += 2000;
  if (n.includes('web-dl'))                   score -= 20;
  if (n.includes('webrip'))                   score -= 10;
  if (/h\.264|h264|x264/.test(n))             score -= 15;
  if (/x265|hevc/.test(n))                    score += 5;
  if (n.includes('av1'))                      score += 10;
  if (/atmos|truehd/.test(n))                 score += 5;
  return score;
}

export function selectBestFiles(videos) {
  const buckets = { '480p': [], '720p': [], '1080p': [], '4K': [], other: [] };
  for (const v of videos) {
    const q = detectQuality(v.name) || 'other';
    buckets[q].push(v);
  }
  const selected = [];
  for (const tier of ['480p', '720p', '1080p', '4K']) {
    if (!buckets[tier].length) continue;
    const sorted = [...buckets[tier]].sort((a, b) => fileScore(b.name) - fileScore(a.name));
    selected.push({ ...sorted[0], quality: tier });
  }
  if (!selected.length) {
    return [...videos]
      .sort((a, b) => fileScore(b.name) - fileScore(a.name))
      .slice(0, 4)
      .map((v) => ({ ...v, quality: null }));
  }
  return selected;
}

// ─────────────────── MASTER RESOLVER — 3 TIERS ─────────────────────────────
/**
 * Resolves a TMDB title to direct video files.
 *
 * @param {object} params
 * @param {string}  params.tmdbId
 * @param {string}  params.mediaType   'movie' | 'tv'
 * @param {string} [params.title]      optional — skips extra TMDB fetch
 * @param {string} [params.year]       optional — skips extra TMDB fetch
 * @param {number} [params.season]     TV only — if provided, resolves to episode files
 * @param {number} [params.episode]    TV only — used for filtered episode match
 *
 * @returns {Promise<{ folders: object[], videos: object[], source: string }>}
 *
 * For movies: videos[] is populated with direct file objects { name, url, quality }
 * For TV:     folders[] contains season folders; call fetchSubfolder(folder.url)
 *             to get episodes, or pass season to auto-drill one level.
 */
export async function resolveTitle({ tmdbId, mediaType, title, year, season, episode }) {

  // Fetch TMDB metadata if title/year not provided
  if (!title || !year) {
    try {
      const r = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`
      );
      const d = await r.json();
      title = title || d.title || d.name;
      year  = year  || (d.release_date || d.first_air_date || '').slice(0, 4);
    } catch (_) { /* carry on with whatever we have */ }
  }

  if (!title) {
    throw new Error(`Could not determine title for TMDB ID ${tmdbId}`);
  }

  // ── Tier 1: Supabase ──────────────────────────────────────────────────────
  const supaUrl = await supaFetch(tmdbId, mediaType);
  if (supaUrl) {
    const safe = safeUrl(supaUrl);

    // Direct video file in Supabase?
    if (VID_RE.test(decodeURIComponent(safe.split('?')[0]))) {
      const name = decodeURIComponent(safe.split('/').pop().split('?')[0]);
      const q    = detectQuality(name);
      return {
        folders: [],
        videos:  [{ name, url: safe, quality: q }],
        source:  '⚡ database',
      };
    }

    // Folder URL in Supabase — try fetching it
    try {
      const folderUrl = safe.endsWith('/') ? safe : safe + '/';
      const html      = await proxiedFetch(folderUrl);
      const result    = parseFolderListing(html, folderUrl);
      if (result.videos.length || result.folders.length) {
        return { ...result, source: '⚡ database' };
      }
    } catch (_) { /* fall through to scraper */ }
  }

  // ── Tier 2+3: Index scraper ───────────────────────────────────────────────
  const result = await scrapeIndex(title, year, mediaType);

  // TV: if a season number is given, drill one level deeper automatically
  if (mediaType === 'tv' && season && result.folders.length && !result.videos.length) {
    const seasonNum = Number(season);
    const seasonFolder = result.folders.find((f) => {
      const n = normalizeTitle(f.name);
      return (
        n.includes(`season ${seasonNum}`) ||
        n.includes(`s${String(seasonNum).padStart(2, '0')}`) ||
        n === String(seasonNum)
      );
    }) || result.folders[0]; // fall back to first folder

    if (seasonFolder) {
      try {
        const seasonResult = await fetchSubfolder(seasonFolder.url);
        if (seasonResult.videos.length) {
          // Optionally filter to a specific episode
          let videos = seasonResult.videos;
          if (episode) {
            const epNum = String(episode).padStart(2, '0');
            const filtered = videos.filter((v) =>
              new RegExp(`[Ee]${epNum}|[Ee]pisode.?${epNum}`, 'i').test(v.name)
            );
            if (filtered.length) videos = filtered;
          }
          return { folders: [], videos, source: '📁 index' };
        }
      } catch (_) { /* return top-level result */ }
    }
  }

  if (result.videos.length || result.folders.length) {
    return { ...result, source: '📁 index' };
  }

  throw new Error(
    `"${title}" (${year || '?'}) not found.\n` +
    `Checked Supabase DB and ${BASE}.\n` +
    `Try pasting a direct URL.`
  );
}
