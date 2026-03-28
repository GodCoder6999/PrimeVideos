"""Base provider interface."""
from abc import ABC, abstractmethod
from typing import Optional
from core.models import StreamInfo


class BaseProvider(ABC):
    name: str = "BaseProvider"
    enabled: bool = True

    @abstractmethod
    async def fetch_streams(
        self,
        tmdb_id: str,
        media_type: str,
        season: Optional[int] = None,
        episode: Optional[int] = None,
        imdb_id: Optional[str] = None,
    ) -> list[StreamInfo]:
        """Fetch available streams and return a list of StreamInfo objects."""
        ...

    def _make_proxy_url(self, stream_url: str, referer: str = "") -> str:
        """Wrap a raw stream URL with the local proxy endpoint."""
        from urllib.parse import quote
        base = f"/proxy/stream?url={quote(stream_url, safe='')}"
        if referer:
            base += f"&referer={quote(referer, safe='')}"
        return base
