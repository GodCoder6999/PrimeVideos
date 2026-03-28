"""Stream URL extraction utilities."""
import re


# Regexes for finding stream URLs in HTML / JavaScript
_M3U8_RE = re.compile(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*')
_MP4_RE = re.compile(r'https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*')
_BASE64_RE = re.compile(r'[A-Za-z0-9+/]{40,}={0,2}')


def extract_m3u8_urls(text: str) -> list[str]:
    """Find all M3U8 URLs in arbitrary text."""
    return list(dict.fromkeys(_M3U8_RE.findall(text)))


def extract_mp4_urls(text: str) -> list[str]:
    """Find all MP4 URLs in arbitrary text."""
    return list(dict.fromkeys(_MP4_RE.findall(text)))


def extract_stream_urls(text: str) -> list[tuple[str, str]]:
    """
    Return a list of (url, stream_type) tuples found in text.
    Stream type is 'hls' for M3U8, 'mp4' for MP4.
    """
    results: list[tuple[str, str]] = []
    for url in extract_m3u8_urls(text):
        results.append((url, "hls"))
    for url in extract_mp4_urls(text):
        results.append((url, "mp4"))
    return results


def detect_quality(text: str) -> str:
    """Infer quality label from a stream name / description."""
    t = text.lower()
    if re.search(r'\b(?:2160p?|4k|uhd)\b', t):
        return "4K"
    if re.search(r'\b1080p?\b', t):
        return "1080p"
    if re.search(r'\b720p?\b', t):
        return "720p"
    if re.search(r'\b480p?\b', t):
        return "480p"
    return "Auto"


def detect_language(text: str, source_name: str = "") -> str:
    """Infer language label from a stream name / description."""
    t = text.lower()

    if re.search(r'\b(?:multi[\s\-]?audio|multi[\s\-]?lang(?:uage)?|multilingual)\b', t):
        return "Multi Audio"
    if re.search(r'\b(?:dual[\s\-]?audio|dual[\s\-]?lang(?:uage)?)\b', t):
        return "Dual Audio"

    PATTERNS = [
        ("Hindi",     re.compile(r'\b(?:hindi|hin)\b')),
        ("Tamil",     re.compile(r'\b(?:tamil|tam)\b')),
        ("Telugu",    re.compile(r'\b(?:telugu|tel)\b')),
        ("Bengali",   re.compile(r'\b(?:bengali|bangla|ben)\b')),
        ("Malayalam", re.compile(r'\b(?:malayalam|mal)\b')),
        ("Kannada",   re.compile(r'\b(?:kannada|kan)\b')),
        ("Marathi",   re.compile(r'\b(?:marathi|mar)\b')),
        ("Punjabi",   re.compile(r'\b(?:punjabi|pun)\b')),
        ("English",   re.compile(r'\b(?:english|eng)\b')),
    ]

    found = [lang for lang, pat in PATTERNS if pat.search(t)]
    if len(found) >= 3:
        return "Multi Audio"
    if len(found) == 2:
        return f"{found[0]} + {found[1]}"
    if len(found) == 1:
        return found[0]

    # Source heuristic fallback
    src = source_name.lower()
    if any(x in src for x in ("vidsrc", "moviesapi", "autoembed", "embedsu")):
        return "English"
    return "English"
