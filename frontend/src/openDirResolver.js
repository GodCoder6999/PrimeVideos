/**
 * openDirResolver.js
 *
 * Ports the full 3-tier video resolution logic from REELSTREAM:
 *   Tier 1 — Supabase DB lookup by TMDB ID (instant)
 *   Tier 2 — Open directory index scraping (fuzzy title match)
 *   Tier 3 — Candidate URL construction (brute-force variants)
 *
 * Also exports quality selection helpers used by PrimePlayer.
 */

const TMDB_API_KEY = 'cb1dc311039e6ae85db0aa200345cbc5';
const BASE = 'https://a.111477.xyz';
const VID_RE = /\.(mkv|mp4|avi|webm|mov|m4v|ts|ogv|flv|wmv|mpeg|mpg)(\?.*)?$/i;

// ── Supabase credentials ────────────────────────────────────────────────────
const SUPA_BASE = 'https://xuzfdkkkklmrilcitsec.supabase.co/rest/v1';
const SUPA_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1emZka2tra2xtcmlsY2l0c2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4MzA3NjIsImV4cCI6MjAyNTQwNjc2Mn0.lyODVH5HMqBGCTMXHdwMWlHIKvhGNS1yBrISeZFDhXo';

// ── Fallback CORS proxies (used only if /api/proxy is unavailable) ──────────
const FALLBACK_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

// ── Probe the local /api/proxy once at module load ──────────────────────────
let _localProxyOk = null; // null = unknown, true = ok, false = broken
async function checkLocalProxy() {
  if (_localProxyOk !== null) return _localProxyOk;
  try {
    const r = await fetch(
      `/api/proxy?url=${encodeURIComponent('https://www.google.com/robots.txt')}`,
      { signal: AbortSignal.timeout(4000) }
    );
    const ct = r.headers.get('content-type') || '';
    const xps = r.headers.get('x-proxy-status');
    _localProxyOk = !!(xps || (r.ok && !ct.includes('text/html')));
  } catch (_) {
    _localProxyOk = false;
  }
  return _localProxyOk;
}

// ── Build proxy URL list for a target URL ───────────────────────────────────
async function buildProxyList(url) {
  const ok = await checkLocalProxy();
  const list = [];
  if (ok) list.push(`/api/proxy?url=${encodeURIComponent(url)}`);
  FALLBACK_PROXIES.forEach((fn) => list.push(fn(url)));
  return list;
}

// ── Fetch through proxy waterfall, returning text ───────────────────────────
export async function proxiedFetch(url) {
  const proxies = await buildProxyList(url);
  const errors = [];

  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) { errors.push(`${proxyUrl.slice(0, 60)}: HTTP ${res.status}`); continue; }
      const ct = res.headers.get('content-type') || '';
      const text = await res.text();
      const isHtmlPage = ct.includes('text/html') && text.includes('<!DOCTYPE');
      const hasLinks = /<a\s+[^>]*href=/i.test(text);
      if (!text || text.length < 50 || (isHtmlPage && !hasLinks)) {
        errors.push(`${proxyUrl.slice(0, 60)}: empty/error page (${text?.length ?? 0}b)`);
        continue;
      }
      return text;
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(`Could not fetch: ${url.slice(0, 80)}\n${errors.slice(0, 2).join('; ')}`);
}

// ── Supabase tier ────────────────────────────────────────────────────────────
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

