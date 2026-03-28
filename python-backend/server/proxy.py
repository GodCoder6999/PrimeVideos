"""Stream proxy logic — fetch remote streams and rewrite M3U8 manifests."""
import re
from urllib.parse import urlparse
import httpx
from fastapi import Request
from fastapi.responses import Response, StreamingResponse
from core.m3u8_parser import rewrite_m3u8
from config import USER_AGENT, DEFAULT_TIMEOUT

# Internal/reserved IP ranges that must never be proxied (SSRF protection)
_BLOCKED_HOSTS = re.compile(
    r'^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|::1|0\.0\.0\.0)',
    re.IGNORECASE,
)


def _is_safe_url(url: str) -> bool:
    """Return True only for external HTTP(S) URLs to prevent SSRF."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        host = parsed.hostname or ""
        if _BLOCKED_HOSTS.match(host):
            return False
        return True
    except Exception:
        return False


def _proxy_base(request: Request) -> str:
    """Build the proxy base URL for M3U8 rewriting."""
    base = str(request.base_url).rstrip("/")
    return f"{base}/proxy/stream?url="


async def proxy_stream(url: str, referer: str, request: Request) -> Response:
    """
    Proxy a remote stream URL through the server.
    - For M3U8 manifests: fetch, rewrite segment URLs, return text.
    - For everything else: stream bytes directly.
    """
    if not url:
        return Response(content="Missing url parameter", status_code=400)

    if not _is_safe_url(url):
        return Response(content="Invalid or disallowed URL", status_code=400)

    is_m3u8 = ".m3u8" in url.lower()

    headers: dict[str, str] = {
        "User-Agent": USER_AGENT,
        "Referer": referer or (urlparse(url).scheme + "://" + urlparse(url).netloc + "/"),
    }
    if request.headers.get("range"):
        headers["Range"] = request.headers["range"]

    try:
        if is_m3u8:
            async with httpx.AsyncClient(
                timeout=DEFAULT_TIMEOUT,
                follow_redirects=True,
                headers=headers,
            ) as client:
                r = await client.get(url)
                r.raise_for_status()

            proxy_base = _proxy_base(request)
            rewritten = rewrite_m3u8(r.text, url, proxy_base)
            return Response(
                content=rewritten,
                media_type="application/vnd.apple.mpegurl",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache",
                },
            )
        else:
            # Stream binary content
            async def _stream_generator():
                async with httpx.AsyncClient(
                    timeout=DEFAULT_TIMEOUT,
                    follow_redirects=True,
                    headers=headers,
                ) as client:
                    async with client.stream("GET", url) as r:
                        r.raise_for_status()
                        async for chunk in r.aiter_bytes(chunk_size=65536):
                            yield chunk

            resp_headers = {"Access-Control-Allow-Origin": "*"}
            return StreamingResponse(
                _stream_generator(),
                headers=resp_headers,
            )

    except httpx.HTTPStatusError as exc:
        return Response(
            content=f"Upstream error: {exc.response.status_code}",
            status_code=exc.response.status_code,
        )
    except Exception as exc:
        return Response(content=f"Proxy error: {exc}", status_code=500)

