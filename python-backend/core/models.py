from typing import Optional, List
from pydantic import BaseModel


class StreamInfo(BaseModel):
    url: str
    quality: str = "Auto"
    language: str = "English"
    source: str = "Unknown"
    type: str = "hls"  # "hls" or "mp4"
    rawName: str = ""


class MultiStreamResponse(BaseModel):
    success: bool
    count: int = 0
    imdbId: Optional[str] = None
    streams: List[StreamInfo] = []
    subtitles: list = []
    audioTracks: list = []
    error: Optional[str] = None


class SearchResult(BaseModel):
    id: int
    title: str
    overview: str = ""
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    media_type: str = "movie"
    release_date: Optional[str] = None
    vote_average: float = 0.0


class MediaDetails(BaseModel):
    id: int
    title: str
    overview: str = ""
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    release_date: Optional[str] = None
    vote_average: float = 0.0
    genres: list = []
    runtime: Optional[int] = None
    number_of_seasons: Optional[int] = None


class ProviderStatus(BaseModel):
    name: str
    enabled: bool
    last_checked: Optional[str] = None