// ── TMDB metadata fetch ──────────────────────────────────────────────────────
export async function fetchTmdbDetails(tmdbId, mediaType) {
  try {
    const r = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`
    );
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

// ── URL helpers ──────────────────────────────────────────────────────────────
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
      .replace(/ /g, '%20')
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

// ── Link extraction ──────────────────────────────────────────────────────────
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

// ── Folder match logic ───────────────────────────────────────────────────────
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

// ── Candidate URL builder ────────────────────────────────────────────────────
function buildCandidateUrls(baseUrl, title, year, mediaType) {
  const enc = (s) => encodeURIComponent(s);
  const sp = title.replace(/ /g, '%20');
  const raw = `${title} (${year})`;
  const spP = `${sp}%20(${year})`;
  const spPE = `${sp}%20%28${year}%29`;
  const fullE = enc(raw);

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
    `${baseUrl}${spP}/`,
    `${baseUrl}${spPE}/`,
    `${baseUrl}${fullE}/`,
    `${baseUrl}${enc(title)}%20(${year})/`,
  ];
}

// ── Folder listing parser ────────────────────────────────────────────────────
export function parseFolderListing(html, baseUrl) {
  const folders = [];
  const videos = [];
  const links = extractLinks(html);

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

// ── Subfolder fetch ──────────────────────────────────────────────────────────
export async function fetchSubfolder(url) {
  const html = await proxiedFetch(url);
  const endsWith = url.endsWith('/') ? url : url + '/';
  return parseFolderListing(html, endsWith);
}

// ── Index scraper (Tier 2+3) ─────────────────────────────────────────────────
async function scrapeIndex(title, year, mediaType) {
  const baseDir = mediaType === 'tv' ? 'tvs' : 'movies';
  const baseUrl = `${BASE}/${baseDir}/`;
  const searchKey = normalizeTitle(title);

  let bestHref = null;
  try {
    const rootHtml = await proxiedFetch(baseUrl);
    const links = extractLinks(rootHtml);
    bestHref = findFolderMatch(links, searchKey, year, mediaType);
  } catch (_) { /* root fetch failed, continue to candidates */ }

  let folderUrl;
  const tried = new Set();

  if (bestHref) {
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
      const html = await proxiedFetch(folderUrl);
      const result = parseFolderListing(html, folderUrl);
      if (result.videos.length || result.folders.length) return result;
    } catch (_) { /* fall through to candidates */ }
  }

  const candidates = buildCandidateUrls(baseUrl, title, year, mediaType);
  for (const candidate of candidates) {
    if (tried.has(candidate)) continue;
    tried.add(candidate);
    try {
      const html = await proxiedFetch(candidate);
      const result = parseFolderListing(html, candidate);
      if (result.videos.length || result.folders.length) return result;
    } catch (_) { /* try next */ }
  }

  throw new Error(
    `"${title}" (${year || '?'}) not found on index.\nTry a direct URL instead.`
  );
}

// ── Quality helpers ──────────────────────────────────────────────────────────
export function detectQuality(filename) {
  const f = filename.toLowerCase();
  if (/2160p|4k|uhd/.test(f)) return '4K';
  if (/1080p/.test(f)) return '1080p';
  if (/720p/.test(f)) return '720p';
  if (/480p/.test(f)) return '480p';
  if (/360p/.test(f)) return '360p';
  return null;
}

function fileScore(name) {
  const n = name.toLowerCase();
  let score = 0;
  if (n.includes('remux')) score += 1000;
  if (n.includes('part00')) score += 2000;
  if (n.includes('web-dl')) score -= 20;
  if (n.includes('webrip')) score -= 10;
  if (/h\.264|h264|x264/.test(n)) score -= 15;
  if (/x265|hevc/.test(n)) score += 5;
  if (n.includes('av1')) score += 10;
  if (/atmos|truehd/.test(n)) score += 5;
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

// ── Master resolver — 3 tiers ────────────────────────────────────────────────
/**
 * Resolves a TMDB item to a list of direct video files.
 * @param {object} params
 * @param {string} params.tmdbId
 * @param {string} params.mediaType  'movie' | 'tv'
 * @param {string} [params.title]    pre-fetched title (avoids extra TMDB call)
 * @param {string} [params.year]     pre-fetched year
 * @returns {Promise<{ folders: object[], videos: object[], source: string }>}
 */
export async function resolveTitle({ tmdbId, mediaType, title, year }) {
  // If title/year not provided, fetch from TMDB
  if (!title || !year) {
    const details = await fetchTmdbDetails(tmdbId, mediaType);
    if (details) {
      title = details.title || details.name || title;
      const dateField = details.release_date || details.first_air_date || '';
      year = year || dateField.slice(0, 4);
    }
  }

  if (!title) throw new Error('Could not determine title for TMDB ID ' + tmdbId);

  // ── Tier 1: Supabase ──────────────────────────────────────────────────────
  const supaUrl = await supaFetch(tmdbId, mediaType);
  if (supaUrl) {
    const safe = safeUrl(supaUrl);
    if (VID_RE.test(decodeURIComponent(safe.split('?')[0]))) {
      const name = decodeURIComponent(safe.split('/').pop().split('?')[0]);
      return { folders: [], videos: [{ name, url: safe }], source: '⚡ database' };
    }
    try {
      const folderUrl = safe.endsWith('/') ? safe : safe + '/';
      const html = await proxiedFetch(folderUrl);
      const result = parseFolderListing(html, folderUrl);
      if (result.videos.length || result.folders.length) {
        return { ...result, source: '⚡ database' };
      }
    } catch (_) { /* fall through */ }
  }

  // ── Tier 2+3: Index scraper ───────────────────────────────────────────────
  const result = await scrapeIndex(title, year, mediaType);
  if (result.videos.length || result.folders.length) {
    return { ...result, source: '📁 index' };
  }

  throw new Error(
    `"${title}" (${year || '?'}) not found.\nTry pasting a direct URL.`
  );
}
