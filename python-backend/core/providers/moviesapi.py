"""moviesapi.club provider."""
import re
import json
from typing import Optional
import httpx
from core.providers.base import BaseProvider
from core.models import StreamInfo
from utils.extractor import detect_quality, detect_language
from config import USER_AGENT, PROVIDER_TIMEOUT


class MoviesApiProvider(BaseProvider):
    name = "MoviesAPI"
    BASE = "https://moviesapi.club"

    async def fetch_streams(
        self,
        tmdb_id: str,
        media_type: str,
        season: Optional[int] = None,
        episode: Optional[int] = None,
        imdb_id: Optional[str] = None,
    ) -> list[StreamInfo]:
        if media_type == "tv" and season and episode:
            url = f"{self.BASE}/tv/{tmdb_id}/{season}/{episode}"
        else:
            url = f"{self.BASE}/movie/{tmdb_id}"

        try:
            async with httpx.AsyncClient(
                timeout=PROVIDER_TIMEOUT,
                follow_redirects=True,
                headers={"User-Agent": USER_AGENT, "Referer": self.BASE + "/"},
            ) as client:
                r = await client.get(url)
                html = r.text

            # MoviesAPI often embeds stream data as JSON in the HTML
            # Try to find sources array first
            sources_match = re.search(
                r'"sources"\s*:\s*(\[.*?\])', html, re.DOTALL
            )
            m3u8_urls: list[str] = []

            if sources_match:
                try:
                    sources = json.loads(sources_match.group(1))
                    for src in sources:
                        file_url = src.get("file") or src.get("url") or src.get("src", "")
                        if file_url:
                            m3u8_urls.append(file_url)
                except (json.JSONDecodeError, AttributeError):
                    pass

            if not m3u8_urls:
                m3u8_urls = re.findall(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html)

            streams = []
            for raw_url in dict.fromkeys(m3u8_urls):
                streams.append(StreamInfo(
                    url=self._make_proxy_url(raw_url, self.BASE + "/"),
                    quality=detect_quality(raw_url),
                    language=detect_language(raw_url, self.name),
                    source=self.name,
                    type="hls",
                    rawName=raw_url[:80],
                ))
            return streams
        except Exception:
            return []
