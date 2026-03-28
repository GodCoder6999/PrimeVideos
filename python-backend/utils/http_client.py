"""HTTP client with retry logic."""
import asyncio
import httpx
from config import USER_AGENT


async def fetch_with_retry(
    url: str,
    headers: dict | None = None,
    timeout: int = 12,
    retries: int = 2,
    referer: str | None = None,
) -> httpx.Response:
    """Fetch a URL with automatic retries on transient errors."""
    base_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "*/*",
    }
    if referer:
        base_headers["Referer"] = referer
    if headers:
        base_headers.update(headers)

    last_exc: Exception = RuntimeError("No attempts made")
    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
        headers=base_headers,
    ) as client:
        for attempt in range(retries + 1):
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp
            except (httpx.HTTPStatusError, httpx.RequestError) as exc:
                last_exc = exc
                if attempt < retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
    raise last_exc
