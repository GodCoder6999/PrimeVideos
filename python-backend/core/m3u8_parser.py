"""M3U8 playlist parsing and URL rewriting utilities."""
from urllib.parse import urljoin, urlparse, urlencode


def resolve_uri(uri: str, base_url: str) -> str:
    """Resolve a potentially relative URI against a base URL."""
    uri = uri.strip()
    if uri.startswith("http://") or uri.startswith("https://"):
        return uri
    return urljoin(base_url, uri)


def rewrite_m3u8(content: str, original_url: str, proxy_base: str) -> str:
    """
    Rewrite all segment/key URLs in an M3U8 playlist so they route through
    the proxy endpoint, avoiding browser CORS restrictions.

    proxy_base: e.g. "/proxy/stream?url="
    """
    lines = content.splitlines()
    out: list[str] = []

    for line in lines:
        stripped = line.strip()

        if not stripped:
            out.append(line)
            continue

        if stripped.startswith("#"):
            # Rewrite URI="..." attributes (e.g. #EXT-X-KEY, #EXT-X-MAP)
            rewritten = _rewrite_tag_uris(stripped, original_url, proxy_base)
            out.append(rewritten)
        else:
            # Segment URL (relative or absolute)
            abs_url = resolve_uri(stripped, original_url)
            out.append(f"{proxy_base}{_encode(abs_url)}")

    return "\n".join(out)


def _rewrite_tag_uris(tag_line: str, base_url: str, proxy_base: str) -> str:
    """Replace URI="..." values inside an M3U8 tag line."""
    import re

    def replace_uri(match: re.Match) -> str:
        uri = match.group(1)
        abs_url = resolve_uri(uri, base_url)
        return f'URI="{proxy_base}{_encode(abs_url)}"'

    return re.sub(r'URI="([^"]+)"', replace_uri, tag_line)


def _encode(url: str) -> str:
    from urllib.parse import quote
    return quote(url, safe="")
