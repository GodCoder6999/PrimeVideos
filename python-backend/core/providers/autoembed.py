"""autoembed.cc provider."""
import re
from typing import Optional
import httpx
from core.providers.base import BaseProvider
from core.models import StreamInfo
from utils.extractor import detect_quality, detect_language
from config import USER_AGENT, PROVIDER_TIMEOUT


class AutoEmbedProvider(BaseProvider):
    name = "AutoEmbed"
    BASE = "https://autoembed.cc"

    async def fetch_streams(
        self,
        tmdb_id: str,
        media_type: str,
        season: Optional[int] = None,
        episode: Optional[int] = None,
        imdb_id: Optional[str] = None,
    ) -> list[StreamInfo]:
        if media_type == "tv" and season and episode:
            url = f"{self.BASE}/embed/tv/{tmdb_id}/{season}/{episode}"
        else:
            url = f"{self.BASE}/embed/movie/{tmdb_id}"

        try:
            async with httpx.AsyncClient(
                timeout=PROVIDER_TIMEOUT,
                follow_redirects=True,
                headers={"User-Agent": USER_AGENT, "Referer": self.BASE + "/"},
            ) as client:
                r = await client.get(url)
                html = r.text

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
